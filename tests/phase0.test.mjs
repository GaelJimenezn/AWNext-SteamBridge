import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { root, inventory, sha256 } from '../scripts/source-inventory.mjs';

const read = p => readFileSync(p, 'utf8');
const fixture = resolve(root, 'tests/fixtures/legacy-config.json');
test('the complete baseline iconMap is pinned independently of personal configuration', () => {
  const config = JSON.parse(read(fixture));
  const game = config.games['2545026989'];
  assert.equal(game.titleId, '4D5309C9');
  const canonical = JSON.stringify(Object.fromEntries(Object.entries(game.iconMap).sort(([a], [b]) => a.localeCompare(b))));
  assert.equal(sha256(canonical), '233d415a5fe8d4a630fda50b87e05af1f06d9e52df675c68357e004fc93cd494');
});
function setup(t) {
  const dir = mkdtempSync(join(tmpdir(), 'library-customizer-phase0-'));
  t.after(() => { assert.ok(dir.startsWith(join(tmpdir(), 'library-customizer-phase0-'))); rmSync(dir, { recursive: true }); });
  const steam = join(dir, 'Steam'), appdata = join(dir, 'AppData');
  const plugins = join(steam, 'millennium/plugins');
  mkdirSync(plugins, { recursive: true });
  mkdirSync(join(steam, 'millennium/config'), { recursive: true });
  writeFileSync(join(steam, 'steam.exe'), 'fixture');
  const activation = enabled => writeFileSync(join(steam, 'millennium/config/config.json'), JSON.stringify({ plugins: { enabledPlugins: enabled } }));
  activation([]);
  const oldConfig = join(plugins, 'org.awnext.steambridge.config.json');
  const newConfig = join(plugins, 'library-customizer.config.json');
  writeFileSync(oldConfig, read(fixture));
  const secret = join(appdata, 'AWNext-SteamBridge/secrets/steamgriddb.bin');
  mkdirSync(resolve(secret, '..'), { recursive: true });
  writeFileSync(secret, Buffer.from([0, 1, 2, 255, 128, 42]));
  writeFileSync(join(appdata, 'AWNext-SteamBridge/preferences.json'), '{"theme":"legacy","unknown":42}');
  mkdirSync(join(appdata, 'AWNext-SteamBridge/artwork-backups/fixture'), { recursive: true });
  writeFileSync(join(appdata, 'AWNext-SteamBridge/artwork-backups/fixture/old.png'), 'fixture image');
  const run = (script, ...args) => spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(root, 'scripts', script), '-SteamRoot', steam, ...args], { encoding: 'utf8' });
  return { dir, steam, appdata, plugins, oldConfig, newConfig, secret, activation, run };
}

test('all local dependencies resolve and removed component symbols are absent', () => {
  const data = inventory();
  const banned = /\b(AppearanceTab|SourcesTab|ManagerTabs|ManagerTabDefinition|ManagerSection|ManagerTab)\b|managerStyles\.(section|navigation|button)\b/;
  for (const m of data.modules.filter(m => m.file.startsWith('plugin/'))) {
    assert.doesNotMatch(read(resolve(root, m.file)), banned, m.file);
  }
  const reachable = new Set();
  const visit = file => {
    if (reachable.has(file)) return;
    reachable.add(file);
    const item = data.modules.find(m => m.file === file);
    for (const dep of item?.dependencies ?? []) {
      if (!dep.startsWith('.')) continue;
      const base = resolve(root, file, '..', dep);
      const target = data.modules.find(m => [base + '.ts', base + '.tsx', join(base, 'index.ts')].includes(resolve(root, m.file)));
      if (target) visit(target.file);
    }
  };
  visit('plugin/frontend/index.tsx');
  const orphan = data.modules.filter(m => m.file.startsWith('plugin/frontend/') && /\.tsx?$/.test(m.file) && !reachable.has(m.file));
  assert.deepEqual(orphan, []);
});

