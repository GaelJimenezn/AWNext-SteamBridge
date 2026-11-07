# Migración a Library Customizer

## Identidad

Nombre público: **Library Customizer**. ID Starlight/Millennium: **library-customizer**. Versión: **0.1.0**, preparación Alpha Fase 0.

La [referencia oficial de Millennium](https://docs.steambrew.app/plugins/structure/config) define id como string único y no exige reverse-DNS. El compilador local Starlight 1.1.7 acepta `library-customizer`; inspect confirma el ID en el paquete. La activación real con el nuevo ID queda pendiente, porque esta fase no instala el paquete.

La carpeta de distribución es `artifacts/library-customizer/`; contiene `library-customizer.star` y `build-manifest.json`. Starlight distribuye un archivo `.star` plano en `millennium/plugins/library-customizer.star`, no una carpeta legacy con plugin.json. El directorio fuente genérico `plugin/` y la ubicación física del checkout no se renombran: no son el ID del plugin. No se toca `millennium/plugins/aw-next`, que pertenece al plugin oficial de AWN.

La prueba local confirmó que Starlight 1.1.7 interpreta la salida como carpeta y añade `<id>.star`. Por eso el script pasa una carpeta absoluta. No reutiliza ni sobrescribe el binario preexistente `plugin/dist`.

## Compatibilidad

| Dato | Nombre nuevo | Lectura anterior |
|---|---|---|
| Configuración | millennium/plugins/library-customizer.config.json | org.awnext.steambridge.config.json |
| Datos propios | APPDATA/library-customizer | APPDATA/AWNext-SteamBridge |
| Credencial SGDB | library-customizer/secrets/steamgriddb.bin | AWNext-SteamBridge/secrets/steamgriddb.bin |
| Backups artwork | library-customizer/artwork-backups | Los anteriores se conservan y copian en la migración |

En ejecución, config_path prefiere el archivo nuevo si existe. Si está corrupto muestra el error: no mezcla ni sustituye silenciosamente datos. Sin archivo nuevo lee el anterior. No hay escritura/migración automática al cargar el plugin.

Las credenciales cifradas antiguas siguen siendo legibles para el mismo usuario Windows. La migración copia los bytes DPAPI sin descifrarlos. Cuando existe el directorio nuevo de secretos, este controla el ciclo de vida y evita recuperar una credencial antigua después de desconectar. Antes de migrar, Desconectar devuelve un error explicativo en vez de borrar el secreto heredado.

La migración copia el JSON completo sin reformatearlo y todo el árbol propio de datos: preferencias, campos desconocidos, respaldos y secretos. No transforma el formato del script experimental `steamgriddb.dpapi`; ese archivo se preserva como tal, pero nunca fue el formato leído por el backend Lua (`steamgriddb.bin`). No hay preferencias generales nuevas implementadas en esta fase.

## Procedimiento manual futuro

1. Ejecutar pruebas y build local.
2. Revisar `migrate-local.ps1 -SteamRoot '<Steam>'` sin Apply. Usar `-Apply` únicamente para copiar los datos después de revisar destinos.
3. Deshabilitar `org.awnext.steambridge` en Millennium. No borrarlo.
4. Revisar `install-local.ps1 -SteamRoot '<Steam>'`. El script rechaza la identidad antigua habilitada, estados de activación ilegibles, destinos distintos y otra instalación en carpeta.
5. Instalar con `-Apply`, habilitar únicamente `library-customizer` y validar la interfaz, mapping y credenciales.
6. Mantener la instalación anterior y sus datos hasta confirmar funcionamiento. Esta fase no incluye un borrado automático del legado.

Ningún script edita enabledPlugins. No hay opción Force para sobreescribir. La desinstalación exige deshabilitar el nuevo plugin, inspecciona su ID y solo retira library-customizer.star; conserva todos los datos y plugins externos.

Si un destino ya existe con bytes distintos, se aborta antes de copiar; la resolución del conflicto es manual. Una interrupción puede dejar una copia parcial nueva, pero nunca elimina los originales: volver a ejecutar completa los archivos idénticos/faltantes sin sobreescribir diferencias.

## Compilación aislada

La primera compilación debug de esta sesión provocó que Starlight añadiera el ID nuevo a enabledPlugins mediante HMR, incluso con salida local. Se revirtió solo esa entrada y se recuperó el SHA-256 original exacto. `--release`, auto_restart=false y reload=never por sí solos todavía producían un intento HMR.

La configuración final añade un socket de desarrollo aislado `library-customizer-offline-build.sock`; la compilación verificada ya no emite HMR. build-local.mjs exige esa configuración y usa release. Los hashes protegidos confirman el estado final intacto de configuración, paquetes, secretos y plugins externos.

## Reversión

Deshabilitar library-customizer y volver a habilitar org.awnext.steambridge. Como los originales nunca se borran ni sobreescriben, el antiguo plugin continúa leyendo sus archivos. La sincronización de cambios realizados posteriormente con el nuevo plugin hacia el antiguo no es automática.
