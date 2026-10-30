# AWNext Steam Bridge (MVP)

Panel local de logros de AWN para accesos directos externos. El primer adaptador lee los archivos TOML de recompilaciones Xbox 360, incluida Forza Horizon mediante Pinyon Shift.

## Prerequisites

- **[Millennium](https://github.com/SteamClientHomebrew/Millennium)** >= v3.4.0
- **[Bun](https://bun.com/)** >= v1.0.0

## Compilación

```bash
$ bun install
$ bun run build
```

El resultado es el archivo `dist` de Starlight: `starlight inspect dist` confirma que es un paquete `.star` con backend, frontend, webview y recursos. La instalación local lo copia como `org.awnext.steambridge.star`; `dist` por sí solo no incluye la configuración de rutas del equipo.

## Prueba en Steam

1. Consulta `docs/LOCAL_TEST.md` para las comprobaciones y comandos exactos. El script `scripts/install-local.ps1` muestra una vista previa y sólo copia archivos al usar `-Apply`.
2. `plugin/bridge-config.json` es la configuración local ignorada por Git. El instalador la copia como `org.awnext.steambridge.config.json` al directorio de plugins. Contiene el AppID del acceso directo, `awnDataRoot`, `stateRoot`, perfil y un mapa opcional `iconMap` del ID de logro al ID de imagen SPA.
3. Abre el acceso directo de Forza Horizon. AWN debe haber creado `steam_cache/x360recomp/4D5309C9.json` y el directorio `icon_cache/x360recomp/4D5309C9/`.
4. Revisa la consola del frontend: `[MAPPING]` identifica el acceso directo, `[BACKEND]` indica un fallo RPC, `[DATA]` indica archivos AWN ausentes y `[UI]` indica el punto de inserción. El backend registra `Read N/M achievements`.

Si GDL está instalado, los logros locales de AWN aparecen dentro de su sección de logros con una etiqueta de origen propia; no se crea una segunda sección. Sin GDL, se crea una sección que sigue la estructura de NOTES. El lector sólo abre archivos locales en modo lectura, sin acceder a tokens de Steam o Xbox. La técnica visual adaptada de GDL conserva su licencia MIT en `resources/GDL-LICENSE.txt`. Hace falta probar el anclaje y la carga en una sesión real de Steam y Millennium.
