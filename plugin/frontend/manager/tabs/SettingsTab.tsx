import { useState } from 'react';

type ProviderStatus = { ok?: boolean; awn?: { connected?: boolean; total?: number; external?: number; version?: string; reason?: string } };
const sites = [
  { name: 'SteamGridDB', role: 'Artwork API', url: 'https://www.steamgriddb.com/profile/preferences/api', state: 'Not connected' },
  { name: 'RetroAchievements', role: 'Emulated games and achievements', url: 'https://retroachievements.org/controlpanel.php', state: 'Not connected' },
  { name: 'ScreenScraper', role: 'Retro artwork API', url: 'https://www.screenscraper.fr/', state: 'Not connected' },
];
const panel: React.CSSProperties = { border: '1px solid #36556a', borderRadius: 9, background: '#1a3042', padding: 18 };
const action: React.CSSProperties = { background: '#28678c', color: 'white', border: '1px solid #4988ad', padding: '9px 13px', cursor: 'pointer', borderRadius: 6 };
export function SettingsTab() {
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const test = async () => {
    setBusy(true); setError('');
    try {
      const fn = (backend as unknown as { get_provider_status?: () => Promise<ProviderStatus | string> }).get_provider_status;
      if (typeof fn !== 'function') throw new Error('RPC not registered. Restart Steam after installing.');
      const raw = await fn();
      const value: ProviderStatus = typeof raw === 'string' ? JSON.parse(raw) as ProviderStatus : raw;
      if (!value || typeof value !== 'object') throw new Error('Invalid response from Lua backend.');
      setStatus(value);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  return <div style={{ maxWidth: 880, display: 'grid', gap: 14 }}>
    <h2 style={{ margin: 0, color: '#fff' }}>Provider Settings</h2>
    <p style={{ margin: 0, color: '#9fb8ca', fontSize: 13 }}>Test local AWN integration. External API credentials are not stored yet.</p>
    <section style={panel}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div><strong>Achievement Watcher Next</strong><div style={{ fontSize: 12, color: '#9fb8ca', marginTop: 5 }}>Local achievement database</div></div>
        <button type="button" disabled={busy} onClick={() => { void test(); }} style={action}>{busy ? 'Checking...' : 'Test AWN'}</button>
      </div>
      {status?.awn && <div style={{ marginTop: 12, fontSize: 13, color: status.awn.connected ? '#7de1a5' : '#e9b982' }}>
        {status.awn.connected ? `Connected - ${status.awn.total ?? 0} games (${status.awn.external ?? 0} external), AWN ${status.awn.version ?? '?'}` : `Unavailable - ${status.awn.reason ?? 'Unknown error'}`}
      </div>}
      {error && <p style={{ fontSize: 12, color: '#eda7a7' }}>{error}</p>}
    </section>
    {sites.map(s => <section key={s.name} style={panel}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}><strong>{s.name}</strong><span style={{ fontSize: 12, color: '#e6bc83' }}>{s.state}</span></div>
      <p style={{ fontSize: 12, color: '#a9bdcb' }}>{s.role}</p>
      <a href={s.url} target="_blank" rel="noreferrer" style={{ color: '#66c0f4', fontSize: 12 }}>Open provider setup website</a>
    </section>)}
    <p style={{ fontSize: 12, color: '#9fb8ca' }}>API keys will be entered here only after secure local storage and backend-only requests are implemented. Do not paste secrets into the plugin code or console.</p>
  </div>;
}