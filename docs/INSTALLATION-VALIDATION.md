# Validación de instalación — intervención en Steam

Estado comprobado al preparar Fase 1: org.awnext.steambridge está habilitado; library-customizer no está instalado ni habilitado. No hay dos identidades activas. AWN oficial (aw-next) es otro producto y permanece intacto.

El manifiesto local usa library-customizer; Starlight acepta ese ID y inspect lo confirma. La compatibilidad de carga con Millennium y la interfaz todavía necesitan la prueba manual descrita abajo. El instalador rechaza una identidad antigua habilitada; además, la nueva entrada frontend no instala hooks de navegación y las escrituras RPC se bloquean si detectan el legacy activo o un estado de activación ilegible.

## Preparación sin cambios personales

Desde la raíz del checkout:

```powershell
node plugin/node_modules/typescript/bin/tsc --noEmit -p plugin/frontend/tsconfig.json
python tests/test_identity.py
node scripts/build-local.mjs
node --test tests/phase0.test.mjs tests/identity-client.test.mjs
node scripts/verify-build.mjs
& ./scripts/check-installation.ps1 -SteamRoot '<Steam>'
& ./scripts/backup-activation.ps1 -SteamRoot '<Steam>'
& ./scripts/migrate-local.ps1 -SteamRoot '<Steam>'
```

Los tres scripts finales son comprobación/previsión. Esta fase solo los aplicó sobre instalaciones ficticias de pruebas. No se ejecutó instalación ni migración de datos personales.

## Acciones que requieren al usuario

1. **Respaldar antes de cambiar activación:** revisar backup-activation y ejecutarlo con -Apply. Copia config.json sin modificarlo ni sobrescribir un respaldo diferente. Si el nombre ya existe con otros bytes, elegir otro nombre mediante -BackupName.
2. **Migrar por copia:** revisar migrate-local y ejecutarlo con -Apply si corresponde. Conserva originales, preferencias, respaldos y bytes cifrados SGDB. Un conflicto de destino se resuelve manualmente, sin Force.
3. **Dentro de Steam:** deshabilitar org.awnext.steambridge; conservar su paquete y datos. No deshabilitar aw-next por confundir los nombres.
4. Ejecutar check-installation de nuevo y la previsión install-local. Solo después instalar con -Apply y habilitar library-customizer en Millennium. Ningún script cambia enabledPlugins.
5. Verificar que se carga el nuevo ID y que Games muestra la cuenta correcta. Si solo aparece autologin-readonly o un error de cuenta, no guardar; abrir Steam con la cuenta esperada y actualizar.
6. Abrir MWIII 3531473258 en Games: debe resolver a 3595270 / GBE Fork. MWII 1959007243 no debe ser selección automática. Revisar evidencia; un panel del plugin oficial AWN no prueba la identidad calculada por Library Customizer.
7. Comprobar el lector propio de Pinyon: asociación 2545026989 → 4D5309C9, 50 iconos y 16/70 mientras el progreso no haya cambiado. Cambiar asociaciones no debe escribir en los archivos de logros.
8. Guardar una asociación de prueba desde Games. Debe crearse .bak y schemaVersion 1, conservar games/iconMap y sobrevivir a cerrar/reabrir el administrador y reiniciar Steam. Restablecer debe recuperar la asociación heredada.
9. Verificar que Steam catálogo, AWN y SteamGridDB conservan referencias independientes. Artwork no debe elegir el primer resultado ambiguo. Si una referencia no está disponible, debe explicarse sin cambiarla automáticamente.
10. Comprobar el refresco inmediato tras editar y la delegación de paneles generales con AWN oficial activo. Conservar el lector propio de ports y revisar convivencia visual; no retirar el paquete antiguo hasta terminar.

No se necesita manipular ni corromper datos personales para probar fallos: backup/escritura fallida, recuperación, concurrencia y JSON dañado ya se prueban en temporales.

## Reversión

Deshabilitar library-customizer y volver a habilitar org.awnext.steambridge. Los archivos legacy no se han sobreescrito. Las nuevas asociaciones por cuenta quedan en el archivo nuevo; no se sincronizan hacia el legacy automáticamente. El desinstalador nuevo retira solo su .star y conserva configuración, backups y otros plugins.

## Fase 3A: Import Preview

Previsualización local de instalaciones, identidad, posibles duplicados y colecciones sugeridas. Selección temporal individual o por lote, sin escrituras ni ejecución de juegos. [Validación Steam y APIs de 3B/3C](STEAM-IMPORT-VALIDATION.md). Integración runtime pendiente; no instalar ni activar automáticamente.

## Preparación 3B e integración guiada

La entrega posterior incorpora simulación transitoria, registro probado solo en temporales y una página Integration de lectura. Ver [guía paso a paso](INTEGRATION-RUNBOOK.md) y [arquitectura y candidatos de colecciones](SHORTCUT-MANAGER.md). Los resultados runtime continúan pendientes. No aplicar instalación ni modificar activación sin aprobación.
