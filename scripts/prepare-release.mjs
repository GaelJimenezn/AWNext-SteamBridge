import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { root, inventory, sha256 } from './source-inventory.mjs';
const folder = resolve(root, 'artifacts/library-customizer');
const manifest = JSON.parse(readFileSync(resolve(folder, 'build-manifest.json'), 'utf8'));
if (manifest.id !== 'library-customizer' || manifest.sourceSha256 !== inventory().sourceSha256 || manifest.artifactSha256 !== sha256(readFileSync(resolve(folder, 'library-customizer.star')))) throw new Error('Build and verify locally before preparing the folder');
copyFileSync(resolve(root, 'docs/INTEGRATION-RUNBOOK.md'), resolve(folder, 'VALIDATION.md'));
copyFileSync(resolve(root, 'docs/SHORTCUT-MANAGER.md'), resolve(folder, 'SHORTCUT-MANAGER.md'));
writeFileSync(resolve(folder, 'README-INSTALLATION.md'), `# Library Customizer Alpha 0.1.0

Entrega organizada: paquete, build-manifest.json, VALIDATION.md y SHORTCUT-MANAGER.md.

No instalar ni activar sin autorización. No sobrescribir paquete/configuración anteriores.
El cargador publicado de Millennium busca los .star en la raíz de millennium/plugins;
no trasladar el paquete a una subcarpeta suponiendo que seguirá cargando.
Las carpetas de formato antiguo requieren otro contrato; no se genera un wrapper ficticio.

Esta entrega solo añade simulación. Las APIs y el reinicio real siguen sin validar.
Paquete SHA256: ${manifest.artifactSha256}

Usar scripts/install-local.ps1 y los pasos de respaldo/migración de la guía, desde el repositorio, solo tras aprobación.
`);
console.log(`Entrega preparada sin instalar: ${folder}`);
