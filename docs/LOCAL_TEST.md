# Library Customizer — verificación local

La Fase 0 no instala ni activa el nuevo plugin. La compatibilidad de interfaz dentro de Steam queda pendiente de validación manual posterior.

## Estado inicial protegido

HEAD: 6c29a7811b5d58625f694a031a2bf57739f4deeb.

Cambios anteriores al trabajo: `plugin/dist` modificado y `AWNext_Phase9_SteamGridDB_Test.ps1` sin seguimiento. Ambos se conservan sin cambios. La captura `.phase0/baseline.json` se realizó tras crear el capturador y descargar la dependencia de prueba; esas entradas adicionales son trabajo nuevo, no cambios preexistentes.

La configuración privada y la instalada tenían el mismo SHA-256 y la asociación 2545026989 → 4D5309C9, perfil user y 50 iconos. Los paquetes antiguo local e instalado tenían igual inventario pero distinto hash; eso no demuestra por sí solo diferencias funcionales.

## Capturas reproducibles

```powershell
node scripts/phase0-snapshot.mjs .phase0/before.json
# Trabajar y verificar sin aplicar migraciones ni instalar.
node scripts/phase0-snapshot.mjs .phase0/after.json .phase0/before.json
```

Definir LC_STEAM_ROOT si Steam está en otra ubicación. El capturador guarda hashes, no contenidos de secretos; la carpeta .phase0 está ignorada. La comparación protege configuración, paquete antiguo, plugins externos y los árboles de datos propios antiguo/nuevo. No reescribir before después de comenzar el trabajo.

```powershell
node scripts/source-inventory.mjs > .phase0/inventory.json
node scripts/build-local.mjs
node scripts/verify-build.mjs > .phase0/versions.json
# También puede indicarse la ruta explícita de cualquier .star instalado:
node scripts/verify-build.mjs '<Steam>/millennium/plugins/org.awnext.steambridge.star'
```

verify-build exige que las fuentes actuales y el paquete coincidan con el manifiesto. Identifica el instalado mediante hash e inspect. No afirma que el legacy coincida con las nuevas fuentes ni que una compilación pruebe funcionamiento en Steam.

## Regresión disponible

La suite Lua cubre parser, precedencia de configuración, campos desconocidos, mapping e iconos completos, rutas compatibles y DPAPI real con credenciales de prueba. La suite Node ejecuta PowerShell 5.1 sobre instalaciones ficticias, valida migración idempotente, conflictos y conservación de otros archivos.

El verificador opcional de datos personales sigue leyendo 70 logros, 16 desbloqueados y 50 iconos en esta sesión. Es un caso real de lectura; no ejecuta RPC en Millennium. No deben fijarse esos 16 desbloqueos como requisito permanente, porque jugar puede cambiarlos.

## Pendiente en Steam

Con el legacy deshabilitado y después de instalar conscientemente: abrir administrador, comprobar mapping, imágenes y credencial SGDB; navegar rápidamente entre juegos y probar AWN/GDL activos/inactivos. No borrar el paquete antiguo hasta verificar esas capacidades.
