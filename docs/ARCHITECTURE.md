# Arquitectura actual: Fase 2 local

La base de identidad/persistencia de Fase 1 se conserva. DiscoveryTab → discovery-service → RPC de solo lectura → discovery/library → adaptadores sustituibles → fuentes de metadatos. game_identity evalúa posibles duplicados y conflictos; no se crean ni fusionan accesos, licencias o instalaciones por título. Cache de discovery solo en memoria, revisión por snapshot y observaciones anteriores conservadas ante error fatal.

El recurso PowerShell enumera valores seleccionados de instalación y paquetes del usuario actual. SQLite usa SELECTs fijos de metadatos GOG en modo lectura/immutable, sin journals. No hay clientes HTTP ni autenticación en este subsistema. Ver [contrato, límites y fuentes](UNIVERSAL-DISCOVERY.md).

La validación de ejecución dentro de Steam sigue pendiente. La descripción de Fase 1 a continuación se conserva para sus módulos; el contenido futuro del roadmap no está implementado.

# Library Customizer — arquitectura actual (Fase 1)

Backend Lua, frontend React/TypeScript y distribución Starlight bajo el ID library-customizer. La Fase 0 y sus resultados se conservan como historial; el contrato actual es [Game Identity & Persistence](PHASE1-IDENTITY.md).

## Entrada y protección de instalación

main.lua registra RPC y millennium.ready. Antes de registrar el hook de ventanas o conectar el observer, index consulta installation_status. Si el legacy org.awnext.steambridge está habilitado o no se puede leer el estado, no se activa la navegación nueva. La misma restricción protege escrituras de identidad. Los scripts nunca editan enabledPlugins.

## Identidad compartida

GamesTab → core/identity-service → RPC → identity_service → game_identity.

El backend combina config_store, el inventario Steam por cuenta y los candidatos de awn_repository. El motor evalúa identidad de proveedor, títulos, entrega/año, edición, origen y rutas. Devuelve selección, candidatos, evidencia y bloqueos. Artwork y las comprobaciones Steam consultan la misma política mediante resolve_identity_provider. No hay un segundo algoritmo de matching en React.

steam_shortcuts lee loginusers.vdf y el VDF binario de accesos. ActiveUser se consulta en lectura cuando está disponible; AutoLogin sin confirmación mantiene el editor bloqueado. Los nombres del VDF prevalecen sobre la caché frontend para evitar contaminación entre cuentas y accesos eliminados.

## Datos de logros

get_achievements → achievement_resolver → identidad compartida → x360recomp o awn_snapshot.from_game.

El lector x360recomp mantiene TOML, catálogo, iconMap y PNG de AWN. Acepta un override scoped sin cambiar la asociación heredada original. awn_snapshot solo transforma el juego ya resuelto; se retiraron su normalización y búsqueda independientes. Discovery y provider_status comparten awn_repository, que lee el snapshot con TTL.

Con aw-next habilitado se delega la presentación general en el plugin oficial; el lector explícito de ports permanece disponible. No se añaden escrituras ni hooks nativos de logros Steam. AWN oficial, GDL y otros plugins no se modifican.

## Persistencia

config_store lee el archivo nuevo o el legado mediante product_compat. Migra en memoria y escribe versión 1 únicamente al guardar explícitamente. Usa scope por cuenta/shortcut, revisión y token de concurrencia. Se conserva games y sus campos desconocidos.

Antes de reemplazar se guarda el original exacto en .bak. atomic_file escribe y vacía un temporal, con API Unicode y reemplazo Windows; json_document preserva formas JSON desconocidas. Un directorio .lock coordina escritores. La recuperación explícita conserva el dañado y no degrada esquemas futuros.

Tras guardar/recuperar se limpia asset_cache y el servicio frontend emite una generación. Los consumidores descartan respuestas anteriores y refrescan datos. No se ha reemplazado el observer de navegación por una arquitectura de Fase 2.

## Presentación y artwork conservados

steam-placement y presentation siguen insertando la sección propia en contenedores GDL o junto a Notes/Media. Los builders ui/* mantienen lista, filtros y resumen. Se conserva la atribución y licencia MIT de GDL.

SteamGridDB sigue usando HTTP Lua y curl.exe para imágenes; el flujo visible aplica mediante SteamClient.Apps.SetCustomArtworkForApp. El camino antiguo sgdb_apply y sus respaldos permanecen. No se ha corregido todavía su selector de perfil ni implementado el rediseño completo de artwork. La selección de juego SGDB ahora utiliza identidad compartida y requiere elección explícita si hay ambigüedad.

## Verificación

TypeScript, LuaJIT 2.1 y pruebas del cliente/editor con transporte simulado. PowerShell prueba instalación, migración y respaldo de activación en temporales. El build release usa el socket aislado de Fase 0, genera manifiesto con hashes y no instala. La validación de carga e interacción dentro de Steam está descrita en [INSTALLATION-VALIDATION](INSTALLATION-VALIDATION.md).

## Fase 3A: Import Preview

Previsualización local de instalaciones, identidad, posibles duplicados y colecciones sugeridas. Selección temporal individual o por lote, sin escrituras ni ejecución de juegos. [Validación Steam y APIs de 3B/3C](STEAM-IMPORT-VALIDATION.md). Integración runtime pendiente; no instalar ni activar automáticamente.
