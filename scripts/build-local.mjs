import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { root, inventory, sha256 } from './source-inventory.mjs';

const output = resolve(root, 'artifacts/library-customizer');
const config = readFileSync(resolve(root, 'plugin/millennium.toml'), 'utf8');
if (!/socket\s*=\s*"library-customizer-offline-build.sock"/.test(config) ||
    !/auto_restart\s*=\s*false/.test(config) || !/reload_steamui_when\s*=\s*"never"/.test(config)) {
  throw new Error('Local builds require an isolated dev socket and disabled reload/restart');
}
mkdirSync(output, { recursive: true });
const before = inventory();
const starlight = resolve(root, 'plugin/node_modules/@steambrew/starlight/bin/starlight.js');
// Literal local output; never use output_path=auto or watch here.
execFileSync(process.execPath, [starlight, 'pack', '--release', '-d', resolve(root, 'plugin'), '-c', resolve(root, 'plugin/millennium.toml'), '-o', output], { cwd: root, stdio: 'inherit' });
const inspection = execFileSync(process.execPath, [starlight, 'inspect', resolve(output, 'library-customizer.star')], { encoding: 'utf8' });
if (!/id:\s+library-customizer\s/.test(inspection)) throw new Error('Unexpected compiled plugin ID');
if (inventory().sourceSha256 !== before.sourceSha256) throw new Error('Sources changed during build');
const manifest = {
  id: 'library-customizer', version: '0.1.0', stage: 'alpha-phase3b-simulation',
  gitHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  gitStatus: execFileSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8' }).trim(),
  ...before, artifactSha256: sha256(readFileSync(resolve(output, 'library-customizer.star'))),
  starlightPackage: JSON.parse(readFileSync(resolve(root, 'plugin/node_modules/@steambrew/starlight/package.json'))).version,
  inspection,
};
writeFileSync(resolve(output, 'build-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Local artifact verified: ${manifest.artifactSha256}`);
