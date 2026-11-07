# Fase 2 — resultado de Universal Library Discovery

Entrega: arquitectura modular y descubrimiento local con límites explícitos. No se ha completado una biblioteca universal de derechos ni la cobertura no instalada de todos los launchers. No se ha validado la ejecución dentro de Steam. No se inicia Fase 3.

## Antes de implementar

Se ejecutaron las 35 regresiones de Fase 1; pasaron. Se comprobaron dependencias y se conservó el manifiesto previo en .phase0/phase1-build-manifest.json. Las modificaciones anteriores sin commit no se atribuyen a esta fase. Tras una interrupción la unidad D: dejó de estar accesible en el entorno restringido; se continuó con acceso ampliado al mismo repositorio, sin cambiarlo de ubicación.

Siguen pendientes las pruebas de instalación de Fase 1: copia de activación, deshabilitar el legacy sin borrarlo, cargar library-customizer, comprobar cuenta/edición/persistencia y los 16/70 dentro del cliente. Discovery tampoco se marca validado por haberse probado fuera de Steam.

## Código entregado

Modificados respecto a Fase 1:

- README.md, plugin/README.md, docs/ARCHITECTURE.md: alcance y enlaces actuales.
- plugin/backend/rpc_functions.lua: get_discovery_library y refresh_discovery_provider, ambos de lectura.
- plugin/frontend/manager/Manager.tsx: pestaña Discovery.
- plugin/package.json: suite ampliada.
- scripts/build-local.mjs: artefacto alpha-phase2, mismo ID library-customizer y canal aislado.

Nuevos:

- plugin/backend/services/discovery/model.lua: juego, instalación, evaluación de licencia y evidencia independientes.
- plugin/backend/services/discovery/library.lua: registro de adaptadores, cache en memoria, error aislado, revisiones y comparación con Fase 1.
- plugin/backend/services/discovery/sources.lua: contexto de IO limitado y sustituible.
- plugin/backend/services/discovery/sqlite_catalog.lua: SELECTs fijos de metadatos GOG en lectura.
- plugin/backend/services/discovery/epic.lua.
- plugin/backend/services/discovery/ubisoft.lua.
- plugin/backend/services/discovery/xbox.lua.
- plugin/backend/services/discovery/gog.lua.
- plugin/backend/services/discovery/gamepass.lua: estado limited, sin inferir derechos o juegos.
- plugin/resources/discovery-windows.ps1: lectura de registro/Appx/manifest con timeout, sin acciones de launcher.
- plugin/frontend/core/discovery-service.ts: contrato RPC y normalización.
- plugin/frontend/manager/tabs/DiscoveryTab.tsx: agrupación, búsqueda, refresco y evidencia.
- tests/fixtures/discovery.json, tests/test_discovery.py, tests/discovery-client.test.mjs.
- scripts/verify-discovery-local.py: comprobación opcional de lectores reales fuera de Steam.
- docs/UNIVERSAL-DISCOVERY.md, docs/ROADMAP.md, docs/PHASE2-RESULTS.md.

No se eliminan módulos de Fase 1 ni se cambia su motor de identidad. No se tocan AWN oficial, GDL, Steam ROM Manager u otros plugins.

## Pruebas

- Fase 1: 23 pruebas Python y sus 12 Node/PowerShell de partida siguen pasando.
- Discovery: 14 pruebas Python, de las cuales 6 repiten regresiones base y 8 son escenarios nuevos.
- Cliente discovery: 3 pruebas Node adicionales.
- Total de la suite: 52 ejecuciones de prueba, equivalentes a 46 escenarios distintos. No se cuentan las regresiones repetidas como funcionalidades nuevas.
- TypeScript noEmit y compilación release local: correctos.
- Se verifican errores aislados, observaciones antiguas conservadas, metadatos corruptos, rutas fuera de raíz, IDs grandes, caché de títulos no instalados, distintas instalaciones/licencias, adaptadores sustituibles y bloqueo MWIII/MWII por contradicción.
- SQLite nativo se prueba con una base temporal real: hash inalterado, sin sidecars, solo queries permitidas y rechazo de WAL.
- Se comprueba sintaxis/ejecución del helper Windows en lectura; no se ejecutan APIs de importación.

La comprobación de lectores locales encontró 2 registros Epic, 8 Ubisoft, 9 Xbox/Store y 1 GOG; sin errores en esos lectores en esa comprobación. Game Pass devolvió limited con 0 registros, lo cual no afirma nada sobre la suscripción del usuario. Son observaciones de fuentes locales, no cifras de juegos comprados. GOG se observó por registro; su lector SQLite fue probado con fixtures, no se afirma catálogo real disponible aquí.

La prueba personal de lectura sigue obteniendo MWIII 3531473258 → 3595270; Pinyon 2545026989 → 4D5309C9, 16/70 y 50 iconos. La configuración, los paquetes y los 28 archivos protegidos mantienen sus hashes de inicio. El antiguo plugin/dist también permanece intacto. No se instala el nuevo .star.

## Limitaciones que afectan al objetivo

- Ubisoft: registro instalado; decodificador del caché local protobuf/YAML pendiente.
- Epic: manifiestos locales; biblioteca remota poseída/no instalada no disponible aquí.
- Xbox/Store: solo juegos reconocibles en paquetes del usuario actual; sin derechos de cuenta.
- Game Pass: adaptador limitado sin lector de derechos compatible. No se ha implementado detección de catálogo ni suscripción.
- GOG: catálogo local puede contener candidatos no instalados/no poseídos o productos no clasificados; no se lee ProductAuthorizations. Si hay WAL/journal, se informa limitación en lugar de modificar archivos del cliente.
- Todos: licencia desconocida salvo que un futuro adaptador aporte evidencia; no se infiere compra por instalación ni suscripción por pertenecer al catálogo público. No hay sincronización incremental ni persistencia de discovery entre reinicios.

## Siguiente fase, únicamente diseñada

ROADMAP.md documenta AddShortcut y comprobación posterior del AppID, lanzamiento mediante cliente/URI/AUMID, colecciones normales (API todavía por validar), registro de propiedad, protección de accesos y miembros manuales, sincronización por evidencia, prevención de duplicados y enriquecimiento SGDB opcional. Importación individual y por lotes necesitan vista previa y confirmación. Nada de ello se ejecuta en esta entrega.

El estado Git sigue sin commits/staging nuevos, con el trabajo previo de Fases 0/1 presente. El inventario del manifiesto permite distinguir esta fase; plugin/dist y AWNext_Phase9_SteamGridDB_Test.ps1 son cambios preexistentes conservados.
