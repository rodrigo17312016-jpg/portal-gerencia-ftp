# Runbook Operacional - Portal Frutos Tropicales

**Version:** 1.0
**Fecha:** 2026-04-23
**Audiencia:** DevOps, ops, developer on-call

Este documento describe todas las operaciones repetibles del portal. Es AUTOCONTENIDO: un nuevo responsable debe poder ejecutar cualquier procedimiento leyendolo sin consultar otras fuentes.

---

## 0. Variables y referencias importantes

| Variable | Valor |
|---|---|
| Repo Git | `github.com/<org>/portal-gerencia-ftp` (ajustar con URL real) |
| Rama principal | `main` |
| URL produccion | `https://<org>.github.io/portal-gerencia-ftp/` |
| Proyecto Supabase principal | `rslzosmeteyzxmgfkppe` |
| Proyecto Supabase calidad | `obnvrfvcujsrmifvlqni` |
| Supabase Dashboard | `https://supabase.com/dashboard/project/{id}` |
| Cache SW actual | ver `sw.js` constante `CACHE_NAME` |
| Build version router | ver `assets/js/core/router.js` constante `BUILD_VERSION` |
| Email dominio sintetico | `@frutos-tropicales.pe` |

Paths criticos:
- `proyecto/sw.js` - service worker, cache version
- `proyecto/assets/js/core/router.js` - version de build
- `proyecto/assets/js/config/supabase.js` - URLs y anon keys
- `proyecto/config/roles.json` - permisos por rol
- `proyecto/config/navigation.json` - menu del portal

---

## 1. Deploy

### 1.1 Deploy estandar (push a main)

GitHub Pages deploya automaticamente cuando se pushea a `main`.

```bash
# Desde la raiz del repo
git status
git add proyecto/modules/produccion/indicadores.js
git commit -m "fix: corregir calculo KG acumulado en indicadores"
git push origin main
```

Tiempo de propagacion: 1-3 minutos. Verificar en tab "Actions" del repo GitHub el build de pages.

### 1.2 Deploy con breaking changes (requiere bump de cache SW)

Si tocaste `auth.js`, `router.js`, o CSS compartidos:

```bash
# 1. Bumpear cache en sw.js (ej: v24 -> v25)
# 2. Bumpear BUILD_VERSION en router.js (ej: '23' -> '24')
# 3. Commit + push
git add proyecto/sw.js proyecto/assets/js/core/router.js
git commit -m "chore: bump SW cache v25 + build 24 para deploy breaking"
git push origin main
```

Los browsers descargaran el nuevo SW en el siguiente fetch y eliminaran el cache viejo.

### 1.3 Verificacion post-deploy

Ver checklist en seccion 10.

---

## 2. Rollback

### 2.1 Rollback simple (revertir ultimo commit)

```bash
git log --oneline -5              # identificar el commit problematico
git revert <SHA>                  # crea commit inverso
git push origin main              # GitHub Pages rollback en ~2 min
```

Preferido: `git revert` sobre `git reset --hard`, porque mantiene historia.

### 2.2 Rollback a una version anterior especifica

```bash
git log --oneline                 # identificar SHA bueno conocido
git revert <SHA>..HEAD            # revierte todo lo posterior
git push origin main
```

### 2.3 Rollback de migracion SQL

Supabase NO tiene rollback automatico. Procedimiento manual:

1. Identificar la migracion problematica en Supabase Dashboard > Database > Migrations.
2. Escribir la migracion inversa (ejemplo: si se creo una columna, `ALTER TABLE t DROP COLUMN c`).
3. Ejecutar via SQL Editor o MCP `apply_migration`.
4. Documentar en el git log: commit de correccion + nota en `docs/COMPLIANCE.md`.

Si es critico y hay riesgo de perdida de datos:
- Usar Point-in-Time Recovery (PITR): Supabase Dashboard > Database > Backups > Restore to point in time (hasta 7 dias en plan actual).

