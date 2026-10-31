// Provider checks run independently. Steam catalog metadata is NOT proof of Steam ownership.
export type SourceCheck = {
  provider: 'steam' | 'awn' | 'retro';
  status: 'matched' | 'missing' | 'needs-config' | 'error' | 'ambiguous';
  detail: string;
  appid?: number;
};

type StoreResult = { id?: number; name?: string; type?: string };
const normalize = (s: string): string => s.toLocaleLowerCase().normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[Â®â„¢Â©]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');

export async function checkSources(game: {
  name: string; source: string; total: number; unlocked: number; hasCatalog: boolean;
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
    const response = await fetch(url, { method: 'GET', credentials: 'omit' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data: { items?: StoreResult[] } = await response.json();
    const candidates = (data.items ?? []).filter(item => item.type === 'app' &&
      typeof item.id === 'number' && typeof item.name === 'string' &&
      normalize(item.name) === normalize(game.name));
    if (candidates.length === 1) {
      steam = { provider: 'steam', status: 'matched', appid: candidates[0].id,
        detail: `Ficha encontrada: ${candidates[0].name} (${candidates[0].id}). NO confirma propiedad ni vincula logros.` };
    } else if (candidates.length > 1) {
      steam = { provider: 'steam', status: 'ambiguous',
        detail: `${candidates.length} fichas exactas: requiere eleccion manual.` };
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