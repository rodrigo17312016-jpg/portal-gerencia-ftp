# Politica de Seguridad — Portal FTP

## Reportar vulnerabilidades

Si descubres una vulnerabilidad de seguridad en este portal, **NO** abras un issue publico en GitHub.

En su lugar:

1. **Email privado** a: rodrigo17312016@gmail.com
2. **Asunto**: `[SECURITY] Portal FTP - <breve descripcion>`
3. Incluye:
   - Tipo de vulnerabilidad (XSS, RLS bypass, etc.)
   - Pasos para reproducir
   - Impacto potencial
   - (Opcional) sugerencia de fix

## Tiempo de respuesta

- **Ack inicial**: 48 horas
- **Evaluacion**: 7 dias
- **Fix deployed**: depende de severidad
  - Critico: 24-72 horas
  - Alto: 1 semana
  - Medio: 1 mes
  - Bajo: proxima iteracion

## Bounty

Sin programa formal de bounty, pero reconocimiento publico disponible (si lo deseas) en hall of fame post-fix.

## Versiones soportadas

Solo la rama `main` recibe actualizaciones. No hay LTS.

## Scope

**In scope:**
- Portal web (`portal.html` + modulos)
- Apps standalone (`apps/*`)
- Supabase configuration (policies RLS, functions)
- Documentacion oficial (`docs/*`)

**Out of scope:**
- Tablas `finance_*` y `aresbet_debug` (son de otros proyectos, no del portal)
- Infraestructura de GitHub / Supabase (reportar a sus respectivos programas)
- Ataques que requieran acceso fisico al dispositivo del usuario
- DoS trivial (rate limit ya existe)

## Referencia

Politica completa en [docs/SECURITY.md](../docs/SECURITY.md).
