# Fase 1 — resultados y archivos

Library Customizer Alpha 0.1.0: Game Identity & Persistence implementado y verificado localmente. No se ha iniciado Fase 2 ni se ha instalado el paquete sobre Steam.

## Resultado

- Un solo motor Lua para frontend/backend, consumido mediante RPC.
- Referencias independientes por proveedor y scope de cuenta/shortcut.
- Candidatos, ambigüedades, conflictos y explicación de evidencia.
- Editor en Games para referencias, edición/origen y mapping de port.
- Persistencia versión 1, migración al guardar, respaldo previo, reemplazo sin borrar destino y recuperación explícita.
- Invalidación de cachés y descarte de respuestas frontend anteriores al cambio.
- MWIII 3531473258 selecciona 3595270 y no 1959007243 por ejecutable compartido.
- El lector propio conserva 16/70 y las 50 entradas de iconMap en la comprobación real en lectura.

## Archivos modificados respecto a la Fase 0

| Archivo | Cambio |
|---|---|
| README.md | Estado y enlaces de Fase 1 |
| docs/ARCHITECTURE.md | Arquitectura efectiva y consumidores |
| plugin/README.md | Comandos y contrato de identidad |
| plugin/backend/adapters/awn_snapshot.lua | Transformar únicamente el juego ya resuelto; retirar matching duplicado |
| plugin/backend/adapters/x360recomp.lua | Admitir mapping/configuración scoped conservando lector existente |
| plugin/backend/rpc_functions.lua | Cinco RPC de identidad/instalación con entrada validada |
| plugin/backend/services/achievement_resolver.lua | Consumir identidad compartida y preservar prioridad de ports |
| plugin/backend/services/awn_discovery.lua | Usar repositorio AWN compartido |
| plugin/backend/services/provider_status.lua | Misma raíz y snapshot que identidad/discovery |
| plugin/frontend/core/steam-navigation.ts | No elegir el primer shortcut homónimo |
| plugin/frontend/index.tsx | Guard de instalación y refresco por generación |
| plugin/frontend/manager/services/source-checks.ts | Matching por RPC y timeout de consulta |
| plugin/frontend/manager/tabs/ArtworkTab.tsx | Resolver compartido, sin primer resultado automático, invalidación |
| plugin/frontend/manager/tabs/GamesTab.tsx | Diagnóstico, candidatos y editor de asociaciones |
| plugin/library-customizer.config.example.json | Esquema versión 1 sin datos personales |
| plugin/package.json | Suite ampliada de regresión |
| scripts/build-local.mjs | Identificación alpha-phase1 |
| tests/test_backend.py | Servicios de prueba aislados y representación JSON null |

## Archivos nuevos

| Archivo | Función |
|---|---|
| backend/services/game_identity.lua | Política pura de identidad, normalización y conflictos |
| backend/services/identity_service.lua | Orquestación, namespaces, validación y edición |
| backend/services/config_store.lua | Versión, migración, concurrencia, backup y recuperación |
| backend/services/awn_repository.lua | Lectura común del snapshot |
| backend/services/steam_shortcuts.lua | Cuenta y metadatos de accesos en lectura |
| backend/services/installation_status.lua | Protección contra identidades activas simultáneas |
| backend/utils/atomic_file.lua | Lectura limitada y reemplazo Unicode con flush |
| backend/utils/json_document.lua | Preservar tipos y valores JSON previos |
| frontend/core/identity-service.ts | Contratos, RPC e invalidación para React |
| frontend/manager/components/IdentityEditor.tsx | Formulario de edición desde Games |
| scripts/backup-activation.ps1 | Copia verificada antes de cambios manuales de activación |
| scripts/check-installation.ps1 | Diagnóstico de instalación en lectura |
| scripts/verify-identity-local.py | Caso real MWIII y x360recomp sin escrituras |
| tests/fixtures/mwiii-identity.json | Caso conflictivo obligatorio sin rutas personales |
| tests/test_identity.py | Regresión de motor y persistencia en LuaJIT real |
| tests/identity-client.test.mjs | Transporte, invalidación, editor y preparación de instalación |
| docs/PHASE1-IDENTITY.md | Contrato y límites de implementación |
| docs/INSTALLATION-VALIDATION.md | Acciones que requieren al usuario dentro de Steam |
| docs/PHASE1-RESULTS.md | Este informe |

