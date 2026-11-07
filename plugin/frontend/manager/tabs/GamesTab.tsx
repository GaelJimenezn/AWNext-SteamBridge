import { useEffect, useState } from 'react';
import { getSteamShortcuts } from '../../core/steam-shortcuts';
import { identityEpoch, loadIdentityLibrary, recoverIdentity, subscribeIdentityChanges, type IdentityLibrary, type IdentityGame } from '../../core/identity-service';
import { IdentityEditor } from '../components/IdentityEditor';
import { checkSources } from '../services/source-checks';

const messages: Record<string, string> = {
  title: 'Título coincidente', steam_id: 'ID Steam corroborado', executable_path: 'Ejecutable compartido', directory_path: 'Directorio compartido',
  title_mismatch: 'El título corresponde a otro juego', installment_or_year_mismatch: 'Entrega o año diferentes', edition_mismatch: 'Edición diferente o sin confirmar',
  origin_mismatch: 'Origen diferente', steam_id_mismatch: 'ID Steam diferente', manual_reference: 'Referencia manual guardada',
  preserved_x360recomp_mapping: 'Asociación propia x360recomp conservada', unique_corroborated_candidate: 'Candidato único con evidencia compatible',
  multiple_candidates_require_manual_choice: 'Hay varios candidatos: elige manualmente', contradictory_or_insufficient_evidence: 'La evidencia es insuficiente o contradictoria',
  manual_reference_unavailable: 'La referencia manual no está disponible o es ambigua', no_candidate: 'No hay un candidato compatible', manual_achievement_disable: 'Panel propio deshabilitado por asociación manual',
};
const explain = (code: string): string => messages[code] ?? code;
const button: React.CSSProperties = { background: '#29445b', color: '#fff', border: '1px solid #45657c', padding: '9px 12px', borderRadius: 5, cursor: 'pointer' };
export function GamesTab() {
  const [library, setLibrary] = useState<IdentityLibrary | null>(null);
  const [revision, setRevision] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [checks, setChecks] = useState<Record<string, Awaited<ReturnType<typeof checkSources>>>>({});
  const refresh = () => setRevision(value => value + 1);
  useEffect(() => subscribeIdentityChanges(refresh), []);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void loadIdentityLibrary(getSteamShortcuts()).then(data => {
      if (!cancelled) { setLibrary(data); setMessage(data.error ?? ''); setChecks({}); }
    }).catch(error => { if (!cancelled) { setLibrary(null); setMessage(String(error)); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [revision]);
  const runChecks = async (game: IdentityGame) => {
    const selected = game.resolution.selected;
    const awn = library?.awnGames.find(g => g.id === selected?.id && g.source === selected?.source);
    if (!awn) return;
    const epoch = identityEpoch();
    try { const result = await checkSources({ ...awn, appid: game.appid }); if (epoch === identityEpoch()) setChecks(old => ({ ...old, [game.key]: result })); }
    catch (error) { setMessage(String(error)); }
  };
  const visible = (library?.games ?? []).filter(game => game.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()) &&
    (filter === 'all' || (filter === 'linked' ? ['manual', 'manual-port', 'matched'].includes(game.resolution.status) : ['conflict', 'ambiguous', 'missing'].includes(game.resolution.status))));
  return <div style={{ color: '#c7d5e0', background: '#1b2d3d', padding: 18, borderRadius: 8 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><h2>Identidad y asociaciones de juegos</h2><button type="button" style={button} disabled={loading} onClick={refresh}>Actualizar</button></div>
    <p>Cuenta {library?.accountId ?? 'no identificada'} ({library?.accountSource ?? 'sin confirmar'}) · {library?.games.length ?? 0} accesos externos · revisión {library?.revision ?? '—'}</p>
    {library?.needsMigration && <p>Formato heredado en lectura. El primer guardado crea la versión 1 con respaldo y conserva todos los mappings.</p>}
    {library && !library.writable && <p role="alert">Edición bloqueada: {library.installation?.error || library.shortcutError || library.error || 'No se ha verificado la cuenta activa.'}</p>}
    {library?.snapshotError && <p role="status">{library.snapshotError}. Los mappings de ports siguen disponibles.</p>}
    {library?.installation?.awnOfficialEnabled && <p>AWN oficial presenta los logros generales. Estas asociaciones controlan los datos de Library Customizer; el lector propio de ports se conserva.</p>}
    {library?.recoveryAvailable && !library.ok && library.token && library.installation?.mayRun && <button type="button" style={button} onClick={() => {
      void recoverIdentity(library.token!).then(refresh).catch(error => setMessage(String(error)));
    }}>Recuperar respaldo conservando el archivo dañado</button>}
    <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
      <input aria-label="Buscar juegos" placeholder="Buscar juegos" value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, padding: 9 }} />
      <select aria-label="Filtro de identidad" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Todos</option><option value="linked">Resueltos</option><option value="pending">Conflictos / pendientes</option></select>
    </div>
    {loading && <p role="status">Resolviendo identidades…</p>}
    {visible.map(game => <article key={game.key} style={{ borderTop: '1px solid #426279', padding: '12px 0' }}>
      <button type="button" aria-expanded={expanded === game.key} onClick={() => setExpanded(expanded === game.key ? null : game.key)} style={{ ...button, width: '100%', textAlign: 'left' }}>
        <strong>{game.name}</strong> · shortcut {game.appid}<br />{game.resolution.status}: {explain(game.resolution.explanation)}
      </button>
      {expanded === game.key && <div>
        {game.resolution.selected && <p>AWN: {game.resolution.selected.name} · {game.resolution.selected.source} · {game.resolution.selected.id}</p>}
        {game.resolution.warnings?.map((warning, i) => <p key={`${warning}:${i}`} role="alert">Referencia manual: {explain(warning)}</p>)}
        {game.resolution.candidates.length > 0 && <details><summary>Evidencia y candidatos ({game.resolution.candidates.length})</summary>
          {game.resolution.candidates.slice(0, 20).map((candidate, i) => <div key={`${candidate.source}:${candidate.id}:${i}`} style={{ padding: 8, marginTop: 5, background: '#102334' }}>
            <strong>{candidate.name}</strong> · {candidate.source} · {candidate.id}
            <p>{candidate.reasons.map(explain).join(' · ') || 'Sin evidencia positiva'}</p>
            {candidate.blockers.length > 0 && <p style={{ color: '#efb0a0' }}>{candidate.blockers.map(explain).join(' · ')}</p>}
          </div>)}
        </details>}
        {game.resolution.selected && <button type="button" style={button} onClick={() => void runChecks(game)}>Consultar proveedores</button>}
        {checks[game.key]?.map(result => <p key={result.provider}>{result.provider}: {result.detail}</p>)}
        {library && <IdentityEditor key={`${game.key}:${library.token}`} game={game} library={library} saved={() => { setMessage('Asociación guardada; cachés invalidadas.'); }} />}
      </div>}
    </article>)}
    {!loading && library?.ok && visible.length === 0 && <p>No hay accesos que mostrar. Abre la biblioteca y comprueba la cuenta activa.</p>}
    {message && <p role="status">{message}</p>}
  </div>;
}
