import { make } from './shared/dom';
import type { AchievementResult } from './models/achievement';
export type { Achievement, AchievementResult } from './models/achievement';


export const PANEL_ID = 'awn-bridge-achievements';
const WRAPPER_ATTR = 'data-awn-bridge-wrapper';


type Placement =
  | { kind: 'gdl'; container: Element }
  | { kind: 'sidebar'; sidebarColumn: HTMLElement; anchorRegion: HTMLElement };

// ---------------------------------------------------------------------------
// CSS class resolution
// Adapted from the runtime class lookup technique in Game Data Linker
// (MIT, copyright 2026 retrotoolsdev-wq). Full notice: resources/GDL-LICENSE.txt.
// ---------------------------------------------------------------------------


function localized(doc: Document, token: string, fallback: string): string {
  try {
    const manager =
      (doc.defaultView as any)?.LocalizationManager ??
      (window as any)?.LocalizationManager;
    const value =
      manager?.m_mapTokens?.get?.(token) ??
      manager?.m_mapFallbackTokens?.get?.(token);
    if (typeof value === 'string' && value.length > 0) return value;
  } catch {
    // LocalizationManager is not guaranteed in every Steam build.
  }
  return fallback;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function templateToRegex(template: string): RegExp | null {
  const parts = template.split('%1$s');
  if (parts.length < 2) return null;
  const escaped = parts.map((p) => escapeRegex(p.trim()).replace(/\s+/g, '\\s+'));
  return new RegExp(escaped.join('\\s*(.+?)\\s*'), 'i');
}

/**
 * Check whether an element is part of or contains the play controls bar
 * (JUGAR button, Última sesión, Tiempo de juego / Playtime).
 */
export function isPlayArea(el: Element | null): boolean {
  if (!el) return false;
  if (
    el.querySelector(
      '[class*="PlayButton"], [class*="playButton"], [class*="PlayBar"], [class*="PlayAction"], [class*="playtime"], [class*="Playtime"], [class*="LastPlayed"]',
    )
  ) {
    return true;
  }
  const buttons = el.querySelectorAll('button, div[role="button"]');
  for (let i = 0; i < buttons.length; i++) {
    const txt = (buttons[i].textContent || '').trim().toLowerCase();
    if (txt === 'jugar' || txt === 'play' || txt.startsWith('jugar ') || txt.startsWith('play ')) {
      return true;
    }
  }
  return false;
}

const NON_STEAM_NOTICE_FALLBACK =
  'Some detailed information on %1$s is unavailable because it is a non-Steam game or mod. ' +
  'Steam will still manage launching the game for you and in most cases the in-game overlay will be available.';

/**
 * Locate the non-Steam shortcut explanation notice in the content area and extract the game title.
 */
export function findNonSteamNotice(doc: Document): { element: Element; title: string } | null {
  if (!doc.body) return null;
  const template = localized(doc, 'AppDetails_Shortcut_Explanation', NON_STEAM_NOTICE_FALLBACK);

  if (template.includes('%1$s')) {
    const parts = template.split('%1$s');
    const anchorText = parts
      .reduce((a, b) => (b.trim().length > a.trim().length ? b : a), '')
      .trim()
      .slice(0, 50);

    if (anchorText) {
      const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const text = node.textContent || '';
        if (text.includes(anchorText)) {
          const parent = node.parentElement;
          if (parent) {
            const rx = templateToRegex(template);
            const m = rx ? (parent.textContent || '').match(rx) : null;
            if (m && m[1]) return { element: parent, title: m[1].trim() };
          }
        }
      }
    }
  }

  // Regex fallback for Spanish & English standard wording
  const noticeRxList = [
    /(.+?)\s+es un juego que no es de Steam/i,
    /(?:Some detailed information on\s+)?(.+?)\s+is a non-Steam game/i,
    /(.+?)\s+no es de Steam/i,
  ];

  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  let textNode: Node | null;
  while ((textNode = walker.nextNode())) {
    const content = (textNode.textContent || '').trim();
    if (content.length > 20 && (content.includes('Steam') || content.includes('steam'))) {
      for (const rx of noticeRxList) {
        const m = content.match(rx);
        if (m && m[1] && textNode.parentElement) {
          return { element: textNode.parentElement, title: m[1].trim() };
        }
      }
    }
  }

  return null;
}

