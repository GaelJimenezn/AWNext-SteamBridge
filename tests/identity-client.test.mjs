import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import ts from '../plugin/node_modules/typescript/lib/typescript.js';
import vm from 'node:vm';

let sequence = 0;
const projectRoot = resolve(import.meta.dirname, '..');
async function client() {
  const source = readFileSync(new URL('../plugin/frontend/core/identity-service.ts', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}#${sequence++}`);
}

test('identity client sends namespaced references and invalidates only successful mutations', async () => {
  const service = await client();
  const requests = [];
  globalThis.backend = { save_game_identity: async raw => { requests.push(JSON.parse(raw)); return JSON.stringify({ ok: true, revision: 2 }); } };
  let notifications = 0;
  const unsubscribe = service.subscribeIdentityChanges(() => notifications++);
  const library = { writable: true, token: 'original-token', accountId: '1' };
  const entry = { achievementMode: 'awn', providers: { awn: { id: '3595270', source: 'GBE Fork' }, steamgriddb: { id: '900' } } };
  await service.saveIdentity(library, '3531473258', entry);
  assert.equal(requests[0].appid, '3531473258');
  assert.equal(requests[0].token, 'original-token');
  assert.equal(requests[0].entry.providers.awn.id, '3595270');
  assert.equal(requests[0].entry.providers.steamgriddb.id, '900');
  assert.equal(notifications, 1);
  assert.equal(service.identityEpoch(), 1);
  globalThis.backend.save_game_identity = async () => ({ ok: false, conflict: true, error: 'Reload before saving' });
  await assert.rejects(service.saveIdentity(library, '3531473258', entry), /Reload before saving/);
  assert.equal(service.identityEpoch(), 1);
  await assert.rejects(service.saveIdentity({ ...library, writable: false }, '3531473258', entry), /read-only/);
  unsubscribe();
});

test('client normalizes empty Lua collections and delegates provider matching to RPC', async () => {
  const service = await client();
  let payload;
  globalThis.backend = {
    get_identity_library: async () => ({ ok: true, games: {}, awnGames: {} }),
    resolve_identity_provider: async raw => {
      payload = JSON.parse(raw);
      return { ok: true, resolution: { status: 'conflict', candidates: {}, warnings: {} } };
    },
  };
  const library = await service.loadIdentityLibrary([]);
  assert.deepEqual(library.games, []);
  assert.deepEqual(library.awnGames, []);
  const result = await service.resolveProvider('3531473258', 'MWIII', 'steamgriddb', [{ id: 9, name: 'MWII' }]);
  assert.equal(result.status, 'conflict');
  assert.deepEqual(result.candidates, []);
  assert.equal(payload.provider, 'steamgriddb');
  assert.equal(payload.appid, '3531473258');
});

test('client recovery refreshes consumers and listener errors do not report a saved mapping as failed', async () => {
  const service = await client();
  globalThis.backend = { recover_identity_config: async () => ({ ok: true, recovered: true }), save_game_identity: async () => ({ ok: true }) };
  service.subscribeIdentityChanges(() => { throw new Error('synthetic refresh failure'); });
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    await service.recoverIdentity('token');
    assert.equal(service.identityEpoch(), 1);
    await service.saveIdentity({ writable: true, token: 'token', accountId: '1' }, '3531473258', undefined);
    assert.equal(service.identityEpoch(), 2);
  } finally { console.warn = originalWarn; }
});

