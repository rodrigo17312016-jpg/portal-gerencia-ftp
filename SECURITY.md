# Security Policy

## Reglas duras (no negociables)

### NUNCA committear

- Passwords (auth, DB, API)
- Tokens (JWT firmados, GitHub PATs, Slack tokens, etc.)
- API keys con secret (Stripe `sk_*`, OpenAI `sk-*`, AWS `AKIA*`, etc.)
- Service role keys de Supabase (las anon keys son OK porque son JWTs públicos firmados con anon role)
- Service account JSONs (Google, Firebase, AWS)
- `.env` con valores reales (commitea `.env.example` con placeholders)
- Backups de DB con datos personales (Ley 29733 Peru)

### Cómo manejar credenciales operativas

| Caso | Solución |
|------|----------|
| Password de usuario para login | Crear usuario via SQL **template** con placeholder. El owner ejecuta localmente con valor real. |
| API key de servicio externo | Variable de entorno (`process.env.X`) o Supabase secrets. Nunca hardcoded. |
| Service role Supabase | Solo en Edge Functions vía `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')`. Nunca en frontend. |
| Anon key Supabase | OK hardcoded en `assets/js/config/supabase.js` (es JWT público con role=anon, RLS protege los datos). |

## Defensas instaladas

### Capa 1 — Pre-commit hook (local)
`scripts/security/scan-secrets.py` escanea cada commit. Si detecta patrones de password/token/key, **bloquea** el commit.

Setup (ejecutar UNA VEZ tras clonar):
```bash
bash scripts/security/install-pre-commit-hook.sh
```

### Capa 2 — `.gitignore`
Patrones explícitos para `.env`, `*.pem`, `secrets/`, `*-passwords.txt`, etc. en el `.gitignore`.

### Capa 3 — GitHub Push Protection (servidor)
**Pendiente activar manualmente** en:
https://github.com/rodrigo17312016-jpg/portal-gerencia-ftp/settings/security_analysis

Activar "Secret scanning" + "Push protection" → GitHub bloquea el push si detecta secret antes de aceptarlo.

## Si descubres un leak

1. **Rotar el secret AHORA** (no esperes a "limpiar el repo primero")
2. Documentar el incidente en `docs/SECURITY_INCIDENTS.md` con la plantilla
3. Sanitizar el código actual
4. (Opcional) Reescribir historia con `git filter-repo --replace-text` y `git push --force-with-lease origin main`
5. Notificar a usuarios afectados si los datos pueden haber sido comprometidos (Ley 29733)

## Reportar vulnerabilidades

Si encontraste un bug de seguridad: **NO abras issue público**. Mándale email a Rodrigo García directo.
