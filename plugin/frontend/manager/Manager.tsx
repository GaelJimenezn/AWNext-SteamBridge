import { useState } from 'react';

import type { ManagerTab } from './models/manager';

import { ManagerTabs } from './components/ManagerTabs';
import { GamesTab } from './tabs/GamesTab';
import { SourcesTab } from './tabs/SourcesTab';
import { AppearanceTab } from './tabs/AppearanceTab';
import { managerStyles } from './styles/manager-styles';

/** Main settings view registered by Millennium. */
export function Manager() {
  const [activeTab, setActiveTab] = useState<ManagerTab>('games');

  return (
    <div style={managerStyles.panel}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          minWidth: 0,
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 42,
            height: 42,
            flex: '0 0 42px',
            display: 'grid',
            placeItems: 'center',
            borderRadius: 6,
            background: '#203b51',
            color: '#66c0f4',
            fontSize: 23,
          }}
        >
          ★
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              color: '#ffffff',
              fontWeight: 700,
              fontSize: 16,
            }}
          >
            Administrador
          </div>
          <div style={managerStyles.muted}>Gestiona tus logros locales</div>
        </div>

        <span
          style={{
            color: '#91a7b8',
            fontSize: 10,
            alignSelf: 'flex-start',
          }}
        >
          v0.1
        </span>
      </header>

      <ManagerTabs activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'games' && <GamesTab />}
      {activeTab === 'sources' && <SourcesTab />}
      {activeTab === 'appearance' && <AppearanceTab />}
    </div>
  );
}
