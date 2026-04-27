# Portal de Gerencia - Frutos Tropicales Peru Export S.A.C.

## Descripcion
Portal web unificado para la gestion integral de operaciones de Frutos Tropicales Peru Export S.A.C. Integra modulos de produccion, calidad, almacen y recursos humanos con control de acceso basado en roles.

## Stack Tecnico
- **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES Modules)
- **Backend:** Supabase (PostgreSQL + Realtime)
- **Charts:** Chart.js v4.4.0 + plugin datalabels
- **PWA:** Service Worker para offline
- **Sin build tool:** Imports nativos del browser, CDN para librerias

## Estructura
```
proyecto/
├── index.html          # Web corporativa (publica)
├── login.html          # Login unificado
├── portal.html         # Shell del portal
├── assets/css/         # Estilos modularizados
├── assets/js/config/   # Supabase, users, constantes
├── assets/js/core/     # Auth, router, theme, clock
├── assets/js/utils/    # Helpers reutilizables
├── modules/            # Paneles por area (gerencia, produccion, calidad, almacen, rrhh)
├── apps/               # Apps de registro standalone
├── dashboards/         # Dashboards expandidos
└── config/             # roles.json, navigation.json
```

## Roles
- **admin** (gerencia, rodrigo): Acceso total
- **produccion**: Modulos produccion + almacen
- **calidad**: Modulos calidad + almacen

## Convenciones
- Archivos CSS: kebab-case
- Variables JS: camelCase
- Constantes: UPPER_SNAKE_CASE
- Componentes CSS: BEM simplificado (.card, .card-header, .card-title)
- IDs de paneles: kebab-case (panel-produccion-dia)
- Modulos: cada panel tiene un .html (template) y .js (logica con init())

## Base de Datos (Supabase)
- `registro_produccion` - Registros horarios de produccion
- `registro_personal` - Tracking de personal
- `registro_tuneles` - Ciclos de congelamiento
- `registro_empaque_congelado` - Registros de empaque
- `config_costos` - Configuracion de costos
- `labores_custom` - Labores personalizadas
- `registros_temperatura` - Monitoreo de temperaturas

## Comandos
- Servir localmente: `npx serve proyecto/` o Live Server de VS Code
- No requiere npm install para el frontend