test('Games identity editor changes one provider without losing other references or port icons', async () => {
  const source = readFileSync(new URL('../plugin/frontend/manager/components/IdentityEditor.tsx', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const slots = [], writes = [];
  let cursor = 0, saved = 0;
  const react = { useState(initial) {
    const index = cursor++;
    if (!(index in slots)) slots[index] = initial;
    return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
  } };
  const jsx = (type, props) => ({ type, props });
  const exports = {};
  const modules = { react, 'react/jsx-runtime': { jsx, jsxs: jsx }, '../../core/identity-service': {
    saveIdentity: async (library, id, entry) => { writes.push({ library, id, entry }); return { ok: true }; },
  } };
  vm.runInNewContext(js, { exports, require: name => { assert.ok(name in modules, name); return modules[name]; } });
  const port = JSON.parse(readFileSync(new URL('fixtures/legacy-config.json', import.meta.url), 'utf8')).games['2545026989'];
  const game = { key: '1:shortcut:2545026989', appid: '2545026989', name: 'Fixture', entry: {}, port,
    providers: { awn: { id: '3595270', source: 'GBE Fork' }, steam: { id: '3595270' }, steamgriddb: { id: '900' }, retro: { id: '700' } } };
  const library = { writable: true, accountId: '1', token: 'token', awnGames: [] };
  const render = () => { cursor = 0; return exports.IdentityEditor({ game, library, saved: () => saved++ }); };
  const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
  const text = tree => typeof tree === 'string' ? tree : Array.isArray(tree) ? tree.map(text).join('') : tree && typeof tree === 'object' ? text(tree.props?.children) : '';
  let tree = render();
  const label = nodes(tree).find(n => n.type === 'label' && text(n) === 'steamgriddb ID');
  assert.ok(label);
  nodes(label).find(n => n.type === 'input').props.onChange({ target: { value: '901' } });
  tree = render();
  nodes(tree).find(n => n.type === 'button' && text(n) === 'Guardar asociación con respaldo').props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(writes[0].id, '2545026989');
  assert.equal(writes[0].entry.providers.steamgriddb.id, '901');
  assert.equal(writes[0].entry.providers.awn.id, '3595270');
  assert.equal(writes[0].entry.providers.retro.id, '700');
  assert.deepEqual(writes[0].entry.port.iconMap, port.iconMap);
  assert.equal(Object.keys(writes[0].entry.port.iconMap).length, 50);
  assert.equal(saved, 1);
  tree = render();
  nodes(tree).find(n => n.type === 'button' && text(n) === 'Restablecer heredado / automático').props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(writes[1].entry, undefined);
  library.writable = false;
  tree = render();
  assert.equal(nodes(tree).find(n => n.type === 'button' && text(n) === 'Guardar asociación con respaldo').props.disabled, true);
});

test('read-only installation check detects both identities without modifying activation', t => {
  const dir = mkdtempSync(join(tmpdir(), 'library-customizer-check-'));
  t.after(() => { assert.ok(dir.startsWith(join(tmpdir(), 'library-customizer-check-'))); rmSync(dir, { recursive: true }); });
  mkdirSync(join(dir, 'millennium/plugins'), { recursive: true });
  mkdirSync(join(dir, 'millennium/config'), { recursive: true });
  writeFileSync(join(dir, 'steam.exe'), 'fixture');
  const activation = JSON.stringify({ plugins: { enabledPlugins: ['org.awnext.steambridge', 'library-customizer'] } });
  const config = join(dir, 'millennium/config/config.json');
  writeFileSync(config, activation);
  const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', resolve(projectRoot, 'scripts/check-installation.ps1'), '-SteamRoot', dir], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Both identities are enabled/);
  assert.equal(readFileSync(config, 'utf8'), activation);
  const backup = join(dir, 'millennium/config/config.before-library-customizer.json');
  const runBackup = (...args) => spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', resolve(projectRoot, 'scripts/backup-activation.ps1'), '-SteamRoot', dir, ...args], { encoding: 'utf8' });
  assert.equal(runBackup().status, 0);
  assert.equal(existsSync(backup), false);
  const copied = runBackup('-Apply');
  assert.equal(copied.status, 0, copied.stderr);
  assert.equal(readFileSync(backup, 'utf8'), activation);
  writeFileSync(backup, 'different existing backup');
  assert.notEqual(runBackup('-Apply').status, 0);
  assert.equal(readFileSync(config, 'utf8'), activation);
});
