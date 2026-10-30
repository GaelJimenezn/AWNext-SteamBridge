import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const projectRoot = resolve(import.meta.dirname, '..');
const configPath = resolve(process.argv[2] || join(projectRoot, 'plugin', 'bridge-config.json'));
const config = JSON.parse(readFileSync(configPath, 'utf8'));
const shortcutId = '2545026989';
const game = config.games?.[shortcutId];
if (!game || game.adapter !== 'x360recomp-toml' || game.titleId !== '4D5309C9') {
  throw new Error('MAPPING: la asociación real de Forza Horizon 1 no coincide');
}
const stateFile = join(game.stateRoot, game.profile || 'user', 'achievements', `${game.titleId}.toml`);
const catalogFile = join(config.awnDataRoot, 'steam_cache', 'x360recomp', `${game.titleId}.json`);
const spaFile = join(config.awnDataRoot, 'steam_cache', 'x360recomp', `${game.titleId}.spa`);
for (const file of [stateFile, catalogFile, spaFile]) {
  if (!existsSync(file)) throw new Error(`DATA: falta ${file}`);
}

const toml = readFileSync(stateFile, 'utf8');
const unlocked = new Map();
for (const match of toml.matchAll(/^\s*\[unlocked\.(\d+)\]\s*\r?\n(?<body>[^[]*)/gm)) {
  const filetime = match.groups.body.match(/^\s*filetime\s*=\s*(\d+)\s*$/m)?.[1];
  const seconds = filetime ? Number(BigInt(filetime) / 10000000n - 11644473600n) : 0;
  unlocked.set(match[1], seconds);
}
const catalog = JSON.parse(readFileSync(catalogFile, 'utf8'));
if (!Array.isArray(catalog.achievements) || catalog.achievements.length === 0) throw new Error('DATA: catálogo sin logros');
const byId = new Map(catalog.achievements.map((entry) => [String(entry.achievement_id), entry]));
const missing = [...unlocked.keys()].filter((id) => !byId.has(id));
if (missing.length) throw new Error(`MAPPING: ${missing.length} desbloqueos sin entrada en catálogo`);
const descriptions = catalog.achievements.filter((entry) => {
  const text = entry.localizations?.find((part) => part.locale?.identifier === 'en_US');
  return Boolean(text?.description || text?.locked_description);
}).length;
const spaReader = require(join(projectRoot, 'references', 'awn', 'app', 'parser', 'xllnSpa.js'));
const spa = spaReader.parseSpa(readFileSync(spaFile));
if (spa.titleId !== Number.parseInt(game.titleId, 16)) throw new Error('DATA: SPA de otro título');
let icons = 0;
for (const [achievementId, imageId] of Object.entries(game.iconMap || {})) {
  const spaEntry = spa.achievements.find((entry) => String(entry.id) === achievementId);
  if (!spaEntry || String(spaEntry.imageId) !== String(imageId)) throw new Error(`MAPPING: icono incorrecto para ${achievementId}`);
  if (existsSync(join(config.awnDataRoot, 'icon_cache', 'x360recomp', game.titleId, `${imageId}.png`))) icons += 1;
}
const firstId = [...unlocked.keys()][0];
const first = byId.get(firstId);
const text = first.localizations?.find((part) => part.locale?.identifier === 'en_US');
console.log(JSON.stringify({
  shortcutId,
  titleId: game.titleId,
  catalogAchievements: byId.size,
  unlocked: unlocked.size,
  descriptions,
  mappedIcons: Object.keys(game.iconMap || {}).length,
  readableIcons: icons,
  sample: { id: firstId, name: text?.name, description: text?.description || text?.locked_description || '', unlockedAt: new Date(unlocked.get(firstId) * 1000).toISOString() },
  stateFile,
  catalogFile,
}, null, 2));
