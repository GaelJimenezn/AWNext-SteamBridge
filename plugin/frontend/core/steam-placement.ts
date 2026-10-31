import { findNonSteamNotice, isPlayArea, localized } from './steam-navigation';

// Resolve the achievement section placement in Steam.
// GDL compatibility is limited to supported DOM containers.

export type Placement =
  | { kind: 'gdl'; container: Element }
  | { kind: 'sidebar'; sidebarColumn: HTMLElement; anchorRegion: HTMLElement };

export function findNotesRegion(doc: Document): HTMLElement | null {
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

export function findSidebarColumn(
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

export function findPlacement(doc: Document): Placement | null {
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
