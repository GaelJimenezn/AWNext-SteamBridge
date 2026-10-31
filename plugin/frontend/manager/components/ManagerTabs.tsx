import type { ManagerTab, ManagerTabDefinition } from '../models/manager';

import { managerStyles } from '../styles/manager-styles';

const tabs: readonly ManagerTabDefinition[] = [
  { id: 'games', label: 'Juegos' },
  { id: 'sources', label: 'Fuentes' },
  { id: 'appearance', label: 'Apariencia' },
];

interface ManagerTabsProps {
  readonly activeTab: ManagerTab;
  readonly onChange: (tab: ManagerTab) => void;
}

export function ManagerTabs({ activeTab, onChange }: ManagerTabsProps) {
  return (
    <nav aria-label="Secciones de AWNext Manager" style={managerStyles.navigation}>
      {tabs.map((tab) => {
        const active = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(tab.id)}
            style={{
              ...managerStyles.button,
              background: active ? '#2b5875' : 'transparent',
              color: active ? '#ffffff' : '#91a7b8',
              boxShadow: active ? 'inset 0 -2px #66c0f4' : 'none',
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