Las rutas backend/ y frontend/ de esta tabla están bajo plugin/.

Se elimina `plugin/frontend/manager/models/awn-game.ts`: sus consumidores se sustituyeron por los contratos de identity-service. No quedan imports de ese modelo. También se retiran las normalizaciones y resoluciones locales sustituidas en GamesTab, source-checks y awn_snapshot; no se conserva un segundo matching desactivado.

## Pruebas y evidencia

- TypeScript noEmit: sin errores.
- **23 pruebas Python/LuaJIT 2.1**: incluye las seis regresiones de Fase 0, parser/DPAPI reales, MWIII, IDs signed/unsigned, namespaces, ambigüedad, override manual, scopes de cuenta, migración con 50 iconos, preferencias y JSON desconocido, Unicode, bloqueo, tokens antiguos, fallos de backup/escritura, recuperación y esquema futuro.
- **12 pruebas Node/PowerShell**: siete de Fase 0 y cinco de cliente/editor/validación. El editor se ejercita con estado/transportes simulados; no equivale a una prueba visual dentro de Steam. Los scripts con Apply se ejecutan únicamente sobre directorios temporales.
- **Caso real en lectura**: MWIII 3531473258 → AWN 3595270; Pinyon 2545026989 → 4D5309C9, 16 desbloqueados de 70 y 50 iconos mapeados. El perfil disponible se infiere como autologin-readonly en esta sesión; no se permite editarlo sin confirmación de cuenta activa.
- Compilación Starlight release local, socket aislado, ID library-customizer; manifest vincula fuentes, commit y hash del .star. verify-build identifica el instalado legacy por separado.
- Comparación de los 28 archivos protegidos y de plugin/dist contra `.phase0/phase1-before.json`: sin cambios. No se modifican AWN oficial, GDL, configuraciones personales, credenciales ni paquetes instalados.
- git diff --check: sin errores de contenido. Puede haber avisos de conversión LF/CRLF.

El antiguo método de artwork, sus respaldos, el observer y el lector de ports permanecen. Con AWN oficial habilitado no se añade otro panel general de snapshot; esta fase no modifica el matching del plugin oficial.

## Estado Git y procedencia

HEAD permanece en 6c29a7811b5d58625f694a031a2bf57739f4deeb, rama feature/native-artwork-integration. Sin commit ni staging nuevos. La Fase 0 ya estaba sin commit al iniciar esta fase; no se presenta todo el diff contra HEAD como trabajo nuevo de Fase 1.

La comparación de archivos de esta fase usa el inventario del manifiesto de Fase 0, conservado en `.phase0/phase0-build-manifest.json`. `plugin/dist` modificado y `AWNext_Phase9_SteamGridDB_Test.ps1` sin seguimiento son preexistentes a ambas fases y permanecen intactos. El artefacto nuevo está bajo artifacts/library-customizer, ignorado por Git.

## Validación pendiente del usuario

Solo el legacy está habilitado; no hay coexistencia activa. Se debe respaldar config.json, deshabilitar el legacy sin borrarlo, revisar migración e instalación, activar únicamente library-customizer y verificar carga, cuenta, editor, persistencia tras reinicio, MWIII y 16/70 dentro de Steam. Ver INSTALLATION-VALIDATION.md.

No se ha simulado un corte eléctrico ni se afirma compatibilidad visual probada. La convivencia avanzada por juego, cambios de layout y rediseño de artwork quedan fuera; no se avanza automáticamente a la siguiente fase.
