# Library Customizer Alpha 0.1.0 — Fase 1

Implementación: Game Identity & Persistence. No se ha iniciado Fase 2. La validación de carga e interfaz dentro de Steam requiere intervención del usuario; no se ha instalado este paquete sobre la instalación personal.

## Motor compartido

`services/game_identity.lua` es la única política de coincidencia. React la consulta mediante `core/identity-service.ts` y los RPC get_identity_library / resolve_identity_provider. El lector de logros consulta identity_service y usa la misma resolución. Artwork y las consultas de catálogo Steam también delegan al mismo motor; no vuelven a comparar títulos ni seleccionan automáticamente el primer resultado.

La identidad del acceso es `cuenta:shortcut:AppID`. Sus referencias a AWN, Steam catálogo, SteamGridDB y proveedores adicionales son espacios independientes. Un ID AWN nunca se interpreta como AppID del shortcut ni como ID SGDB por igualdad numérica.

Se obtienen nombre, ejecutable, directorio y opciones de lanzamiento de shortcuts.vdf en modo lectura. Se acepta AppID signed/unsigned como representación del mismo shortcut. La cuenta se confirma con ActiveProcess/ActiveUser de Windows si pertenece a loginusers.vdf, o con un único MostRecent. AutoLogin solo permite inferencia en lectura; sin confirmación no se permite guardar.

## Política de resolución

- Referencia manual AWN: se busca por ID y, si se fijó, origen. Si falta o identifica varios registros se informa; no se sustituye por otro candidato automático.
- Títulos normalizados: se eliminan marcas, puntuación y acentos latinos contemplados, conservando texto no latino. Se normalizan números romanos y los alias MWII/MWIII. Es una comparación conservadora, no búsqueda difusa universal.
- Entrega/año, edición, origen e ID Steam contradictorios bloquean la coincidencia automática. Las referencias manuales explícitas pueden superar esa discrepancia, mostrándola como advertencia.
- Ejecutable/directorio compartidos aportan evidencia, pero no bastan para asociar un juego sin título o identificador corroborado.
- Varios candidatos compatibles requieren elección manual, incluso si sus puntuaciones difieren. La puntuación es evidencia interna, no probabilidad.
- Las asociaciones x360recomp heredadas siguen teniendo prioridad en modo auto. Otros modos disponibles: AWN manual, port y sin panel propio.

Caso protegido: el shortcut **3531473258 / MWIII** selecciona **AWN 3595270**, y rechaza **MWII 1959007243** aunque ambos candidatos compartan ejecutable. Se verifica con un fixture deliberadamente conflictivo y mediante lectura de los archivos reales disponibles.

## Persistencia versión 1

```json
{
  "schemaVersion": 1,
  "revision": 1,
  "games": { "2545026989": { "adapter": "x360recomp-toml", "titleId": "4D5309C9", "iconMap": {} } },
  "identities": {
    "1:shortcut:3531473258": {
      "shortcut": { "accountId": "1", "appid": "3531473258" },
      "achievementMode": "awn",
      "providers": {
        "awn": { "id": "3595270", "source": "GBE Fork" },
        "steam": { "id": "3595270" },
        "steamgriddb": { "id": "ID_INDEPENDIENTE" }
      }
    }
  }
}
```

Ejemplo esquemático, no configuración instalable: cuenta 1 es ficticia y se omiten rutas y las 50 entradas reales del iconMap por brevedad. El código conserva el mapa completo; nunca lo sustituye por el objeto vacío del ejemplo.

La carga del formato anterior es compatible y no escribe. El primer guardado explícito usa el documento existente como base, conserva games, preferencias y campos desconocidos, y crea el archivo nuevo versionado. Nunca escribe org.awnext.steambridge.config.json. Si ya existe un archivo nuevo, este tiene precedencia; no se mezclan silenciosamente documentos diferentes.

Las ediciones de port son overrides por cuenta/shortcut y conservan iconMap y campos heredados. Restablecer elimina solo el override; vuelve al mapping original o a la resolución automática. No elimina el mapping legacy.

Excepción de compatibilidad: los mappings legacy de games continúan siendo globales por AppID, como antes. No se asignan silenciosamente a una cuenta inferida. Las nuevas asociaciones y overrides sí están separados por cuenta.

## Protocolo de guardado y recuperación

1. Validar instalación, cuenta, shortcut, campos y token del documento cargado.
2. Adquirir un directorio .lock exclusivo. Un lock pendiente no se borra automáticamente.
3. Conservar el contenido original exacto en library-customizer.config.json.bak antes de modificar el destino.
4. Escribir y vaciar el temporal en el mismo directorio. En Windows se usan rutas Unicode, FlushFileBuffers y MoveFileExW con reemplazo y write-through; el destino no se borra antes.
5. Comprobar de nuevo el token antes de reemplazar. Un cambio externo causa conflicto y obliga a recargar.
6. Invalidar cachés backend y emitir invalidación frontend solo después del éxito.

El token es una huella de concurrencia no criptográfica, no un mecanismo de autenticación. El bloqueo coordina escritores del plugin; un editor externo que ignore el lock no ofrece una transacción compare-and-swap con el sistema de archivos. Se comprueba el contenido de nuevo inmediatamente antes del reemplazo.

json_document mantiene las formas JSON de valores previos, incluidas listas/objetos vacíos, null y números grandes desconocidos. No se reduce todo el documento a una nueva serialización Lua que pueda cambiar preferencias.

Si el archivo nuevo está dañado y existe respaldo válido, Games ofrece recuperación explícita. Se conserva antes el dañado en .corrupt.<token>; la recuperación comprueba concurrencia e invalida cachés. Un esquema futuro no se degrada mediante recuperación. Un fallo de backup o escritura deja el documento anterior disponible. La prueba de fallos es simulada; no se ha provocado un corte eléctrico real.

## Consumidores y cachés

GamesTab muestra estados matched/manual/manual-port/ambiguous/conflict/missing/disabled, evidencia y bloqueos. IdentityEditor permite editar referencias y datos básicos de port, fijar edición/origen y restablecer. Un cambio de revisión exige recargar antes de escribir.

El repositorio AWN compartido sirve a discovery, diagnóstico e identidad. Tras guardar o recuperar se limpia asset_cache; el frontend incrementa una generación, descarta resultados en vuelo anteriores y vuelve a leer el panel. Las comprobaciones de proveedores y la selección de artwork también se invalidan.

No se añade un proveedor nuevo de logros ni se escriben logros oficiales. Si aw-next está habilitado se delega la presentación general y se evita añadir otro panel snapshot. El lector explícito de ports sigue disponible. No se modifica el resolver ni la presentación del plugin oficial: la corrección de MWIII está en Library Customizer.

## Límites de esta fase

La validación en Steam, el arbitraje avanzado de presentación por juego, la gestión completa de artwork/backups y Studio quedan fuera. La normalización no es un catálogo universal de alias ni un identificador de ROM por hash. Los IDs manuales de un proveedor que no aparezcan en sus candidatos se muestran como no disponibles; no se inventa otra asociación.
