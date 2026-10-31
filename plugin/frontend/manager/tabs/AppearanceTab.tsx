import { ManagerSection } from '../components/ManagerSection';
import { managerStyles } from '../styles/manager-styles';

/** Displays appearance preferences until persistence is available. */
export function AppearanceTab() {
  return (
    <ManagerSection title="Apariencia">
      <p>Tema actual: diseño local de Steam Bridge.</p>

      <p style={managerStyles.muted}>
        Los temas Steam clásico, Steam moderno y AWN estarán disponibles cuando implementemos la
        configuración persistente.
      </p>
    </ManagerSection>
  );
}
