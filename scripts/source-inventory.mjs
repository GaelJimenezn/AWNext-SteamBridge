import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, relative, dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import ts from '../plugin/node_modules/typescript/lib/typescript.js';

export const root = resolve(import.meta.dirname, '..');
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]);
export function inventory() {
  const files = ['plugin/frontend', 'plugin/backend', 'plugin/webview', 'plugin/resources', 'scripts', 'tests', 'docs'].flatMap(p => walk(resolve(root, p)))
    .filter(p => !p.includes('__pycache__') && !p.endsWith('.pyc'));
  files.push(...['README.md', 'plugin/README.md', 'plugin/millennium.toml', 'plugin/package.json', 'plugin/bun.lock', 'plugin/tsconfig.json', 'plugin/library-customizer.config.example.json'].map(p => resolve(root, p)));
  const modules = files.sort().map(p => {
    const bytes = readFileSync(p), source = bytes.toString('utf8');
    const name = relative(root, p).replaceAll('\\', '/');
    const dependencies = [], functions = [];
    if (/\.tsx?$/.test(p)) {
      const ast = ts.createSourceFile(p, source, ts.ScriptTarget.Latest, true);
      const visit = n => {
        if ((ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && n.moduleSpecifier) dependencies.push(n.moduleSpecifier.text);
        if (ts.isFunctionDeclaration(n) && n.name) functions.push(n.name.text);
        if (ts.isVariableDeclaration(n) && n.initializer && (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer))) functions.push(n.name.getText(ast));
        ts.forEachChild(n, visit);
      };
      visit(ast);
      for (const dep of dependencies.filter(d => d.startsWith('.'))) {
        const base = resolve(dirname(p), dep);
        if (![base, base + '.ts', base + '.tsx', join(base, 'index.ts')].some(existsSync)) throw new Error(`Broken import: ${name} -> ${dep}`);
      }
    } else if (p.endsWith('.lua')) {
      dependencies.push(...[...source.matchAll(/require\(['"]([^'"]+)['"]\)/g)].map(m => m[1]));
      functions.push(...[...source.matchAll(/function\s+([\w.]+)\s*\(/g)].map(m => m[1]));
      for (const dep of dependencies.filter(d => /^(adapters|services|parsers|utils)\./.test(d) || d === 'rpc_functions')) {
        if (!existsSync(resolve(root, 'plugin/backend', dep.replaceAll('.', '/') + '.lua'))) throw new Error(`Broken require: ${name} -> ${dep}`);
      }
    }
    return { file: name, sha256: sha256(bytes), dependencies, functions };
  });
  return { sourceSha256: sha256(JSON.stringify(modules)), modules };
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) console.log(JSON.stringify(inventory(), null, 2));
