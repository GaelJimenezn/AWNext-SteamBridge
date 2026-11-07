import { resolveProvider } from '../../core/identity-service';
// Metadata lookups never establish ownership or write achievement progress.
export type SourceCheck = {
  provider: 'steam' | 'awn' | 'retro';
  status: 'matched' | 'missing' | 'needs-config' | 'error' | 'ambiguous';
  detail: string;
  appid?: number;
};

type StoreResult = { id?: number; name?: string; type?: string };

export async function checkSources(game: {
  appid: string; name: string; source: string; total: number; unlocked: number; hasCatalog: boolean;
}): Promise<SourceCheck[]> {
  const awn: SourceCheck = {
    provider: 'awn', status: game.hasCatalog ? 'matched' : 'missing',
    detail: game.hasCatalog ? `${game.source}: ${game.unlocked}/${game.total} en AWN` : 'AWN no tiene catalogo utilizable',
  };
  const retro: SourceCheck = {
    provider: 'retro', status: 'needs-config',
    detail: 'Pendiente: identificar ROM por hash y conectar cuenta RetroAchievements. No se infieren logros por nombre.',
  };
  let steam: SourceCheck;
  try {
    // Public, undocumented Store search endpoint; it can be blocked by Steam CORS or the client.
    const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(game.name)}&l=english&cc=MX`;
    const response = await fetch(url, { method: 'GET', credentials: 'omit', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data: { items?: StoreResult[] } = await response.json();
    const candidates = (data.items ?? []).filter(item => item.type === 'app' &&
      typeof item.id === 'number' && typeof item.name === 'string');
    const identity = await resolveProvider(game.appid, game.name, 'steam', candidates);
    if (identity.selected) {
      steam = { provider: 'steam', status: 'matched', appid: Number(identity.selected.id),
        detail: `Ficha encontrada: ${identity.selected.name} (${identity.selected.id}). NO confirma propiedad ni vincula logros.` };
    } else if (identity.status === 'ambiguous' || identity.status === 'conflict') {
      steam = { provider: 'steam', status: 'ambiguous',
        detail: `${identity.status === 'conflict' ? 'Evidencia contradictoria' : 'Varios candidatos compatibles'}: requiere eleccion manual.` };
    } else {
      steam = { provider: 'steam', status: 'missing',
        detail: 'No se encontro una ficha con coincidencia exacta. Puede requerir busqueda manual.' };
    }
  } catch (error) {
    steam = { provider: 'steam', status: 'error',
      detail: `Consulta Steam no disponible (${String(error)}). No se asumio ninguna coincidencia.` };
  }
  return [steam, awn, retro];
}
