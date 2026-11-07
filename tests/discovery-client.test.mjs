import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import ts from '../plugin/node_modules/typescript/lib/typescript.js';
const root = resolve(import.meta.dirname, '..');
async function client() {
  const source = readFileSync(resolve(root, 'plugin/frontend/core/discovery-service.ts'), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
  return import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
}
test('discovery transport normalizes Lua collections and refreshes only the requested provider', async () => {
  let requested;
  globalThis.backend = {
    get_discovery_library: async () => ({ ok: true, readOnly: true, revision: 0, providers: {} }),
    refresh_discovery_provider: async provider => { requested = provider; return JSON.stringify({ ok: true, readOnly: true, revision: 1, providers: [{ id: provider, records: [{ id: 'gog:1', installations: {}, licenses: {}, evidence: {}, shortcuts: {}, identity: { candidates: {}, conflicts: {} } }], errors: {}, limitations: {} }] }); },
  };
  const api = await client();
  assert.deepEqual((await api.discoveryLibrary()).providers, []);
  const result = await api.discoveryLibrary('gog');
  assert.equal(requested, 'gog');
  assert.deepEqual(result.providers[0].records[0].installations, []);
  assert.deepEqual(result.providers[0].records[0].identity.candidates, []);
  globalThis.backend.refresh_discovery_provider = async () => ({ ok: false, error: 'source unavailable' });
  await assert.rejects(api.discoveryLibrary('gog'), /source unavailable/);
});
test('Windows metadata resource parses and returns bounded read-only registry metadata', () => {
  const raw = readFileSync(resolve(root, 'plugin/resources/discovery-windows.ps1'), 'utf8').replaceAll('__PROVIDER__', 'ubisoft');
  const encoded = Buffer.from(raw, 'utf16le').toString('base64');
  assert.ok(encoded.length < 30000);
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], { encoding: 'utf8', timeout: 25000 });
  assert.equal(result.status, 0, result.stderr);
  const data = JSON.parse(result.stdout.replace(/^\uFEFF/, ''));
  assert.ok(Array.isArray(data.records));
  assert.ok(Array.isArray(data.errors));
});
test('discovery implementation exposes no mutations, auth stores or unbounded SQL surface', () => {
  for (const name of ['DiscoveryTab.tsx']) {
    const text = readFileSync(resolve(root, 'plugin/frontend/manager/tabs', name), 'utf8');
    assert.doesNotMatch(text, /AddShortcut|RemoveShortcut|CreateCollection|SetCustomArtworkForApp/);
  }
  const script = readFileSync(resolve(root, 'plugin/resources/discovery-windows.ps1'), 'utf8');
  assert.doesNotMatch(script, /Get-Credential|Cookie|Token|Password|Invoke-WebRequest|Invoke-RestMethod|Set-ItemProperty|Add-AppxPackage/i);
  const sqlite = readFileSync(resolve(root, 'plugin/backend/services/discovery/sqlite_catalog.lua'), 'utf8');
  assert.doesNotMatch(sqlite, /SELECT[^\n]*\*|FROM ProductAuthorizations|load_extension|sqlite3_exec/);
  assert.match(sqlite, /immutable=1/);
});
