import test from 'node:test';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from '../plugin/node_modules/typescript/lib/typescript.js';
const root = resolve(import.meta.dirname, '..');
const source = readFileSync(resolve(root, 'plugin/frontend/core/import-preview.ts'), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { importPreview, selectedPreview } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
function fixture() {
  return { ok: true, readOnly: true, revision: 4, steamInventory: { available: true, liveVerified: false }, providers: [{
    id: 'epic', name: 'Epic Games', status: 'ready', records: [{
      id: 'epic:1', provider: 'epic', providerId: '1', name: 'Shared Game', installed: 'installed', lastChecked: 'fixture',
      installations: [{ id: 'epic:1:install', path: 'C:/Game', status: 'installed', launch: { kind: 'executable', target: 'C:/Game/Game.exe', verified: true } }],
      licenses: [{ type: 'unknown', entitlement: 'unknown' }], evidence: [], shortcuts: [], identity: { candidates: [], conflicts: [] },
    }], errors: [], limitations: [] }] };
}
const row = data => data.providers[0].records[0];
test('preview preserves separate concepts and never claims absence from Steam', () => {
  const data = fixture(), before = JSON.stringify(data), plan = importPreview(data), item = plan.items[0];
  assert.equal(plan.writesEnabled, false); assert.equal(item.existing, 'unknown'); assert.equal(item.risk, 'unknown');
  assert.equal(item.collection, 'Epic Games'); assert.equal(item.record.licenses[0].type, 'unknown');
  assert.match(item.reasons.join(' '), /ejecución.*no está validada/); assert.equal(JSON.stringify(data), before);
});
test('manual associations are distinguished from title candidates without claiming launch equivalence', () => {
  const data = fixture(); row(data).shortcuts = [{ appid: '2545026989', kind: 'candidate' }];
  assert.equal(importPreview(data).items[0].existing, 'possible');
  row(data).shortcuts[0].kind = 'manual_reference';
  assert.equal(importPreview(data).items[0].existing, 'manual_reference');
  assert.match(importPreview(data).items[0].reasons.join(' '), /no implica/);
});
test('shared-engine conflicts propagate rather than being matched again in JavaScript', () => {
  const data = fixture(); row(data).identity.conflicts = [{ id: 'MWII', name: 'MWII', blockers: ['installment_mismatch'] }];
  const item = importPreview(data).items[0]; assert.equal(item.risk, 'conflict');
  assert.deepEqual(item.record.identity.conflicts[0].blockers, ['installment_mismatch']);
  assert.doesNotMatch(source, /normalize|toLowerCase|RegExp|\.match\(/);
});
test('uninstalled, unknown, unresolved and stale observations are excluded from selection', () => {
  for (const status of ['not_installed', 'unknown']) {
    const data = fixture(); row(data).installations[0].status = status;
    const plan = importPreview(data); assert.deepEqual(selectedPreview(plan, [plan.items[0].key]), []);
  }
  const data = fixture(); data.providers[0].stale = true; assert.equal(importPreview(data).items[0].selectable, false);
  data.providers[0].stale = false; row(data).nameResolved = false; assert.equal(importPreview(data).items[0].selectable, false);
  row(data).installations = []; assert.equal(importPreview(data).items[0].selectable, false);
});
test('repeated preparation is idempotent and deduplicates exact installation keys only', () => {
  const data = fixture(); row(data).installations.push(structuredClone(row(data).installations[0]));
  const plan = importPreview(data); assert.equal(plan.items.length, 1); assert.deepEqual(importPreview(data), plan);
  assert.equal(selectedPreview(plan, [plan.items[0].key, plan.items[0].key]).length, 1);
});
test('different stores and installations survive even when titles coincide', () => {
  const data = fixture(), gog = structuredClone(data.providers[0]); gog.id = 'gog'; gog.name = 'GOG';
  gog.records[0].provider = 'gog'; gog.records[0].providerId = '2';
  data.providers.push(gog); row(data).installations.push({ ...row(data).installations[0], id: 'second', path: 'D:/Game' });
  const plan = importPreview(data); assert.equal(plan.items.length, 3);
  assert.equal(selectedPreview(plan, plan.items.map(item => item.key)).length, 3);
  assert.equal(plan.items[2].collection, 'GOG');
});
test('refresh and deleted observations cannot select stale or fabricated keys; discard has no effects', () => {
  const data = fixture(), old = importPreview(data), keys = [old.items[0].key];
  assert.equal(selectedPreview(old, keys).length, 1); assert.deepEqual(selectedPreview(old, []), []);
  assert.deepEqual(selectedPreview(old, ['fabricated']), []);
  data.providers[0].records = []; data.revision++;
  assert.deepEqual(selectedPreview(importPreview(data), keys), []);
  assert.equal(importPreview(fixture()).revision, old.revision);
});
test('missing Steam inventory and missing launch methods are explicit, never replaced with invented executables', () => {
  const data = fixture(); data.steamInventory.available = false; delete row(data).installations[0].launch;
  const item = importPreview(data).items[0]; assert.equal(item.installation.launch, undefined);
  assert.match(item.reasons.join(' '), /No se pudo leer/); assert.match(item.reasons.join(' '), /no disponible/);
});
test('Xbox is not Game Pass and no speculative Game Pass collection is suggested', () => {
  const data = fixture(); row(data).provider = 'xbox'; assert.equal(importPreview(data).items[0].collection, 'Xbox PC');
  row(data).provider = 'gamepass'; assert.equal(importPreview(data).items[0].collection, undefined);
});
test('preview UI cannot execute, import, delete, persist or rollback Steam objects', () => {
  const ui = readFileSync(resolve(root, 'plugin/frontend/manager/tabs/ImportPreviewTab.tsx'), 'utf8');
  assert.doesNotMatch(source + ui, /SteamClient|AddShortcut|RemoveShortcut|RunGame|localStorage|shortcuts\.vdf|saveIdentity|CreateCollection/);
  assert.match(ui, /setData\(null\); setSelection\(\[\]\)/);
  assert.match(ui, /subscribeIdentityChanges/);
  assert.match(ui, /request.current === current/);
  assert.match(ui, /Descartar selección/);
});

test('rendered preview supports individual/bulk review, discard, identity invalidation and late-response rejection', async () => {
  const text = readFileSync(resolve(root, 'plugin/frontend/manager/tabs/ImportPreviewTab.tsx'), 'utf8');
  const compiled = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const slots = [], effects = []; let cursor = 0, notify, cleanup, response = fixture();
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useRef(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
    useEffect(effect) { if (!effects.length) effects.push(effect); },
  };
  const jsx = (type, props) => ({ type, props }), exports = {};
  const modules = { react, 'react/jsx-runtime': { jsx, jsxs: jsx },
    '../../core/discovery-service': { discoveryLibrary: async () => response },
    '../../core/identity-service': { subscribeIdentityChanges(callback) { notify = callback; return () => { notify = undefined; }; } },
    '../../core/shortcut-service': { simulateShortcuts: async () => ({ ok: true, mode: 'simulation', writesEnabled: false, plan: { proposals: [] }, results: [{ key: 'fixture', status: 'would_create', reasons: [] }] }) },
    '../../core/import-preview': { importPreview, selectedPreview } };
  vm.runInNewContext(compiled, { exports, require(name) { assert.ok(name in modules); return modules[name]; } });
  const render = () => { cursor = 0; return exports.ImportPreviewTab(); };
  const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
  const content = node => typeof node === 'string' || typeof node === 'number' ? String(node) : Array.isArray(node) ? node.map(content).join('') : node && typeof node === 'object' ? content(node.props?.children) : '';
  const flush = () => new Promise(resolve => setImmediate(resolve));
  const click = label => { const button = nodes(render()).find(node => node.type === 'button' && content(node).includes(label)); assert.ok(button, label); button.props.onClick(); };
  render(); cleanup = effects[0](); await flush();
  assert.match(content(render()), /0 seleccionadas/);
  nodes(render()).find(node => node.type === 'input').props.onChange({ target: { checked: true } });
  assert.match(content(render()), /1 seleccionadas/);
  click('Descartar selección'); assert.match(content(render()), /0 seleccionadas/);
  click('Seleccionar instalaciones'); assert.match(content(render()), /1 seleccionadas/);
  click('Simular propuesta'); await flush(); assert.match(content(render()), /Resultado simulado/);
  notify(); assert.doesNotMatch(content(render()), /1 seleccionadas|Resultado simulado/); await flush();
  assert.match(content(render()), /0 seleccionadas/);
  let finish; response = new Promise(resolve => { finish = resolve; });
  click('Actualizar previsualización'); assert.match(content(render()), /Consultando/);
  response = fixture(); response.providers[0].records = []; notify(); await flush();
  assert.match(content(render()), /No hay observaciones/);
  finish(fixture()); await flush(); assert.match(content(render()), /No hay observaciones/);
  cleanup(); assert.equal(notify, undefined);
});
