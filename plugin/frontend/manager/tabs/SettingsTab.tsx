import { useEffect, useState } from 'react';

type Result = {
  ok?: boolean;
  configured?: boolean;
  persistent?: boolean;
  error?: string;
};

async function rpc(name: string, ...args: string[]): Promise<Result> {
  const fn = (backend as any)?.[name];
  if (typeof fn !== 'function') throw new Error(`RPC unavailable: ${name}`);
  const raw = await fn(...args);
  return typeof raw === 'string' ? JSON.parse(raw) as Result : raw as Result;
}

const button: React.CSSProperties = {
  background: '#286285', border: '1px solid #5088a5',
  borderRadius: 5, color: '#fff', padding: '10px 13px',
  cursor: 'pointer',
};

const field: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: 11, background: '#102334',
  color: '#fff', border: '1px solid #45677b',
  borderRadius: 5,
};

export function SettingsTab() {
  const [open, setOpen] = useState('sgdb');
  const [key, setKey] = useState('');
  const [connected, setConnected] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    void rpc('sgdb_status')
      .then(result => setConnected(!!result.configured))
      .catch(error => setMessage(String(error)));
  }, []);

  async function perform(action: string, ...args: string[]) {
    setWorking(true);
    setMessage('');

    try {
      const result = await rpc(action, ...args);
      if (!result.ok) throw new Error(result.error || 'Unknown error');

      if (action === 'sgdb_configure') {
        setConnected(true);
        setKey('');
        setMessage('API key guardada con Windows DPAPI.');
      } else if (action === 'sgdb_test') {
        setMessage('Conexion con SteamGridDB correcta.');
      } else {
        setConnected(false);
        setKey('');
        setMessage('SteamGridDB desconectado.');
      }
    } catch (error) {
      setMessage(String(error));
    } finally {
      setWorking(false);
    }
  }

  const sections = [
    { id: 'awn', name: 'Achievement Watcher Next', info: 'Logros locales' },
    { id: 'sgdb', name: 'SteamGridDB', info: 'Artwork y API key' },
    { id: 'ra', name: 'RetroAchievements', info: 'Logros de emuladores' },
    { id: 'ss', name: 'ScreenScraper', info: 'Metadatos y arte retro' },
  ];

  return (
    <div style={{ maxWidth: 870, color: '#c7d5e0' }}>
      <h2>Provider Settings</h2>

      {sections.map(section => (
        <section key={section.id}
          style={{ background: '#192e40', border: '1px solid #35566b',
            borderRadius: 8, marginBottom: 12, overflow: 'hidden' }}>

          <button type="button"
            onClick={() => { setOpen(open === section.id ? '' : section.id); setMessage(''); }}
            style={{ display: 'flex', width: '100%', padding: 16,
              justifyContent: 'space-between', alignItems: 'center',
              background: 'transparent', border: 0, color: '#fff',
              cursor: 'pointer', textAlign: 'left' }}>
            <span>
              <strong>{section.name}</strong>
              <small style={{ display: 'block', color: '#9fb8c9', marginTop: 4 }}>
                {section.info}
              </small>
            </span>
            <svg width="18" height="18" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2">
              <path d={open === section.id ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'}/>
            </svg>
          </button>

          {open === section.id && (
            <div style={{ padding: 16, borderTop: '1px solid #35566b' }}>
              {section.id === 'awn' && <p>AWN sigue conectado mediante su backend actual.</p>}

              {section.id === 'sgdb' && (
                <>
                  <p style={{ color: connected ? '#95dca9' : '#cdb48f' }}>
                    {connected ? 'API key configurada y guardada.' : 'Sin API key configurada.'}
                  </p>

                  <input type="password" aria-label="SteamGridDB API key"
                    autoComplete="off" placeholder="API key"
                    value={key} onChange={e => setKey(e.target.value)}
                    style={field}/>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                    <button style={button} disabled={!key.trim() || working}
                      onClick={() => void perform('sgdb_configure', key.trim())}>
                      Guardar / Aplicar
                    </button>
                    <button style={button} disabled={!connected || working}
                      onClick={() => void perform('sgdb_test')}>
                      Probar conexion
                    </button>
                    <button style={button} disabled={!connected || working}
                      onClick={() => void perform('sgdb_disconnect')}>
                      Desconectar
                    </button>
                    <button style={button} onClick={() => window.open(
                      'https://www.steamgriddb.com/profile/preferences/api',
                      '_blank', 'noopener,noreferrer'
                    )}>Obtener API key</button>
                  </div>
                  {message && <p role="status">{message}</p>}
                </>
              )}

              {section.id === 'ra' && (
                <>
                  <p>RetroAchievements: conexion pendiente del cliente de backend.</p>
                  <button style={button} onClick={() => window.open(
                    'https://retroachievements.org/controlpanel.php',
                    '_blank', 'noopener,noreferrer'
                  )}>Obtener perfil y Web API key</button>
                </>
              )}

              {section.id === 'ss' && (
                <>
                  <p>ScreenScraper: requiere usuario y credenciales de aplicacion.</p>
                  <button style={button} onClick={() => window.open(
                    'https://www.screenscraper.fr/',
                    '_blank', 'noopener,noreferrer'
                  )}>Crear cuenta / Iniciar sesion</button>
                </>
              )}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}