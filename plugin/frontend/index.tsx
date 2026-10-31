import { definePlugin, Millennium } from 'millennium';
import {
  AchievementResult,
  findShortcutAppIdByName,
  getPageGameTitle,
  hasPlacement,
  PANEL_ID,
  placePanel,
  reconcilePlacement,
  removePanel,
} from './presentation';

const observed = new WeakSet<Document>();

/**
 * Extract shortcut AppID using Steam navigation, stores, and URL fallback.
 * Non-Steam shortcuts have numeric AppIDs in the range [2^31, 2^32-1].
 */
function shortcutId(doc: Document): string | null {
  const win = doc.defaultView || (typeof window !== 'undefined' ? window : null);
  if (!win) return null;

  // 1. Navigation & URL inspection
  const href = win.location?.href ?? '';
  const pathname = win.location?.pathname ?? '';
  const hash = win.location?.hash ?? '';
  const search = win.location?.search ?? '';

  for (const src of [href, pathname, hash, search]) {
    if (!src) continue;
    const match =
      src.match(/(?:app|apps|details|game|library)\/(\d+)(?:[/?#]|$)/i) ||
      src.match(/[?&]appid=(\d+)/i) ||
      src.match(/steam:\/\/nav\/games\/details\/(\d+)/i);
    if (match) {
      const id = Number(match[1]);
      if (Number.isSafeInteger(id) && id >= 2147483648 && id <= 4294967295) {
        return String(match[1]);
      }
    }
  }

  // 2. React Router / window.history state inspection
  try {
    const historyState = win.history?.state;
    if (historyState) {
      const stateStr = JSON.stringify(historyState);
      const match =
        stateStr.match(/\/app\/(\d+)/) ||
        stateStr.match(/"appid":\s*"?(\d+)"?/) ||
        stateStr.match(/"appId":\s*"?(\d+)"?/);
      if (match) {
        const id = Number(match[1]);
        if (Number.isSafeInteger(id) && id >= 2147483648 && id <= 4294967295) {
          return String(match[1]);
        }
      }
    }
  } catch {}

  // 3. Steam AppDetails store
  try {
    const appDetailsStore = (win as any).appDetailsStore || (window as any).appDetailsStore;
    const currentAppId = appDetailsStore?.m_currentAppId ?? appDetailsStore?.currentAppId;
    if (currentAppId) {
      const id = Number(currentAppId);
      if (Number.isSafeInteger(id) && id >= 2147483648 && id <= 4294967295) {
        return String(currentAppId);
      }
    }
  } catch {}

  // 4. Non-Steam notice / Game title + appStore.m_mapApps lookup
  try {
    const title = getPageGameTitle(doc);
    if (title) {
      const resolvedId = findShortcutAppIdByName(doc, title);
      if (resolvedId) return resolvedId;
    }
  } catch {}

  return null;
}

function startObserving(doc: Document): void {
  if (observed.has(doc)) return;
  observed.add(doc);
  console.info('[AWNext Bridge][HOOK] Observing document for window:', doc.defaultView?.name || 'Main');

  let active = '';
  let lastRead = 0;
  let lastResult: AchievementResult | null = null;
  let placementRetries = 0;
  const MAX_PLACEMENT_RETRIES = 25;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const update = async () => {
    const id = shortcutId(doc);
    if (!id) {
      if (active) {
        removePanel(doc);
        console.info('[AWNext Bridge][UI] Panel removed for shortcut', active);
        active = '';
        lastResult = null;
        placementRetries = 0;
      }
      return;
    }

    if (active !== id) {
      console.info('[AWNext Bridge][MAPPING] AppID detectado:', id);
    }

    // Wait until placement is available (Notes region rendered in Steam React DOM)
    if (!hasPlacement(doc)) {
      placementRetries += 1;
      if (placementRetries < MAX_PLACEMENT_RETRIES) {
        if (!timer) {
          timer = setTimeout(() => {
            timer = undefined;
            void update();
          }, 300);
        }
      }
      return;
    }

    placementRetries = 0;

    // Panel already placed for this app and data is fresh â†’ reconcile or restore
    if (active === id && Date.now() - lastRead < 30000) {
      if (doc.getElementById(PANEL_ID)) {
        reconcilePlacement(doc);
      } else if (lastResult && !lastResult.notConfigured) {
        const placement = placePanel(doc, lastResult);
        if (placement) {
          console.info('[AWNext Bridge][UI] InserciÃ³n del panel (' + placement + ') para', id);
        }
      }
      return;
    }

    // App changed â†’ clear cached result
    if (active !== id) lastResult = null;
    active = id;
    lastRead = Date.now();

    console.info('[AWNext Bridge][BACKEND] Invocando backend.get_achievements() para', id);
    let result: AchievementResult;
    try {
      const response = await backend.get_achievements(id);

      result = (
        typeof response === 'string'
          ? JSON.parse(response)
          : response
      ) as AchievementResult;

      console.info(
        '[AWNext Bridge][BACKEND] Respuesta normalizada:',
        result?.total,
        result?.unlocked
      );
      console.info('[AWNext Bridge][BACKEND] Resultado RPC recibido para', id);
    } catch (error) {
      console.error('[AWNext Bridge][BACKEND] Resultado RPC fallido:', error);
      result = { stage: 'BACKEND', error: 'No se pudieron leer los logros locales de AWN.' };
    }

    // Guard against stale responses if user navigated away during RPC
    if (shortcutId(doc) !== id) return;
    lastResult = result;

    if (result.notConfigured) {
      removePanel(doc);
      return;
    }

    console.info(
      '[AWNext Bridge][DATA] NÃºmero de logros: ' +
        (result.unlocked ?? 0) +
        '/' +
        (result.total ?? 0) +
        ' para ' +
        id,
    );

    const placement = placePanel(doc, result);
    if (placement) {
      console.info('[AWNext Bridge][UI] InserciÃ³n del panel (' + placement + ') para', id);
    }
  };

  const observer = new MutationObserver(() => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = undefined;
      void update();
    }, 250);
  });

  observer.observe(doc.body, { childList: true, subtree: true });

  // Periodic refresh for data freshness (30 s)
  doc.defaultView?.setInterval(() => {
    if (doc.body.isConnected) {
      void update();
    }
  }, 30000);

  void update();
}

