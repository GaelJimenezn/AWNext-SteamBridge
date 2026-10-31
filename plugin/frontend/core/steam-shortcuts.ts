export type SteamShortcut = { appid: string; name: string };
let cached: SteamShortcut[] = [];

/** Store comes from the Steam library window, NOT the settings popup. */
export function captureSteamShortcuts(doc: Document): void {
  try {
    const win = doc.defaultView as any;
    const store = win?.appStore?.m_mapApps;
    if (!store || typeof store.entries !== 'function') return;
    const found: SteamShortcut[] = [];
    for (const [rawId, app] of store.entries()) {
      const id = Number(rawId);
      if (!Number.isSafeInteger(id) || id < 2147483648 || id > 4294967295) continue;
      const name = String(app?.display_name ?? app?.m_strDisplayName ?? '').trim();
      if (!name) continue;
      found.push({ appid: String(id), name });
    }
    // Do not erase a previously captured library because a popup has a partial store.
    if (found.length) {
      const merged = new Map(cached.map(item => [item.appid, item]));
      for (const item of found) merged.set(item.appid, item);
      cached = [...merged.values()].sort((a, b) => a.name.localeCompare(b.name));
    }
  } catch (err) {
    console.warn('[AWNext Bridge] Steam shortcut discovery failed', err);
  }
}

export function getSteamShortcuts(): SteamShortcut[] {
  return [...cached];
}