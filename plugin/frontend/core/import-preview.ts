import type { DiscoveryLibrary, DiscoveryInstallation, DiscoveryRecord } from './discovery-service';

export type ImportPreviewItem = {
  key: string; record: DiscoveryRecord; platform: string; installation?: DiscoveryInstallation;
  collection?: string; existing: 'manual_reference' | 'possible' | 'unknown';
  risk: 'related' | 'conflict' | 'unknown'; selectable: boolean; reasons: string[];
};
export type ImportPreview = { revision: number; items: ImportPreviewItem[]; writesEnabled: false };
const collections: Record<string, string> = { ubisoft: 'Ubisoft Connect', xbox: 'Xbox PC', epic: 'Epic Games', gog: 'GOG' };

// Projection only: all identity matching is performed by the shared Lua engine in Discovery.
// No absence of a persisted shortcut can prove absence from the running Steam library.
export function importPreview(library: DiscoveryLibrary): ImportPreview {
  const items: ImportPreviewItem[] = [];
  const seen = new Set<string>();
  for (const provider of library.providers) for (const record of provider.records) {
    for (const installation of record.installations.length ? record.installations : [undefined]) {
      const key = JSON.stringify([record.provider, record.providerId, installation?.id ?? null]);
      if (seen.has(key)) continue;
      seen.add(key);
      const manual = record.shortcuts.some(ref => ref.kind === 'manual_reference');
      const related = record.shortcuts.length > 0 || record.identity.candidates.length > 0;
      const conflict = record.identity.conflicts.length > 0;
      const reasons: string[] = [];
      if (provider.stale || !['ready', 'partial'].includes(provider.status)) reasons.push('Observación del proveedor obsoleta o no disponible.');
      if (installation?.status !== 'installed') reasons.push('Esta instalación no está confirmada: excluida de la selección.');
      if (record.nameResolved === false) reasons.push('Nombre sin resolver: requiere revisión de identidad.');
      if (!library.steamInventory?.available) reasons.push('No se pudo leer el inventario persistido de accesos de Steam.');
      reasons.push('Biblioteca nativa y accesos en memoria de Steam pendientes de validar; no se confirma ausencia de duplicados.');
      if (manual) reasons.push('Existe una asociación manual con un acceso; no implica que su lanzamiento sea equivalente.');
      if (related) reasons.push('Hay coincidencias para revisar; no se combinan tiendas ni instalaciones.');
      if (conflict) reasons.push('Existen candidatos incompatibles; consultar los conflictos de identidad.');
      if (!installation?.launch) reasons.push('Método de lanzamiento no disponible.');
      else if (!installation.launch.verified) reasons.push('Método observado sin verificar.');
      else reasons.push('El archivo existe; su ejecución mediante el launcher y Steam aún no está validada.');
      let collection = collections[record.provider];
      // Current local adapters cannot establish Game Pass entitlement. Never infer it from Xbox.
      if (record.provider === 'gamepass') collection = undefined;
      items.push({ key, record, platform: provider.name, installation, collection,
        existing: manual ? 'manual_reference' : record.shortcuts.length ? 'possible' : 'unknown',
        risk: conflict ? 'conflict' : related ? 'related' : 'unknown',
        selectable: installation?.status === 'installed' && !provider.stale && ['ready', 'partial'].includes(provider.status) && record.nameResolved !== false,
        reasons });
    }
  }
  return { revision: library.revision, items, writesEnabled: false };
}

export function selectedPreview(plan: ImportPreview, keys: readonly string[]): ImportPreviewItem[] {
  const selected = new Set(keys);
  return plan.items.filter(item => item.selectable && selected.has(item.key));
}
