import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { GamesTab } from './tabs/GamesTab';
import { SettingsTab } from './tabs/SettingsTab';
import { IntegrationTab } from './tabs/IntegrationTab';
import { ImportPreviewTab } from './tabs/ImportPreviewTab';
import { DiscoveryTab } from './tabs/DiscoveryTab';
import { ArtworkTab } from './tabs/ArtworkTab';
import { managerStyles } from './styles/manager-styles';

type Page = 'games' | 'integration' | 'preview' | 'discovery' | 'artwork' | 'settings';

const button: React.CSSProperties = {
  border: '1px solid #34536a', borderRadius: 5, padding: '9px 14px',
  background: '#1d3b52', color: '#d9e8f3', cursor: 'pointer', fontWeight: 600,
};

function ManagerWindow({ popup, close }: { popup: Window; close: () => void }) {
  const [page, setPage] = useState<Page>('games');

  // Chromium may restrict moving/positioning popup windows. No native titlebar is promised.
  // LC_DRAG_ONLY_V1
  // The host can restrict window.moveTo for popup windows.
  const onDragStart = (event: React.MouseEvent<HTMLDivElement>) => {
    if (
      event.button !== 0 ||
      (event.target as HTMLElement).closest('button')
    ) return;

    event.preventDefault();

    const startX = event.screenX;
    const startY = event.screenY;
    const originX = popup.screenX;
    const originY = popup.screenY;

    const onMove = (moveEvent: MouseEvent) => {
      const x = originX + moveEvent.screenX - startX;
      const y = originY + moveEvent.screenY - startY;

      try {
        popup.moveTo(x, y);
      } catch {
        // Steam/Chromium may refuse window movement.
      }
    };

    const onUp = () => {
      popup.document.removeEventListener('mousemove', onMove);
      popup.document.removeEventListener('mouseup', onUp);
      popup.removeEventListener('blur', onUp);
    };

    popup.document.addEventListener('mousemove', onMove);
    popup.document.addEventListener('mouseup', onUp, { once: true });
    popup.addEventListener('blur', onUp, { once: true });
  };
  return (
    <div style={{ minHeight: '100vh', color: '#c7d5e0', fontFamily: 'Arial, sans-serif', background: '#0f1b28' }}>
      {/* LC_TITLEBAR_SVG_V1 */}
      <div
        onMouseDown={onDragStart}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          padding: '12px 18px',
          background: '#152f44',
          borderBottom: '1px solid #3d6178',
          userSelect: 'none',
          cursor: 'move',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M12 2.5l2.8 6.3 6.8.7-5.1 4.5 1.5 6.6L12 17.2l-6 3.4 1.5-6.6L2.4 9.5l6.8-.7L12 2.5z"
              fill="#66c0f4"
            />
          </svg>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>
              Library Customizer
            </div>
            <div style={{ color: '#8eb8ce', fontSize: 11 }}>
              Non-Steam library manager
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button"
            style={{ ...button, background: '#633342' }}
            title="Close" onClick={close}>
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M5 5l14 14M19 5L5 19"
                fill="none" stroke="currentColor" strokeWidth="2"/>
            </svg>
          </button>
        </div>
      </div>
      <div style={{ display: 'flex', minHeight: 'calc(100vh - 66px)' }}>
        <nav style={{ width: 180, flexShrink: 0, borderRight: '1px solid #2b4558', background: '#101e2d', padding: 14 }}>
          {([
            ['games', 'Games'],
            ['discovery', 'Discovery'],
            ['preview', 'Import Preview'],
            ['integration', 'Integration'],
            ['artwork', 'Artwork'],
            ['settings', 'Settings'],
          ] as const).map(([id, label]) => (
            <button type="button" key={id} onClick={() => setPage(id)} style={{ ...button, width: '100%', textAlign: 'left', marginBottom: 10,
              background: page === id ? '#27668c' : '#1a2d3f', borderColor: page === id ? '#66c0f4' : '#2b4558' }}>
              {label}
            </button>
          ))}
        </nav>
        <main style={{ flex: 1, minWidth: 0, padding: 20, boxSizing: 'border-box' }}>
          {page === 'games' && <GamesTab />}
          {page === 'discovery' && <DiscoveryTab />}
          {page === 'preview' && <ImportPreviewTab />}
          {page === 'integration' && <IntegrationTab />}
          {page === 'artwork' && <ArtworkTab />}
          {page === 'settings' && <SettingsTab />}
        </main>
      </div>
    </div>
  );
}

export function Manager() {
  const [popup, setPopup] = useState<Window | null>(null);
  const [fallback, setFallback] = useState(false);
  const openManager = () => {
    const win = window.open('', 'LibraryCustomizerManager', 'popup=yes,width=1120,height=790,resizable=yes,scrollbars=yes');
    if (!win) { setFallback(true); return; }
    win.document.title = 'Library Customizer - Game Manager';
    if (!win.document.getElementById('library-customizer-popup-root')) {
      win.document.body.style.cssText = 'margin:0;background:#0f1b28;min-height:100vh';
      const root = win.document.createElement('div');
      root.id = 'library-customizer-popup-root';
      win.document.body.appendChild(root);
    }
    setPopup(win);
    win.focus();
  };
  useEffect(() => {
    if (!popup) return undefined;
    const onClose = () => setPopup(null);
    popup.addEventListener('beforeunload', onClose);
    return () => popup.removeEventListener('beforeunload', onClose);
  }, [popup]);
  const root = popup?.document.getElementById('library-customizer-popup-root');
  return <div style={managerStyles.panel}>
    <div style={{ fontWeight: 700, color: '#fff', fontSize: 16 }}>Library Customizer</div>
    <p style={managerStyles.muted}>Non-Steam games, achievements, and artwork</p>
    <button type="button" onClick={openManager} style={{ ...button, width: '100%', padding: 12 }}>Open Game Manager</button>
    {root && popup && createPortal(<ManagerWindow popup={popup} close={() => { popup.close(); setPopup(null); }} />, root)}
    {fallback && <div style={{ marginTop: 12 }}>
      <p>Popup blocked. Open Steam library, then try again.</p>
      <button type="button" style={button} onClick={() => setFallback(false)}>Dismiss</button>
    </div>}
  </div>;
}