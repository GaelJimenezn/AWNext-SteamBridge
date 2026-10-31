import { useEffect, useMemo, useState } from 'react';
import { getSteamShortcuts } from '../../core/steam-shortcuts';

type ArtKind = 'Grid' | 'Hero' | 'Logo' | 'Icon';
type Provider = 'SteamGridDB' | 'RetroAchievements' | 'ScreenScraper' | 'Custom URL';
type StoredArtwork = { url: string; provider: Provider; updatedAt: number };
const kinds: ArtKind[] = ['Grid', 'Hero', 'Logo', 'Icon'];
const providers: Provider[] = ['SteamGridDB', 'RetroAchievements', 'ScreenScraper', 'Custom URL'];
const key = (appid: string, kind: ArtKind) => `awn-bridge:artwork:v1:${appid}:${kind}`;
const field: React.CSSProperties = { color: '#dcebf4', background: '#112638', border: '1px solid #45657b', borderRadius: 6, padding: '10px 12px', width: '100%', boxSizing: 'border-box' };
const btn: React.CSSProperties = { color: '#f4f9fc', background: '#27658b', border: '1px solid #4e8eb6', borderRadius: 6, padding: '9px 13px', cursor: 'pointer' };
function load(appid: string, kind: ArtKind): StoredArtwork | null {
  try {
    const raw = window.localStorage.getItem(key(appid, kind));
    if (!raw) return null;
    const value = JSON.parse(raw) as StoredArtwork;
    return typeof value.url === 'string' && /^https:\/\/[^\s]+$/i.test(value.url) ? value : null;
  } catch { return null; }
}
export function ArtworkTab() {
  const [games, setGames] = useState(getSteamShortcuts);
  const [appid, setAppid] = useState('');
  const [kind, setKind] = useState<ArtKind>('Grid');
  const [provider, setProvider] = useState<Provider>('SteamGridDB');
  const [url, setUrl] = useState('');
  const [saved, setSaved] = useState<StoredArtwork | null>(null);
  const [message, setMessage] = useState('');
  const [imageError, setImageError] = useState(false);
  useEffect(() => {
    const current = getSteamShortcuts();
    setGames(current);
    if (current.length && !appid) setAppid(current[0].appid);
  }, []);
  useEffect(() => {
    const record = appid ? load(appid, kind) : null;
    setSaved(record);
    setUrl(record?.url ?? '');
    if (record?.provider) setProvider(record.provider);
    setMessage('');
    setImageError(false);
  }, [appid, kind]);
  const valid = useMemo(() => /^https:\/\/[^\s]+$/i.test(url.trim()), [url]);
  const chosen = games.find(g => g.appid === appid);
  const save = () => {
    if (!appid || !valid) { setMessage('Select a game and enter a valid HTTPS image URL.'); return; }
    const record: StoredArtwork = { url: url.trim(), provider, updatedAt: Date.now() };
    try {
      window.localStorage.setItem(key(appid, kind), JSON.stringify(record));
      setSaved(record);
      setMessage('Selection saved locally. Steam artwork has NOT been changed.');
    } catch { setMessage('Could not save. Browser storage may be restricted.'); }
  };
  const reset = () => {
    if (!appid) return;
    try { window.localStorage.removeItem(key(appid, kind)); } catch { setMessage('Could not remove selection.'); return; }
    setSaved(null); setUrl(''); setMessage('Local selection cleared.');
  };
  return <section style={{ maxWidth: 920, color: '#d6e6f2' }}>
    <h2 style={{ color: '#fff', marginTop: 0 }}>Artwork Manager</h2>
    <p style={{ color: '#9fb5c4', fontSize: 13 }}>Choose artwork yourself. Detection never changes your Steam images.</p>
    <div style={{ background: '#1b3143', border: '1px solid #35536a', borderRadius: 9, padding: 18, display: 'grid', gap: 16 }}>
      <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>Non-Steam game
        <select value={appid} onChange={e => setAppid(e.target.value)} style={field}>
          {!games.length && <option value="">No Steam shortcuts captured. Open Library first.</option>}
          {games.map(g => <option key={g.appid} value={g.appid}>{g.name} ({g.appid})</option>)}
        </select>
      </label>
      <div>
        <div style={{ fontSize: 13, marginBottom: 8 }}>Artwork type</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{kinds.map(k => <button key={k} type="button" onClick={() => setKind(k)} style={{ ...btn, background: kind === k ? '#367fa8' : '#20384b' }}>{k}</button>)}</div>
      </div>
      <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>Preferred provider
        <select value={provider} onChange={e => setProvider(e.target.value as Provider)} style={field}>{providers.map(p => <option key={p}>{p}</option>)}</select>
      </label>
      <p style={{ fontSize: 12, color: '#9fb5c4', margin: 0 }}>Provider search is not connected yet. Find an image yourself and paste its direct HTTPS image URL below. The provider is recorded as attribution, not searched automatically.</p>
      <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>Direct image URL (HTTPS)
        <input value={url} onChange={e => { setUrl(e.target.value); setImageError(false); }} placeholder="https://.../image.png" style={field} />
      </label>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 180, border: '1px dashed #517185', borderRadius: 8, background: '#0d1d2b', padding: 16 }}>
        {valid && !imageError ? <img src={url.trim()} onError={() => setImageError(true)} alt={`${chosen?.name ?? 'Game'} ${kind} preview`} style={{ display: 'block', maxHeight: 280, maxWidth: '100%', objectFit: 'contain' }}/> : <span style={{ color: '#a5bbc9', fontSize: 13 }}>{imageError ? 'Image could not be loaded.' : 'Image preview appears here.'}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" onClick={save} disabled={!valid || !appid} style={{ ...btn, opacity: valid && appid ? 1 : .5 }}>Save selection</button>
        <button type="button" onClick={reset} disabled={!saved} style={{ ...btn, background: '#2a3744', opacity: saved ? 1 : .5 }}>Clear saved selection</button>
        <span style={{ color: '#9fb5c4', fontSize: 12 }}>{saved ? 'Saved for this game and type' : 'Not saved'}</span>
      </div>
      {message && <p role="status" style={{ margin: 0, color: '#94c9e9', fontSize: 12 }}>{message}</p>}
    </div>
  </section>;
}