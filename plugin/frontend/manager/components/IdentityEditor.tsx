import { useState } from 'react';
import { saveIdentity, type IdentityLibrary, type IdentityGame, type IdentityEntry, type ProviderReference, type PortMapping } from '../../core/identity-service';

const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: 8, background: '#102334', border: '1px solid #45657c', color: '#fff', borderRadius: 4 };
export function IdentityEditor({ game, library, saved }: { game: IdentityGame; library: IdentityLibrary; saved: () => void }) {
  const [mode, setMode] = useState<NonNullable<IdentityEntry['achievementMode']>>(game.entry.achievementMode ?? 'auto');
  const [providers, setProviders] = useState<Record<string, ProviderReference>>(game.providers);
  const [edition, setEdition] = useState(game.entry.edition ?? '');
  const [origin, setOrigin] = useState(game.entry.origin ?? '');
  const [port, setPort] = useState<PortMapping>(game.port ?? { adapter: 'x360recomp-toml', titleId: '', stateRoot: '', profile: 'user' });
  const [other, setOther] = useState('');
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  const update = (provider: string, field: 'id' | 'source', value: string) => setProviders(old => ({ ...old, [provider]: { ...(old[provider] ?? { id: '' }), [field]: value } }));
  const write = async (reset = false) => {
    setWorking(true); setMessage('');
    try {
      const refs = Object.fromEntries(Object.entries(providers).filter(([, ref]) => ref.id.trim()).map(([key, ref]) => [key, { ...ref, id: ref.id.trim(), source: ref.source?.trim() ?? '' }]));
      const entry: IdentityEntry = { achievementMode: mode, providers: refs, edition, origin, ...((mode === 'port' || game.port) ? { port } : {}) };
      const result = await saveIdentity(library, game.appid, reset ? undefined : entry);
      setMessage(result.warning || 'Asociación guardada con respaldo.');
      saved();
    } catch (error) { setMessage(String(error)); }
    finally { setWorking(false); }
  };
  return <section aria-label={`Editar identidad de ${game.name}`} style={{ marginTop: 12, padding: 12, border: '1px solid #426279', borderRadius: 5 }}>
    <strong>Asociaciones manuales</strong>
    <p>Cuenta {library.accountId ?? 'no identificada'} · Shortcut {game.appid}. Los ID de cada proveedor son independientes.</p>
    <label>Origen de logros
      <select style={inputStyle} value={mode} onChange={e => setMode(e.target.value as typeof mode)}>
        <option value="auto">Automático, conservando el lector propio existente</option><option value="awn">Referencia AWN manual</option>
        <option value="port">Lector propio x360recomp</option><option value="none">Sin panel de logros propio</option>
      </select>
    </label>
    <label style={{ display: 'block', marginTop: 10 }}>Elegir juego AWN
      <select style={inputStyle} value={JSON.stringify([providers.awn?.source ?? '', providers.awn?.id ?? ''])} onChange={e => {
        const [source, id] = JSON.parse(e.target.value) as [string, string];
        setProviders(old => ({ ...old, awn: { ...(old.awn ?? {}), id, source } }));
      }}>
        <option value={JSON.stringify(['', ''])}>Sin referencia manual</option>
        {providers.awn?.id && !library.awnGames.some(g => g.id === providers.awn.id && g.source === providers.awn.source) &&
          <option value={JSON.stringify([providers.awn.source ?? '', providers.awn.id])}>Referencia guardada: {providers.awn.id} ({providers.awn.source ?? 'origen no fijado'})</option>}
        {library.awnGames.map((g, index) => <option key={`${g.source}:${g.id}:${index}`} value={JSON.stringify([g.source, g.id])}>{g.name} · {g.source} · {g.id}</option>)}
      </select>
    </label>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 10, marginTop: 10 }}>
      {(['awn', 'steam', 'steamgriddb'] as const).map(provider => <label key={provider}>{provider === 'steam' ? 'Steam catálogo (no shortcut)' : provider} ID
        <input style={inputStyle} value={providers[provider]?.id ?? ''} onChange={e => update(provider, 'id', e.target.value)} />
      </label>)}
      <label>Origen AWN<input style={inputStyle} value={providers.awn?.source ?? ''} onChange={e => update('awn', 'source', e.target.value)} /></label>
      <label>Edición esperada<input style={inputStyle} value={edition} onChange={e => setEdition(e.target.value)} placeholder="Opcional" /></label>
      <label>Origen esperado<input style={inputStyle} value={origin} onChange={e => setOrigin(e.target.value)} placeholder="Opcional, por ejemplo GBE Fork" /></label>
    </div>
    {Object.entries(providers).filter(([key]) => !['awn', 'steam', 'steamgriddb'].includes(key)).map(([key, ref]) => <div key={key} style={{ marginTop: 10 }}>
      <label>{key} ID<input style={inputStyle} value={ref.id} onChange={e => update(key, 'id', e.target.value)} /></label>
      <label>Origen<input style={inputStyle} value={ref.source ?? ''} onChange={e => update(key, 'source', e.target.value)} /></label>
    </div>)}
    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}><input aria-label="Nombre de otro proveedor" style={inputStyle} value={other} onChange={e => setOther(e.target.value)} placeholder="Otro proveedor" />
      <button type="button" disabled={!/^[a-z][a-z0-9_-]*$/.test(other) || other in providers} onClick={() => { update(other, 'id', ''); setOther(''); }}>Añadir proveedor</button>
    </div>
    {(mode === 'port' || game.port) && <fieldset style={{ marginTop: 12 }}><legend>x360recomp · se conserva iconMap</legend>
      {(['titleId', 'stateRoot', 'profile', 'title'] as const).map(field => <label key={field} style={{ display: 'block', marginTop: 7 }}>{field}<input style={inputStyle} value={port[field] ?? ''} onChange={e => setPort(old => ({ ...old, [field]: e.target.value }))} /></label>)}
      <small>Guardar conserva los iconos y campos heredados. Restablecer vuelve a la asociación original; no la borra.</small>
    </fieldset>}
    <p>Una referencia manual puede sustituir la sugerencia automática. Revisa los conflictos antes de guardarla.</p>
    <button type="button" disabled={!library.writable || working} onClick={() => void write()}>{working ? 'Guardando…' : 'Guardar asociación con respaldo'}</button>{' '}
    <button type="button" disabled={!library.writable || working} onClick={() => void write(true)}>Restablecer heredado / automático</button>
    {message && <p role="status">{message}</p>}
  </section>;
}
