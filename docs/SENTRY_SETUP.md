# Sentry Setup — Observabilidad gratis

**Proposito:** capturar errores de runtime, performance y usuarios afectados sin infraestructura propia.
**Tiempo estimado:** 20 minutos.
**Costo:** $0 en plan Developer (5K errores / 10K transacciones / mes).

---

## 1. Por que Sentry

Hoy el portal tiene `production-guard.js` que silencia logs en produccion (bueno para seguridad), pero eso implica que los errores en prod **no se ven**. Sin observabilidad:

- Un bug en mantenimiento/ordenes.js puede romper la UI para usuarios y nadie se entera
- No hay manera de saber cuantos usuarios fueron afectados
- Debugging requiere que el usuario describa el problema

Sentry resuelve todo esto:

- Captura errores automaticamente (incluso los silenciados por console.error vacio)
- Muestra stack trace, usuario afectado, browser, panel activo
- Agrupa errores similares (evita spam)
- Alertas por email/Slack cuando hay error critico
- Replays opcionales (graban los clicks del usuario antes del error)

## 2. Crear cuenta y proyecto

1. https://sentry.io/signup/
2. Elegir "Plan Developer" (free)
3. Create Project:
   - Platform: **Browser JavaScript**
   - Nombre: `ftp-portal`
4. Copiar el **DSN** (formato: `https://XXXXX@oXXXXX.ingest.sentry.io/YYYYY`)

## 3. Integracion en el portal

### 3.1 Cargar SDK via CDN

Agregar al `<head>` de `portal.html` DESPUES del `production-guard.js`:

```html
<!-- Sentry (observabilidad) -->
<script
  src="https://browser.sentry-cdn.com/7.109.0/bundle.tracing.min.js"
  integrity="sha384-yyyyyyyy"
  crossorigin="anonymous"
></script>
<script>
  // Inicializar solo en produccion (no en localhost/file://)
  (function() {
    var host = window.location.hostname;
    var isProd = host && host !== 'localhost' && host !== '127.0.0.1' && !host.startsWith('192.168.');
    if (!isProd || typeof Sentry === 'undefined') return;

    Sentry.init({
      dsn: 'TU_DSN_AQUI',  // reemplazar con el DSN real
      environment: 'production',
      release: 'ftp-portal@' + (window.__FTP_BUILD_VERSION || '0'),

      // Sample rate: % de transacciones a enviar
      tracesSampleRate: 0.1,  // 10% para monitor performance

      // Error sample rate: 100% (captura todos los errores)
      sampleRate: 1.0,

      // No enviar datos sensibles
      beforeSend: function(event, hint) {
        // Filtrar errores del SDK de Supabase que ya manejamos
        if (event.exception && event.exception.values) {
          var msg = event.exception.values[0].value || '';
          if (msg.includes('Supabase timeout')) return null;   // ya manejamos
          if (msg.includes('FTP_AUTH_GUARD')) return null;     // intencional
        }
        // Remover datos personales de los extra fields si hubiera
        if (event.request && event.request.url) {
          event.request.url = event.request.url.replace(/[?&]token=[^&]*/g, '?token=[REDACTED]');
        }
        return event;
      },

      // Ignorar errores benignos
      ignoreErrors: [
        'ResizeObserver loop',
        'Non-Error promise rejection',
        /extension\//i,
        /^chrome:/
      ]
    });

    // Tag con info del usuario (sin PII)
    window.addEventListener('DOMContentLoaded', function() {
      try {
        var token = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
        if (token) {
          var data = JSON.parse(localStorage.getItem(token));
          var email = data.user && data.user.email;
          var role = data.user && data.user.app_metadata && data.user.app_metadata.role;
          if (email) {
            // Usar user.id (UUID) para privacy, no el email
            Sentry.setUser({ id: data.user.id });
          }
          if (role) Sentry.setTag('user_role', role);
        }
      } catch (e) { /* noop */ }
    });

    // Tag con panel actual cada vez que cambia
    var origShowPanel = null;
    setTimeout(function() {
      if (window.showPanel) {
        origShowPanel = window.showPanel;
        window.showPanel = function(panelId, modulePath) {
          Sentry.setTag('active_panel', panelId);
          return origShowPanel.apply(this, arguments);
        };
      }
    }, 1000);
  })();
</script>
```

**IMPORTANTE**: calcular el SRI hash real del SDK Sentry con:

```bash
curl -sL https://browser.sentry-cdn.com/7.109.0/bundle.tracing.min.js | \
  openssl dgst -sha384 -binary | openssl base64 -A
```

### 3.2 Actualizar CSP para permitir Sentry

En el `<meta http-equiv="Content-Security-Policy">` de `portal.html`, agregar:

