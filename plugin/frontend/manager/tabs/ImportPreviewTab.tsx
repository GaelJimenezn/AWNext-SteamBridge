import { useEffect, useRef, useState } from 'react';
import { discoveryLibrary, type DiscoveryLibrary } from '../../core/discovery-service';
import { subscribeIdentityChanges } from '../../core/identity-service';
import { simulateShortcuts, type ShortcutSimulation } from '../../core/shortcut-service';
import { importPreview, selectedPreview } from '../../core/import-preview';

export function ImportPreviewTab() {
  const [data, setData] = useState<DiscoveryLibrary | null>(null);
  const [selection, setSelection] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [simulation, setSimulation] = useState<ShortcutSimulation | null>(null);
  const [simulating, setSimulating] = useState(false);
  const request = useRef(0);
  const simulationRequest = useRef(0);
  function discardSimulation() { simulationRequest.current++; setSimulating(false); setSimulation(null); }
  useEffect(() => { void load(); const unsubscribe = subscribeIdentityChanges(() => { void load(); }); return () => { request.current++; simulationRequest.current++; unsubscribe(); }; }, []);
  async function load() {
    const current = ++request.current;
    setBusy(true); setError(''); setData(null); setSelection([]); discardSimulation();
    try { const next = await discoveryLibrary(); if (request.current === current) setData(next); }
    catch (err) { if (request.current === current) setError(String(err)); }
    finally { if (request.current === current) setBusy(false); }
  }
  const plan = data ? importPreview(data) : null;
  const selected = plan ? selectedPreview(plan, selection) : [];
  async function simulate() {
    if (!plan) return;
    const current = ++simulationRequest.current;
    setSimulating(true); setError(''); setSimulation(null);
    try { const value = await simulateShortcuts(plan.revision, selected); if (simulationRequest.current === current) setSimulation(value); }
    catch (err) { if (simulationRequest.current === current) setError(String(err)); }
    finally { if (simulationRequest.current === current) setSimulating(false); }
  }
  return <div>
    <h2>Previsualización de importación</h2>
    <p>Revisa primero los proveedores en Discovery. Esta pantalla no crea accesos ni colecciones y no ejecuta juegos. Las selecciones son temporales y se descartan al salir o actualizar.</p>
    <p>Integración dentro de Steam pendiente. Solo se permiten operaciones simuladas; las escrituras reales no están implementadas.</p>
    <button type="button" disabled={busy} onClick={() => void load()}>{busy ? 'Consultando…' : 'Actualizar previsualización y descartar selección'}</button>
    {error && <p role="alert">{error}</p>}
    {data && <p>Revisión Discovery: {data.revision} · Cuenta del inventario: {data.steamInventory?.account ?? 'desconocida'} ({data.steamInventory?.accountSource ?? 'fuente desconocida'}) · Solo accesos persistidos; biblioteca nativa y estado en memoria sin validar.</p>}
    {plan && <>
      <p>{plan.items.length} instalaciones u observaciones · {selected.length} seleccionadas para revisión.</p>
      <button type="button" onClick={() => { discardSimulation(); setSelection(plan.items.filter(item => item.selectable).map(item => item.key)); }}>Seleccionar instalaciones confirmadas para revisar</button>{' '}
      <button type="button" onClick={() => { discardSimulation(); setSelection([]); }}>Descartar selección</button>
      <button type="button" disabled={busy || simulating || !selected.length || selected.length > 100} onClick={() => void simulate()}>{simulating ? 'Simulando…' : 'Simular propuesta (sin guardar ni importar)'}</button>
      {simulation && <div role="status"><h3>Resultado simulado</h3><p>No se guardó ningún registro personal ni se llamó a Steam. Descartar revierte únicamente esta vista.</p>
        {simulation.plan.proposals.map(proposal => <div key={proposal.key}><p>{proposal.name} · Compatibilidad con el launcher: sin verificar. Reversión propuesta: conservar cambios manuales y retirar únicamente el acceso propio sin modificaciones.</p>{proposal.blockers.map(reason => <p key={reason}>{reason}</p>)}</div>)}
        {simulation.results.map(result => <p key={result.key}>{result.status === 'would_create' ? 'Creación simulada; lanzamiento e integración siguen pendientes' : 'Conservado o bloqueado'} · {result.reasons.join(', ')}</p>)}
      </div>}
      <p>Seleccionar un juego no confirma que pueda importarse. La aprobación de esta vista no ejecuta ninguna operación.</p>
      {plan.items.map(item => <section key={item.key} style={{ padding: 14, marginTop: 12, background: '#192f40', overflowWrap: 'anywhere' }}>
        <label><input type="checkbox" disabled={!item.selectable} checked={selection.includes(item.key)} onChange={event => { discardSimulation(); const checked = event.target.checked; setSelection(old => checked ? [...old, item.key] : old.filter(key => key !== item.key)); }} /> {item.record.name} · {item.platform}</label>
        <p>Identidad de proveedor: {item.record.provider}:{item.record.providerId}</p>
        <p>Ruta: {item.installation?.path ?? 'Desconocida'} · Instalación: {item.installation?.status ?? 'unknown'}</p>
        <p>Lanzamiento: {item.installation?.launch ? `${item.installation.launch.kind}: ${item.installation.launch.target}` : 'No disponible'}</p>
        <p>Licencia observada: {item.record.licenses.map(license => `${license.type} (${license.entitlement})`).join(', ') || 'Desconocida'}</p>
        <p>En Steam: {item.existing === 'manual_reference' ? 'Referencia manual existente' : item.existing === 'possible' ? 'Posible coincidencia' : 'Sin confirmar'} · Riesgo: {item.risk === 'conflict' ? 'Conflicto' : item.risk === 'related' ? 'Coincidencias para revisar' : 'Desconocido'}</p>
        <p>Accesos relacionados: {item.record.shortcuts.map(ref => `${ref.appid} (${ref.kind})`).join(', ') || 'Ninguno observado; no confirma ausencia'}</p>
        <p>Colección sugerida: {item.collection ?? 'Sin evidencia suficiente'} (no se crea)</p>
        <p>Comprobación del proveedor: {item.record.lastChecked}</p>
        <details><summary>Evidencia y explicación</summary>
          {item.reasons.map(reason => <p key={reason}>{reason}</p>)}
          {item.record.evidence.map((evidence, index) => <p key={index}>{evidence.kind}: {evidence.source}</p>)}
          {item.record.identity.candidates.map(candidate => <p key={candidate.id}>Candidato: {candidate.name} ({candidate.id})</p>)}
          {item.record.identity.conflicts.map(conflict => <p key={conflict.id}>Conflicto: {conflict.name} ({conflict.id}) · {conflict.blockers.join(', ')}</p>)}
        </details>
      </section>)}
      {!plan.items.length && <p>No hay observaciones. Refresca los proveedores en Discovery; no se interpretará una ausencia como una eliminación.</p>}
    </>}
  </div>;
}
