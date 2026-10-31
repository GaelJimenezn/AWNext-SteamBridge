// Steam library identification and non-Steam shortcut detection.
// Uses Steam runtime APIs when available.

const NON_STEAM_NOTICE_FALLBACK =
  'Some detailed information on %1$s is unavailable because it is a non-Steam game or mod. ' +
  'Steam will still manage launching the game for you and in most cases the in-game overlay will be available.';

export function localized(doc: Document, token: string, fallback: string): string {
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

export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function templateToRegex(template: string): RegExp | null {
  const parts = template.split('%1$s');
  if (parts.length < 2) return null;
  const escaped = parts.map((p) => escapeRegex(p.trim()).replace(/\s+/g, '\\s+'));
  return new RegExp(escaped.join('\\s*(.+?)\\s*'), 'i');
}

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

export function getPageGameTitle(doc: Document): string | null {
  const notice = findNonSteamNotice(doc);
  if (notice?.title) return notice.title;
  const titleEl = doc.querySelector(
    '[class*="GameDetailsHeader"] [class*="Title"], [class*="HeaderLabel"], [class*="header_Title"], [class*="GameName"]',
  );
  if (titleEl?.textContent) return titleEl.textContent.trim();
  return null;
}