/**
 * Lookup shortcut AppID by game display name in Steam's native appStore.m_mapApps.
 */
export function findShortcutAppIdByName(doc: Document, title: string): string | null {
  const normalized = title.trim().toLowerCase();
  if (!normalized) return null;
  const appStore =
    (doc.defaultView as any)?.appStore || (window as any)?.appStore;
  if (!appStore?.m_mapApps) return null;
  const SHORTCUT_THRESHOLD = 2147483648; // 2^31

  for (const [id, app] of appStore.m_mapApps) {
    const numId = Number(id);
    if (!Number.isSafeInteger(numId) || numId < SHORTCUT_THRESHOLD || numId > 4294967295) {
      continue;
    }
    const name = String(app?.display_name || app?.m_strDisplayName || '')
      .trim()
      .toLowerCase();
    if (name && name === normalized) {
      return String(id);
    }
  }
  return null;
}

/**
 * Extract active game title from the page notice or header.
 */
export function getPageGameTitle(doc: Document): string | null {
  const notice = findNonSteamNotice(doc);
  if (notice?.title) return notice.title;
  const titleEl = doc.querySelector(
    '[class*="GameDetailsHeader"] [class*="Title"], [class*="HeaderLabel"], [class*="header_Title"], [class*="GameName"]',
  );
  if (titleEl?.textContent) return titleEl.textContent.trim();
  return null;
}

// ---------------------------------------------------------------------------
// Placement strategy
// ---------------------------------------------------------------------------

/**
 * Find the NOTES region (role="region" containing "Notes"/"Notas"/etc.)
 * Robust against Spanish UI («NOTAS») and structural variations.
 */
function findNotesRegion(doc: Document): HTMLElement | null {
  if (!doc.body) return null;
  const labels = [
    localized(doc, 'AppDetails_SectionTitle_GameNotes', 'Notas'),
    localized(doc, 'AppDetails_SectionTitle_GameNotes', 'Notes'),
    localized(doc, 'AppDetails_SectionTitle_Media', 'Grabaciones y capturas'),
    localized(doc, 'AppDetails_SectionTitle_Media', 'Recordings and Screenshots'),
    'NOTAS',
    'Notas',
    'NOTES',
    'Notes',
    'Grabaciones y capturas',
    'Recordings and Screenshots',
  ];

  // 1. Check headings without walking the full text tree
  const headings = Array.from(
    doc.querySelectorAll(
      'h2, [role="heading"], h3, div[class*="SectionTitle"], div[class*="sectionTitle"], div[class*="header"]',
    ),
  );

  for (const h of headings) {
    const text = (h.textContent || '').trim();
    if (!text) continue;
    const lower = text.toLowerCase();
    const matched =
      labels.some((l) => l.toLowerCase() === lower) || /\b(notas|notes)\b/i.test(text);

    if (matched) {
      // Walk up to find the enclosing section container
      let el: HTMLElement | null = h as HTMLElement;
      for (let depth = 0; el && depth < 6; depth += 1) {
        if (isPlayArea(el)) break;
        if (el.getAttribute('role') === 'region' || el.tagName === 'SECTION') {
          return el;
        }
        const parent = el.parentElement;
        if (parent && parent.childElementCount >= 2 && !isPlayArea(parent)) {
          if (el.querySelector('div') && el.contains(h)) {
            if (parent.parentElement && !isPlayArea(parent.parentElement)) {
              return el;
            }
          }
        }
        el = el.parentElement;
      }
      const fallbackContainer =
        (h.closest('[role="region"], section, [class*="Section"]') as HTMLElement) ||
        h.parentElement;
      if (fallbackContainer && !isPlayArea(fallbackContainer)) {
        return fallbackContainer;
      }
    }
  }

  // 2. Structural fallback: [role="region"] or section matching notes/notas
  const regions = Array.from(
    doc.querySelectorAll('[role="region"], section'),
  ) as HTMLElement[];
  for (const region of regions) {
    if (isPlayArea(region)) continue;
    const heading = region.querySelector(
      'h2, [role="heading"], h3, div[class*="Title"]',
    );
    const text = (heading?.textContent || '').trim();
    if (
      /\b(notes|notas|notizen|note|anotações|anotacoes|grabaciones|recordings)\b/i.test(
        text,
      )
    ) {
      return region;
    }
  }

  return null;
}

