# Library Customizer Alpha 0.1.0 — roadmap actualizado

1. **Fase 0, base verificable:** limpieza segura, migración de nombre, fixtures e identificación de artefactos. Implementada localmente.
2. **Fase 1, Game Identity & Persistence:** motor compartido, referencias independientes y editor con persistencia/backup. 35 regresiones de partida; validación dentro de Steam pendiente.
3. **Fase 2, Universal Library Discovery:** proveedores locales sustituibles, evidencia, estados y vista agrupada. Entrega actual con cobertura limitada por launcher; no es una biblioteca completa de derechos. Ver UNIVERSAL-DISCOVERY.md.
4. **Fase 3A, Import Preview:** implementada localmente sin escrituras. Validación Steam pendiente. 3B/3C investigadas, sin adaptadores de escritura; ver STEAM-IMPORT-VALIDATION.md.
5. Fases posteriores: colecciones mantenidas, sincronización incremental, enriquecimiento optativo y ampliación de fuentes. Cualquier autenticación requerirá un alcance y consentimiento separados.

## Diseño posterior de 3B/3C, sin implementación

### Accesos seguros

Las declaraciones locales de Millennium incluyen SteamClient.Apps.AddShortcut(appName, executablePath, directory, launchOptions): Promise<number> y RemoveShortcut(appId). Son interfaces del cliente no una garantía de API pública estable de Valve: hay que probarlas dentro de Steam con un acceso de prueba y validar lectura posterior. No se han llamado. No editar shortcuts.vdf directamente mientras Steam funciona.

Proponer una operación de importación: inventario → identidad → plan de cambios → vista previa → confirmación explícita → API del cliente → comprobación del AppID devuelto → registro propio de procedencia. Cancelar no debe escribir nada. No eliminar/recrear accesos manuales para resolver un conflicto. Para lotes, resultados por elemento y recuperación de fallos parciales; nunca rollback que borre accesos ajenos.

### Lanzamiento oficial

Resolver launcher oficial, URI o AUMID por adaptador, con argumentos separados y validación de disponibilidad. Playnite documenta en su código uplay://launch/<id>, el esquema com.epicgames.launcher y los argumentos launchViaAutostart de Galaxy. No se añaden esas URIs por inferencia a los resultados actuales ni se ejecutan. Para Xbox se detecta AUMID, pero falta verificar la activación mediante shell en Steam. No eludir comprobaciones de licencia del launcher ni convertir comandos arbitrarios del manifiesto en shell ejecutable.

### Colecciones normales por tienda

No se encontró una interfaz tipada de creación de colecciones normales en las declaraciones locales consultadas. Su API de runtime debe investigarse y probarse con una colección temporal antes de implementar; no se inventa un método ni se escribe directamente su almacenamiento.

Mantener un registro propio de IDs de colecciones creadas por Library Customizer, tipo normal y miembros gestionados. Si el usuario ya tiene una colección con el mismo nombre, no apropiarse de ella; ofrecer seleccionar una existente o crear otra. Preservar nombre, orden y miembros manuales. El proveedor de colección debe ser sustituible para cambios del cliente.

### Sincronización incremental y prevención de duplicados

Claves de proveedor, instalación y licencia independientes. Registrar fingerprint/evidencia de las fuentes y última exploración completa válida. Una fuente ausente, error, catálogo obsoleto o fin de suscripción no deben disparar borrados de accesos. Proponer diferencias y conservaciones; los cambios destructivos siempre requieren revisión.

Cruzar referencias manuales y candidatos del motor de identidad con el inventario Steam. Un mismo título de varias tiendas puede representar instalaciones/licencias distintas; no deduplicar solo por nombre o ejecutable. El caso MWIII/MWII continúa bloqueado por contradicción de identidad. Los registros de catálogo sin prueba de propiedad deben estar claramente diferenciados antes de importación.

### Artwork e importación individual/por lotes

Reutilizar la referencia SteamGridDB independiente de Fase 1. Enriquecimiento optativo después de elegir la identidad, con revisión de coincidencias, límites y recuperación de artwork; no acceder a SGDB automáticamente durante discovery.

La vista previa debe mostrar nombre, proveedor, instalación/método, licencia confirmada/desconocida, acceso existente, evidencia, conflicto, colección destino y cambios de artwork. Permitir excluir elementos, resolver candidatos y cancelar. La selección de uno o varios ya existe en 3A; el plan transaccional de escritura no se implementa todavía.

## Condiciones para habilitar escrituras de 3B/3C

Validación de Fases 1/2 dentro de Steam; revisión de las limitaciones de fuentes no instaladas; prueba segura de AddShortcut y de la API real de colecciones normales; copia de seguridad, vista previa y registro de propiedad implementados antes de cualquier cambio al usuario. Esta entrega no ejecuta ninguno de esos cambios.

## Preparación 3B entregada

Planificación, validación y reversión simuladas; journal versionado probado en temporales usando config_store. Integration ofrece lectura y guía; escrituras Steam ausentes. Investigación 3C identifica candidatos de collectionStore en una implementación externa, sin validación en esta versión. Ver INTEGRATION-RUNBOOK.md y SHORTCUT-MANAGER.md. No se avanza a Fase 4.
