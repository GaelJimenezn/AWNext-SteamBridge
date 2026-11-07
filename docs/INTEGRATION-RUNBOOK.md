# Validación guiada de Library Customizer Alpha 0.1.0

Estado inicial observado: Steam cerrado, legacy activo, nuevo paquete no instalado ni activo. Ningún caso de integración está aprobado. Esta guía no ejecuta cambios. La primera instalación/activación requiere autorización del usuario. Leer también INSTALLATION-VALIDATION.md y STEAM-IMPORT-VALIDATION.md.

## 1. Preparación revisable, antes de autorizar instalación

La entrega está en `artifacts/library-customizer/`: .star, build-manifest.json, README-INSTALLATION.md y guías. Verificar desde el repositorio:

```powershell
node scripts/verify-build.mjs
& ./scripts/check-installation.ps1 -SteamRoot 'A:/launchers/Steam'
& ./scripts/backup-activation.ps1 -SteamRoot 'A:/launchers/Steam'
& ./scripts/migrate-local.ps1 -SteamRoot 'A:/launchers/Steam'
```

Los tres scripts PowerShell están en modo previsión por defecto. No usar -Apply sin aprobación. Registrar hash del paquete, versión y canal Steam, versión Millennium, fecha y contexto de consola. No publicar tokens, credenciales, rutas privadas ni contenido de configuración.

## 2. Instalación tras aprobación, conservando la anterior

1. Crear y verificar respaldo de configuración de activación con backup-activation -Apply. Si hay conflicto, elegir otro BackupName: nunca sobrescribirlo.
2. Migración por copia mediante migrate-local -Apply, después de revisar su previsión. Conserva originales, iconMap, preferencias y credenciales cifradas. Detenerse ante destinos distintos.
3. Abrir Steam manualmente y deshabilitar únicamente org.awnext.steambridge desde Millennium. No eliminar su paquete. No deshabilitar aw-next oficial ni GDL.
4. Cerrar Steam limpiamente; comprobar que no quedan steam/steamwebhelper. Ejecutar check-installation: bothEnabled debe ser false y legacyEnabled false antes de instalar.
5. Revisar install-local sin -Apply. Tras autorización, copiar con -Apply. El script verifica ID/hash y no sobrescribe paquetes distintos ni activa el plugin.
6. Abrir Steam y habilitar solo library-customizer entre las dos identidades. Si se informa coexistencia o cuenta ambigua, detener validación, no guardar.

El formato .star es un archivo: el cargador publicado itera la raíz de plugins y solo trata directorios con manifiesto antiguo por otra ruta. Fuente: https://github.com/SteamClientHomebrew/Millennium/blob/d6a7822a43744b6290a0e059bdd032d9b9a2ec94/src/engine/plugin_manager.cc#L192 . Poner .star dentro de library-customizer/ no es una instalación soportada por esa lógica. No se transforma automáticamente a formato antiguo ni se crean enlaces. La carpeta de entrega sí está organizada; un formato de instalación por carpeta exigiría trabajo y validación adicionales. No se afirma que ese código fuente pruebe la versión binaria instalada.

## 3. Sesión de lectura dentro de Steam

| Caso | Acción guiada | Resultado exigido | Resultado observado |
|---|---|---|---|
| ID/carga | Abrir Library Manager y página Integration | Una sola entrada, legacy desactivado, nuevo ID activo | Pendiente |
| RPC/contexto | Pulsar Comprobar contexto y RPC en Integration | Ping ok, instalación coherente, snapshot ok; presencia de APIs registrada sin invocarlas | Pendiente |
| Games | Abrir Games y revisar cuenta/asociaciones | Datos actuales, fuentes independientes, sin errores React/Lua | Pendiente |
| MWIII | Revisar 3531473258 y evidencia MWII | AWN 3595270, 1959007243 no asociado automáticamente por ejecutable | Pendiente |
| Discovery | Refrescar Ubisoft, Xbox, Game Pass, Epic, GOG de uno en uno | Cada RPC retorna; errores/limitaciones propios, otros grupos siguen visibles | Pendiente |
| Artwork | Abrir y revisar artwork existente | Imágenes previas intactas; no pulsar Apply para esta prueba | Pendiente |
| Settings | Abrir sin cambiar valores | Preferencias visibles, sin sobrescrituras | Pendiente |
| x360recomp | Abrir port 2545026989 | 4D5309C9, 50 iconos, 16/70 salvo nuevo progreso legítimo | Pendiente |
| Preview | Seleccionar uno/varios instalados, simular, descartar, actualizar | Sin accesos nuevos ni cambios de colecciones; métodos no verificados visibles | Pendiente |
| Ventana | Abrir/cerrar 3 veces; navegar Games/Discovery/Preview/Settings y páginas de juegos | Una ventana/panel por acción, sin listeners/observadores duplicados visibles | Pendiente |
| AWN/GDL | Mantenerlos activos y revisar paneles | Convivencia sin errores ni duplicación de logros; ports propios conservados | Pendiente |
| Consola | Revisar consola de Steam/Millennium en contexto principal y ventana | Registrar errores, contexto, pasos de reproducción; no marcar APIs como funcionales por typeof | Pendiente |

Si faltan métodos RPC en el paquete, no solucionar activando ambas identidades. Anotar hash/versión y detenerse. Ante excepción, conservar evidencia y volver a legacy desactivando primero el nuevo; no borrar configuraciones nuevas ni antiguas.

## 4. Reinicio y persistencia

Cerrar Steam limpiamente y reiniciar manualmente. Repetir carga, navegación, cuenta, mapping, logros y artwork. Las asociaciones/preferencias existentes deben permanecer. Caché Discovery y selección/simulación se vacían por diseño: refrescar proveedores reconstruye observaciones y no debe borrar nada de Steam.

Para probar una NUEVA asociación persistente se necesita respaldo y autorización expresa para ese cambio: elegir un acceso de prueba, guardar con respaldo, salir limpiamente, reiniciar, comprobar referencia y restaurar desde el editor. No usar el mapping protegido como objeto experimental. Esta entrega no ejecuta ese cambio.

Registrar cada caso como pendiente/aprobado/fallido con fecha y evidencia. Una prueba local de recarga de módulo Lua no equivale a reinicio Steam. El informe Integration solo indica presencia de funciones y conectividad; nunca promueve permisos de escritura.

## 5. Puerta de 3B real

Completar matriz, revisar simulación, verificar inventario Steam nativo y accesos en memoria, launcher y permisos de cuenta. Aprobar por separado un acceso desechable y un ensayo de creación/lectura/ejecución/reinicio/reversión. Solo entonces implementar un adaptador real y registro con propiedad verificable. La aprobación de instalar el plugin no autoriza importar juegos ni modificar colecciones. Sin ejecución satisfactoria no hay APIs confirmadas funcionalmente.