/**
 * Derive the sidebar column by using LCA with the notice element or walking up
 * to the two-column row. Validates that the play area is never selected.
 */
function findSidebarColumn(
  anchorRegion: HTMLElement,
  noticeElement?: Element | null,
): { sidebarColumn: HTMLElement; anchorWrap: HTMLElement | null } | null {
  // Method 1: If noticeElement is available in the content column, use LCA
  if (noticeElement) {
    const getChain = (e: Element): HTMLElement[] => {
      const chain: HTMLElement[] = [e as HTMLElement];
      let cur: HTMLElement | null = e as HTMLElement;
      while (cur.parentElement) {
        chain.push(cur.parentElement);
        cur = cur.parentElement;
      }
      return chain;
    };
    const noticeChain = getChain(noticeElement);
    const anchorChain = getChain(anchorRegion);
    for (let ai = 1; ai < anchorChain.length; ai += 1) {
      const ni = noticeChain.indexOf(anchorChain[ai]);
      if (ni > 0) {
        const twoColRow = anchorChain[ai];
        const sidebarCol = anchorChain[ai - 1];
        if (!isPlayArea(sidebarCol) && !isPlayArea(twoColRow)) {
          return {
            sidebarColumn: sidebarCol,
            anchorWrap:
              anchorRegion.parentElement !== sidebarCol ? anchorRegion.parentElement : null,
          };
        }
      }
    }
  }

  // Method 2: Climb up from anchorRegion, looking for the sidebar column
  let el: HTMLElement | null = anchorRegion.parentElement;
  for (let depth = 0; el && depth < 8; depth += 1) {
    const parent = el.parentElement;
    if (!parent || parent === el.ownerDocument?.body || isPlayArea(parent)) break;
    if (isPlayArea(el)) break;

    // Two-column row is typically a flex container with 2 or 3 block children
    if (parent.childElementCount >= 2 && parent.childElementCount <= 4) {
      if (el.contains(anchorRegion) && !isPlayArea(el)) {
        return {
          sidebarColumn: el,
          anchorWrap: anchorRegion.parentElement !== el ? anchorRegion.parentElement : null,
        };
      }
    }
    el = parent;
  }

  return null;
}

