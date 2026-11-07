# Fase 3B preparada e integración guiada — resultados

## Estado efectivo

Se implementó arquitectura y operaciones virtuales, sin adaptador real de escritura. No se instala ni activa nada. Steam no estaba ejecutándose durante la comprobación: legacy sigue activo, library-customizer no instalado/inactivo; bothEnabled false. Las Fases 1/2/3A NO están validadas dentro de Steam. No hay API de creación/actualización/eliminación o colección confirmada en ejecución.

La página Integration ofrece ping Lua, snapshot, diagnóstico de activación y comprobación de presencia de métodos sin llamarlos. La guía INTEGRATION-RUNBOOK.md contiene pasos, matriz de resultados pendientes, reinicio y reversión de activación. Debe completarse tras autorización e instalación; no se marca automáticamente como aprobada.

## Resultado local comprobado

- 23 pruebas Identity + 15 Discovery + 17 Shortcuts + 30 Node = 85 ejecuciones, 73 escenarios únicos. Los seis escenarios base se repiten en tres clases Python: 12 ejecuciones adicionales. Todos aprobaron. Se conservan los 58 escenarios previos y se añaden 15 únicos; el test de componente de 3A también cubre la simulación.
- TypeScript y compilación release local correctos. Fuente/manifiesto/artefacto verificados. El paquete está solo en artifacts/library-customizer; no coincide con el legacy instalado, como corresponde a una versión nueva todavía no instalada.
- Propuestas con datos frescos, rechazo de revisión/IDs obsoletos, duplicados, conflicto MWII/MWIII, validación de rutas y comandos, lote parcial, diferentes instalaciones, repetición, reversión virtual y preservación de cambios manuales.
- Journal versionado usando config_store: respaldo exacto, guardado atómico en temporales, rechazo de token obsoleto/futura versión/IDs reales, recarga desde disco y fallo de guardado conservando originales. La recarga Lua NO prueba reinicio Steam.
- Presencia de APIs y lectura RPC probadas con mocks que no permiten mutaciones. El sondeo no llama AddShortcut, RemoveShortcut ni métodos de colección.
- Lector local real en modo lectura: MWIII 3531473258 → AWN 3595270; mapping 2545026989 → 4D5309C9, 50 iconMap y 16/70. No se valida visualmente el panel dentro de Steam.
- Los 28 archivos protegidos y plugin/dist mantienen hashes respecto a phase3b-before.json: sin cambios personales, de paquetes legacy, AWN/GDL ni datos protegidos. No hay escrituras de artwork, accesos ni progreso.
- git diff --check sin errores; avisos de conversión LF/CRLF heredados. No staging/commit. Se conserva HEAD 6c29a7811b5d58625f694a031a2bf57739f4deeb en feature/native-artwork-integration. El árbol ya estaba sucio por fases previas; las eliminaciones visibles son anteriores, no de esta fase.

## Archivos de esta entrega

Comparación por SHA256 con .phase0/phase3a-build-manifest.json, no contra HEAD. Once modificados, once nuevos, cero eliminados.

