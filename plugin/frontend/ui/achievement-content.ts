import { make } from '../shared/dom';
import type { AchievementResult } from '../models/achievement';
import { buildAchievementSummary } from './achievement-summary';
import { buildAchievementList } from './achievement-list';
import { achievementStyles } from './achievement-styles';

export const PANEL_ID = 'library-customizer-achievements';

/** Coordinate the local achievement components for Steam. */
export function buildContents(doc: Document, result: AchievementResult): HTMLElement {
  const root = make(doc, 'div');
  root.id = PANEL_ID;
  root.setAttribute('data-achievement-source', 'awn-local');
  root.style.cssText = achievementStyles.root;

  if (result.error) {
    const error = make(doc, 'p', result.error);
    error.style.cssText = 'color:#e4a3a3;padding:8px';
    root.append(error);
    return root;
  }

  const achievements = result.achievements || [];
  const unlocked = achievements.filter((a) => a.unlocked);

  const total = result.total ?? achievements.length;
  const earned = result.unlocked ?? unlocked.length;

  root.append(
    buildAchievementSummary(doc, unlocked, earned, total),
    buildAchievementList(doc, achievements),
  );

  return root;
}
