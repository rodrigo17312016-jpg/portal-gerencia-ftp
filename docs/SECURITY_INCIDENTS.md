# Security Incidents Log

Registro auditable de incidentes de seguridad y su remediación.

---

## INC-2026-05-01-001 — Generic Password leakeado en GitHub via SQL audit

| Campo | Valor |
|-------|-------|
| **Fecha detección** | 2026-05-01 ~05:25 UTC |
| **Detector** | GitGuardian (alerta automática a GMail del owner) |
| **Severidad** | Alta (credenciales operativas con acceso a datos reales) |
| **Estado** | ✅ RESUELTO 2026-05-01 |
| **Repositorio** | `rodrigo17312016-jpg/portal-gerencia-ftp` (público) |
| **Archivo culpable** | `sql/multi-sede/010_crear_usuarios_supervisores_y_asignar_sedes.sql` |
| **Commit que introdujo** | `320de36` (`docs(multi-tenant): SQL audit de creacion de usuarios...`) |
| **Pushed at** | 2026-05-01 05:24:54 UTC |

### Qué se leakeó

- Password de usuario `produccion@frutos-tropicales.pe` (**rotado**)
- Password de usuario `produccionprc@frutos-tropicales.pe` (**rotado**)

Ambos usuarios tienen rol `produccion` en Supabase Auth, con acceso (vía RLS):
- `produccion`: lectura/escritura de FTP-HUA + PRC-MAQ
- `produccionprc`: lectura/escritura de PRC-MAQ únicamente
- **Ninguno** tenía acceso a funciones admin ni a la planta FTP-PIU

### Causa raíz

El commit incluía un SQL "audit" de la operación manual de crear usuarios + asignar sedes. Por error, los passwords se hardcodearon en el script en lugar de usar placeholders. El repo es público en GitHub Pages, así que GitGuardian (y posiblemente bots de scraping) los detectaron en cuestión de minutos.

### Remediación aplicada (2026-05-01)

1. **Rotación de passwords** en ambos proyectos Supabase (Prod + Calidad) usando MCP. Verificado:
   - Viejos passwords: `Invalid login credentials`
   - Nuevos passwords: login OK, role correcto preservado
2. **Sanitización del SQL**: archivo `010_*.sql` reescrito con placeholders `:PRODUCCION_PASSWORD`, `:PRODUCCIONPRC_PASSWORD`. Documentado patrón de uso para rotaciones futuras.
3. **Reescritura de historia git** con `git filter-repo --replace-text` para purgar `prod2026` y `prc2026` de TODOS los commits del repo. Reemplazo `***REDACTED-2026-05-01***`.
4. **Force-push** a `origin/main` con `--force-with-lease` (commit hashes nuevos).
5. **Privacidad informada al usuario**: aunque la historia esté limpia, hay que asumir que los secretos viejos quedaron en cachés de scrapers / Wayback Machine / GitGuardian DB. Por eso la rotación es lo que cierra el incidente, no el filter-repo.

### Defensas instaladas para que NO se repita

| Capa | Tipo | Ubicación |
|------|------|-----------|
| 1 | Secret scanner local pre-commit | `scripts/security/scan-secrets.py` + hook en `.git/hooks/pre-commit` (instalable con `bash scripts/security/install-pre-commit-hook.sh`) |
| 2 | `.gitignore` reforzado | Patrones `*.env`, `*.pem`, `secrets/`, `*-passwords.txt`, etc. |
| 3 | Política dura para Claude (auto-memory) | `MEMORY.md` ahora dice "NUNCA hardcodear passwords/tokens/keys en SQL/JS/JSON. Usar placeholders + doc separada" |
| 4 | (Pendiente acción del owner) GitHub Push Protection | https://github.com/rodrigo17312016-jpg/portal-gerencia-ftp/settings/security_analysis → activar "Secret scanning" + "Push protection" |

### Lecciones aprendidas

- **No commitear "audits" con valores reales.** Los audits son útiles, pero se documentan como TEMPLATES con placeholders.
- **El `.gitignore` no salva** — un archivo committeable puede tener secretos en su contenido. La protección viene del scanner pre-commit + push protection del servidor.
- **Repo público = asumir leak inmediato.** Con repo privado el blast radius es menor, pero la rotación sigue siendo obligatoria si hay sospecha.
- **No usar passwords débiles ni "memorables".** GitGuardian indexa palabras del proyecto. Mejor passwords aleatorios largos en password manager.

---

## (Plantilla para futuros incidentes)

### INC-YYYY-MM-DD-NNN — [Título corto]

| Campo | Valor |
|-------|-------|
| Fecha detección | YYYY-MM-DD HH:MM UTC |
| Detector | (GitGuardian / pre-commit hook / manual / ...) |
| Severidad | Baja / Media / Alta / Crítica |
| Estado | Abierto / En proceso / RESUELTO |
| Archivo culpable | path |
| Commit que introdujo | hash |

#### Qué se leakeó / qué pasó

#### Causa raíz

#### Remediación aplicada

#### Defensas adicionales instaladas (si aplica)
