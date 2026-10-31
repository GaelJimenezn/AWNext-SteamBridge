import { make } from '../shared/dom';
import type { Achievement } from '../models/achievement';
import { buildAchievementCard } from './achievement-card';
import { achievementStyles } from './achievement-styles';

type FilterMode = 'all' | 'unlocked' | 'locked';

/** Build the collapsible list with working achievement filters. */
export function buildAchievementList(
  doc: Document,
  achievements: Achievement[],
): HTMLDetailsElement {
  const section = make(doc, 'details') as HTMLDetailsElement;
  section.style.cssText = 'width:100%;min-width:0';

  const summary = make(doc, 'summary', 'Ver mis logros');
  summary.style.cssText =
    'cursor:pointer;color:#c7d5e0;padding:10px 0;' + 'font-weight:600;border-top:1px solid #344454';

  section.append(summary);

  const filters = make(doc, 'div');
  filters.style.cssText = achievementStyles.filters;

  const list = make(doc, 'div');
  list.style.cssText = achievementStyles.list;

  const unlocked = achievements.filter((a) => a.unlocked);
  const locked = achievements.filter((a) => !a.unlocked);
  // Mostrar primero los logros conseguidos, de mas reciente a mas antiguo.
  // Los logros sin fecha y los bloqueados mantienen su orden relativo.
  const hasDate = (a: Achievement): boolean =>
    typeof a.unlockTime === 'number' &&
    Number.isFinite(a.unlockTime) &&
    a.unlockTime > 0;

  const ordered = [...achievements].sort((a, b) => {
    if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
    if (!a.unlocked) return 0;
    const aTime = hasDate(a) ? a.unlockTime : -1;
    const bTime = hasDate(b) ? b.unlockTime : -1;
    return bTime - aTime;
  });

  const cards = ordered.map((achievement) => {
    const element = buildAchievementCard(doc, achievement);
    list.append(element);

    return {
      element,
      unlocked: achievement.unlocked,
    };
  });

  const options: Array<{ label: string; mode: FilterMode }> = [
    { label: `Todos (${achievements.length})`, mode: 'all' },
    { label: `Conseguidos (${unlocked.length})`, mode: 'unlocked' },
    { label: `Bloqueados (${locked.length})`, mode: 'locked' },
  ];

  const buttons: HTMLButtonElement[] = [];

  const selectFilter = (mode: FilterMode): void => {
    for (const card of cards) {
      const visible =
        mode === 'all' ||
        (mode === 'unlocked' && card.unlocked) ||
        (mode === 'locked' && !card.unlocked);

      card.element.style.display = visible ? 'flex' : 'none';
    }

    buttons.forEach((button, index) => {
      const active = options[index].mode === mode;
      button.style.background = active ? '#397ba4' : '#263746';
      button.style.color = active ? '#fff' : '#a9bac8';
    });
  };

  for (const option of options) {
    const button = doc.createElement('button');
    button.type = 'button';
    button.textContent = option.label;
    button.style.cssText =
      'border:0;border-radius:4px;padding:7px 9px;' +
      'cursor:pointer;font-size:11px;' +
      'background:#263746;color:#a9bac8';

    button.addEventListener('click', () => {
      selectFilter(option.mode);
    });

    buttons.push(button);
    filters.append(button);
  }

  selectFilter('all');
  section.append(filters, list);

  return section;
}
