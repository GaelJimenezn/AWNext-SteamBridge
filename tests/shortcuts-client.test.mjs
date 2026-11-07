import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from '../plugin/node_modules/typescript/lib/typescript.js';
async function module(name) {
  const source = readFileSync(new URL(`../plugin/frontend/core/${name}.ts`, import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
  return import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
}
test('shortcut transport sends IDs only and requires simulation response; no persistence request', async () => {
  let payload, calls = 0;
  globalThis.backend = { simulate_shortcut_import: async raw => { calls++; payload = JSON.parse(raw); return { ok: true, mode: 'simulation', writesEnabled: false, results: {}, plan: { proposals: {} } }; } };
  const { simulateShortcuts } = await module('shortcut-service');
  const item = { selectable: true, record: { id: 'epic:1' }, installation: { id: 'install:1' } };
  const result = await simulateShortcuts(9, [item]);
  assert.deepEqual(payload, { revision: 9, items: [{ recordId: 'epic:1', installationId: 'install:1' }] });
  assert.deepEqual(result.results, []); assert.equal(calls, 1);
  await assert.rejects(simulateShortcuts(9, [])); await assert.rejects(simulateShortcuts(9, [item, { ...item, selectable: false }]));
  globalThis.backend.simulate_shortcut_import = async () => ({ ok: true, mode: 'real', writesEnabled: true });
  await assert.rejects(simulateShortcuts(9, [item]), /inválida/);
});
test('runtime presence probe never invokes shortcut or collection methods or grants write permission', async () => {
  let calls = 0; const trap = () => { calls++; throw new Error('Mutation forbidden'); };
  const { probeSteamCapabilities } = await module('integration-probe');
  const result = probeSteamCapabilities({ SteamClient: { Apps: { AddShortcut: trap, RemoveShortcut: trap } }, collectionStore: { NewUnsavedCollection: trap, GetCollection: trap } });
  assert.equal(calls, 0); assert.equal(result.shortcuts.AddShortcut, 'function');
  assert.equal(result.collections.createCandidate, 'function'); assert.equal(result.runtimeExecutionVerified, false);
  assert.equal(result.writesEnabled, false); assert.equal(probeSteamCapabilities({}).collections.store, 'undefined');
});
test('integration page calls only read RPC and reports manual validation pending', async () => {
  const source = readFileSync(new URL('../plugin/frontend/manager/tabs/IntegrationTab.tsx', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const slots = [], effects = [], calls = []; let cursor = 0;
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = value; }]; },
    useRef(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
    useEffect(effect) { effects.push(effect); },
  };
  const jsx = (type, props) => ({ type, props }), exports = {};
  const modules = { react, 'react/jsx-runtime': { jsx, jsxs: jsx }, '../../core/integration-probe': { probeSteamCapabilities: () => ({ writesEnabled: false }) } };
  const backend = Object.fromEntries(['get_installation_status', 'bridge_ping', 'get_discovery_library'].map(name => [name, async () => { calls.push(name); return JSON.stringify({ ok: true }); }]));
  vm.runInNewContext(js, { exports, backend, require: name => modules[name] });
  const render = () => { cursor = 0; return exports.IntegrationTab(); };
  const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
  render(); const cleanup = effects[0]();
  await nodes(render()).find(node => node.type === 'button').props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, ['get_installation_status', 'bridge_ping', 'get_discovery_library']);
  assert.match(nodes(render()).find(node => node.type === 'pre').props.children, /Pendiente de observación manual y reinicio/);
  cleanup();
});
test('simulation RPC cannot save journals or reach a Steam writer', () => {
  const rpc = readFileSync(new URL('../plugin/backend/rpc_functions.lua', import.meta.url), 'utf8').split('function simulate_shortcut_import')[1];
  assert.doesNotMatch(rpc, /persist_simulation|store.update|AddShortcut|RemoveShortcut|utils.exec/);
  const manager = readFileSync(new URL('../plugin/backend/services/shortcuts/manager.lua', import.meta.url), 'utf8');
  assert.doesNotMatch(manager, /persist_simulation|store.update|AddShortcut|RemoveShortcut|utils.exec/);
  assert.match(manager, /writesEnabled=false/);
});