---

## 3. Agregar un nuevo panel al portal

Ejemplo: agregar panel "Eficiencia linea" en area Produccion.

### 3.1 Archivos a crear

```
proyecto/modules/produccion/eficiencia-linea.html
proyecto/modules/produccion/eficiencia-linea.js
```

### 3.2 Template HTML minimo

```html
<div class="panel-content">
  <div class="card">
    <div class="card-header">
      <h3 class="card-title">Eficiencia Linea</h3>
    </div>
    <div class="card-body">
      <canvas id="chart-eficiencia-linea"></canvas>
    </div>
  </div>
</div>
```

### 3.3 Modulo JS (esqueleto obligatorio)

```js
import { supabase } from '../../assets/js/config/supabase.js';
import { createChart, destroyChart } from '../../assets/js/utils/chart-helpers.js';
import { escapeHtml } from '../../assets/js/utils/dom-helpers.js';

let chartInstance = null;

export async function init() {
  const { data, error } = await supabase
    .from('registro_produccion')
    .select('fecha, kg_procesados, linea')
    .order('fecha', { ascending: true });

  if (error) {
    console.error('eficiencia-linea:', error);
    return;
  }

  const ctx = document.getElementById('chart-eficiencia-linea').getContext('2d');
  chartInstance = createChart(ctx, {
    type: 'bar',
    data: { /* ... */ },
    options: { /* ... */ }
  });
}

export function destroy() {
  destroyChart(chartInstance);
  chartInstance = null;
}
```

### 3.4 Registrar en navigation.json

Editar `proyecto/config/navigation.json`, seccion "Produccion":

```json
{ "id": "eficiencia-linea", "label": "Eficiencia Linea", "icon": "\u26A1", "module": "produccion/eficiencia-linea" }
```

### 3.5 Autorizar en roles.json

Editar `proyecto/config/roles.json`, agregar `eficiencia-linea` al array `panels` del rol `produccion` (y eventualmente `admin` ya tiene `"*"`).

### 3.6 Testing local

```bash
cd proyecto
npx serve .
# abrir http://localhost:3000/login.html
# loguearse con rol produccion, verificar que el panel aparece
```

### 3.7 Deploy

Sigue el procedimiento 1.1. No requiere bump de cache SW a menos que hayas tocado imports compartidos.

---

## 4. Agregar un nuevo usuario

### 4.1 Via Supabase Dashboard (recomendado)

1. Ir a `https://supabase.com/dashboard/project/rslzosmeteyzxmgfkppe/auth/users`.
2. Click "Add user" > "Create new user".
3. Email: `<username>@frutos-tropicales.pe` (ejemplo: `jperez@frutos-tropicales.pe`).
4. Password: temporal, generar uno fuerte, entregarlo al usuario por canal seguro. Pedir que lo cambie en primer login.
5. Click "Create user".
6. Editar el usuario creado > tab "Raw User Meta Data" agregar:
   ```json
   { "name": "Juan Perez", "initials": "JP" }
   ```
7. MAS IMPORTANTE: tab "Raw App Meta Data" agregar el rol:
   ```json
   { "role": "produccion", "username": "jperez" }
   ```
   Valores validos de `role`: `admin`, `produccion`, `calidad`, `mantenimiento`, `rrhh`.
8. Save.

### 4.2 Verificacion

Probar login en `/login.html` con username `jperez` y el password temporal. Verificar que el menu muestre solo las secciones correctas del rol.

### 4.3 Completar metadata UI en users.js (opcional, solo display)

Editar `proyecto/assets/js/config/users.js` (solo para centralizar el listado, no es autoritativo):

```js
export const USERS = {
  // ...existing users,
  jperez: { name: 'Juan Perez', initials: 'JP', role: 'produccion', roleLabel: 'Supervisor Produccion' }
};
```

