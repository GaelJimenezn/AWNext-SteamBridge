# Library Customizer — resultado de Fase 0

Fecha: 6 de noviembre de 2026. Base: commit `6c29a7811b5d58625f694a031a2bf57739f4deeb`. No hay commit nuevo ni cambios staged. No se ha avanzado a Fase 1.

## Cambios anteriores y nuevos

Antes de comenzar ya existían `M plugin/dist` y `?? AWNext_Phase9_SteamGridDB_Test.ps1`. Se conservaron; no son resultado de esta implementación. El nuevo build se escribe bajo artifacts/library-customizer, ignorado por Git. El fixture no contiene rutas personales ni credenciales.

Cambios nuevos:

| Archivos | Motivo |
|---|---|
| `.gitignore` | Ignorar artifacts, .phase0 y __pycache__ |
| `README.md`, `plugin/README.md`, `docs/ARCHITECTURE.md`, `docs/LOCAL_TEST.md` | Nombre, alcance actual y reproducción |
| `docs/NAME-MIGRATION.md`, `PHASE0-INVENTORY.md`, `PHASE0-RESULTS.md` | Contrato de migración, inventario y evidencia |
| `plugin/millennium.toml`, `package.json`, `bun.lock` | ID/nombre library-customizer, salida local y verificación |
| `backend/main.lua` | Nombre de producto en logs |
| `backend/services/product_compat.lua` | Lectura de rutas nueva/heredada sin escrituras al cargar |
| `backend/adapters/x360recomp.lua`, `awn_snapshot.lua`, `services/awn_discovery.lua` | Consumir la selección compatible de configuración; misma lógica de datos |
| `backend/services/steamgriddb.lua` | Rutas nuevas con lectura de secreto antiguo; conservar aplicación y respaldos |
| `frontend/index.tsx`, `core/steam-shortcuts.ts`, `manager/Manager.tsx` | Nombre visible/logs/popup nuevos; mismos hooks y lectores |
| `manager/tabs/ArtworkTab.tsx` | Identificador de comentario propio; se conserva el flujo |
| `presentation.ts`, `ui/achievement-content.ts` | IDs DOM propios nuevos y retirada de comentarios vacíos |
| `manager/styles/manager-styles.ts` | Retirar tres estilos exclusivos sin consumidores |
| `scripts/install-local.ps1`, `uninstall-local.ps1` | Validar identidad, no sobrescribir y bloquear doble activación |
| `scripts/migrate-local.ps1`, `migration-common.ps1` | Copia explícita verificable de datos completos; conservación de originales |
| `scripts/build-local.mjs`, `source-inventory.mjs`, `verify-build.mjs`, `phase0-snapshot.mjs` | Fuentes/funciones/dependencias, artefacto y protección de instalación |
| `tests/test_backend.py`, `phase0.test.mjs`, `requirements.txt`, `fixtures/*` | Regresión real LuaJIT/DPAPI y scripts en instalaciones temporales |

El ejemplo `plugin/bridge-config.example.json` se renombra a `plugin/library-customizer.config.example.json` sin cambiar el formato. El archivo privado `plugin/bridge-config.json` se conserva intacto.

## Eliminaciones reales y evidencia

| Archivo retirado | Evidencia |
|---|---|
| `AppearanceTab.tsx` | No importado por la navegación activa |
| `SourcesTab.tsx` | No importado; información de proveedores obsoleta |
| `ManagerTabs.tsx` | Manager usa navegación propia Games/Artwork/Settings |
| `models/manager.ts` | Tipos usados exclusivamente por ManagerTabs |
| `ManagerSection.tsx` | Consumido exclusivamente por AppearanceTab/SourcesTab |

También se retiran managerStyles.section/navigation/button y JSDoc/encabezados vacíos heredados de presentation.ts. Búsqueda de símbolos y prueba de alcanzabilidad frontend sin referencias residuales. La licencia GDL permanece asociada a buildSidebarSection y en recursos. No se retiraron dependencias npm ni RPC activos por esta limpieza.

## Verificaciones

- TypeScript noEmit: sin errores.
- Seis pruebas Python/LuaJIT 2.1: parser real, compilación de todos los módulos Lua, precedencia y error de configuración, campos/preferencias desconocidos, rutas de secreto, DPAPI real con clave sintética, resolver x360 e integridad de los 50 iconos.
- Siete pruebas Node: checksum completo del iconMap, alcanzabilidad/imports, migración preview/WhatIf, copia completa e idempotente, conflictos/corrupción, bloqueo del legacy habilitado, instalación/desinstalación con identidad verificada y comparación opcional con mapping personal.
- Verificador local personal: 70 logros, 16 desbloqueados, 70 descripciones y 50 iconos disponibles. Lectura solamente.
- Starlight 1.1.7 acepta library-customizer y genera release local; inspect confirma identidad y contenido. Paquete sin firma.
- verify-build vincula hash del árbol actual con manifiesto y paquete e identifica el legacy instalado separadamente.
- git diff --check sin errores; avisos de conversión LF/CRLF de Git no son errores de contenido.
- Comparación final de los 28 archivos protegidos y del antiguo plugin/dist contra baseline: idénticos. Ninguna migración se aplicó a datos personales ni se sobrescribió el paquete instalado.

La prueba de copia mantiene el mapping 2545026989 → 4D5309C9 y las 50 entradas exactas; el archivo personal y su copia instalada conservan sus hashes. No se pierden asociaciones, preferencias ni credenciales.

## Problemas encontrados y límites

1. El entorno restringido no permite a Starlight resolver algunas rutas; la compilación local se ejecutó con acceso ampliado, salida explícita e inventario verificable. La dependencia de pruebas Lupa se descargó aislada en .phase0/python.
2. El primer build debug produjo HMR y añadió el ID nuevo a enabledPlugins. Se retiró exclusivamente esa entrada tras verificar que la reconstrucción coincidía con el hash original; la configuración quedó restaurada byte por byte. La solución final usa socket aislado, sin HMR. Ver NAME-MIGRATION.
3. Starlight 1.1.7 requiere carpeta de salida y añade el nombre del .star; el artefacto anterior dist era un archivo. No se reutiliza.
4. Get-FileHash no estaba disponible en el proceso Windows PowerShell 5.1 usado para probar. Los scripts usan SHA-256 de .NET, probado en ese mismo entorno.
5. No se ha probado la nueva identidad cargada dentro de Steam ni una migración sobre los datos reales. Las pruebas de scripts usan árboles temporales; las de credenciales usan una clave sintética y no contactan SGDB.
6. La carpeta de distribución se llama library-customizer. En la instalación Starlight se usa library-customizer.star plano; no se crea un segundo layout plugin.json. El checkout y la carpeta fuente genérica plugin no son identificadores de Millennium.

## Pendiente para Fase 1

Definir identidad y evidencia de coincidencia, precedencia manual, separación por cuenta/proveedor y contrato de asociaciones. Implementar el editor y persistencia general versionada solo en la siguiente fase. Se mantienen los defectos ya auditados de caché acumulativa, matching independiente, observer amplio, arbitraje de logros y selector de perfil/backups de artwork: esta fase no introduce sus sustituciones.

La validación manual de nueva instalación/migración debe hacerse antes de retirar la instalación anterior. Los scripts no ofrecen borrado automático del legado.
