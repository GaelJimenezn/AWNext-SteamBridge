import { useEffect, useRef, useState } from 'react';
import { probeSteamCapabilities } from '../../core/integration-probe';
export function IntegrationTab() {
  const [report, setReport] = useState('Sin comprobar en este contexto.');
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function check() {
    setBusy(true);
    const parse = (raw: unknown) => typeof raw === 'string' ? JSON.parse(raw) : raw;
    try {
      const status = parse(await (backend as any).get_installation_status());
      const ping = parse(await (backend as any).bridge_ping());
      const discovery = parse(await (backend as any).get_discovery_library());
      if (alive.current) setReport(JSON.stringify({ capabilities: probeSteamCapabilities(), installation: status, rpcPing: ping,
        discovery: { ok: discovery.ok, revision: discovery.revision }, integrationVerdict: 'Pendiente de observación manual y reinicio' }, null, 2));
    } catch (err) { if (alive.current) setReport(`Error de integración: ${String(err)}`); }
    finally { if (alive.current) setBusy(false); }
  }
  return <div><h2>Validación de integración</h2>
    <p>Comprobación de lectura: activación, enlace Lua y presencia de APIs. No instala, activa ni crea objetos. Un método presente no se considera probado.</p>
    <button type="button" disabled={busy} onClick={() => void check()}>{busy ? 'Comprobando…' : 'Comprobar contexto y RPC'}</button>
    <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{report}</pre>
    <ol><li>Confirmar que solo library-customizer está activo entre las dos identidades; conservar el paquete anterior.</li>
      <li>Abrir Games, Discovery, Artwork y Settings; refrescar cada proveedor desde Discovery.</li>
      <li>Revisar MWIII 3531473258 → 3595270 y el conflicto con MWII 1959007243.</li>
      <li>Comprobar x360recomp 2545026989 → 4D5309C9, 50 iconos y 16/70 si no hay progreso nuevo.</li>
      <li>Abrir/cerrar el administrador, navegar y simular selecciones; no deben aparecer accesos nuevos.</li>
      <li>Revisar consola, AWN/GDL y artwork; cerrar y reiniciar Steam manualmente y repetir.</li>
    </ol><p>Guardar asociaciones de prueba requiere respaldo y autorización aparte. Esta pantalla no lo hace.</p>
  </div>;
}
