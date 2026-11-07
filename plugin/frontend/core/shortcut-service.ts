import type { ImportPreviewItem } from './import-preview';
export type ShortcutSimulation = {
  ok: boolean; mode: 'simulation'; writesEnabled: false; error?: string;
  results: { key: string; status: string; reasons: string[] }[];
  plan: { account: string; proposals: { key: string; name: string; launcherCompatibility: string; blockers: string[]; rollback: string; command?: { target: string; startDir: string } }[] };
};
const list = <T>(value: T[] | Record<string, T> | undefined): T[] => Array.isArray(value) ? value : Object.values(value ?? {});
export async function simulateShortcuts(revision: number, selected: ImportPreviewItem[]): Promise<ShortcutSimulation> {
  if (!selected.length || selected.length > 100) throw new Error('Selecciona entre 1 y 100 instalaciones.');
  const items = selected.map(item => {
    if (!item.installation || !item.selectable) throw new Error('Instalación excluida de la revisión.');
    return { recordId: item.record.id, installationId: item.installation.id };
  });
  const method = (backend as any).simulate_shortcut_import;
  if (typeof method !== 'function') throw new Error('RPC de simulación no disponible.');
  const raw = await method(JSON.stringify({ revision, items }));
  const result = (typeof raw === 'string' ? JSON.parse(raw) : raw) as ShortcutSimulation;
  if (!result?.ok || result.mode !== 'simulation' || result.writesEnabled !== false) throw new Error(result?.error || 'Respuesta de simulación inválida.');
  return { ...result, results: list(result.results).map(item => ({ ...item, reasons: list(item.reasons) })),
    plan: { ...result.plan, proposals: list(result.plan.proposals).map(item => ({ ...item, blockers: list(item.blockers) })) } };
}