function findPlacement(doc: Document): Placement | null {
  // 1. GDL container: prefer it when GDL is active to avoid duplicate panels.
  const gdlContent =
    doc.getElementById('gdl-achievements-content') ||
    doc.getElementById('gdl-epic-ach-content');
  if (gdlContent) return { kind: 'gdl', container: gdlContent };

  // 2. Sidebar placement: find NOTES region → sidebar column → insert next to NOTES.
  const notesRegion = findNotesRegion(doc);
  if (notesRegion) {
    const noticeInfo = findNonSteamNotice(doc);
    const sidebar = findSidebarColumn(notesRegion, noticeInfo?.element);
    if (sidebar) {
      return {
        kind: 'sidebar',
        sidebarColumn: sidebar.sidebarColumn,
        anchorRegion: notesRegion,
      };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Panel content builders
// ---------------------------------------------------------------------------
function buildContents(doc: Document, result: AchievementResult): HTMLElement {
  const root = make(doc, 'div');
  root.id = PANEL_ID;
  root.setAttribute('data-achievement-source', 'awn-local');
  root.style.cssText = 'color:#dcdedf;font:13px Arial,sans-serif;width:100%;min-width:0;box-sizing:border-box';

  if (result.error) {
    const error = make(doc, 'p', result.error);
    error.style.cssText = 'color:#e4a3a3;padding:8px';
    root.append(error);
    return root;
  }

  const achievements = result.achievements || [];
  const unlocked = achievements.filter(a => a.unlocked);
  const locked = achievements.filter(a => !a.unlocked);

  const total = result.total ?? achievements.length;
  const earned = result.unlocked ?? unlocked.length;
  const percent = total ? Math.round(earned / total * 100) : 0;

  const header = make(doc, 'div');
  header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px';

  const count = make(doc, 'strong', `${earned} de ${total}`);
  count.style.cssText = 'font-size:16px;color:#fff';

  const percentage = make(doc, 'span', `${percent}%`);
  percentage.style.cssText = 'color:#66c0f4;font-size:13px';

  header.append(count, percentage);
  root.append(header);

  const bar = make(doc, 'div');
  bar.style.cssText = 'height:6px;background:#344454;border-radius:4px;overflow:hidden;margin-bottom:12px';

  const fill = make(doc, 'div');
  fill.style.cssText = `width:${percent}%;height:100%;background:#66c0f4`;
  bar.append(fill);
  root.append(bar);

  // Steam-style compact preview: four latest unlocked achievements.
  const recent = [...unlocked]
    .sort((a, b) => b.unlockTime - a.unlockTime)
    .slice(0, 4);

  const previewTitle = make(
    doc,
    'div',
    'LOGROS DESBLOQUEADOS RECIENTEMENTE'
  );
  previewTitle.style.cssText =
    'font-size:10px;letter-spacing:0.7px;color:#8f98a0;margin:12px 0 8px';
  root.append(previewTitle);

  const preview = make(doc, 'div');
  preview.style.cssText =
    'display:flex;gap:7px;align-items:center;margin-bottom:12px';

  for (const achievement of recent) {
    const slot = make(doc, 'div');
    slot.title = achievement.name;
    slot.style.cssText =
      'width:48px;height:48px;flex:0 0 48px;background:#17232e;border-radius:3px;display:flex;align-items:center;justify-content:center;overflow:hidden';

    if (achievement.icon?.startsWith('data:image/png;base64,')) {
      const image = doc.createElement('img');
      image.src = achievement.icon;
      image.alt = achievement.name;
      image.style.cssText =
        'width:100%;height:100%;object-fit:contain';
      slot.append(image);
    } else {
      const fallback = make(doc, 'span', '★');
      fallback.style.cssText = 'color:#66c0f4;font-size:22px';
      slot.append(fallback);
    }

    preview.append(slot);
  }

  if (unlocked.length > recent.length) {
    const extra = make(
      doc,
      'span',
      `+${unlocked.length - recent.length}`
    );
    extra.style.cssText =
      'color:#8f98a0;font-size:12px;margin-left:3px';
    preview.append(extra);
  }

  root.append(preview);

  const section = make(doc, 'details') as HTMLDetailsElement;
  section.style.cssText = 'width:100%;min-width:0';

  const summary = make(doc, 'summary', 'Ver mis logros');
  summary.style.cssText = 'cursor:pointer;color:#c7d5e0;padding:10px 0;font-weight:600;border-top:1px solid #344454';
  section.append(summary);

  const filters = make(doc, 'div');
  filters.style.cssText = 'display:flex;flex-wrap:wrap;gap:5px;margin:8px 0 12px';

  const list = make(doc, 'div');
  list.style.cssText = 'display:flex;flex-direction:column;gap:8px;max-height:460px;overflow-y:auto;overflow-x:hidden';

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
      image.style.cssText =
        'width:48px;height:48px;object-fit:contain';

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
        : 'Bloqueado'
    );
    status.style.cssText =
      'font-size:11px;color:#66c0f4;margin-top:6px';

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

/**
 * Build a sidebar section that mirrors the NOTES region chrome.
 * Adapted from GDL's buildSidebarSection (MIT, see GDL-LICENSE.txt).
 */function buildSidebarSection(
  doc: Document,
  anchorRegion: HTMLElement,
  sidebarColumn: HTMLElement,
  body: HTMLElement,
): HTMLElement {
  const regionChildren = Array.from(anchorRegion.children);
  const sourceH2 = regionChildren.find((c) => c.tagName === 'H2') as HTMLElement | undefined;
  const sourceBody = regionChildren.find((c) => c.tagName === 'DIV') as HTMLElement | undefined;

  const region = make(doc, 'div');
  region.setAttribute('role', 'region');
  region.className = anchorRegion.className;

  // Clone and re-label the heading from NOTES.
  if (sourceH2) {
    const h2 = sourceH2.cloneNode(true) as HTMLElement;
    const headingText = h2.querySelector('div div') || h2.querySelector('div') || h2;
    headingText.textContent = 'Logros locales';
    region.append(h2);
  } else {
    const h2 = make(doc, 'h2', 'Logros locales');
    h2.style.cssText = 'font-size:11px;font-weight:600;letter-spacing:1.5px;color:#8f98a0;margin:0 0 8px';
    region.append(h2);
  }

  // Clone body panel structure.
  const panel = make(doc, 'div');
  if (sourceBody) panel.className = sourceBody.className;
  panel.style.padding = '12px';
  panel.append(body);
  region.append(panel);

  // Wrap in the same slot wrapper class used by the NOTES parent.
  const anchorWrap = anchorRegion.parentElement;
  let outer: HTMLElement = region;
  if (anchorWrap && anchorWrap.parentElement === sidebarColumn) {
    const wrap = make(doc, 'div');
    wrap.className = anchorWrap.className;
    wrap.append(region);
    outer = wrap;
  }
  outer.setAttribute(WRAPPER_ATTR, '1');
  return outer;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export function hasPlacement(doc: Document): boolean {
  return findPlacement(doc) !== null;
}

export function placePanel(
  doc: Document,
  result: AchievementResult,
): 'gdl' | 'sidebar' | null {
  const placement = findPlacement(doc);
  if (!placement) {
    return null;
  }
  removePanel(doc);
  const content = buildContents(doc, result);

  if (placement.kind === 'gdl') {
    placement.container.append(content);
    return 'gdl';
  }

  if (placement.kind === 'sidebar') {
    const wrapper = buildSidebarSection(
      doc,
      placement.anchorRegion,
      placement.sidebarColumn,
      content,
    );
    // Insert after the NOTES anchor region wrapper (or after anchorRegion directly)
    const anchorWrap = placement.anchorRegion.parentElement;
    if (anchorWrap && anchorWrap.parentElement === placement.sidebarColumn) {
      anchorWrap.insertAdjacentElement('afterend', wrapper);
    } else {
      placement.anchorRegion.insertAdjacentElement('afterend', wrapper);
    }
    return 'sidebar';
  }

  return null;
}

export function reconcilePlacement(doc: Document): void {
  const panel = doc.getElementById(PANEL_ID);
  const placement = findPlacement(doc);
  if (!panel || !placement) return;
  if (placement.kind === 'gdl' && panel.parentElement !== placement.container) {
    doc.querySelector(`[${WRAPPER_ATTR}]`)?.remove();
    placement.container.append(panel);
  }
}

export function removePanel(doc: Document): void {
  doc.querySelectorAll(`[${WRAPPER_ATTR}]`).forEach((el) => el.remove());
  doc.getElementById(PANEL_ID)?.remove();
}
