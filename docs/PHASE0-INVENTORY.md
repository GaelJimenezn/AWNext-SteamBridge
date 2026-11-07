# Library Customizer — inventario verificable de Fase 0

Estado: Alpha 0.1.0 en preparación. No se ha ejecutado la Fase 1.

## Reproducción

`node scripts/source-inventory.mjs` enumera archivos, SHA-256, funciones y dependencias locales. Comprueba imports TS y require Lua locales. El manifiesto de compilación incorpora ese mismo inventario y la identidad del artefacto. La comprobación AST de pruebas identifica módulos frontend no alcanzables desde `frontend/index.tsx`, además de símbolos retirados.

No es un análisis semántico de todas las llamadas dinámicas: los RPC se verifican mediante el siguiente inventario explícito. Las interfaces Steam/Millennium siguen necesitando regresión real dentro del cliente.

## Funcionalidades y dependencias actuales

| Funcionalidad | Implementación / funciones principales | Dependencias y consumidores | Estado |
|---|---|---|---|
| Entrada Lua | `backend/main.lua`: on_load/on_unload | logger, millennium, rpc_functions | Activa |
| RPC logros | `get_achievements` → achievement_resolver | x360recomp, awn_snapshot; frontend/index | Activa |
| Asociación manual | x360recomp.get_achievements | product_compat, file_reader, config.games | Lectura; sin editor |
| TOML ports | parsers/toml: parse_toml, filetime_seconds | x360recomp | Activa; formato limitado |
| Catálogo / iconos | awn_schema.schema_entries/safe_id, icon_data | caché, base64, archivos AWN | Activa; 50 asociaciones protegidas |
| Snapshot AWN | awn_snapshot.get_achievements/load_snapshot | snapshot, título; resolver | Activa; matching por nombre |
| Descubrimiento AWN | list_awn_games → awn_discovery.list_games | snapshot; GamesTab | Activa |
| Estado proveedor | get_provider_status → provider_status.status | APPDATA; sin llamada frontend actual | Conservado; sustitución posterior |
| Diagnóstico RPC | bridge_ping | logger/json; inicio frontend | Activo |
| Captura Steam | captureSteamShortcuts, getSteamShortcuts/getSteamLibraryGames | appStore; index, GamesTab, ArtworkTab | Activa; caché acumulativa |
| Juego visible | shortcutId, getPageGameTitle, findShortcutAppIdByName | URL/history/appDetailsStore/DOM/appStore | Activa; no motor unificado |
| Navegación | startObserving, windowCreated, attachToCurrentWindow | hook Millennium, observer y timers | Conservada |
| Panel local | placePanel/removePanel/reconcilePlacement | steam-placement, builders ui/* | Conservado |
| Colocación | findPlacement/findNotesRegion/findSidebarColumn | DOM Steam y contenedores GDL | Activa, heurística |
| Lista y resumen | buildContents, buildAchievementSummary/List/Card | models/achievement, shared/dom, achievement-styles | Activos |
| Administrador | Manager, ManagerWindow | portal React, popup; index | Activo |
| Juegos | GamesTab | lista Steam, list_awn_games, checkSources | Inventario/consulta, sin mapping editable |
| Comprobaciones | checkSources | Steam Store fetch, datos AWN; GamesTab | Activas; Retro es placeholder |
| Ajustes | SettingsTab | sgdb_status/configure/test/disconnect | Activos; AWN/RA/SS no son clientes nuevos |
| Búsqueda artwork | sgdb_search → M.search; sgdb_artwork → M.artwork | HTTP SGDB; ArtworkTab | Activa |
| Aplicación nativa | sgdb_native_image → M.native_image → SetCustomArtworkForApp | curl.exe, base64, SteamClient | Activa; recuperación pendiente |
| Aplicación antigua | sgdb_apply → M.apply | grid userdata, backups, curl.exe | Conservada expresamente; sin consumidor frontend |
| Perfiles artwork | sgdb_accounts → M.accounts | fs.list; ArtworkTab | Activo; selección no dirige API nativa |
| Helper de cuenta | active_account/userdata_id | loginusers.vdf | Sin consumidor; conservado en Fase 0 |
| Credenciales | M.configure/status/disconnect; encrypt/decrypt/load_key/save_key | DPAPI/ffi, product_compat | Activas; compatibilidad de nombre añadida |
| Caché | asset_cache.get/clear | adapters y discovery; clear sin consumidores | Conservada; invalidación pendiente |
| I/O y base64 | file_reader.read/read_json, utils/base64 | catálogo, snapshot, iconos, artwork | Activos |
| Compatibilidad producto | product_compat.config_path/data_dir/secret_read_path | tres lectores config y SGDB | Nueva; solo selección de rutas |
| Preload | webview/preload.ts | entrada webkit Starlight | Vacío; conservado |
| Recursos | GDL-LICENSE.txt, favicon.svg | assets.resources glob | Conservados; ninguna eliminación deja nuevos recursos sueltos |

## Cadena eliminada

`Manager` solo consume Games/Artwork/Settings. AppearanceTab y SourcesTab no tenían imports entrantes desde la entrada activa. ManagerTabs tampoco. ManagerTab y ManagerTabDefinition solo servían a ManagerTabs. ManagerSection solo servía a las dos pestañas huérfanas.

Se retiran esos cinco archivos, `models/manager.ts` incluido en el cómputo (cinco archivos TSX/TS en total), y las propiedades `managerStyles.section`, `navigation`, `button`. `panel` y `muted` siguen activos. Se eliminan encabezados y JSDoc sin función asociada de presentation.ts, conservando la atribución MIT en buildSidebarSection.

No se han retirado RPC antiguos, artwork por archivos, respaldos, observers, lectores de logros ni compatibilidad GDL.

## Pruebas que protegen datos

- Fixture con AppID 2545026989, Title ID 4D5309C9 y las 50 entradas reales de iconMap; rutas personales sustituidas.
- SHA-256 fijado del iconMap canónico: `233d415a5fe8d4a630fda50b87e05af1f06d9e52df675c68357e004fc93cd494`.
- LuaJIT 2.1 ejecuta el parser real y el resolver/adaptador real con archivos sintéticos. Verifica cada asociación icono→archivo, igualdad entre rutas antigua/nueva y precedencia manual.
- Prueba DPAPI real con una clave sintética, sin red: cifrado, lectura heredada, copia y desconexión sin resucitar el secreto antiguo.
- PowerShell 5.1 ejecuta migración/instalación/desinstalación en árboles temporales. Se comprueban preview, WhatIf, conflictos, idempotencia, bytes cifrados, preferencias, respaldos, bloqueo de doble activación y rechazo de paquetes ajenos.

## Fuera de Fase 0

Motor de identidad compartido, editor de mapping, detector de conflictos por juego, arbitraje AWN/GDL, invalidación de caché, Studio Lite y correcciones funcionales de artwork. Sus consumidores actuales se conservan hasta entregar una sustitución.