Commit + push. No afecta auth (solo display de iniciales/label).

### 4.4 Dar de baja usuario

1. Supabase Dashboard > Users > seleccionar > "Delete user".
2. Alternativa mas suave: editar `app_metadata` y poner `role: null` para revocar accesos sin perder historia.

---

## 5. Aplicar una migracion SQL

### 5.1 Via SQL Editor (manual)

1. Ir a `https://supabase.com/dashboard/project/rslzosmeteyzxmgfkppe/sql/new`.
2. Escribir/pegar la migracion:
   ```sql
   -- Agregar columna de comentarios a registro_produccion
   ALTER TABLE public.registro_produccion
     ADD COLUMN IF NOT EXISTS comentarios TEXT;
   ```
3. Click "Run". Revisar resultado.
4. Guardar el SQL en `proyecto/scripts/migrations/YYYYMMDD_descripcion.sql` para historial.

### 5.2 Via MCP (automatizado, recomendado para changes importantes)

Si se usa Claude Code con MCP Supabase:

```
mcp__supabase__apply_migration(
  project_id='rslzosmeteyzxmgfkppe',
  name='add_comentarios_to_registro_produccion',
  query='ALTER TABLE public.registro_produccion ADD COLUMN IF NOT EXISTS comentarios TEXT;'
)
```

El MCP registra la migracion en el historial de Supabase automaticamente.

### 5.3 Migraciones con RLS

Si la migracion agrega una tabla nueva, SIEMPRE habilitar RLS y crear policies:

```sql
CREATE TABLE public.nueva_tabla (...);
ALTER TABLE public.nueva_tabla ENABLE ROW LEVEL SECURITY;

-- Policy ejemplo: lectura a autenticados
CREATE POLICY "Lectura autenticada" ON public.nueva_tabla
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Escritura autenticada" ON public.nueva_tabla
  FOR INSERT TO authenticated
  WITH CHECK (true);
```

Post-migracion: ejecutar `get_advisors(type='security')` via MCP para confirmar 0 lints nuevos.

### 5.4 Migraciones con triggers de audit

Si la tabla debe ser auditada (BRCGS), crear trigger:

```sql
CREATE TRIGGER trg_audit_nueva_tabla
  AFTER INSERT OR UPDATE OR DELETE ON public.nueva_tabla
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();
```

---

## 6. Bump de cache Service Worker

Cuando cambies assets criticos (CSS global, JS core, JSONs de config):

### 6.1 Pasos

1. Abrir `proyecto/sw.js`.
2. Cambiar `CACHE_NAME = 'ftp-portal-v24'` a `v25`.
3. Si agregaste archivos nuevos a la cache estatica, agregarlos al array `STATIC_ASSETS`.
4. Abrir `proyecto/assets/js/core/router.js`.
5. Cambiar `BUILD_VERSION = '23'` a `'24'`.
6. Commit + push:
   ```bash
   git add proyecto/sw.js proyecto/assets/js/core/router.js
   git commit -m "chore: bump SW cache v25 + build 24"
   git push origin main
   ```

### 6.2 Efecto en browsers clientes

- Browser detecta nuevo SW al primer fetch post-deploy (puede tardar hasta 24h sin intervencion).
- Para forzar: DevTools > Application > Service Workers > "Update" o "Skip waiting".
- Usuarios finales: ctrl+shift+R (hard reload) o cerrar pestania y reabrir.

### 6.3 Cuando NO bumpear

Si solo cambiaste un modulo especifico (ej `modules/calidad/temperaturas.js`), NO requiere bump. El SW hace fetch network-first para rutas no listadas en `STATIC_ASSETS`, asi que recibira la version nueva automaticamente.

---

## 7. Rotacion de anon keys Supabase

Procedimiento si se sospecha compromiso o como rotacion anual.

