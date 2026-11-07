export type ProviderReference = { id: string; source?: string; [field: string]: unknown };
export type PortMapping = { adapter: string; titleId: string; stateRoot: string; profile?: string; title?: string; iconMap?: Record<string, string> };
export type IdentityEntry = {
  achievementMode?: 'auto' | 'awn' | 'port' | 'none';
  providers?: Record<string, ProviderReference>;
  edition?: string;
  origin?: string;
  port?: PortMapping;
};
export type IdentityCandidate = { id: string; provider: string; source?: string; name: string; score: number; reasons: string[]; blockers: string[]; eligible: boolean };
export type IdentityResolution = { status: string; explanation: string; selected?: IdentityCandidate; candidates: IdentityCandidate[]; warnings?: string[] };
export type IdentityGame = { key: string; appid: string; name: string; providers: Record<string, ProviderReference>; entry: IdentityEntry; port?: PortMapping; resolution: IdentityResolution };
export type AwnIdentityGame = { id: string; awnId: string; name: string; source: string; total: number; unlocked: number; hasCatalog: boolean };
export type InstallationStatus = { ok: boolean; mayRun: boolean; legacyEnabled?: boolean; bothEnabled?: boolean; awnOfficialEnabled?: boolean; error?: string };
export type IdentityLibrary = {
  ok: boolean; token?: string; revision?: number; accountId?: string; accountSource?: string; writable: boolean;
  needsMigration?: boolean; recoveryAvailable?: boolean; error?: string; shortcutError?: string; snapshotError?: string;
  installation: InstallationStatus; games: IdentityGame[]; awnGames: AwnIdentityGame[];
};
export type IdentityWriteResult = { ok: boolean; token?: string; revision?: number; error?: string; conflict?: boolean; backup?: string; warning?: string };

const listeners = new Set<() => void>();
let epoch = 0;
export const identityEpoch = (): number => epoch;
export function subscribeIdentityChanges(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
function changed(): void {
  epoch++;
  for (const listener of listeners) {
    try { listener(); } catch (error) { console.warn('[Library Customizer] Identity refresh listener failed', error); }
  }
}
const list = <T>(value: T[] | Record<string, T> | undefined): T[] => Array.isArray(value) ? value : Object.values(value ?? {});
export async function identityRpc<T>(name: string, payload?: unknown): Promise<T> {
  const method = (backend as any)?.[name];
  if (typeof method !== 'function') throw new Error(`RPC unavailable: ${name}`);
  const raw = payload === undefined ? await method() : await method(JSON.stringify(payload));
  const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!value || typeof value !== 'object') throw new Error('Invalid identity response');
  return value as T;
}
function resolution(value: IdentityResolution): IdentityResolution {
  const candidate = (item: IdentityCandidate): IdentityCandidate => ({ ...item, reasons: list(item.reasons), blockers: list(item.blockers) });
  return { ...value, selected: value.selected ? candidate(value.selected) : undefined, candidates: list(value.candidates).map(candidate), warnings: list(value.warnings) };
}
export async function loadIdentityLibrary(shortcuts: { appid: string; name: string }[]): Promise<IdentityLibrary> {
  const data = await identityRpc<IdentityLibrary>('get_identity_library', shortcuts);
  return { ...data, games: list(data.games).map(game => ({ ...game, resolution: resolution(game.resolution) })), awnGames: list(data.awnGames) };
}
export async function saveIdentity(library: IdentityLibrary, appid: string, entry?: IdentityEntry): Promise<IdentityWriteResult> {
  if (!library.writable || !library.token || !library.accountId) throw new Error('Identity configuration is read-only; reload and check installation/account');
  const result = await identityRpc<IdentityWriteResult>('save_game_identity', { accountId: library.accountId, token: library.token, appid, entry, reset: entry === undefined });
  if (!result.ok) throw new Error(result.error || 'Identity save failed');
  changed();
  return result;
}
export async function recoverIdentity(token: string): Promise<void> {
  const result = await identityRpc<IdentityWriteResult>('recover_identity_config', { token });
  if (!result.ok) throw new Error(result.error || 'Recovery failed');
  changed();
}
export async function resolveProvider(appid: string, name: string, provider: 'steam' | 'steamgriddb', candidates: { id?: number; name?: string }[]): Promise<IdentityResolution> {
  const data = await identityRpc<{ ok: boolean; error?: string; resolution: IdentityResolution }>('resolve_identity_provider', { appid, name, provider, candidates });
  if (!data.ok) throw new Error(data.error || 'Provider resolution failed');
  return resolution(data.resolution);
}
