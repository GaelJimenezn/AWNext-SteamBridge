import { findClassModule } from 'millennium';

export type Achievement = {
  id: string;
  name: string;
  description: string;
  icon?: string;
  unlocked: boolean;
  unlockTime: number;
};

export type AchievementResult = {
  title?: string;
  source?: string;
  total?: number;
  unlocked?: number;
  achievements?: Achievement[];
  error?: string;
  notConfigured?: boolean;
  stage?: string;
  configPath?: string;
  statePath?: string;
  schemaPath?: string;
};

export const PANEL_ID = 'awn-bridge-achievements';
const WRAPPER_ATTR = 'data-awn-bridge-wrapper';

type CssClasses = Record<string, string>;
type Placement =
  | { kind: 'gdl'; container: Element }
  | { kind: 'sidebar'; sidebarColumn: HTMLElement; anchorRegion: HTMLElement }
  | { kind: 'fallback'; host: HTMLElement };

// ---------------------------------------------------------------------------
// CSS class resolution
// Adapted from the runtime class lookup technique in Game Data Linker
// (MIT, copyright 2026 retrotoolsdev-wq). Full notice: resources/GDL-LICENSE.txt.
// ---------------------------------------------------------------------------
function achievementClasses(): CssClasses {
  try {
    return (
      findClassModule(
        (module: CssClasses) =>
          Boolean(
            module.AchievementHoverContainer &&
              module.UnlockedLabel &&
              module.SingleAchievementProgressBar,
          ),
      ) || {}
    );
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------
function make(doc: Document, tag: string, text?: string): HTMLElement {
  const element = doc.createElement(tag);
  if (text !== undefined) element.textContent = text;
  return element;
}

function localized(doc: Document, token: string, fallback: string): string {
  try {
    const manager = (doc.defaultView as any)?.LocalizationManager;
    const value =
      manager?.m_mapTokens?.get?.(token) ??
      manager?.m_mapFallbackTokens?.get?.(token);
    if (typeof value === 'string' && value.length > 0) return value;
  } catch {
    // LocalizationManager is not guaranteed in every Steam build.
  }
  return fallback;
}

function findByExactText(doc: Document, text: string): Element | null {
  const wanted = text.trim().toLowerCase();
  if (!wanted || !doc.body) return null;
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if ((node.textContent || '').trim().toLowerCase() === wanted)
      return node.parentElement;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Placement strategy
// ---------------------------------------------------------------------------

/**
 * Find the NOTES region (role="region" containing "Notes"/"Notas"/etc.)
 * Used as anchor to locate the sidebar column. Adapted from GDL's
 * injectGameData/epicComputeLayout layout detection.
 */
function findNotesRegion(doc: Document): HTMLElement | null {
  const labels = [
    localized(doc, 'AppDetails_SectionTitle_GameNotes', 'Notes'),
    localized(doc, 'AppDetails_SectionTitle_Media', 'Recordings and Screenshots'),
  ];
  for (const label of labels) {
    let el = findByExactText(doc, label);
    for (let depth = 0; el && depth < 8; depth += 1) {
      if (el.getAttribute('role') === 'region') return el as HTMLElement;
      el = el.parentElement;
    }
  }
  // Structural fallback: any region whose h2 matches known Notes labels.
  const regions = Array.from(doc.querySelectorAll('[role="region"]')) as HTMLElement[];
  return (
    regions.find((region) => {
      const h2 = region.querySelector('h2');
      const text = h2?.textContent || '';
      return /\b(notes|notas|notizen|note|anotações|anotacoes|メモ|笔记|노트)\b/i.test(text);
    }) || null
  );
}

/**
 * Derive the sidebar column by walking up from the NOTES region anchor.
 * The Steam library layout is: Panel > twoColRow(flex) > [sidebarCol, contentCol]
 * We identify the lowest common ancestor of the Notes region and the non-Steam
 * notice area (if present), then take the column parent of Notes as sidebarCol.
 *
 * When the notice element is not available (i.e., our plugin, which doesn't use
 * GDL-style notice detection), we simply walk up from anchorRegion and take the
 * grandparent's first flex child that contains the anchor.
 */
function findSidebarColumn(
  anchorRegion: HTMLElement,
): { sidebarColumn: HTMLElement; anchorWrap: HTMLElement | null } | null {
  // Walk up from the notes region parent and look for a flex container with
  // multiple children (the two-column row). The sidebar column is the
  // intermediate element between anchorRegion and twoColRow.
  let el: HTMLElement | null = anchorRegion.parentElement;
  for (let depth = 0; el && depth < 10; depth += 1) {
    const parent = el.parentElement;
    if (!parent) break;
    // Heuristic: the two-column row is typically a flex container with 2+ block children
    if (parent.childElementCount >= 2) {
      // The sidebar column is the child of parent that contains anchorRegion
      for (let i = 0; i < parent.children.length; i++) {
        const child = parent.children[i] as HTMLElement;
        if (child.contains(anchorRegion)) {
          return {
            sidebarColumn: child,
            anchorWrap: el !== anchorRegion ? el : null,
          };
        }
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
  console.info('[AWNext Bridge][PRESENT] notesRegion found', !!notesRegion);
  if (notesRegion) {
    const sidebar = findSidebarColumn(notesRegion);
    console.info('[AWNext Bridge][PRESENT] sidebarColumn found', !!sidebar);
    if (sidebar) {
      return { kind: 'sidebar', sidebarColumn: sidebar.sidebarColumn, anchorRegion: notesRegion };
    }
  }

  // 3. Fallback: append directly into any visible game-details content region.
  // This matches pages where Notes has not yet rendered but the page has body content.
  const possibleHosts = [
    doc.querySelector('[class*="GameDetailsSummary"]') as HTMLElement | null,
    doc.querySelector('[class*="GamePageContainer"]') as HTMLElement | null,
    doc.querySelector('[class*="BasicInfo"]') as HTMLElement | null,
    doc.querySelector('main') as HTMLElement | null,
  ];
  for (const host of possibleHosts) {
    if (host) {
      console.info('[AWNext Bridge][PRESENT] fallback host', host.tagName, host.className?.slice(0, 60));
      return { kind: 'fallback', host };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Panel content builders
// ---------------------------------------------------------------------------
function buildProgress(doc: Document, result: AchievementResult): HTMLElement {
  const classes = achievementClasses();
  const total = result.total || 0;
  const earned = result.unlocked || 0;
  const percent = total ? Math.round((earned / total) * 100) : 0;

  const highlight = make(doc, 'div');
  highlight.className = classes.HighlightDiv || '';

  const label = make(doc, 'div');
  label.className = classes.UnlockedLabel || '';
  label.style.fontSize = '13px';
  label.append(make(doc, 'span', `${earned}/${total} • ${percent}% local`));
  highlight.append(label);

  const bar = make(doc, 'div');
  bar.className = classes.AchievementProgressContainer || '';
  bar.style.cssText = 'height:5px;background:#344454;margin-top:7px';
  const fill = make(doc, 'div');
  fill.className = classes.AchievementProgress || '';
  fill.style.cssText = `height:100%;width:${percent}%;background:#66c0f4`;
  bar.append(fill);
  highlight.append(bar);

  return highlight;
}

function buildContents(doc: Document, result: AchievementResult): HTMLElement {
  const root = make(doc, 'div');
  root.id = PANEL_ID;
  root.setAttribute('data-achievement-source', 'awn-local');
  root.style.cssText = 'color:#dcdedf;font:13px Arial,sans-serif';

  const heading = make(doc, 'h3', 'Achievement Watcher Next · local');
  heading.style.cssText = 'font-size:14px;font-weight:600;margin:0 0 8px';
  root.append(heading);

  if (result.error) {
    root.append(make(doc, 'p', result.error));
    return root;
  }

  root.append(buildProgress(doc, result));

  const list = make(doc, 'div');
  list.style.cssText = 'max-height:340px;overflow:auto;margin-top:12px';
  const classes = achievementClasses();

  for (const achievement of result.achievements || []) {
    const row = make(doc, 'div');
    row.className = classes.AchievementHoverContainer || '';
    row.style.cssText =
      'display:flex;gap:10px;padding:8px 0;border-top:1px solid #324457;align-items:center';

    const image = doc.createElement('img');
    image.alt = '';
    image.width = 48;
    image.height = 48;
    image.className = classes.Icon || '';
    image.style.cssText = 'width:48px;height:48px;object-fit:contain;flex:none';
    if (achievement.icon?.startsWith('data:image/png;base64,')) image.src = achievement.icon;
    else image.style.visibility = 'hidden';

    const detail = make(doc, 'div');
    detail.className = classes.TextSection || '';

    const name = make(doc, 'strong', achievement.name);
    name.className = classes.Name || '';
    detail.append(name);

    if (achievement.description) {
      const desc = make(doc, 'div', achievement.description);
      desc.className = classes.Desc || '';
      detail.append(desc);
    }

    const dateStr =
      achievement.unlocked && achievement.unlockTime > 0
        ? new Date(achievement.unlockTime * 1000).toLocaleString()
        : achievement.unlocked
          ? 'Desbloqueado; fecha no disponible'
          : 'Bloqueado';
    const status = make(doc, 'small', dateStr);
    status.style.color = '#8fbcda';
    detail.append(status);

    row.append(image, detail);
    list.append(row);
  }

  root.append(list);
  return root;
}

/**
 * Build a sidebar section that mirrors the NOTES region chrome.
 * Adapted from GDL's buildSidebarSection (MIT, see GDL-LICENSE.txt).
 */
function buildSidebarSection(
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
  const placement = findPlacement(doc);
  console.info('[AWNext Bridge][PRESENT] hasPlacement', !!placement, placement?.kind);
  return placement !== null;
}

export function placePanel(doc: Document, result: AchievementResult): 'gdl' | 'sidebar' | 'fallback' | null {
  const placement = findPlacement(doc);
  console.info('[AWNext Bridge][PRESENT] placePanel', placement?.kind);
  if (!placement) {
    console.warn('[AWNext Bridge][UI] Cannot place panel - no placement found');
    return null;
  }
  removePanel(doc);
  const content = buildContents(doc, result);

  if (placement.kind === 'gdl') {
    placement.container.append(content);
    console.info('[AWNext Bridge][UI] placed in gdl container', (placement.container as HTMLElement).id);
    return 'gdl';
  }

  if (placement.kind === 'sidebar') {
    const wrapper = buildSidebarSection(
      doc,
      placement.anchorRegion,
      placement.sidebarColumn,
      content,
    );
    // Insert after the NOTES anchor region wrapper (or before the first child of sidebarColumn).
    const anchorWrap = placement.anchorRegion.parentElement;
    if (anchorWrap && anchorWrap.parentElement === placement.sidebarColumn) {
      anchorWrap.insertAdjacentElement('afterend', wrapper);
    } else {
      placement.sidebarColumn.insertBefore(wrapper, placement.sidebarColumn.firstChild);
    }
    console.info('[AWNext Bridge][UI] placed in sidebar column');
    return 'sidebar';
  }

  // Fallback: just append to the host element.
  const wrapper = make(doc, 'div');
  wrapper.setAttribute(WRAPPER_ATTR, '1');
  wrapper.style.cssText = 'padding:12px;border-top:1px solid #2a3f52';
  wrapper.append(content);
  placement.host.append(wrapper);
  console.info('[AWNext Bridge][UI] placed via fallback host');
  return 'fallback';
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
