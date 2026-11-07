# Fase 3B preparada — simulación y registro

## Módulos y límites

- services/shortcuts/manager.lua: propuesta desde una selección de IDs y revisión Discovery actuales. Relee inventario, valida instalación/ruta/método y consulta game_identity.evaluate para duplicados y contradicciones. No acepta comandos del cliente. Máximo 100 instalaciones. Mantiene identidad de proveedor, instalación y acceso independientes; claves por cuenta/proveedor/producto/instalación.
- services/shortcuts/journal.lua: operaciones virtuales, repetición idempotente y plan de reversión por juego. IDs `sim:` imposibles de confundir con un AppID numérico. Conserva objetos sin propiedad o con fingerprint modificado. Nunca ejecuta una eliminación.
- persist_simulation: persiste exclusivamente un journal de simulación versionado en config.shortcutManager.version=1/simulations[account], reutilizando config_store y su respaldo, revisión, bloqueo y escritura atómica. No hay RPC ni botón para guardarlo; se ejercita solo en temporales. Datos reales y legacy quedan intactos. No es todavía un registro de accesos reales creados.
- simulate_shortcut_import: única RPC nueva. Reconstruye propuesta y devuelve una simulación transitoria; no guarda. No permite al frontend aportar un journal, IDs de Steam, permisos ni una propuesta ejecutable para hacerla pasar por verificada.
- shortcut-service.ts e ImportPreviewTab: envían solo IDs y revisión, muestran resultado simulado y descartan resultados al cambiar selección/identidad/refrescar/salir. Rechazan respuestas en modo real.
- integration-probe.ts e IntegrationTab: lectura de activación, ping, snapshot y presencia de métodos, más guía manual. Ningún typeof confirma funcionamiento real.

## Rutas y ejecución

Validación conservadora Windows: rutas de unidad absolutas, sin traversal, comillas, controles, stream alternativo o comodines; instalación y .exe deben existir y la ruta debe estar contenida lexicalmente en la instalación. Argumentos siempre separados y vacíos en esta fase; no ejecutar LaunchCommand arbitrario, cmd/PowerShell ni inferir URIs. Ubisoft/GOG sin método y Xbox shell_app no verificado permanecen bloqueados para creación simulada. La compatibilidad de ejecución con el launcher siempre se informa unverified.

Un resultado would_create significa que pasó la validación del modelo para una operación virtual. No acredita licencias, launcher, cuenta en ejecución, semántica de APIs ni inventario completo. Todas las puertas reales permanecen false. Antes del futuro escritor faltan resolución física de junctions/enlaces, contrato de argumentos/quoting probado, launcher oficial validado y registro transaccional recuperable.

## Duplicados y reversión

Usa el motor existente, sin duplicar normalización. Un candidato elegible o referencia manual existente bloquea crear. Mismo ejecutable con identidad contradictoria también bloquea: MWIII no se asocia a MWII. La ausencia en shortcuts.vdf no demuestra ausencia en memoria o biblioteca nativa: completeSteamInventory sigue false.

La misma instalación seleccionada repetidamente se proyecta una vez; instalaciones distintas sobreviven. Si dos propuestas comparten exactamente el mismo ejecutable normalizado, la segunda se conserva para revisión pero no simula creación. No se fusionan licencias o tiendas por título.

La simulación del journal es idempotente cuando recibe su estado anterior. La UI no persiste ni reanuda ese estado; al actualizar lo descarta. Una reversión virtual solo afecta una entrada sim propia de la misma cuenta cuyo fingerprint actual coincide. Un cambio manual, objeto ausente, ID ajeno o cuenta distinta se conserva. Una operación revertida no se recrea implícitamente al repetir el mismo journal.

El futuro registro real debe separar planned/created_unconfirmed/verified/persisted/conflict/rollback y guardar el AppID leído, campos exactos y evidencia del runtime. Nunca borrar un objeto por nombre o tratar un fallo al guardar registro como autorización para eliminarlo. No hay actualización/eliminación real en esta entrega.

## APIs: estado de verificación

Las firmas locales de AddShortcut, RemoveShortcut y SetShortcut* se documentaron en STEAM-IMPORT-VALIDATION.md. Esta entrega añade detección de presencia, no invocación. No hay API de escritura confirmada en ejecución local: Steam está cerrado y library-customizer no instalado. Compilación y pruebas con mocks no cambian ese estado.

## Investigación 3C: candidato concreto, sin habilitar

Implementación primaria consultada: https://github.com/danielcamilo1/decky-add-non-steam-games/blob/7f77800b715f5b17efc6a394c9edeb8be6a58841/src/steam.ts#L208 . Declara collectionStore.userCollections/GetCollection y construye una colección con NewUnsavedCollection; agrega app overviews mediante AsDragDropCollection().AddApps y llama Save. Es evidencia de uso en otro plugin/entorno, no prueba de Millennium/Windows ni de nuestra versión de Steam. No se copia su código ni su comportamiento de reutilizar colecciones por nombre.

| Operación | Evidencia disponible | Verificación local |
|---|---|---|
| Enumerar/obtener colección | Implementación externa y probe de presencia limitado | Pendiente dentro de Steam |
| Crear colección normal | NewUnsavedCollection candidato externo | No invocado |
| Añadir miembros | AddApps con overviews, no IDs simples, en referencia externa | No invocado |
| Guardar | Save Promise en referencia externa | No confirma almacenamiento ni durabilidad aquí |
| Retirar miembros/borrar | Sin contrato seguro verificado | Bloqueado |
| Reinicio/sincronización | Requiere cierre limpio y lectura posterior | No probado |

Diseño seguro pendiente: registrar por cuenta el ID devuelto de la colección propia, miembros gestionados y última observación completa usando config_store. El nombre no acredita propiedad. Si existe una colección personal homónima, conservarla y ofrecer otro nombre; no adoptar sin consentimiento. Mantener nombres/miembros manuales; no borrar colecciones personales. Para agregar, calcular diferencia de conjuntos sobre IDs y leer otra vez después de guardar; repetir sin duplicar. No retirar miembros por launcher inaccesible ni por caché vacía; retirar solo miembros gestionados tras evidencia completa y revisión explícita. Si faltan métodos seguros, mantener propuesta sin escritura. Registrar preferencia de sincronización por proveedor solo al habilitar esa fase; desactivar no elimina colecciones. Game Pass requiere evidencia de suscripción separada de Xbox PC.

Antes de habilitar: colección desechable autorizada, creación/ID/membresía/guardado/lectura/cierre limpio/reinicio; probar homónima personal y cambios manuales sin tocarla. No editar archivos internos ni usar tags de shortcuts como sustituto no verificado de colecciones normales. La implementación actual no crea colecciones ni cambia miembros.
