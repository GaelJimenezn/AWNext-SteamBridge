# Library Customizer — Alpha 0.1.0, Fase 2

Plugin Millennium con backend Lua y frontend React/TypeScript. Conserva el administrador actual, personalización SteamGridDB, lector snapshot AWN y asociaciones manuales de ports/x360recomp.

## Preparar y verificar

Desde la raíz del checkout, con Node.js, Bun, Python 3 y Windows:

```powershell
# Dependencias de desarrollo; prepare genera los tipos Millennium.
bun install --cwd plugin
python -m pip install --target .phase0/python -r tests/requirements.txt
node plugin/node_modules/typescript/bin/tsc --noEmit -p plugin/frontend/tsconfig.json
python tests/test_identity.py
node scripts/build-local.mjs
python tests/test_discovery.py
node --test tests/phase0.test.mjs tests/identity-client.test.mjs tests/discovery-client.test.mjs
node scripts/verify-build.mjs
```

`node --test` requiere el paquete local construido para probar instalación/desinstalación en carpetas temporales. Las pruebas Lua usan LuaJIT 2.1 de Lupa; no requieren Steam ni red, excepto la descarga inicial de dependencias. La prueba DPAPI es Windows y usa exclusivamente una clave sintética. El comando de comprobación de datos reales `node scripts/verify-local.mjs` es opcional: depende del mapping privado y de references/awn; no sustituye las pruebas Lua.

El build produce `artifacts/library-customizer/library-customizer.star` y un manifiesto con commit, estado Git, hash de fuentes, funciones/dependencias y hash de paquete. Se usa release, salida local y un canal de desarrollo aislado; no se instala ni activa el plugin. El paquete aún no está firmado. `plugin/dist` es un artefacto histórico preexistente y no se sobrescribe.

## Configuración y migración

El ejemplo público es `plugin/library-customizer.config.example.json`. Completar rutas y asociaciones reales antes de copiarlo manualmente a `<Steam>/millennium/plugins/library-customizer.config.json`. No copiar el placeholder del ejemplo como si fuera un AppID válido.

Se sigue leyendo `org.awnext.steambridge.config.json` si el archivo nuevo no existe. `plugin/bridge-config.json` permanece como archivo privado de desarrollo, ignorado por Git; no se renombra ni modifica automáticamente.

Consultar [NAME-MIGRATION](../docs/NAME-MIGRATION.md) antes de instalar. Los scripts muestran previsión salvo `-Apply`, rechazan sobrescrituras diferentes y nunca borran la versión anterior. Instalador y desinstalador requieren un estado de activación legible; el instalador bloquea `org.awnext.steambridge` habilitado. No alteran plugins de AWN/GDL ni enabledPlugins.

```powershell
& ./scripts/migrate-local.ps1 -SteamRoot '<Steam>'
& ./scripts/install-local.ps1 -SteamRoot '<Steam>'
& ./scripts/uninstall-local.ps1 -SteamRoot '<Steam>'
```

Estos comandos no se han aplicado a la instalación personal durante Fase 0.

## Identidad y persistencia

Games permite editar referencias independientes de AWN, Steam catálogo, SteamGridDB y otros proveedores. El motor Lua único sirve al administrador, al lector de datos y a las consultas de artwork. Ver [contrato de Fase 1](../docs/PHASE1-IDENTITY.md).

El primer guardado migra a schemaVersion 1 con respaldo, conserva games/iconMap y escribe exclusivamente library-customizer.config.json. Las modificaciones son por cuenta y shortcut. La carga no migra archivos automáticamente.

Antes de cambiar activación o instalar, seguir [validación de instalación](../docs/INSTALLATION-VALIDATION.md). Esta fase no instala el paquete ni modifica datos personales.

## Universal Library Discovery

Discovery muestra proveedores de metadatos locales con refresco individual, evidencia y estados desconocidos explícitos. Ver [cobertura por launcher](../docs/UNIVERSAL-DISCOVERY.md). PC Game Pass no infiere derechos; Epic/Ubisoft no exponen aquí toda la biblioteca no instalada. No requiere login ni consulta credenciales, no importa accesos y no crea colecciones.

Dependencias locales adicionales: Windows PowerShell 5.1 y winsqlite3.dll (solo para metadatos GOG). La comprobación opcional `python scripts/verify-discovery-local.py` enumera metadatos reales fuera de Steam, sin validar la integración dentro del cliente.

## Fase 3A: Import Preview

Previsualización local de instalaciones, identidad, posibles duplicados y colecciones sugeridas. Selección temporal individual o por lote, sin escrituras ni ejecución de juegos. [Validación Steam y APIs de 3B/3C](../docs/STEAM-IMPORT-VALIDATION.md). Integración runtime pendiente; no instalar ni activar automáticamente.

## Integración y 3B simulada

[Validación guiada](../docs/INTEGRATION-RUNBOOK.md) y [Steam Shortcut Manager](../docs/SHORTCUT-MANAGER.md). En Import Preview puedes simular propuestas sin guardar ni importar. Integration comprueba RPC/presencia de APIs sin ejecutarlas. La entrega se organiza en artifacts/library-customizer; ninguna instalación automática.
