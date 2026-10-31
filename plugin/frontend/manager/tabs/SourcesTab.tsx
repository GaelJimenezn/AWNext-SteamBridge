import { ManagerSection } from '../components/ManagerSection';

/** Describes configured and planned achievement sources. */
export function SourcesTab() {
  return (
    <ManagerSection title="Fuentes de logros">
      <div style={{ marginBottom: 14 }}>
        <strong>Ports y recompilaciones</strong>
        <p>Adaptador actual: Xbox 360 recomp / Pinyon Shift.</p>
      </div>

      <div style={{ marginBottom: 14 }}>
        <strong>Achievement Watcher Next</strong>
        <p>Catálogos utilizados por el adaptador actual. Pendiente: descubrimiento general.</p>
      </div>

      <div>
        <strong>RetroAchievements</strong>
        <p>Integración de API prevista para emuladores.</p>
      </div>
    </ManagerSection>
  );
}
