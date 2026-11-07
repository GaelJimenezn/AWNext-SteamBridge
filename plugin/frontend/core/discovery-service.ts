export type DiscoveryEvidence = { source: string; kind: string };
export type DiscoveryInstallation = { id: string; path: string; status: string; launch?: { kind: string; target: string; verified: boolean } };
export type DiscoveryRecord = {
  id: string; providerId: string; provider: string; name: string; nameResolved?: boolean; installed: string; lastChecked: string;
  installations: DiscoveryInstallation[]; licenses: { type: string; entitlement: string }[]; evidence: DiscoveryEvidence[]; catalogOnly?: boolean;
  identity: { candidates: { id: string; name: string }[]; conflicts: { id: string; name: string; blockers: string[] }[] };
  shortcuts: { appid: string; kind: string }[];
};
export type DiscoveryProvider = { id: string; name: string; status: string; records: DiscoveryRecord[]; errors: string[]; limitations: string[]; lastChecked?: string; stale?: boolean };
export type DiscoveryLibrary = { ok: boolean; revision: number; readOnly: boolean; error?: string; steamInventory?: { available: boolean; account?: string; accountSource?: string; scope: string; liveVerified: boolean; error?: string }; providers: DiscoveryProvider[] };
const list = <T>(value: T[] | Record<string, T> | undefined): T[] => Array.isArray(value) ? value : Object.values(value ?? {});
export async function discoveryLibrary(provider?: string): Promise<DiscoveryLibrary> {
  const method = provider === undefined ? (backend as any).get_discovery_library : (backend as any).refresh_discovery_provider;
  if (typeof method !== 'function') throw new Error('Discovery RPC no disponible');
  const raw = provider === undefined ? await method() : await method(provider);
  const result = (typeof raw === 'string' ? JSON.parse(raw) : raw) as DiscoveryLibrary;
  if (!result?.ok) throw new Error(result?.error || 'No se pudo consultar el descubrimiento');
  return { ...result, providers: list(result.providers).map(group => ({ ...group, errors: list(group.errors), limitations: list(group.limitations), records: list(group.records).map(record => ({
    ...record, installations: list(record.installations), licenses: list(record.licenses), evidence: list(record.evidence), shortcuts: list(record.shortcuts),
    identity: { candidates: list(record.identity?.candidates), conflicts: list(record.identity?.conflicts).map(conflict => ({ ...conflict, blockers: list(conflict.blockers) })) },
  })) })) };
}
