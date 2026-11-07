# Library Customizer

Repositorio: https://github.com/GaelJimenezn/Library-Customizer

Carpeta de desarrollo: `D:\Projects\Library-Customizer`. Código en `plugin/` y documentación en `docs/`. El paquete instalado es `<Steam>/millennium/plugins/library-customizer.star`; no requiere una carpeta propia en plugins. `aw-next` corresponde al plugin oficial de Achievement Watcher Next.


Alpha 0.1.0 en preparación. Administrador de biblioteca Steam, artwork e integración de datos locales AWN, con soporte propio de x360recomp.

La Fase 1 incorpora identidad compartida y asociaciones persistentes. La Fase 2 añade descubrimiento local modular con cobertura limitada por launcher; no crea accesos ni colecciones.

- [Compilar y verificar](plugin/README.md)
- [Inventario de funcionalidades](docs/PHASE0-INVENTORY.md)
- [Migración compatible de nombre](docs/NAME-MIGRATION.md)
- [Resultados de Fase 0](docs/PHASE0-RESULTS.md)
- [Identidad y persistencia: Fase 1](docs/PHASE1-IDENTITY.md)
- [Validación de instalación en Steam](docs/INSTALLATION-VALIDATION.md)

## Acknowledgements & Credits

Library Customizer would not be possible without the work of the developers and contributors behind these open-source projects.

Special thanks to:

- **[Achievement Watcher Next](https://github.com/Shirowwww/Achievement-Watcher-Next)** — For its incredible work on cross-platform achievement detection, tracking, metadata, and support for various game sources. Library Customizer builds upon the ecosystem and achievement data made available by this project.

- **[Millennium](https://github.com/SteamClientHomebrew/Millennium)** — For providing the plugin framework that makes extending the Steam desktop client possible.

- **[Game Data Linker](https://github.com/retrotoolsdev-wq/game-data-linker)** — For its work on enhancing non-Steam library pages and demonstrating techniques for integrating game information and achievement panels into Steam. Some UI techniques were adapted with attribution under its MIT license.

- **[Millennium PluginTemplate](https://github.com/SteamClientHomebrew/PluginTemplate)** — For providing the foundation and development structure used to build this plugin.

Thank you to all the maintainers and contributors who dedicate their time to keeping these projects available to the community.

### Independence and attribution

Library Customizer is an independent community project and is not officially affiliated with Valve, Millennium, Achievement Watcher Next, or Game Data Linker.

All original projects, trademarks, and associated materials remain the property of their respective owners. Any reused code remains subject to its applicable license and copyright notices.

Special thanks to the open-source community for making projects like this possible. ❤️

- [Descubrimiento universal y limitaciones](docs/UNIVERSAL-DISCOVERY.md)
- [Roadmap actualizado](docs/ROADMAP.md)
- [Resultados Fase 2](docs/PHASE2-RESULTS.md)

## Fase 3A: Import Preview

Previsualización local de instalaciones, identidad, posibles duplicados y colecciones sugeridas. Selección temporal individual o por lote, sin escrituras ni ejecución de juegos. [Validación Steam y APIs de 3B/3C](docs/STEAM-IMPORT-VALIDATION.md). Integración runtime pendiente; no instalar ni activar automáticamente.

## Integración y 3B simulada

[Validación guiada](docs/INTEGRATION-RUNBOOK.md) y [Steam Shortcut Manager](docs/SHORTCUT-MANAGER.md). En Import Preview puedes simular propuestas sin guardar ni importar. Integration comprueba RPC/presencia de APIs sin ejecutarlas. La entrega se organiza en artifacts/library-customizer; ninguna instalación automática.
