import { buildContents, PANEL_ID } from './ui/achievement-content';
export { PANEL_ID } from './ui/achievement-content';
import { make } from './shared/dom';
import type { AchievementResult } from './models/achievement';
export type { Achievement, AchievementResult } from './models/achievement';

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
      (doc.defaultView as any)?.LocalizationManager ?? (window as any)?.LocalizationManager;
    const value = manager?.m_mapTokens?.get?.(token) ?? manager?.m_mapFallbackTokens?.get?.(token);
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
  const appStore = (doc.defaultView as any)?.appStore || (window as any)?.appStore;
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
  const regions = Array.from(doc.querySelectorAll('[role="region"], section')) as HTMLElement[];
  for (const region of regions) {
    if (isPlayArea(region)) continue;
    const heading = region.querySelector('h2, [role="heading"], h3, div[class*="Title"]');
    const text = (heading?.textContent || '').trim();
    if (/\b(notes|notas|notizen|note|anotações|anotacoes|grabaciones|recordings)\b/i.test(text)) {
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
    doc.getElementById('gdl-achievements-content') || doc.getElementById('gdl-epic-ach-content');
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

/**
 * Build a sidebar section that mirrors the NOTES region chrome.
 * Adapted from GDL's buildSidebarSection (MIT, see GDL-LICENSE.txt).
 */ function buildSidebarSection(
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
    h2.style.cssText =
      'font-size:11px;font-weight:600;letter-spacing:1.5px;color:#8f98a0;margin:0 0 8px';
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

export function placePanel(doc: Document, result: AchievementResult): 'gdl' | 'sidebar' | null {
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
