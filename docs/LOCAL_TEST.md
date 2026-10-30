# Prueba local en Windows (30 de octubre de 2026)

## Lo que se comprobó sin instalar

- El registro de Steam apunta a `A:\launchers\Steam`; existen `steam.exe` y `A:\launchers\Steam\millennium\plugins`. Los binarios instalados de Millennium indican versión 3.6.2.
- `A:\launchers\Steam\millennium\plugins` contiene `game-data-linker-1.02`. No contiene todavía nuestro paquete. `A:\launchers\Steam\millennium\config\config.json` incluye `org.awnext.steambridge` en `enabledPlugins`, pero eso no prueba que el plugin esté cargado: el paquete aún no está allí.
- `plugin/millennium.toml` dirige Starlight a `plugin/dist`, un **archivo**, no un directorio. `starlight inspect dist` confirma un paquete v2.0 con metadata `org.awnext.steambridge`, dos fuentes Lua, bundle frontend, bundle webview y dos recursos (incluido el aviso MIT de GDL). Para esta instalación se requieren `org.awnext.steambridge.star` **y** `org.awnext.steambridge.config.json`; el segundo es un archivo externo para rutas y asociaciones locales, no está dentro del paquete.
- El acceso directo “Forza horizon 1” tiene AppID `2545026989` en `A:\launchers\Steam\userdata\1043119986\config\shortcuts.vdf`. Lanza el script de Pinyon Shift `C:\Users\carlo\AppData\Local\PinyonShift\source\0.1.1\tools\launch-preview.ps1`.
- El estado activo está en `C:\Users\carlo\AppData\Local\PinyonShift\source\0.1.1\.local\preview\user\achievements\4D5309C9.toml`; el catálogo AWN está en `C:\Users\carlo\AppData\Roaming\Achievement Watcher Next\steam_cache\x360recomp\4D5309C9.json`. `bun scripts/verify-local.mjs` leyó 70 logros, 16 desbloqueados, 70 descripciones y 50 iconos válidos mediante el mapa SPA. Es una verificación de archivos reales con el parser de referencia AWN; aún falta ejecutar el RPC Lua dentro de Millennium.
- La configuración local concreta está en `plugin/bridge-config.json` (ignorada por Git). El backend la buscará tras instalar en `A:\launchers\Steam\millennium\plugins\org.awnext.steambridge.config.json`. No lee tokens ni escribe en archivos AWN, Steamworks o perfiles oficiales.
- No había procesos `steam` o `steamwebhelper` en la inspección. No se inició ni cerró Steam.

## Comandos exactos

Desde `D:\Projects\AWNext-SteamBridge`:

```powershell
# Comprobación local, sin escribir fuera del workspace
bun .\scripts\verify-local.mjs
& .\scripts\install-local.ps1 -SteamRoot 'A:\launchers\Steam'

# Instalación: ejecutar sólo después de revisar la vista previa y autorizarla
& .\scripts\install-local.ps1 -SteamRoot 'A:\launchers\Steam' -Apply

# Vista previa de retirada y retirada del paquete propio
& .\scripts\uninstall-local.ps1 -SteamRoot 'A:\launchers\Steam'
& .\scripts\uninstall-local.ps1 -SteamRoot 'A:\launchers\Steam' -Apply
```

El instalador rechaza un `.star` ya existente y conserva una configuración lateral existente sin sobrescribirla. El desinstalador comprueba la identidad del paquete con Starlight y elimina únicamente `org.awnext.steambridge.star`; conserva la configuración y todos los demás plugins. Ambos scripts son de vista previa salvo `-Apply`. No reinician Steam.

Los dos scripts contienen sólo caracteres ASCII para que Windows PowerShell 5.1 y PowerShell 7 interpreten igual el archivo. Si la política local de Windows PowerShell impide ejecutar archivos `.ps1`, inicia la vista previa con `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-local.ps1 -SteamRoot 'A:\launchers\Steam'`. Esa opción afecta únicamente a ese proceso de PowerShell y no equivale a `-Apply`.

## Habilitar y diagnosticar

Después de instalar, abre Steam y en su menú Millennium entra a Plugins. Comprueba que **AWNext Steam Bridge** está habilitado; la lista de `enabledPlugins` ya contiene su ID, pero la interfaz debe confirmarlo. Abre “Forza horizon 1” desde la biblioteca, sin cambiar su acceso directo. Con GDL activo, AWN debe verse dentro de la sección de logros de GDL, marcado “Achievement Watcher Next · local”; sin GDL usa una sección propia. Debe mostrar `16/70` y una fila como “Welcome to Horizon” con la descripción “You arrived at Horizon Festival raring to go.” Las cifras pueden cambiar si juegas después de esta comprobación.

En la consola de Steam, filtra `[AWNext Bridge]`: `[HOOK] checking current window` confirma que el panel se enlazó a la ventana principal aunque el hook de Millennium no entregue la ventana existente; `[MAPPING]` indica AppID y configuración, `[BACKEND]` una excepción RPC, `[DATA]` un archivo faltante, y `[UI]` si el panel se colocó en GDL o en la sección nativa. El backend registra `Read N/M achievements for shortcut 2545026989`. `[PRESENT] notes found true` confirma que se encontró la región localizada (por ejemplo `Notas` con Steam en español). Si aparece `[UI] Native NOTES or GDL achievements region not found`, guarda el nombre de ventana y la estructura DOM para ajustar el anclaje; la compilación no garantiza compatibilidad visual con esta versión de Steam.

La prueba dentro de Steam queda pendiente hasta instalar el paquete con autorización. No se ha afirmado funcionamiento dentro de Steam.