| Archivo | Cambio |
|---|---|
| plugin/backend/services/shortcuts/manager.lua | Nuevo: propuestas y validación con motor compartido; simulación transitoria |
| plugin/backend/services/shortcuts/journal.lua | Nuevo: journal/rollback virtual y contrato de persistencia probado en temporales |
| plugin/backend/rpc_functions.lua | RPC exclusiva de simulación; ninguna RPC de guardado de journal |
| plugin/frontend/core/shortcut-service.ts | Nuevo: contrato que rechaza modos reales y envía solo IDs/revisión |
| plugin/frontend/core/integration-probe.ts | Nuevo: lectura de presencia de APIs |
| plugin/frontend/manager/tabs/IntegrationTab.tsx | Nuevo: guía y diagnóstico RPC sin mutaciones |
| plugin/frontend/manager/tabs/ImportPreviewTab.tsx | Simulación desde selección y descarte/invalidez de resultados |
| plugin/frontend/manager/Manager.tsx | Página Integration |
| tests/test_shortcuts.py | Nuevo: 11 escenarios nuevos, más los seis base repetidos |
| tests/shortcuts-client.test.mjs | Nuevo: cuatro escenarios de transporte/sondeo/interfaz/ausencia de escrituras |
| tests/import-preview.test.mjs | Amplía interacción para resultado simulado y descarte |
| plugin/package.json | Incluye nuevas suites; sin dependencias nuevas |
| scripts/build-local.mjs | Etapa alpha-phase3b-simulation |
| scripts/prepare-release.mjs | Nuevo: entrega organizada de paquete/manifiesto/guías con verificación SHA |
| docs/INTEGRATION-RUNBOOK.md | Nuevo: validación guiada y carpeta/formato de instalación |
| docs/SHORTCUT-MANAGER.md | Nuevo: arquitectura, persistencia, límites y fuentes de 3C |
| docs/PHASE3B-PREPARATION-RESULTS.md | Nuevo: resultados de esta entrega |
| docs/INSTALLATION-VALIDATION.md, docs/STEAM-IMPORT-VALIDATION.md | Enlaces a nueva guía; resultados runtime pendientes |
| docs/ROADMAP.md | Preparación 3B simulada y 3C pendiente |
| README.md, plugin/README.md | Acceso a guías y alcance |

Evidencias locales ignoradas: .phase0/phase3b-before.json, phase3b-final.json y phase3b-versions.json. El manifiesto del artefacto identifica todas las fuentes actuales. Los archivos plugin/dist y AWNext_Phase9_SteamGridDB_Test.ps1, preexistentes, se conservan.

## APIs y colecciones

Solo firmas del SDK verificadas estáticamente; la nueva página podrá comprobar typeof cuando esté cargada. Ninguna presencia se afirma observada ahora dentro de Steam. Se identificaron candidatos collectionStore.NewUnsavedCollection, AsDragDropCollection().AddApps y Save en fuente original de otro plugin; sin contrato verificado para esta versión y sin eliminación de miembros verificada. Todo permanece en investigación y sin escrituras.

Los nombres de colección no acreditan propiedad; el diseño exige ID propio por cuenta, miembros gestionados, diferencias de conjuntos y preservación de miembros manuales. Save no prueba durabilidad: debe comprobarse lectura posterior y reinicio limpio. Un error de launcher nunca debe disparar eliminación. Ver SHORTCUT-MANAGER.md para fuentes y criterios.

## Carpeta e instalación

La entrega revisable está en artifacts/library-customizer, junto con guías y manifiesto. El cargador público de Millennium consultado enumera archivos .star directamente en plugins; los directorios corresponden al formato antiguo con otro manifiesto. Por eso no se cambia a ciegas la ubicación del .star instalado ni se fabrica un wrapper. Hace falta verificar por separado una alternativa de formato si se exige instalación íntegra en subcarpeta. No se ha modificado el script de instalación ni la instalación actual.

## Para habilitar 3B real

1. Aprobación del usuario para instalar, respaldar y migrar por copia sin sobrescribir legacy; desactivación guiada de la identidad anterior.
2. Ejecutar la matriz dentro de Steam y registrar versiones, consola, RPC y reinicio. Resolver fallos antes de continuar.
3. Aprobar aparte un acceso de prueba; verificar APIs reales, launcher oficial, lectura posterior e inventario completo.
4. Implementar writer solo después de esa evidencia, con registro transaccional real, ownership, recuperación ante fallos y revalidación antes de cada operación.
5. Ensayar ejecución, repetición, coexistencia de tiendas, cambios manuales y rollback/reinicio con el objeto desechable, nunca con accesos personales.

La autorización de instalar no habilita importaciones ni colecciones. No se avanza a Fase 4.
