import { useEffect, useMemo, useState } from 'react';
import { getSteamShortcuts, type SteamShortcut } from '../../core/steam-shortcuts';
import type { AwnGame, AwnLibraryResponse } from '../models/awn-game';
import { checkSources } from '../services/source-checks';

type Match = { shortcut: SteamShortcut; awn?: AwnGame; ambiguous: boolean };
type CheckResult = Awaited<ReturnType<typeof checkSources>>;
const norm = (value: string): string => value.normalize('NFKD').toLowerCase()
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const buttonStyle: React.CSSProperties = { background: '#29445b', color: '#c7d5e0', border: '1px solid #45657c', borderRadius: 6, padding: '9px 12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7 };
const dim: React.CSSProperties = { fontSize: 12, color: '#91a7b8', lineHeight: 1.5 };

function SymbolIcon({ kind }: { kind: 'chevron' | 'refresh' | 'search' | 'link' }) {
  if (kind === 'refresh') return <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>;
  if (kind === 'search') return <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="2" fill="none"/><path d="m16 16 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>;
  if (kind === 'link') return <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7 .3l2-2a5 5 0 0 0-7-7l-1.2 1.2M14 11a5 5 0 0 0-7-.3l-2 2a5 5 0 0 0 7 7l1.2-1.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" /></svg>;
  return <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>;
}

export function GamesTab() {
  const [shortcuts, setShortcuts] = useState<SteamShortcut[]>([]);
  const [games, setGames] = useState<AwnGame[]>([]);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'linked' | 'missing'>('all');
  const [revision, setRevision] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [checksById, setChecksById] = useState<Record<string, CheckResult>>({});
  const [workingId, setWorkingId] = useState<string | null>(null);

  useEffect(() => {
    setShortcuts(getSteamShortcuts());
    let cancelled = false;
    (async () => {
      try {
        const rpc = (backend as any)?.list_awn_games;
        if (typeof rpc !== 'function') throw new Error('AWN RPC unavailable');
        const response = await rpc();
        const data = (typeof response === 'string' ? JSON.parse(response) : response) as AwnLibraryResponse;
        if (!data?.ok || !Array.isArray(data.games)) throw new Error('AWN response invalid');
        if (!cancelled) { setGames(data.games); setMessage(''); }
      } catch (err) {
        if (!cancelled) setMessage(`AWN: ${String(err)}`);
      }
    })();
    return () => { cancelled = true; };
  }, [revision]);

  const matches = useMemo<Match[]>(() => shortcuts.map(shortcut => {
    const candidates = games.filter(game => norm(game.name) === norm(shortcut.name));
    return { shortcut, awn: candidates.length === 1 ? candidates[0] : undefined, ambiguous: candidates.length > 1 };
  }), [shortcuts, games]);

  const visible = matches.filter(item => {
    if (!norm(item.shortcut.name).includes(norm(search))) return false;
    if (filter === 'linked') return !!item.awn;
    if (filter === 'missing') return !item.awn;
    return true;
  });

  const refresh = () => { setShortcuts(getSteamShortcuts()); setRevision(value => value + 1); };
  const runChecks = async (match: Match) => {
    if (!match.awn) return;
    const id = String(match.shortcut.appid);
    setWorkingId(id);
    setMessage('');
    try {
      const result = await checkSources(match.awn);
      setChecksById(old => ({ ...old, [id]: result }));
    } catch (error) { setMessage(`Check failed: ${String(error)}`); }
    finally { setWorkingId(null); }
  };

  return <div style={{ background: '#1b2d3d', border: '1px solid #34485a', borderRadius: 8, padding: 18, color: '#c7d5e0', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', minWidth: 0 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <div><strong style={{ fontSize: 20, color: '#f2f6fb' }}>My non-Steam games</strong>
        <div style={dim}>{shortcuts.length} Steam shortcuts | {matches.filter(item => !!item.awn).length} exact AWN matches</div>
      </div>
      <button type="button" style={buttonStyle} onClick={refresh}><SymbolIcon kind="refresh" />Refresh</button>
    </div>
    <div style={{ display: 'flex', gap: 8, margin: '16px 0', flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', flex: '1 1 250px', minWidth: 0 }}>
        <span style={{ position: 'absolute', left: 12, top: 12, color: '#8da9bf', pointerEvents: 'none' }}><SymbolIcon kind="search" /></span>
        <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search Steam shortcuts" aria-label="Search Steam shortcuts"
          style={{ width: '100%', boxSizing: 'border-box', padding: '11px 12px 11px 37px', color: '#fff', background: '#101c28', border: '1px solid #45657c', borderRadius: 6 }} />
      </div>
      <select value={filter} onChange={event => setFilter(event.target.value as typeof filter)} aria-label="Shortcut filter"
        style={{ padding: 10, color: '#fff', background: '#101c28', border: '1px solid #45657c', borderRadius: 6 }}>
        <option value="all">All shortcuts</option><option value="linked">AWN matched</option><option value="missing">Needs matching</option>
      </select>
    </div>
    {!shortcuts.length && <p style={{ color: '#f1c176' }}>No Steam shortcuts detected. Open Steam Library, then refresh.</p>}
    <div style={{ maxHeight: '65vh', overflowY: 'auto', borderTop: '1px solid #34485a' }}>
      {visible.map(item => {
        const id = String(item.shortcut.appid);
        const opened = expandedId === id;
        const checks = checksById[id];
        return <div key={id} style={{ borderBottom: '1px solid #34485a', padding: '12px 5px' }}>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <strong style={{ fontSize: 15, color: '#f1f6fa', overflowWrap: 'anywhere' }}>{item.shortcut.name}</strong>
              <div style={{ ...dim, marginTop: 4 }}>Shortcut {id} | {item.ambiguous ? 'Ambiguous AWN match' : item.awn ? `${item.awn.source} - ${item.awn.unlocked}/${item.awn.total}` : 'No exact AWN match'}</div>
            </div>
            <button type="button" aria-expanded={opened} aria-label={`${opened ? 'Hide' : 'Show'} details for ${item.shortcut.name}`}
              onClick={() => setExpandedId(opened ? null : id)} style={{ ...buttonStyle, width: 40, height: 40, padding: 0 }}>
              <span style={{ display: 'inline-flex', transform: opened ? 'rotate(90deg)' : undefined, transition: 'transform 120ms' }}><SymbolIcon kind="chevron" /></span>
            </button>
          </div>
          {opened && <div style={{ marginTop: 12, background: '#101e2b', border: '1px solid #35546b', borderRadius: 8, padding: 14 }}>
            <div style={{ fontWeight: 700, color: '#fff', marginBottom: 10 }}>{item.shortcut.name}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              <span style={{ padding: '6px 10px', background: '#253c50', borderRadius: 18, fontSize: 12 }}>Steam: not verified</span>
              <span style={{ padding: '6px 10px', background: item.awn ? '#244c39' : '#374251', color: item.awn ? '#a5dfa7' : '#b6c5d2', borderRadius: 18, fontSize: 12 }}>AWN: {item.awn ? `${item.awn.unlocked}/${item.awn.total}` : item.ambiguous ? 'ambiguous' : 'no match'}</span>
              <span style={{ padding: '6px 10px', background: '#253c50', borderRadius: 18, fontSize: 12 }}>Retro: not configured</span>
            </div>
            {item.awn ? <button type="button" disabled={workingId === id} style={{ ...buttonStyle, opacity: workingId === id ? 0.6 : 1 }} onClick={() => { void runChecks(item); }}><SymbolIcon kind="link" />{workingId === id ? 'Checking...' : 'Run provider checks'}</button>
              : <p style={dim}>This shortcut has no unique AWN match. Manual linking will be added later.</p>}
            {checks && <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>{checks.map(result => <div key={result.provider} style={{ background: '#1d3446', padding: '9px 11px', borderRadius: 6, fontSize: 12, overflowWrap: 'anywhere' }}><strong>{result.provider.toUpperCase()} [{result.status}]</strong>: {result.detail}</div>)}</div>}
          </div>}
        </div>;
      })}
      {visible.length === 0 && shortcuts.length > 0 && <p style={dim}>No matching shortcuts.</p>}
    </div>
    <p style={{ ...dim, marginTop: 16 }}>{message || 'Steam shortcuts only. No Steam achievements are modified.'}</p>
  </div>;
}