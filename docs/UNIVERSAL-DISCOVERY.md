# Fase 2 — Universal Library Discovery

Estado: implementación local de solo lectura y arquitectura de proveedores. No equivale a biblioteca universal completa de juegos poseídos. La carga del plugin y de los RPC dentro de Steam sigue pendiente. Fase 1 pasó su regresión antes de comenzar (35 pruebas); no se marca validada en ejecución por esta fase.

## Dependencias comprobadas

Se reutilizan LuaJIT, json/fs/utils/millennium, React/TypeScript y el Game Identity Engine de Fase 1 sin cambiar su política. Windows PowerShell 5.1 sirve al lector de registro/Appx y winsqlite3.dll al catálogo local GOG. No se añade una dependencia de producción descargable. Si falta una capacidad, el proveedor informa error sin cancelar los demás. El lector PowerShell se distribuye como recurso del .star y se consulta mediante millennium.assets.read; su carga desde el paquete requiere prueba en Steam.

## Modelo

- Juego: referencia estable compuesta por proveedor e ID nativo. Los títulos no son claves.
- Instalación: ID independiente, ruta, estado, método detectado y evidencia; varias rutas/métodos pueden conservarse para el mismo producto.
- Licencia: evaluación independiente del estado instalado. Admite compra/suscripción/desconocida y referencias distintas; los lectores actuales solo emiten desconocida porque no consultan pruebas de adquisición.
- Acceso Steam: referencias manuales existentes o candidatos para revisar. No se crean ni modifican accesos.
- Evidencia: fuente local concreta y fecha UTC de comprobación. Esa fecha no garantiza actualidad del catálogo remoto ni validez de licencia.

Cada registro expone id, providerId, provider, name, game, installations, licenses, installed, evidence y lastChecked. Se marca nameResolved=false cuando solo se conoce el identificador o nombre técnico del paquete. Los campos ausentes no se rellenan con información inventada.

La ausencia de una ruta o un manifiesto no demuestra desinstalación global. Se devuelve unknown cuando no puede confirmarse el estado; not_installed se reserva para evidencia explícita futura. Un catálogo en caché puede aportar candidatos no instalados, pero no confirma que pertenezcan al usuario.

## Proveedores y limitaciones

