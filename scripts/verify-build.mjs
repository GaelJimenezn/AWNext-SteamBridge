import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { root, inventory, sha256 } from './source-inventory.mjs';

const dir = resolve(root, 'artifacts/library-customizer');
const manifest = JSON.parse(readFileSync(resolve(dir, 'build-manifest.json')));
const artifact = resolve(dir, 'library-customizer.star');
const current = inventory();
if (manifest.sourceSha256 !== current.sourceSha256) throw new Error('Source changed after compilation; rebuild locally');
if (manifest.artifactSha256 !== sha256(readFileSync(artifact))) throw new Error('Artifact does not match build manifest');
const installed = resolve(process.argv[2] || resolve(process.env.LC_STEAM_ROOT || 'A:/launchers/Steam', 'millennium/plugins/library-customizer.star'));
const tool = resolve(root, 'plugin/node_modules/@steambrew/starlight/bin/starlight.js');
const result = {
  source: { gitHead: manifest.gitHead, sourceSha256: current.sourceSha256, files: current.modules.length },
  compiled: { path: artifact, id: manifest.id, version: manifest.version, sha256: manifest.artifactSha256, verified: true },
  installed: existsSync(installed) ? {
    path: installed, sha256: sha256(readFileSync(installed)),
    matchesCompiled: sha256(readFileSync(installed)) === manifest.artifactSha256,
    inspection: execFileSync(process.execPath, [tool, 'inspect', installed], { encoding: 'utf8' }),
  } : { path: installed, present: false },
};
console.log(JSON.stringify(result, null, 2));
