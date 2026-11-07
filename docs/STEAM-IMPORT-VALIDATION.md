# Fase 3A — previsualización y puertas de integración

Estado: código local; ninguna integración dentro de Steam aprobada todavía. No se instala, activa, desactiva ni desinstala ningún plugin. No hay métodos de escritura de accesos o colecciones en esta entrega.

## Evidencia local del 6 de noviembre de 2026

- Starlight compilador 1.1.7 acepta el ID `library-customizer`. Millennium documenta `id` como string único, sin exigir dominio inverso: https://docs.steambrew.app/plugins/structure/config . Esto verifica configuración/compilación, no carga real.
- Comprobación de instalación: antiguo activo, nuevo no instalado/no activo; `bothEnabled=false`. AWN oficial es `aw-next`, no el paquete legacy. No se modifica AWN ni GDL.
- Steam no estaba ejecutándose al comprobar procesos. Steam.exe FileVersion 11.15.70.27, ProductVersion 01.00.00.02; estos campos no sustituyen la versión de cliente/canal mostrada dentro de Steam. La versión runtime de Millennium debe registrarse allí; no se deduce del SDK ni del compilador.
- Lector local: MWIII `3531473258` → `3595270`; x360recomp 70 totales, 16 desbloqueados, 50 iconos. No valida paneles reales.

## Qué hace 3A

Library Manager → Discovery: refrescar proveedores explícitamente. Library Manager → Import Preview: consultar snapshot con inventario persistido, seleccionar una o varias instalaciones para revisión y descartar selección. No refresca automáticamente los launchers. Volver a consultar descarta el plan y la selección; editar identidad invalida la vista. Al salir no se guarda el plan. Sin nueva configuración ni almacenamiento paralelo.

Cada fila conserva proveedor/ID de juego, instalación, licencia y evidencia separados; proyecta candidatos/conflictos del motor Lua existente. Colección es una sugerencia, nunca un objeto de Steam. Xbox PC no implica Game Pass. Sin evidencia de derechos Game Pass no se sugiere esa colección. Compras y suscripciones desconocidas se muestran como tales.

Una referencia manual es una relación existente, no prueba de lanzamiento equivalente. Los demás candidatos son posibles coincidencias. La ausencia en shortcuts.vdf no demuestra ausencia en Steam: los juegos nativos y cambios aún en memoria no se incluyen. Por eso no hay estado «seguro para importar» ni riesgo «ninguno». La lectura fallida se expone expresamente. Instalaciones desconocidas/no instaladas, nombres sin resolver y observaciones obsoletas no pueden seleccionarse. Una selección instalada con método pendiente sirve solo para revisar.

## APIs comprobadas estáticamente para 3B

Fuente local: `plugin/.millennium/lsp/ts/sharedjscontext/globals/steam-client/App.d.ts`.
SHA256: 1fa3e852503bdd806c8f6ac99bc98c2149fbb4d64e9086fbd078664121efefce.

| Método declarado en SteamClient.Apps | Firma | Evidencia | Estado runtime |
|---|---|---|---|
| AddShortcut | (appName, executablePath, directory, launchOptions): Promise<number> | línea 16 | No llamado, pendiente |
| RemoveShortcut | (appId: number): void | línea 351 | No llamado, pendiente |
| SetShortcutExe | (appId, path): void | línea 468 | No llamado, pendiente |
| SetShortcutIcon | (appId, path): void | línea 474 | No llamado, pendiente |
| SetShortcutLaunchOptions | (appId, options): void | línea 486 | No llamado, pendiente |
| SetShortcutName | (appId, name): void | línea 492 | No llamado, pendiente |
| SetShortcutStartDir | (appId, directory): void | línea 498 | No llamado, pendiente |

Los argumentos sin tipo explícito en la tabla son string; appId es number. La documentación publicada del SDK también declara AddShortcut: https://jsr.io/@steamclienthomebrew/millennium/doc . No es una garantía de Valve ni prueba de esta versión del cliente. La API void no ofrece confirmación de persistencia. No se añade un adaptador de escritura que simule éxito.

Comprobación de presencia propuesta dentro de la consola del contexto principal, sin invocar métodos:

```js
(() => {
  const apps = globalThis.SteamClient?.Apps;
  return Object.fromEntries(['AddShortcut', 'RemoveShortcut', 'SetShortcutExe',
    'SetShortcutIcon', 'SetShortcutLaunchOptions', 'SetShortcutName',
    'SetShortcutStartDir'].map(name => [name, typeof apps?.[name]]));
})()
```

Si no está expuesto en ese contexto, registrar contexto/error; no asumir ausencia universal. La presencia tampoco habilita escrituras. Registrar versión/canal Steam, Millennium, hash del .star y resultados sin credenciales ni rutas privadas en el informe compartido.

