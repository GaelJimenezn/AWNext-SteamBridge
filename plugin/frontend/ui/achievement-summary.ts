import { make } from '../shared/dom';
import type { Achievement } from '../models/achievement';
import { achievementStyles } from './achievement-styles';

/** Build the compact progress and recent achievements preview. */
export function buildAchievementSummary(
  doc: Document,
  unlocked: Achievement[],
  earned: number,
  total: number,
): HTMLElement {
  const root = make(doc, 'div');
  const percent = total ? Math.round((earned / total) * 100) : 0;

  const header = make(doc, 'div');
  header.style.cssText = achievementStyles.header;

  const count = make(doc, 'strong', `${earned} de ${total}`);
  count.style.cssText = 'font-size:16px;color:#fff';

  const percentage = make(doc, 'span', `${percent}%`);
  percentage.style.cssText = 'color:#66c0f4;font-size:13px';

  header.append(count, percentage);
  root.append(header);

  const bar = make(doc, 'div');
  bar.style.cssText = achievementStyles.bar;

  const fill = make(doc, 'div');
  fill.style.cssText = `width:${percent}%;height:100%;background:#66c0f4`;

  bar.append(fill);
  root.append(bar);

  const title = make(doc, 'div', 'LOGROS DESBLOQUEADOS RECIENTEMENTE');
  title.style.cssText = 'font-size:10px;letter-spacing:0.7px;' + 'color:#8f98a0;margin:12px 0 8px';

  root.append(title);

  const preview = make(doc, 'div');
  preview.style.cssText = achievementStyles.preview;

  const recent = [...unlocked].sort((a, b) => b.unlockTime - a.unlockTime).slice(0, 4);

  for (const achievement of recent) {
    const slot = make(doc, 'div');
    slot.title = achievement.name;
    slot.style.cssText =
      'width:48px;height:48px;flex:0 0 48px;' +
      'background:#17232e;border-radius:3px;' +
      'display:flex;align-items:center;' +
      'justify-content:center;overflow:hidden';

    if (achievement.icon?.startsWith('data:image/png;base64,')) {
      const image = doc.createElement('img');
      image.src = achievement.icon;
      image.alt = achievement.name;
      image.style.cssText = 'width:100%;height:100%;object-fit:contain';
      slot.append(image);
    } else {
      const fallback = make(doc, 'span', '★');
      fallback.style.cssText = 'color:#66c0f4;font-size:22px';
      slot.append(fallback);
    }

    preview.append(slot);
  }

  if (unlocked.length > recent.length) {
    const extra = make(doc, 'span', `+${unlocked.length - recent.length}`);
    extra.style.cssText = 'color:#8f98a0;font-size:12px;margin-left:3px';
    preview.append(extra);
  }

  root.append(preview);
  return root;
}
