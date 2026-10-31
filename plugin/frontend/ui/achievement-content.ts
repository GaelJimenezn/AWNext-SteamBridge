import { make } from '../shared/dom';
import type { AchievementResult } from '../models/achievement';

export const PANEL_ID = 'awn-bridge-achievements';

export function buildContents(doc: Document, result: AchievementResult): HTMLElement {
  const root = make(doc, 'div');
  root.id = PANEL_ID;
  root.setAttribute('data-achievement-source', 'awn-local');
  root.style.cssText =
    'color:#dcdedf;font:13px Arial,sans-serif;width:100%;min-width:0;box-sizing:border-box';

  if (result.error) {
    const error = make(doc, 'p', result.error);
    error.style.cssText = 'color:#e4a3a3;padding:8px';
    root.append(error);
    return root;
  }

  const achievements = result.achievements || [];
  const unlocked = achievements.filter((a) => a.unlocked);
  const locked = achievements.filter((a) => !a.unlocked);

  const total = result.total ?? achievements.length;
  const earned = result.unlocked ?? unlocked.length;
  const percent = total ? Math.round((earned / total) * 100) : 0;

  const header = make(doc, 'div');
  header.style.cssText =
    'display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px';

  const count = make(doc, 'strong', `${earned} de ${total}`);
  count.style.cssText = 'font-size:16px;color:#fff';

  const percentage = make(doc, 'span', `${percent}%`);
  percentage.style.cssText = 'color:#66c0f4;font-size:13px';

  header.append(count, percentage);
  root.append(header);

  const bar = make(doc, 'div');
  bar.style.cssText =
    'height:6px;background:#344454;border-radius:4px;overflow:hidden;margin-bottom:12px';

  const fill = make(doc, 'div');
  fill.style.cssText = `width:${percent}%;height:100%;background:#66c0f4`;
  bar.append(fill);
  root.append(bar);

  // Steam-style compact preview: four latest unlocked achievements.
  const recent = [...unlocked].sort((a, b) => b.unlockTime - a.unlockTime).slice(0, 4);

  const previewTitle = make(doc, 'div', 'LOGROS DESBLOQUEADOS RECIENTEMENTE');
  previewTitle.style.cssText =
    'font-size:10px;letter-spacing:0.7px;color:#8f98a0;margin:12px 0 8px';
  root.append(previewTitle);

  const preview = make(doc, 'div');
  preview.style.cssText = 'display:flex;gap:7px;align-items:center;margin-bottom:12px';

  for (const achievement of recent) {
    const slot = make(doc, 'div');
    slot.title = achievement.name;
    slot.style.cssText =
      'width:48px;height:48px;flex:0 0 48px;background:#17232e;border-radius:3px;display:flex;align-items:center;justify-content:center;overflow:hidden';

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

  const section = make(doc, 'details') as HTMLDetailsElement;
  section.style.cssText = 'width:100%;min-width:0';

  const summary = make(doc, 'summary', 'Ver mis logros');
  summary.style.cssText =
    'cursor:pointer;color:#c7d5e0;padding:10px 0;font-weight:600;border-top:1px solid #344454';
  section.append(summary);

  const filters = make(doc, 'div');
  filters.style.cssText = 'display:flex;flex-wrap:wrap;gap:5px;margin:8px 0 12px';

  const list = make(doc, 'div');
  list.style.cssText =
    'display:flex;flex-direction:column;gap:8px;max-height:460px;overflow-y:auto;overflow-x:hidden';

  const cards: Array<{ element: HTMLElement; unlocked: boolean }> = [];

  // Unlocked achievements appear first.
  const ordered = [...unlocked, ...locked];

  for (const achievement of ordered) {
    const card = make(doc, 'div');
    card.style.cssText =
      'display:flex;gap:10px;align-items:flex-start;background:#263746;border:1px solid #344c60;border-radius:5px;padding:10px;min-width:0;box-sizing:border-box';

    if (!achievement.unlocked) {
      card.style.background = '#252b31';
      card.style.borderColor = '#383f46';
    }

    const iconWrap = make(doc, 'div');
    iconWrap.style.cssText =
      'width:52px;height:52px;flex:0 0 52px;background:#19232c;border-radius:4px;display:flex;align-items:center;justify-content:center;overflow:hidden';

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
      const desc = make(doc, 'div', achievement.description);
      desc.style.cssText =
        'font-size:12px;line-height:1.4;color:#acbdc9;margin-top:4px;overflow-wrap:anywhere';

      if (!achievement.unlocked) {
        desc.style.color = '#808991';
      }

      info.append(desc);
    }

    const status = make(
      doc,
      'div',
      achievement.unlocked
        ? achievement.unlockTime > 0
          ? new Date(achievement.unlockTime * 1000).toLocaleString()
          : 'Desbloqueado'
        : 'Bloqueado',
    );
    status.style.cssText = 'font-size:11px;color:#66c0f4;margin-top:6px';

    if (!achievement.unlocked) {
      status.style.color = '#737e88';
    }

    info.append(status);
    card.append(iconWrap, info);
    list.append(card);
    cards.push({ element: card, unlocked: achievement.unlocked });
  }

  const options = [
    { label: `Todos (${achievements.length})`, mode: 'all' },
    { label: `Conseguidos (${unlocked.length})`, mode: 'unlocked' },
    { label: `Bloqueados (${locked.length})`, mode: 'locked' },
  ] as const;

  const buttons: HTMLButtonElement[] = [];

  const selectFilter = (mode: 'all' | 'unlocked' | 'locked') => {
    for (const card of cards) {
      card.element.style.display =
        mode === 'all' ||
        (mode === 'unlocked' && card.unlocked) ||
        (mode === 'locked' && !card.unlocked)
          ? 'flex'
          : 'none';
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
      'border:0;border-radius:4px;padding:7px 9px;cursor:pointer;font-size:11px;background:#263746;color:#a9bac8';

    button.addEventListener('click', () => selectFilter(option.mode));

    buttons.push(button);
    filters.append(button);
  }

  selectFilter('all');
  section.append(filters, list);
  root.append(section);

  return root;
}
