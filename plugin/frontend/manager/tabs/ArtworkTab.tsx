import { useEffect, useRef, useState } from 'react';
import { getSteamLibraryGames } from '../../core/steam-shortcuts';

type Kind = 'portrait' | 'landscape' | 'hero' | 'logo' | 'icon';
type Game = { id: number; name: string };
type Account = { id: string };
type Image = { id?: number; url: string; thumb?: string; width?: number; height?: number };
type RpcResult<T> = {
  ok: boolean;
  data?: T[];
  error?: string;
  path?: string;
  restartSteam?: boolean;
};

async function rpc<T>(name: string, ...args: string[]): Promise<RpcResult<T>> {
  const fn = (backend as any)?.[name];
  if (typeof fn !== 'function') throw new Error(`RPC unavailable: ${name}`);
  const raw = await fn(...args);
  return typeof raw === 'string'
    ? JSON.parse(raw) as RpcResult<T>
    : raw as RpcResult<T>;
}

const button: React.CSSProperties = {
  background: '#245573', border: '1px solid #5286a5',
  color: '#fff', padding: '9px 12px', borderRadius: 5, cursor: 'pointer',
};

export function ArtworkTab() {
  const games = getSteamLibraryGames();
  const [selected, setSelected] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [account, setAccount] = useState('');
  const [kind, setKind] = useState<Kind>('portrait');
  const [matches, setMatches] = useState<Game[]>([]);
  const [matched, setMatched] = useState<number | null>(null);
  const [images, setImages] = useState<Image[]>([]);
  const [chosen, setChosen] = useState<Image | null>(null);
  const [showMatches, setShowMatches] = useState(false);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState('');
  const seq = useRef(0);

  const game = games.find(g => g.appid === selected);
  const types: { id: Kind; label: string }[] = [
    { id: 'portrait', label: 'Grid vertical' },
    { id: 'landscape', label: 'Big Picture (ancha)' },
    { id: 'hero', label: 'Hero' },
    { id: 'logo', label: 'Logo' },
    { id: 'icon', label: 'Icon' },
  ];

  useEffect(() => {
    void rpc<Account>('sgdb_accounts')
      .then(result => {
        if (!result.ok) {
          setMessage(result.error || 'No se pudieron listar los perfiles.');
          return;
        }

        const found = result.data || [];
        setAccounts(found);

        if (found.length === 1) {
          setAccount(found[0].id);
        }
      })
      .catch(error => setMessage(String(error)));

    return () => { seq.current++; };
  }, []);

  function filtered(list: Image[], type: Kind) {
    return list.filter(item => {
      if (typeof item.url !== 'string' || !item.url.startsWith('https://')) return false;
      if (type === 'portrait' && item.width && item.height)
        return item.height > item.width;
      if (type === 'landscape' && item.width && item.height)
        return item.width > item.height;
      return true;
    });
  }

  async function load(id: number, type: Kind, requestId: number) {
    try {
      const endpoint = type === 'portrait' || type === 'landscape' ? 'grid' : type;
      const result = await rpc<Image>('sgdb_artwork', String(id), endpoint);

      if (requestId !== seq.current) return;
      if (!result.ok) throw new Error(result.error || 'Artwork search failed');

      const found = filtered(result.data || [], type);
      setImages(found);
      setMessage(found.length ? '' : 'No se encontraron imagenes.');
    } catch (error) {
      if (requestId === seq.current) setMessage(String(error));
    } finally {
      if (requestId === seq.current) setLoading(false);
    }
  }

  async function selectGame(id: string) {
    const requestId = ++seq.current;
    setSelected(id);
    setImages([]);
    setMatches([]);
    setMatched(null);
    setChosen(null);
    setMessage('');
    setShowMatches(false);

    const game = games.find(g => g.appid === id);
    if (!game) return;

    setLoading(true);

    try {
      const result = await rpc<Game>('sgdb_search', game.name);
      if (requestId !== seq.current) return;
      if (!result.ok) throw new Error(result.error || 'Game search failed');

      const found = result.data || [];
      setMatches(found);

      if (!found.length) {
        setMessage('No se encontraron coincidencias.');
        setLoading(false);
        return;
      }

      setMatched(found[0].id);
      await load(found[0].id, kind, requestId);
    } catch (error) {
      if (requestId === seq.current) {
        setMessage(String(error));
        setLoading(false);
      }
    }
  }

  function selectMatch(id: number) {
    const requestId = ++seq.current;
    setMatched(id);
    setChosen(null);
    setImages([]);
    setShowMatches(false);
    setLoading(true);
    void load(id, kind, requestId);
  }

  function selectKind(type: Kind) {
    const requestId = ++seq.current;
    setKind(type);
    setChosen(null);
    setImages([]);
    if (matched !== null) {
      setLoading(true);
      void load(matched, type, requestId);
    }
  }

  async function apply() {
    if (!game || !chosen) return;

    setApplying(true);
    setMessage('');

    try {
      const client = (globalThis as any).SteamClient;

      if (typeof client?.Apps?.SetCustomArtworkForApp !== 'function') {
        throw new Error(
          'Steam native artwork API unavailable in this window.'
        );
      }

      const appId = Number(game.appid);

      if (!Number.isSafeInteger(appId) ||
          appId <= 0 ||
          appId > 4294967295) {
        throw new Error('Invalid Steam AppID.');
      }

      const result = await rpc<never>(
        'sgdb_native_image',
        chosen.url
      ) as RpcResult<never> & {
        base64?: string;
        imageType?: 'png' | 'jpg';
      };

      if (!result.ok || !result.base64 || !result.imageType) {
        throw new Error(result.error || 'Unable to prepare image.');
      }

      const assetTypes: Record<Kind, number> = {
        portrait: 0,
        hero: 1,
        logo: 2,
        landscape: 3,
        icon: 4,
      };

      const assetType = assetTypes[kind];

      await client.Apps.SetCustomArtworkForApp(
        appId,
        result.base64,
        result.imageType,
        assetType
      );

      setMessage(
        'Artwork enviado a Steam. Revisa la biblioteca sin reiniciar.'
      );
    } catch (error) {
      setMessage(`Error: ${String(error)}`);
    } finally {
      setApplying(false);
    }
  }

  return (
    <div style={{ color: '#c7d5e0', maxWidth: 1200 }}>
      <h2>Artwork Manager</h2>

      <select aria-label="Juego" value={selected}
        onChange={e => void selectGame(e.target.value)}
        style={{ width: '100%', padding: 11, background: '#102638',
          color: '#fff', border: '1px solid #45677b' }}>
        <option value="">Selecciona un juego...</option>
        {games.map((g, i) => (
          <option key={`${g.appid}-${i}`} value={g.appid}>{g.name}</option>
        ))}
      </select>

      <div style={{ display: 'flex', flexWrap: 'wrap',
        gap: 8, margin: '14px 0' }}>
        {types.map(t => (
          <button type="button" key={t.id}
            style={{ ...button, background: kind === t.id ? '#347da5' : '#1d374a' }}
            onClick={() => selectKind(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {game && matched !== null && (
        <div style={{ padding: 10, background: '#1b3548',
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
          <span>Coincidencia: {matches.find(m => m.id === matched)?.name}</span>
          <button style={button} onClick={() => setShowMatches(!showMatches)}>
            Cambiar coincidencia
          </button>
          {showMatches && (
            <select aria-label="Coincidencia" value={matched}
              onChange={e => selectMatch(Number(e.target.value))}
              style={{ padding: 8, background: '#102638', color: '#fff' }}>
              {matches.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {loading && <p>Cargando imagenes...</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 270px',
        gap: 14, marginTop: 14, alignItems: 'start' }}>
        <div style={{ display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill,minmax(135px,1fr))',
          gap: 9 }}>
          {images.slice(0, 60).map((image, index) => (
            <button type="button"
              key={`${image.id || index}-${index}`}
              onClick={() => setChosen(image)}
              style={{ padding: 5, background: '#162d3f',
                cursor: 'pointer',
                border: chosen?.url === image.url
                  ? '2px solid #66c0f4' : '1px solid #45677b' }}>
              <img src={image.thumb || image.url}
                alt={`Artwork ${index + 1}`}
                loading="lazy"
                style={{ width: '100%', height: 140, objectFit: 'contain' }}/>
            </button>
          ))}
        </div>

        <aside style={{ position: 'sticky', top: 14,
          padding: 12, background: '#1b3548',
          border: '1px solid #45677b', borderRadius: 8 }}>
          <strong>Vista previa</strong>

          {chosen ? (
            <img src={chosen.url} alt="Imagen elegida"
              style={{ display: 'block', width: '100%',
                maxHeight: 250, objectFit: 'contain', margin: '12px 0' }}/>
          ) : (
            <p style={{ color: '#9fb8c9', fontSize: 12 }}>
              Selecciona una imagen para aplicarla.
            </p>
          )}

                    {/* AWN_PROFILE_SELECTOR_V2 */}
          <label
            htmlFor="steam-profile"
            style={{
              display: 'block',
              marginBottom: 7,
              fontSize: 12
            }}
          >
            Perfil de Steam
          </label>

          <select
            id="steam-profile"
            value={account}
            onChange={e => setAccount(e.target.value)}
            style={{
              width: '100%',
              padding: 9,
              marginBottom: 12,
              background: '#102638',
              color: '#fff',
              border: '1px solid #45677b',
              borderRadius: 5
            }}
          >
            <option value="">Selecciona un perfil...</option>

            {accounts.map(item => (
              <option key={item.id} value={item.id}>
                Steam userdata: {item.id}
              </option>
            ))}
          </select>

          <label
            htmlFor="manual-steam-profile"
            style={{
              display: 'block',
              fontSize: 11,
              color: '#9fb8c9',
              marginBottom: 6
            }}
          >
            ID manual, si tu perfil no aparece
          </label>

          <input
            id="manual-steam-profile"
            value={account}
            onChange={e => setAccount(
              e.target.value.replace(/\D/g, '')
            )}
            placeholder="ID de la carpeta userdata"
            style={{
              display: 'block',
              boxSizing: 'border-box',
              width: '100%',
              padding: 9,
              marginBottom: 14,
              background: '#102638',
              border: '1px solid #45677b',
              borderRadius: 5,
              color: '#fff'
            }}
          />
<button type="button" style={{ ...button, width: '100%',
            background: '#287a50' }}
            disabled={!chosen || !account || applying}
            onClick={() => void apply()}>
            {applying ? 'Aplicando...' : 'Aplicar sin reiniciar'}
          </button>

          <p style={{ fontSize: 11, color: '#9fb8c9' }}>
            Solo cambia {kind} del juego seleccionado.
            Se respalda la imagen anterior.
          </p>
        </aside>
      </div>

      {message && <p role="status" style={{
        color: '#aad6ee', marginTop: 14 }}>{message}</p>}
    </div>
  );
}