No hay método de lanzamiento inventado. Un ejecutable Epic existente no garantiza inicio correcto sin su launcher. Ubisoft/GOG pueden carecer de método; Xbox AUMID detectado sigue sin prueba de activación. URIs conocidas en referencias externas son hipótesis de integración, nunca comandos habilitados por esta entrega.

## 3C: resultado de investigación

La búsqueda reproducible `rg -n 'collection|Collection' plugin/.millennium/lsp/ts/sharedjscontext/globals/steam-client` solo encontró el valor enumerado Collection en App.d.ts:802, sin creación/edición de colecciones normales. Esto no demuestra que Steam carezca de un mecanismo interno; significa que ninguno fue verificado aquí. No llamar métodos inferidos de collectionStore, ni editar almacenamiento privado.

Colecciones y sincronización continúan sin implementación. Antes de habilitarlas: verificar mecanismo runtime con colección temporal autorizada; registrar ID/propiedad; nunca apropiarse por nombre de una colección personal. Guardar proveedores habilitados, miembros gestionados y fingerprint por cuenta mediante config_store versionado, migración y escritura atómica existentes. No añadir otro sistema de persistencia.

La sincronización futura será incremental e idempotente; error/ausencia de launcher o fin de suscripción no disparará borrados. Proponer diferencias y confirmar lotes antes de ejecutar. Desactivar por proveedor debe detener sincronización, no borrar colecciones. Mantener origen Xbox separado de licencia Game Pass verificable.

## Matriz de pruebas dentro de Steam — TODAS PENDIENTES

Requieren intervención/autorización del usuario para instalar y activar el nuevo paquete. Seguir primero INSTALLATION-VALIDATION.md: respaldo verificado de configuración, migración por copia, desactivar solo legacy y conservarlo, instalación sin sobrescribir. No activar ambos IDs.

| Caso | Procedimiento y aceptación | Estado |
|---|---|---|
| Carga | Solo library-customizer activo entre nuevo/legacy; panel abre, sin errores Lua/React | Pendiente |
| Discovery | Abrir todos los grupos; helper empaquetado y estados/limitaciones legibles | Pendiente |
| RPC | Snapshot y refresco individual; fallo de un proveedor no oculta otros; no escritura externa | Pendiente |
| Games/Artwork/Settings | Abrir y navegar; referencias independientes, preferencias previas y artwork conservados | Pendiente |
| Identidad | MWIII 3531473258 → 3595270; nunca MWII 1959007243 por ejecutable | Pendiente |
| Persistencia Fase 1 | Con respaldo y autorización para asociación de prueba: guardar/restablecer; cerrar Steam limpiamente y reabrir; .bak y datos previos intactos | Pendiente |
| Discovery tras reinicio | Caché se reinicia vacía por diseño; nuevo refresco vuelve a detectar, no borra Steam ni preferencias | Pendiente |
| x360recomp | 2545026989 → 4D5309C9, 50 iconos y 16/70 si no hay nuevo progreso; panel propio ports | Pendiente |
| Coexistencia | AWN oficial/GDL activos sin duplicación de paneles, errores o modificación de paquetes | Pendiente |
| Preview | Selección individual/lote, descartado y nueva consulta; método no verificado visible; ningún acceso/colección creado | Pendiente |
| Reinicio con preview | Selección desaparece; Steam conserva sus accesos y colecciones originales | Pendiente |

## Pruebas futuras de escritura — bloqueadas hasta aprobación

Después de aprobar 3A y completar lo anterior, proponer una prueba desechable con respaldo y confirmación explícita. No ejecutar ahora. Debe incluir AddShortcut/lectura AppID, ejecución real por launcher, cierre limpio/reinicio/lectura, actualización preservando cambios manuales y eliminación exclusivamente del objeto propio. Repetición del mismo plan no crea duplicados; varias tiendas del mismo título conservan instalaciones/licencias distintas.

El registro de creación futuro debe usar config_store y vincular cuenta, ID estable de proveedor, instalación, AppID y fingerprint exacto de campos creados. Si el usuario cambia campos, no sobrescribirlos ni eliminarlos en rollback; ofrecer conflicto. Si falla persistir el registro después de crear, conservar diagnóstico recuperable y no borrar objetos de propiedad incierta. No eliminar accesos sin registro por simple coincidencia de nombre/ejecutable. Simular fallo parcial, lectura obsoleta, cambio de cuenta, rollback y colección personal en fixtures antes de cualquier lote. La comprobación de reinicio real no se sustituye por fixtures.

No editar shortcuts.vdf durante ejecución ni implementar fallback de escritura directa. Ningún test local de esta fase es una prueba de creación, ejecución, borrado o rollback real en Steam.

## Preparación 3B e integración guiada

La entrega posterior incorpora simulación transitoria, registro probado solo en temporales y una página Integration de lectura. Ver [guía paso a paso](INTEGRATION-RUNBOOK.md) y [arquitectura y candidatos de colecciones](SHORTCUT-MANAGER.md). Los resultados runtime continúan pendientes. No aplicar instalación ni modificar activación sin aprobación.
