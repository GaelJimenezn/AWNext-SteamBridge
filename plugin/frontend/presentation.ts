import { findPlacement } from './core/steam-placement';
export {
  isPlayArea,
  findNonSteamNotice,
  findShortcutAppIdByName,
  getPageGameTitle,
} from './core/steam-navigation';
import { buildContents, PANEL_ID } from './ui/achievement-content';
export { PANEL_ID } from './ui/achievement-content';
import { make } from './shared/dom';
import type { AchievementResult } from './models/achievement';
export type { Achievement, AchievementResult } from './models/achievement';

const WRAPPER_ATTR = 'data-awn-bridge-wrapper';

// ---------------------------------------------------------------------------
// CSS class resolution
// Adapted from the runtime class lookup technique in Game Data Linker
// (MIT, copyright 2026 retrotoolsdev-wq). Full notice: resources/GDL-LICENSE.txt.
// ---------------------------------------------------------------------------

/**
 * Check whether an element is part of or contains the play controls bar
 * (JUGAR button, Última sesión, Tiempo de juego / Playtime).
 */

/**
 * Locate the non-Steam shortcut explanation notice in the content area and extract the game title.
 */

/**
 * Lookup shortcut AppID by game display name in Steam's native appStore.m_mapApps.
 */

/**
 * Extract active game title from the page notice or header.
 */

// ---------------------------------------------------------------------------
// Placement strategy
// ---------------------------------------------------------------------------

/**
 * Find the NOTES region (role="region" containing "Notes"/"Notas"/etc.)
 * Robust against Spanish UI («NOTAS») and structural variations.
 */

/**
 * Derive the sidebar column by using LCA with the notice element or walking up
 * to the two-column row. Validates that the play area is never selected.
 */

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