1. Supabase Dashboard > proyecto > Settings > API > Rotate anon key. Confirmar.
2. Copiar la NUEVA anon key.
3. Actualizar `proyecto/assets/js/config/supabase.js`:
   - Constantes `SB_KEY` (calidad) y/o `SB_PROD_KEY` (principal).
4. Commit + push (deploy inmediato).
5. Verificar que la key vieja es rechazada (puede requerir esperar 5-10 min de propagacion).
6. Documentar rotacion en `docs/COMPLIANCE.md` log.

Tiempo de downtime esperado: 0 minutos si la rotacion y el deploy se hacen casi simultaneos. Riesgo: ventana de 1-2 min donde usuarios activos reciban 401; automaticamente se recuperan al recargar.

---

## 8. Gestion de backups

### 8.1 Backups automaticos

Supabase hace backup diario automatico. Retencion segun plan:
- Plan Free: 7 dias PITR.
- Plan Pro: 30 dias PITR.

### 8.2 Como restaurar

1. Supabase Dashboard > proyecto > Database > Backups.
2. Seleccionar punto en el tiempo.
3. Click "Restore".
4. La operacion crea un nuevo proyecto o sobrescribe el actual (confirmar la opcion).

**Atencion:** restore sobrescribe datos actuales. Si solo quieres recuperar UN registro, exporta el backup a un proyecto temporal y copia.

### 8.3 Export manual de audit_log

Para cumplimiento BRCGS / FDA:

```sql
COPY (SELECT * FROM public.audit_log_brcgs
      WHERE created_at >= NOW() - INTERVAL '90 days')
TO '/tmp/audit_export.csv' WITH CSV HEADER;
```

O via Dashboard: Table editor > audit_log > Export CSV.

Guardar en storage secundario (Google Drive empresa, S3, etc.) al menos mensualmente.

---

## 9. Monitoring y alertas

### 9.1 Estado actual

- Metricas basicas: Supabase Dashboard > proyecto > Reports (queries/hora, errores, latencia).
- Logs: Supabase Dashboard > proyecto > Logs.
- Advisors de seguridad: ejecutar `get_advisors(type='security')` via MCP trimestralmente.

### 9.2 Alertas recomendadas (ver `SENTRY_SETUP.md`)

- Error rate > 5% en 5 min: investigar inmediato.
- Supabase quota: revisar mensualmente.
- HIBP lint pendiente (plan Free): aceptado, ver `SECURITY.md`.

---

## 10. Checklist post-deploy

Usar SIEMPRE despues de cualquier deploy a produccion:

- [ ] GitHub Pages Actions tab: ultimo workflow termino verde.
- [ ] URL produccion carga en <3 segundos sin errores en consola.
- [ ] Login funciona con cuenta de prueba (rol `produccion`).
- [ ] Cada menu del rol muestra paneles esperados.
- [ ] Al menos un panel renderiza datos actuales (ej: `indicadores`).
- [ ] DevTools > Application > Service Workers: SW activo, version correcta.
- [ ] DevTools > Network: sin 401/403/500 inesperados.
- [ ] Si se bumpeo cache: SW antiguo esta "redundant" y nuevo esta "activated".
- [ ] Si fue migracion SQL: advisors de Supabase no muestran ERROR nuevos.
- [ ] Audit_log recibe eventos de las operaciones post-deploy.

Si algun item falla: ejecutar rollback (seccion 2) y abrir incidente (ver `INCIDENT_RESPONSE.md`).

---

## 11. Contactos de soporte vendor

| Vendor | Soporte | Plan |
|---|---|---|
| GitHub | `https://support.github.com/` | Free |
| Supabase | `https://supabase.com/support` | Free (upgrade a Pro recomendado para SLA) |
| Cloudflare | `https://support.cloudflare.com/` | Free (si esta configurado) |

Respuesta tipica soporte free: 24-72h. Para emergencias reales que requieren SLA, considerar upgrade temporal.

---

**Proxima revision:** 2026-10-23 (semestral)