function windowCreated(context: {
  window?: Window;
  m_strName?: string;
  m_strTitle?: string;
}): void {
  const doc = context.window?.document;
  const name = context.m_strName ?? '';

  if (!doc) return;

  // Filter out popups that are definitely not the library window
  if (
    name.includes('Login') ||
    name.includes('Overlay') ||
    name.includes('Friends') ||
    name.includes('Chat') ||
    name.includes('Menu')
  ) {
    return;
  }

  console.info('[AWNext Bridge][HOOK] Ventana detectada:', name || 'SP Desktop');

  if (!doc.body) {
    const timer = doc.defaultView?.setInterval(() => {
      if (!doc.body) return;
      doc.defaultView?.clearInterval(timer);
      startObserving(doc);
    }, 250);
    return;
  }

  startObserving(doc);
}

function attachToCurrentWindow(): void {
  if (typeof window === 'undefined' || !window.document) return;
  const doc = window.document;
  if (doc.body) {
    startObserving(doc);
    return;
  }
  const timer = window.setInterval(() => {
    if (!doc.body) return;
    window.clearInterval(timer);
    startObserving(doc);
  }, 250);
}

export default definePlugin(() => {
  void (async () => {
    console.info('[AWN-DEBUG] Starting RPC diagnostic');

    try {
      const fn = (backend as any)?.bridge_ping;

      if (typeof fn !== 'function') {
        console.error('[AWN-DEBUG] RPC function unavailable');
        return;
      }

      const response = await fn();

      console.info('[AWN-DEBUG] RPC response type:', typeof response);
      console.info('[AWN-DEBUG] RPC response JSON:', JSON.stringify(response));
      console.info(
        '[AWN-DEBUG] RPC response keys:',
        response && typeof response === 'object'
          ? Object.keys(response)
          : 'not an object'
      );

      if (typeof response !== 'string') {
        console.error('[AWN-DEBUG] Unexpected response type:', typeof response);
        return;
      }

      const parsed = JSON.parse(response);
      console.info('[AWN-DEBUG] RPC SUCCESS:', parsed);
    } catch (error) {
      console.error('[AWN-DEBUG] RPC FAILED:', error);
    }
  })();
  console.info('[AWNext Bridge][HOOK] InicializaciÃ³n de AWNext Steam Bridge');
  try {
    Millennium.AddWindowCreateHook?.(windowCreated);
    console.info('[AWNext Bridge][HOOK] Window create hook registrado en Millennium');
  } catch (error) {
    console.error('[AWNext Bridge][HOOK] Error registrando window create hook:', error);
  }

  attachToCurrentWindow();

  return {
    title: 'AWNext Steam Bridge',
    icon: <span>â˜…</span>,
    content: (
      <div>
        Logros locales de AWN para accesos directos configurados en bridge-config.json.
      </div>
    ),
  };
});

