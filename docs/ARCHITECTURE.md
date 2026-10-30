# AWNext Steam Bridge: auditoría técnica

## Millennium

`plugin/millennium.toml` declara las entradas `backend/main.lua`, `frontend/index.tsx` y `webview/preload.ts`. `plugin/backend/main.lua` registra RPC antes de `millennium.ready()`. Las funciones Lua con `---@ffi` se exponen como `backend.<función>`; la plantilla mostraba `backend.add()` y `millennium.call_frontend_method()`. `definePlugin()` registra los ajustes React. `Millennium.AddWindowCreateHook()` observa ventanas de Steam; el preload de webview corresponde a páginas web, no a la biblioteca.

## Game Data Linker

En `references/gdl/frontend/index.tsx`, `windowCreated()` usa `Millennium.AddWindowCreateHook`, `MutationObserver` y `SP Desktop`; `findNonSteamNotice()` reconoce páginas externas. `findShortcutAppIdByName()` consulta `window.appStore.m_mapApps` y acepta AppID mayores que `2^31`. `buildSidebarSection()` clona la región NOTES; inserta `gdl-friends-section` y `gdl-achievements-section` con `sidebarColumn.insertBefore()`. `injectPlayBarAchievements()` agrega `gdl-playbar-achievements`. Nuestro contenido usa ID propio y se agrega a `gdl-achievements-content` si GDL está presente, con una etiqueta de origen local y sin alterar sus cifras. Sin GDL, crea una sección copiando la estructura de NOTES. La estructura de Steam puede cambiar.

### Técnicas de presentación y licencia

`resolveClasses()` y `ACH_CLASSES()` en `references/gdl/frontend/index.tsx` buscan un módulo CSS de Steam mediante `findClassModule()` y las propiedades `AchievementHoverContainer`, `UnlockedLabel` y `SingleAchievementProgressBar`; GDL mantiene hashes como respaldo. `renderAchievementsPanel()` usa las clases `HighlightDiv`, `UnlockedLabel`, `UnlockedLabelPercent`, `AchievementProgressContainer` y `AchievementProgress` para la cifra y barra. `buildSidebarSection()` y su equivalente `epicComputeLayout()` copian las clases de la región nativa NOTES para el contenedor, cabecera y cuerpo. GDL usa `findModuleExport()` para módulos de actividad y transporte de Steam; no son necesarios para mostrar logros locales y no deben utilizarse para obtener autenticación ni cambiar progreso oficial. El panel de GDL se arma con DOM y cadenas HTML; React sólo registra la vista de ajustes mediante `definePlugin()`.

La implementación del puente adapta únicamente las técnicas de resolución de clases, clonación estructural de NOTES y posición de la sección. No copia los hashes de respaldo, el render HTML, los clientes de red ni el manejo de cuentas. El código de GDL se distribuye bajo MIT (`references/gdl/LICENSE`, copyright 2026 retrotoolsdev-wq). Por atribución de esta adaptación se incluye su licencia completa en `plugin/resources/GDL-LICENSE.txt`, que Millennium empaqueta como recurso. Ningún dato de autenticación de GDL participa en el flujo: el único RPC de este panel es `get_achievements()` del adaptador local de solo lectura.

`plugin/frontend/presentation.ts` contiene la resolución de clases, la barra, las filas y la colocación. La región NOTES se localiza con el token `AppDetails_SectionTitle_GameNotes` de `LocalizationManager` (por ejemplo `Notas` en español), con respaldo estructural. `plugin/frontend/index.tsx` observa la ventana principal actual y también registra el hook de ventanas nuevas, detecta el acceso directo y solicita un resultado al RPC. `plugin/backend/rpc_functions.lua` lee `bridge-config.json`, el TOML de estado, el catálogo JSON y los PNG de AWN con `io.open()` en modo lectura; `get_achievements()` devuelve datos normalizados. No abre archivos de tokens ni llama a servicios de Xbox, Steam o GDL. Cada resultado se vuelve a leer periódicamente, sin escribir en el juego ni en perfiles de usuario.

## Datos de AWN

`references/awn/app/parser/x360Ports.js` registra `Forza Horizon (Pinyon Shift)`, Title ID `4D5309C9`, `pinyon_shift.exe` y layout `pinyon`. `pinyonStateRoots()` considera `PINYON_SHIFT_STATE_ROOT`, `.local/preview` y `pinyon_shift_state`; `pinyonTarget()` busca `user` y `user-*`, bajo los cuales está `achievements/4D5309C9.toml`. `references/awn/app/parser/x360RecompFormats.js` implementa `parseToml()` para `[unlocked.<id>]`, `filetime` y `unlocked = [...]`; `filetimeToUnixSeconds()` convierte fechas a segundos Unix. El Watchdog `references/awn/watchdog/console/x360RecompWatch.js` vigila estos archivos, compara estados con `createBaselineCache()` y genera eventos mediante `unlockEvent()`.

`references/awn/app/parser/x360RecompState.js` define `steam_cache/x360recomp/<TITLEID>.json` para el catálogo y `icon_cache/x360recomp/<TITLEID>/` para iconos. `references/awn/app/parser/x360RecompSchema.js` obtiene y guarda catálogos con `loadSchema()`, localiza textos con `localized()` y obtiene iconos con `spaIcon()` o `withIcons()`. No todos los iconos SPA tienen nombre numérico en el caché. `references/awn/watchdog/util/userData.js` resuelve `%APPDATA%/Achievement Watcher Next`, salvo `AW_USER_DATA`.

`references/awn/watchdog/track.js` guarda `steam_cache/data/<appid>.db` como JSON de línea base, pero el lector x360 recomp usa `createBaselineCache()`, por lo que esta ruta no da su historial. `references/awn/watchdog/websocket.js` escucha en `127.0.0.1:8082`, envía eventos mediante `broadcast()` y sólo recibe comandos de prueba mediante `incoming()`. HTTP sólo ofrece `/obs`; no hay API de historial completo. El puente lee los archivos locales y no consulta cuentas Xbox.

## Identidad, compatibilidad y límites

El AppID del acceso directo es la clave mientras exista. GDL confirma su rango y `appStore.m_mapApps`; el MVP extrae `/app/<id>` en la ventana de biblioteca y exige `2^31 <= id <= 2^32-1`. No usa el nombre como clave. `bridge-config.json` asocia AppID, Title ID y raíz de estado. El adaptador actual lee TOML; los formatos TSV y JSON de `x360Recomp.js` quedan pendientes. El porcentaje es progreso personal, no rareza global. No se inventan fechas ausentes. El anclaje DOM y la carga necesitan prueba real en Steam.

## Licencias

`references/awn/LICENSE` es LGPL-3.0 y `references/awn/NOTICE` exige conservar la atribución al redistribuir versiones modificadas de material AWN. `references/gdl/LICENSE` es MIT. El puente implementa un lector propio de los formatos observados y no distribuye código ni arte de esos proyectos. Antes de publicar el puente debe elegirse su licencia propia.
