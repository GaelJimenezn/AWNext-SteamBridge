# Library Customizer — resultados Fase 3A

## Alcance entregado

Import Preview es una página de Library Manager, separada de Discovery. Muestra nombre/plataforma, ruta y método observado, ID de proveedor, evidencia de identidad compartida, referencias de Steam, incertidumbre/posibles duplicados/conflictos, instalación, licencia y colección sugerida. Selección individual o de varias instalaciones para revisión; no es una confirmación de importación.

Reutiliza snapshot y motor de Fases 1/2. No hay normalizador o resolver nuevo, proveedor nuevo ni sistema de persistencia adicional. La selección solo vive en React; actualizar/salir/editar identidad la invalida. Ignora respuestas tardías. El backend ahora informa disponibilidad, error, cuenta y alcance del inventario persistido. No afirma conocer el estado en memoria de Steam ni la biblioteca nativa completa.

No se implementaron escrituras de 3B/3C. No se crearon, ejecutaron, actualizaron ni eliminaron accesos o colecciones. No se instaló/activó/desinstaló ningún plugin. No se avanzó a Fase 4.

## Archivos de esta fase

Delta contra el inventario SHA256 guardado de Fase 2 en `.phase0/phase2-build-manifest.json`; no contra HEAD, que contiene cambios anteriores pendientes.

| Archivo | Cambio y finalidad |
|---|---|
| plugin/frontend/core/import-preview.ts | Nuevo: proyección pura y selección, conserva instalaciones/tiendas separadas |
| plugin/frontend/manager/tabs/ImportPreviewTab.tsx | Nuevo: vista, selección temporal, evidencia y exclusiones |
| plugin/frontend/manager/Manager.tsx | Entrada Import Preview y montaje de la página |
| plugin/frontend/core/discovery-service.ts | Contrato opcional de diagnóstico del inventario Steam |
| plugin/backend/services/discovery/library.lua | Expone estado real de lectura del inventario, sin nuevas RPC ni escrituras |
| tests/import-preview.test.mjs | Nuevo: 11 escenarios de plan y componente con respuestas simuladas |
| tests/test_discovery.py | Un escenario nuevo de inventario fallido/válido sin prueba runtime |
| plugin/package.json | Incluye las nuevas regresiones en npm test |
| scripts/build-local.mjs | Etiqueta de manifiesto alpha-phase3a; continúa compilando fuera de Steam |
| docs/STEAM-IMPORT-VALIDATION.md | Nuevo: matriz manual, APIs y requisitos de 3B/3C |
| docs/PHASE3A-RESULTS.md | Nuevo: este informe |
| docs/ROADMAP.md | Distingue 3A implementada de 3B/3C pendientes |
| docs/INSTALLATION-VALIDATION.md | Enlace a validaciones adicionales |
| docs/ARCHITECTURE.md | Documenta entrada de previsualización |
| README.md, plugin/README.md | Documentan alcance y enlaces |

Total: 11 archivos previos modificados, 5 nuevos, 0 eliminados en esta fase. El artefacto ignorado y su manifiesto se regeneran solo en artifacts/library-customizer; las evidencias se guardan en .phase0. No se cambian dependencias ni lockfiles en esta fase.

## Verificaciones

- TypeScript sin errores y compilación release local segura con ID library-customizer. Sin HMR, recarga, instalación ni reinicio automáticos.
- Suite final ejecutada y aprobada: 23 pruebas Identity + 15 Discovery + 26 Node = 64 ejecuciones / 58 escenarios únicos (6 pruebas base heredadas se ejecutan en ambas clases Python). Incluye los 46 escenarios únicos previos y 12 nuevos. Todas aprobaron; las simulaciones no se cuentan como integración Steam.
- Nuevos escenarios: conceptos separados, referencias manuales vs candidatos, conflictos del motor existente, exclusión de no instalados/desconocidos/obsoletos, idempotencia de previsualización, varias tiendas/instalaciones, selección obsoleta y descartado, inventario/método no disponibles, Xbox distinto de Game Pass, ausencia de mutaciones, componente con selección individual/lote e invalidación/respuestas tardías y estado de lectura backend.
- Ejecución/borrado/rollback reales y persistencia de accesos tras reiniciar Steam: pendientes. Solo se prueban ausencia de ejecución/escritura, descarte de selección y comportamiento con observaciones retiradas mediante fixtures. No existe importación repetida real todavía.
- `git diff --check` sin errores de espacios; hay avisos históricos LF/CRLF en archivos de fases anteriores.
- Comprobación local de asociaciones: 2545026989 → 4D5309C9, iconMap 50, 16/70. MWIII 3531473258 selecciona 3595270, no 1959007243. Lectura externa a Steam, no validación visual del panel.
- Snapshot antes/después verifica los 28 archivos protegidos y plugin/dist sin cambios: configuraciones personales, paquetes legacy/externos y datos incluidos en la protección mantienen hashes. No se escribe artwork ni archivos de progreso.

## Estado y limitaciones

HEAD permanece 6c29a7811b5d58625f694a031a2bf57739f4deeb, rama feature/native-artwork-integration. No se realiza commit ni staging. El árbol ya estaba sucio por Fases 0/1/2; plugin/dist y AWNext_Phase9_SteamGridDB_Test.ps1 son cambios preexistentes preservados. Las eliminaciones visibles en Git corresponden a Fase 0, no a esta entrega. `.phase0/phase3-before.json` y `.phase0/phase3-final.json` guardan el estado Git completo y evidencia de protección.

La instalación sigue siendo org.awnext.steambridge activa, library-customizer no instalada/inactiva; no coexisten activas. Sin Steam en ejecución al comprobar, no puede validarse carga ni presencia runtime de APIs. Configuración/compilador aceptan el ID, pero la carga real sigue pendiente. El inventario persistido es incompleto respecto a memoria y títulos nativos: ningún resultado se presenta como libre de duplicados.

Epic aporta un ejecutable observado que puede requerir launcher; Ubisoft/GOG no siempre aportan método; Xbox AUMID no verifica ejecución y no acredita Game Pass. Sin licencia verificable no hay colección Game Pass sugerida. Datos de catálogo desconocidos no pueden importarse en esta fase. Datos y selecciones Discovery no son persistentes por diseño.

## Próximo paso autorizado pendiente

Revisar esta previsualización y la matriz de STEAM-IMPORT-VALIDATION.md. Con autorización separada: respaldo, migración por copia, instalación y activación manual sin legacy simultáneo; comprobar carga/RPC/Discovery/Games/Artwork/Settings, AWN/GDL, x360recomp y reinicio. Luego aprobar expresamente la prueba desechable de APIs y el diseño de registro propio/rollback/colecciones antes de implementar 3B/3C. Ninguno de esos pasos se ejecuta automáticamente.