| Proveedor | Fuentes implementadas | No instalados / licencia |
|---|---|---|
| Ubisoft Connect | Valores seleccionados de HKLM Ubisoft/Launcher/Installs, vistas 32/64; comprobación de InstallDir | No se procesa todavía el caché binario de productos. Puede haber claves residuales y nombres no resueltos. Sin biblioteca poseída completa ni prueba de compra/Ubisoft+ |
| Xbox PC / Microsoft Store | Get-AppxPackage del usuario actual, MicrosoftGame.config y AppxManifest.xml, con prueba de juego | No se importan todos los programas Store como juegos. Paquetes inaccesibles/formatos antiguos pueden faltar. Sin catálogo de cuenta ni prueba de compra/Game Pass |
| PC Game Pass | Adaptador sustituible con estado limited | No hay lector de derechos no sensibles compatible en esta entrega. Cero resultados no significa cero juegos ni ausencia de suscripción. No se etiqueta una instalación Xbox como Game Pass |
| Epic Games Launcher | ProgramData/Epic/EpicGamesLauncher/Data/Manifests/*.item, aplicaciones declaradas por el manifiesto | No se consultan webcache, cuenta, sesiones ni biblioteca remota. Caché/manifiesto residual no prueba propiedad ni desinstalación. Algunos registros pueden ser aplicaciones/herramientas; revisión posterior necesaria |
| GOG Galaxy | Registro GOG.com/Games y SQLite LimitedDetails + InstalledBaseProducts | El catálogo puede incluir títulos no instalados/no poseídos o productos sin clasificación suficiente. No se consulta ProductAuthorizations ni datos de cuenta. Ausencia de instalación en esa fuente sigue siendo unknown |

El objetivo de detectar juegos no instalados está cubierto de forma parcial por metadatos GOG cuando existe ese catálogo. No se anuncia cobertura de toda la biblioteca no instalada de cada launcher. Ubisoft dispone de otro caché local conocido, pero su protobuf/YAML no se decodifica en esta entrega: se documenta como extensión pendiente, no como funcionalidad terminada.

## Lectura y límites

Solo se enumeran rutas permitidas de metadatos, no discos completos ni carpetas de credenciales. No se leen tokens, cookies, contraseñas ni configuración de autenticación. No se hacen peticiones HTTP ni se inicia sesión. Las rutas UNC y relativas no se resuelven por el contexto de archivos; no se cambia ningún permiso de WindowsApps.

El helper Windows tiene límite de 15 segundos y salida de 2 MiB. Se abre el registro sin escritura, se seleccionan solo valores de instalación y se limita a 5000 subclaves/paquetes. XML prohíbe DTD y resolución externa. Los errores de un paquete son parciales. El proceso hijo se crea sin ventana y el timeout termina únicamente ese hijo.

SQLite usa dos SELECT fijos, flags READONLY/URI y mode=ro&immutable=1; comprueba que la conexión es de lectura. Rechaza WAL/journal presentes, cambios durante lectura, archivos mayores de 256 MiB y resultados de más de 5000 filas. No crea snapshots ni sidecars del launcher; no hace checkpoints, PRAGMA de escritura ni consultas a tablas de autenticación. Si Galaxy está escribiendo se conserva la lectura de registro y se informa el catálogo no disponible. La prueba SQLite usa una base temporal real y comprueba hash y ausencia de sidecars.

La detección se almacena solo en memoria. Refrescar sustituye las observaciones del proveedor; ante fallo fatal conserva el resultado previo con stale y la fecha original. Los demás resultados permanecen visibles. Se permite solicitar otro proveedor y se descartan respuestas atrasadas mediante revisión de snapshot. No se garantiza paralelismo de los lectores dentro de la VM Lua; el helper está acotado y la sincronización incremental aún no existe.

## Identidad y presentación

El motor Fase 1 compara candidatos por título/edición y rutas. No se fusionan tiendas, licencias ni instalaciones por título. Se agrupan solo observaciones con el mismo ID de proveedor, conservando evidencia, variantes y licencias distintas. Los posibles duplicados y conflictos se muestran para revisar. También se reconocen referencias de proveedores que ya estén guardadas manualmente para un shortcut de la cuenta actual; no se escriben mappings durante discovery.

Se indexan títulos/ejecutables y se limita a 50 comparaciones relacionadas por registro. La interfaz muestra hasta 200 registros por proveedor y permite buscar en todos los registros recibidos. No hay botones de importar, lanzar, crear colecciones ni enriquecer artwork. Cada proveedor tiene su propio refresco/estado/error.

## Evidencia de investigación

- [EpicLauncher de Playnite](https://github.com/JosefNemec/PlayniteExtensions/blob/master/source/Libraries/EpicLibrary/EpicLauncher.cs): ubicación de manifiestos locales y separación de datos instalados.
- [Uplay de Playnite](https://github.com/JosefNemec/PlayniteExtensions/blob/master/source/Libraries/UplayLibrary/Uplay.cs): caché local configuration/configurations y su uso de protobuf/YAML; no implementado aquí.
- [UplayLibrary](https://github.com/JosefNemec/PlayniteExtensions/blob/master/source/Libraries/UplayLibrary/UplayLibrary.cs): registro Installs y origen de datos locales.
- [Get-AppxPackage](https://learn.microsoft.com/en-us/powershell/module/appx/get-appxpackage): inventario del perfil actual; no se usa AllUsers.
- [MicrosoftGame.config](https://learn.microsoft.com/en-us/gaming/gdk/docs/features/common/game-config/microsoftgameconfig-overview): identidad y metadatos de juegos, no derechos de suscripción.
- [SQLite URI](https://www.sqlite.org/uri.html): modo de lectura e immutable. La exclusión de WAL evita presentarlo como snapshot coherente de un cliente activo.
- Esquema GOG contrastado con la referencia local AWN gogOfficial.js y fixtures. Se implementa lector propio de dos tablas de metadatos, sin copiar ni modificar el plugin o sus lectores de autorizaciones.

## Validación pendiente en Steam

Respaldar activación antes de deshabilitar el legacy; conservarlo. Instalar conscientemente el nuevo .star y comprobar ID, cuenta, RPC y carga del recurso. Abrir Discovery, refrescar cada proveedor, contrastar las filas con su launcher y probar ausentes/permisos/GOG con WAL sin perder otros resultados. Comprobar que no aparecen accesos/colecciones nuevos y que Games/mapping/16/70 continúan funcionando. La enumeración local ejecutada fuera de Steam no sustituye estas pruebas.
