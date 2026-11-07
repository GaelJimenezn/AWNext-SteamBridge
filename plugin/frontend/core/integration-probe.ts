// Presence checks never invoke a Steam mutation or infer restart persistence.
export function probeSteamCapabilities(host: any = globalThis) {
  const names = ['AddShortcut', 'RemoveShortcut', 'SetShortcutExe', 'SetShortcutName', 'SetShortcutStartDir', 'SetShortcutLaunchOptions', 'RegisterForAppDetails'];
  return { runtimeExecutionVerified: false, writesEnabled: false,
    shortcuts: Object.fromEntries(names.map(name => [name, typeof host.SteamClient?.Apps?.[name]])),
    collections: { store: typeof host.collectionStore, createCandidate: typeof host.collectionStore?.NewUnsavedCollection,
      getCandidate: typeof host.collectionStore?.GetCollection },
    note: 'Presencia en este contexto solamente; no confirma semántica, ejecución ni persistencia.' };
}
