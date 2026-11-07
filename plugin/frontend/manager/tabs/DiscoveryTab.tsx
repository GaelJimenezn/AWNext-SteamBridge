import { useEffect, useRef, useState } from 'react';
import { discoveryLibrary, type DiscoveryLibrary } from '../../core/discovery-service';
const button: React.CSSProperties = { padding: '9px 12px', background: '#285978', color: '#fff', border: '1px solid #63889e', borderRadius: 5, cursor: 'pointer' };
export function DiscoveryTab() {
  const [data, setData] = useState<DiscoveryLibrary | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const alive = useRef(true);
  const requests = useRef<Record<string, number>>({});
  useEffect(() => { let active = true; alive.current = true; void discoveryLibrary().then(value => { if (active) setData(value); }).catch(err => { if (active) setError(String(err)); }); return () => { active = false; alive.current = false; }; }, []);
  const refresh = async (provider: string) => {
    const request = (requests.current[provider] ?? 0) + 1; requests.current[provider] = request;
    setBusy(old => ({ ...old, [provider]: true })); setError('');
    try { const value = await discoveryLibrary(provider); if (alive.current && request === requests.current[provider]) setData(old => !old || value.revision >= old.revision ? value : old); }
    catch (err) { if (alive.current && request === requests.current[provider]) setError(`${provider}: ${String(err)}`); }
    finally { if (alive.current && request === requests.current[provider]) setBusy(old => ({ ...old, [provider]: false })); }
  };
  return <div style={{ color: '#c7d5e0' }}>
    <h2>Descubrimiento universal</h2>
    <p>Solo lectura local. No se añaden accesos ni colecciones. Un título en caché no confirma propiedad, compra ni suscripción.</p>
    <p>La ausencia de datos no significa que tu biblioteca esté vacía. PC Game Pass requiere evidencia de licencia que esta fase no consulta.</p>
    <input aria-label="Buscar juegos detectados" placeholder="Buscar títulos detectados" value={search} onChange={event => setSearch(event.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: 10, marginBottom: 15 }} />
    {error && <p role="alert">{error}</p>}
    {data?.providers.map(provider => <section key={provider.id} style={{ background: '#192f40', padding: 15, marginBottom: 14, borderRadius: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><h3>{provider.name}</h3><button type="button" style={button} disabled={!!busy[provider.id]} onClick={() => void refresh(provider.id)}>{busy[provider.id] ? 'Comprobando…' : 'Refrescar proveedor'}</button></div>
      <p>{provider.records.length} títulos · {provider.status === 'not_checked' ? 'Sin comprobar' : provider.status === 'limited' ? 'Cobertura limitada' : provider.status === 'error' ? 'Error' : provider.status === 'partial' ? 'Resultado parcial' : 'Comprobado localmente'}{provider.stale ? ' · Datos anteriores conservados' : ''}</p>
      {provider.lastChecked && <p>Última comprobación: {provider.lastChecked}</p>}
      {provider.errors.map((message, i) => <p key={i} role="alert">{message}</p>)}
      <p>Se muestran hasta 200 títulos por proveedor; usa la búsqueda para localizar otros.</p>
      <details><summary>Fuentes y limitaciones</summary>{provider.limitations.map((message, i) => <p key={i}>{message}</p>)}</details>
      {provider.records.filter(record => record.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())).slice(0, 200).map(record => <details key={record.id} style={{ padding: '10px 0', borderTop: '1px solid #426279' }}>
        <summary>{record.name} · {record.installed === 'installed' ? 'Instalado según evidencia local' : record.installed === 'not_installed' ? 'No instalado según evidencia local' : 'Instalación desconocida'}{record.nameResolved === false ? ' · Nombre no resuelto' : ''}</summary>
        <p>ID de origen: {record.providerId} · Licencia: {record.licenses.map(license => license.type === 'purchase' ? 'Compra confirmada' : license.type === 'subscription' ? 'Suscripción confirmada' : 'Desconocida').join(', ')}</p>
        {record.catalogOnly && <p>Metadatos de catálogo en caché: no confirman que el juego pertenezca a tu cuenta.</p>}
        {record.installations.map(install => <p key={install.id}>{install.path}{install.launch ? ` · Método detectado: ${install.launch.kind} / ${install.launch.target}` : ' · Método de lanzamiento sin confirmar'}</p>)}
        <p>Comprobado: {record.lastChecked}</p>
        {record.evidence.map((item, i) => <p key={i}>Fuente: {item.source}</p>)}
        {record.identity.candidates.length > 0 && <p>Posibles coincidencias, sin combinar: {record.identity.candidates.map(candidate => candidate.name).join(', ')}</p>}
        {record.identity.conflicts.length > 0 && <p>Conflictos de identidad: {record.identity.conflicts.map(candidate => candidate.name).join(', ')}</p>}
        {record.shortcuts.length > 0 && <p>Accesos Steam relacionados para revisar: {record.shortcuts.map(shortcut => `${shortcut.appid} (${shortcut.kind === 'manual_reference' ? 'referencia manual' : 'candidato'})`).join(', ')}</p>}
      </details>)}
    </section>)}
  </div>;
}