test('preview/WhatIf are read-only; migration retains all 50 icons and unknown fields byte-for-byte', t => {
  const x = setup(t);
  for (const flags of [[], ['-Apply', '-WhatIf']]) {
    const r = x.run('migrate-local.ps1', '-AppDataRoot', x.appdata, ...flags);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(existsSync(x.newConfig), false);
  }
  const r = x.run('migrate-local.ps1', '-AppDataRoot', x.appdata, '-Apply');
  assert.equal(r.status, 0, r.stderr);
  assert.equal(read(x.newConfig), read(x.oldConfig));
  assert.equal(Object.keys(JSON.parse(read(x.newConfig)).games['2545026989'].iconMap).length, 50);
  assert.deepEqual(readFileSync(join(x.appdata, 'library-customizer/secrets/steamgriddb.bin')), readFileSync(x.secret));
  assert.equal(read(join(x.appdata, 'library-customizer/preferences.json')), '{"theme":"legacy","unknown":42}');
  assert.equal(read(join(x.appdata, 'library-customizer/artwork-backups/fixture/old.png')), 'fixture image');
  assert.equal(x.run('migrate-local.ps1', '-AppDataRoot', x.appdata, '-Apply').status, 0);
});

test('conflicting destination aborts before any copy; malformed source is rejected', t => {
  const x = setup(t);
  writeFileSync(x.newConfig, '{"games":{}}');
  assert.notEqual(x.run('migrate-local.ps1', '-AppDataRoot', x.appdata, '-Apply').status, 0);
  assert.equal(read(x.newConfig), '{"games":{}}');
  assert.equal(existsSync(join(x.appdata, 'library-customizer')), false);
  writeFileSync(x.oldConfig, '{broken');
  assert.notEqual(x.run('migrate-local.ps1', '-AppDataRoot', x.appdata, '-Apply').status, 0);
});

test('installation blocks legacy activation and preserves both old package and data', t => {
  const x = setup(t);
  const old = join(x.plugins, 'org.awnext.steambridge.star');
  writeFileSync(old, 'legacy package fixture');
  x.activation(['org.awnext.steambridge', 'aw-next', 'game-data-linker']);
  const r = x.run('install-local.ps1', '-Apply');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Disable org.awnext.steambridge/);
  assert.equal(existsSync(join(x.plugins, 'library-customizer.star')), false);
  assert.equal(read(old), 'legacy package fixture');
});

test('install/uninstall use verified identity, never overwrite, and preserve data and other plugins', t => {
  const x = setup(t);
  writeFileSync(join(x.plugins, 'aw-next-fixture'), 'external');
  const preview = x.run('install-local.ps1');
  assert.equal(preview.status, 0, preview.stderr);
  assert.equal(existsSync(join(x.plugins, 'library-customizer.star')), false);
  const whatIf = x.run('install-local.ps1', '-Apply', '-WhatIf');
  assert.equal(whatIf.status, 0, whatIf.stderr);
  assert.equal(existsSync(join(x.plugins, 'library-customizer.star')), false);
  let r = x.run('install-local.ps1', '-Apply');
  assert.equal(r.status, 0, r.stderr);
  const target = join(x.plugins, 'library-customizer.star');
  assert.equal(sha256(readFileSync(target)), sha256(readFileSync(resolve(root, 'artifacts/library-customizer/library-customizer.star'))));
  x.activation(['library-customizer']);
  assert.notEqual(x.run('uninstall-local.ps1', '-Apply').status, 0);
  x.activation([]);
  writeFileSync(target, 'unrecognized');
  assert.notEqual(x.run('install-local.ps1', '-Apply').status, 0);
  assert.notEqual(x.run('uninstall-local.ps1', '-Apply').status, 0);
  writeFileSync(target, readFileSync(resolve(root, 'artifacts/library-customizer/library-customizer.star')));
  r = x.run('uninstall-local.ps1', '-Apply');
  assert.equal(r.status, 0, r.stderr);
  assert.equal(existsSync(target), false);
  assert.equal(read(x.oldConfig), read(fixture));
  assert.equal(read(join(x.plugins, 'aw-next-fixture')), 'external');
});

test('personal mapping equals sanitized protected fixture when available (read only)', t => {
  const path = resolve(root, 'plugin/bridge-config.json');
  if (!existsSync(path)) { t.skip('Personal configuration unavailable'); return; }
  const actual = JSON.parse(read(path)).games['2545026989'];
  const expected = JSON.parse(read(fixture)).games['2545026989'];
  assert.equal(actual.titleId, expected.titleId);
  assert.equal(actual.adapter, expected.adapter);
  assert.equal(actual.profile, expected.profile);
  assert.deepEqual(actual.iconMap, expected.iconMap);
});