```
script-src ... https://browser.sentry-cdn.com;
connect-src ... https://*.ingest.sentry.io https://*.sentry.io;
```

### 3.3 Capturar errores de Supabase manualmente

Opcionalmente, en `assets/js/config/supabase.js`:

```js
export async function safeInsert(table, data) {
  try {
    const { data: res, error } = await supabase.from(table).insert(data).select();
    if (error) {
      if (window.Sentry) {
        Sentry.captureException(new Error('Supabase insert error'), {
          tags: { operation: 'insert', table },
          extra: { error_code: error.code, error_msg: error.message }
        });
      }
      throw error;
    }
    return res;
  } catch (err) {
    throw err;
  }
}
```

## 4. Configurar alertas

Dashboard Sentry > Alerts > Create Alert Rule:

**Regla 1: Error nuevo en produccion**
```
When: a new issue is seen in project ftp-portal
If: environment equals production
Then: Send email to rodrigo17312016@gmail.com
```

**Regla 2: Spike de errores**
```
When: more than 10 events in the last 5 minutes
Then: Send notification
```

**Regla 3: Error afecta a > 5 usuarios**
```
When: event count > 5 unique users in 1 hour
Then: High priority notification
```

## 5. Tags utiles para el portal

Sentry permite filtrar por tags. Recomendados:

| Tag | Valor | Para que |
|---|---|---|
| `user_role` | admin, produccion, calidad, mantenimiento | Filtrar errores por rol |
| `active_panel` | resumen, audit, tuneles, etc. | Ver que panel falla mas |
| `build_version` | v23, v24, ... | Detectar regresiones post-deploy |

## 6. Dashboard Sentry — metricas clave

Dashboard > Issues muestra:
- **Issues**: errores agrupados
- **Performance**: transacciones lentas
- **Releases**: cuando aparecen/desaparecen errores segun version
- **User Feedback**: si implementas el widget, usuarios pueden reportar

Filtros utiles:
- `is:unresolved` — solo errores abiertos
- `user_role:admin` — errores de admins
- `active_panel:tuneles` — errores en panel especifico
- `age:-1d` — ultimas 24h

## 7. Integracion con Slack/Discord (opcional)

Settings > Integrations > Slack (gratis):
- Conectar workspace
- Elegir canal #alertas-ftp
- Se recibe notificacion automatica por cada error nuevo

## 8. Session Replays (opcional, $$$)

Plan Developer no incluye replays. Plan Team ($29/mes) agrega:
- Ver clicks del usuario previos al error (como video)
- Util para bugs dificiles de reproducir

Decision: **no lo activamos en Free**. Solo considerar si hay muchos bugs de UI dificiles de reproducir.

## 9. Privacidad y PII

Sentry por default NO envia:
- Contenido de forms
- Cookies
- Headers sensibles (Authorization, Cookie)

Configurar en `beforeSend` para asegurar que NO se envia:
- Emails de usuarios (usar UUID en su lugar)
- Datos de tablas operacionales
- JWTs (ya redacted por SDK)

## 10. Verificacion post-setup

1. Hacer deploy con Sentry activado
2. Abrir DevTools del navegador
3. En Console ejecutar: `throw new Error('Test Sentry')`
4. Ir a Sentry Dashboard > Issues
5. Debe aparecer el error con detalles

## 11. Alternativas a Sentry

Si Sentry no convence, equivalentes:

| Tool | Plan Free | Comentario |
|---|---|---|
| **LogRocket** | 1K sesiones/mes | Incluye replays gratis |
| **Datadog RUM** | Limitado | Mas orientado a enterprise |
| **Raygun** | 14 dias trial | No free tier real |
| **Rollbar** | 5K errores/mes | Similar a Sentry |
| **Bugsnag** | 7.5K errores/mes | Simple y bueno |

Recomendacion: **Sentry** por balance de features/precio y documentacion.

## 12. Manejo de volumen / quotas

Plan Developer (free) tiene:
- 5K errores/mes
- 10K transacciones/mes
- 50 replays/mes (si activas)

Si se excede: Sentry avisa pero NO bloquea (siguiente mes resetea). Si consistentemente se excede -> upgrade a Team ($29/mes) o reducir sampleRate.

## 13. Roadmap opcional

- **Feedback widget**: boton "Report bug" en portal que dispara Sentry feedback form
- **Performance monitoring**: tracing de queries Supabase lentas
- **Custom dashboards**: metricas especificas (logins/hora, exports/dia, etc.)
- **Alertas avanzadas**: integrar con PagerDuty si incidentes P1

## 14. Desactivar Sentry

Para desinstalar:
1. Remover las 2 `<script>` tags de portal.html
2. Reducir CSP (quitar `sentry-cdn.com` y `sentry.io`)
3. Delete project en Sentry Dashboard
4. Bump SW cache
