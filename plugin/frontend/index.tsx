import { definePlugin, Millennium } from 'millennium';
import {
  AchievementResult,
  hasPlacement,
  PANEL_ID,
  placePanel,
  reconcilePlacement,
  removePanel,
} from './presentation';

const observed = new WeakSet<Document>();

/**
 * Extract shortcut AppID from the current page URL.
 * Non-Steam shortcuts have numeric AppIDs in the range [2^31, 2^32-1].
 */
function shortcutId(doc: Document): string | null {
  const href = doc.defaultView?.location?.href ?? '';
  const match = href.match(/\/app\/(\d+)(?:[/?#]|$)/);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isSafeInteger(id) && id >= 2147483648 && id <= 4294967295 ? match[1] : null;
}

function startObserving(doc: Document): void {
  if (observed.has(doc)) return;
  observed.add(doc);

  let active = '';
  let lastRead = 0;
  let lastResult: AchievementResult | null = null;
  let warnedPlacement = false;
  let placementRetries = 0;
  const MAX_PLACEMENT_RETRIES = 20;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const update = async () => {
    const id = shortcutId(doc);
    console.info(
      '[AWNext Bridge][SCAN] location',
      doc.defaultView?.location?.href,
      'shortcutId',
      id,
    );
    if (!id) {
      removePanel(doc);
      active = '';
      lastResult = null;
      warnedPlacement = false;
      placementRetries = 0;
      return;
    }

    // If we have a cached result and placement is missing, keep retrying for
    // a while — Steam's React may render the Notes region slightly late.
    if (!hasPlacement(doc)) {
      placementRetries += 1;
      if (!warnedPlacement || placementRetries % 5 === 0) {
        console.warn(
          '[AWNext Bridge][UI] Placement not ready (retry',
          placementRetries + '/' + MAX_PLACEMENT_RETRIES + ') for',
          id,
        );
        warnedPlacement = true;
      }
      if (placementRetries < MAX_PLACEMENT_RETRIES) {
        // Schedule a retry soon — the Notes region may still be rendering.
        if (!timer) {
          timer = setTimeout(() => {
            timer = undefined;
            void update();
          }, 300);
        }
      }
      return;
    }

    warnedPlacement = false;
    placementRetries = 0;

    // Panel already placed for this app and data is fresh → just reconcile.
    if (active === id && Date.now() - lastRead < 30000) {
      if (doc.getElementById(PANEL_ID)) {
        reconcilePlacement(doc);
      } else if (lastResult && !lastResult.notConfigured) {
        placePanel(doc, lastResult);
      }
      return;
    }

    // App changed → clear cached result.
    if (active !== id) lastResult = null;
    active = id;
    lastRead = Date.now();

    console.info('[AWNext Bridge][MAPPING] Reading local achievements for shortcut', id);
    let result: AchievementResult;
    try {
      result = JSON.parse(await backend.get_achievements(id)) as AchievementResult;
    } catch (error) {
      console.error('[AWNext Bridge][BACKEND] RPC failed', error);
      result = { stage: 'BACKEND', error: 'No se pudieron leer los logros locales de AWN.' };
    }

    // Guard against stale responses when user navigated away.
    if (shortcutId(doc) !== id) return;
    lastResult = result;

    if (result.notConfigured) {
      removePanel(doc);
      return;
    }

    if (result.error) {
      console.warn(
        `[AWNext Bridge][${result.stage || 'BACKEND'}] ${result.error}`,
        result.configPath || result.statePath || result.schemaPath || '',
      );
    }

    const placement = placePanel(doc, result);
    console.info('[AWNext Bridge][UI] Panel placement', placement || 'unavailable', 'for shortcut', id);
  };

  const observer = new MutationObserver(() => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = undefined;
      console.info('[AWNext Bridge][OBS] mutation → update');
      void update();
    }, 200);
  });

  observer.observe(doc.body, { childList: true, subtree: true });

  // Periodic refresh for data freshness (30 s).
  doc.defaultView?.setInterval(() => {
    if (doc.body.isConnected) {
      console.info('[AWNext Bridge][TIMER] interval');
      void update();
    }
  }, 30000);

  console.info('[AWNext Bridge][HOOK] starting update');
  void update();
}

function windowCreated(context: {
  window?: Window;
  m_strName?: string;
  m_strTitle?: string;
}): void {
  const doc = context.window?.document;
  console.info(
    '[AWNext Bridge][HOOK] window created',
    context.m_strName,
    context.m_strTitle,
    doc?.defaultView?.location?.href,
  );

  if (!doc) {
    console.info('[AWNext Bridge][HOOK] skipped window without document', context.m_strName);
    return;
  }

  // Accept the main Steam library window.
  // GDL confirms the window name is "SP Desktop"; accept any window that
  // either has that name OR has no name (the hook may deliver the main
  // window on startup with an empty m_strName on some builds).
  const name = context.m_strName ?? '';
  if (name && !name.includes('SP Desktop')) {
    console.info('[AWNext Bridge][HOOK] skipped non-library window', name);
    return;
  }

  if (!doc.body) {
    console.info('[AWNext Bridge][HOOK] waiting for document body', name);
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
  console.info('[AWNext Bridge][HOOK] checking current window', doc.defaultView?.location?.href);
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
  try {
    Millennium.AddWindowCreateHook?.(windowCreated);
    console.info('[AWNext Bridge] Library window hook registered');
  } catch (error) {
    console.error('[AWNext Bridge][HOOK] Could not register window hook', error);
  }

  // Also observe the current window in case it already exists when definePlugin runs.
  attachToCurrentWindow();

  return {
    title: 'AWNext Steam Bridge',
    icon: <span>★</span>,
    content: (
      <div>
        Logros locales de AWN para accesos directos configurados en bridge-config.json.
      </div>
    ),
  };
});
