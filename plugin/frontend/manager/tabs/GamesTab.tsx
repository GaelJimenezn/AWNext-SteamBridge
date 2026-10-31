import { ManagerSection } from '../components/ManagerSection';
import { managerStyles } from '../styles/manager-styles';

/** Displays the future Steam-to-AWN game mapping section. */
export function GamesTab() {
  return (
    <ManagerSection title="Biblioteca de juegos">
      <p>
        Aquí administraremos las asociaciones entre los accesos directos de Steam y los juegos
        detectados.
      </p>

      <p style={managerStyles.muted}>
        El descubrimiento automático se conectará al backend en una próxima fase.
      </p>
    </ManagerSection>
  );
}
