import { readFileSync, existsSync, readdirSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, relative, join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const hash = p => createHash('sha256').update(readFileSync(p)).digest('hex');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const walk = p => !existsSync(p) ? [] : statSync(p).isFile() ? [p] : readdirSync(p).flatMap(n => walk(join(p, n)));
const steam = resolve(process.env.LC_STEAM_ROOT || 'A:/launchers/Steam');
const appdata = process.env.APPDATA;
const protectedPaths = [
  join(root, 'plugin/bridge-config.json'),
  join(steam, 'millennium/plugins/org.awnext.steambridge.config.json'),
  join(steam, 'millennium/plugins/org.awnext.steambridge.star'),
  join(steam, 'millennium/plugins/library-customizer.config.json'),
  join(steam, 'millennium/plugins/library-customizer.star'),
  join(steam, 'millennium/plugins/library-customizer'),
  join(steam, 'millennium/plugins/aw-next'),
  join(steam, 'millennium/plugins/game-data-linker-1.02'),
  join(steam, 'millennium/config/config.json'),
  ...(appdata ? [join(appdata, 'AWNext-SteamBridge'), join(appdata, 'library-customizer')] : []),
];
const sources = git('ls-files').split('\n').filter(p => /\.(lua|tsx?|json|toml|mjs|ps1|md|lock)$/.test(p) && p !== 'plugin/bridge-config.json' && existsSync(join(root, p)));
const data = {
  capturedAt: new Date().toISOString(), head: git('rev-parse', 'HEAD'), status: git('status', '--short'),
  sources: Object.fromEntries(sources.map(p => [p, hash(join(root, p))])),
  protected: Object.fromEntries(protectedPaths.flatMap(walk).sort().map(p => [p, hash(p)])),
  artifacts: Object.fromEntries(['plugin/dist', 'artifacts/library-customizer/library-customizer.star'].filter(p => existsSync(join(root, p))).map(p => [p, hash(join(root, p))])),
};
const output = resolve(root, process.argv[2] || '.phase0/snapshot.json');
mkdirSync(resolve(output, '..'), { recursive: true });
writeFileSync(output, JSON.stringify(data, null, 2) + '\n');
if (process.argv[3]) {
  const before = JSON.parse(readFileSync(resolve(root, process.argv[3]), 'utf8'));
  if (JSON.stringify(data.protected) !== JSON.stringify(before.protected)) throw new Error('Protected installation/personal files changed; compare snapshots');
  if (before.artifacts['plugin/dist'] !== data.artifacts['plugin/dist']) throw new Error('Pre-existing plugin/dist changed');
}
console.log(`${relative(root, output)}: ${data.head}, ${Object.keys(data.protected).length} protected files hashed (no secret contents exported)`);
