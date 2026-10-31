import { make } from '../shared/dom';
import type { Achievement } from '../models/achievement';
import { achievementStyles } from './achievement-styles';

/** Render one achievement with its icon and unlock status. */
export function buildAchievementCard(doc: Document, achievement: Achievement): HTMLElement {
  const card = make(doc, 'div');
  card.style.cssText = achievementStyles.card;

  if (!achievement.unlocked) {
    card.style.background = '#252b31';
    card.style.borderColor = '#383f46';
  }

  const iconWrap = make(doc, 'div');
  iconWrap.style.cssText = achievementStyles.icon;

  if (achievement.icon?.startsWith('data:image/png;base64,')) {
    const image = doc.createElement('img');
    image.alt = achievement.name;
    image.src = achievement.icon;
    image.style.cssText = 'width:48px;height:48px;object-fit:contain';

    if (!achievement.unlocked) {
      image.style.filter = 'grayscale(1)';
      image.style.opacity = '0.45';
    }

    iconWrap.append(image);
  } else {
    const fallback = make(doc, 'span', achievement.unlocked ? '★' : '🔒');
    fallback.style.cssText = 'font-size:22px;color:#8294a3';
    iconWrap.append(fallback);
  }

  const info = make(doc, 'div');
  info.style.cssText = 'flex:1;min-width:0;overflow-wrap:anywhere';

  const name = make(doc, 'div', achievement.name);
  name.style.cssText = 'font-size:13px;font-weight:700;line-height:1.3;color:#fff';

  if (!achievement.unlocked) {
    name.style.color = '#9aa3ab';
  }

  info.append(name);

  if (achievement.description) {
    const description = make(doc, 'div', achievement.description);

    description.style.cssText =
      'font-size:12px;line-height:1.4;color:#acbdc9;' + 'margin-top:4px;overflow-wrap:anywhere';

    if (!achievement.unlocked) {
      description.style.color = '#808991';
    }

    info.append(description);
  }

  const statusText = achievement.unlocked
    ? achievement.unlockTime > 0
      ? new Date(achievement.unlockTime * 1000).toLocaleString()
      : 'Desbloqueado'
    : 'Bloqueado';

  const status = make(doc, 'div', statusText);
  status.style.cssText = 'font-size:11px;color:#66c0f4;margin-top:6px';

  if (!achievement.unlocked) {
    status.style.color = '#737e88';
  }

  info.append(status);
  card.append(iconWrap, info);

  return card;
}
