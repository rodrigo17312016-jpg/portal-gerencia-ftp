# Cloudflare Setup — Proxy gratis delante de GitHub Pages

**Proposito:** agregar WAF, DDoS protection, HSTS headers reales y cache distribuido sin costo.
**Tiempo estimado:** 30-60 minutos.
**Costo:** $0 (plan Free de Cloudflare es suficiente).

---

## 1. Por que Cloudflare

GitHub Pages es excelente para hosting estatico, pero tiene limitaciones:

| Feature | GitHub Pages solo | GitHub Pages + Cloudflare |
|---|---|---|
| HTTPS | ✓ (automatico) | ✓ + HSTS headers custom |
| DDoS protection | Basica | ✓ (avanzada, automatica) |
| WAF rules | ✗ | ✓ (WAF managed + custom) |
| Cache global | ✓ (GitHub CDN) | ✓ (Cloudflare + GitHub) |
| Headers HTTP custom | ✗ (solo meta tags) | ✓ (CSP, HSTS, etc.) |
| Rate limiting | ✗ | ✓ (reglas granulares) |
| Analytics | Basico | ✓ (detallado) |
| Bot protection | ✗ | ✓ (Cloudflare Bot Fight Mode free) |

## 2. Requisitos previos

- Dominio propio (ej: `portal.frutostropicales.pe`). Si no tienes, comprar uno (~$10-15/ano en Namecheap/Cloudflare Registrar).
- Acceso al DNS del dominio
- Cuenta Cloudflare gratis: https://dash.cloudflare.com/sign-up

## 3. Pasos detallados

### 3.1 Agregar dominio a Cloudflare

1. Dashboard Cloudflare > "Add Site"
2. Ingresar dominio (ej: `frutostropicales.pe`)
3. Elegir plan "Free"
4. Cloudflare escanea DNS actual y los importa
5. Al final del wizard te dan 2 nameservers (ej: `ava.ns.cloudflare.com`)

### 3.2 Cambiar nameservers

En tu registrar (Namecheap, GoDaddy, etc.):

1. Buscar "DNS Management" o "Nameservers"
2. Cambiar de "default" a "custom nameservers"
3. Poner los 2 nameservers que te dio Cloudflare
4. Guardar (la propagacion toma 1-24h, tipicamente 15 min)

### 3.3 Configurar subdominio apuntando a GitHub Pages

En Cloudflare Dashboard > DNS:

```
Type    Name        Content                                     Proxy status
CNAME   portal      rodrigo17312016-jpg.github.io               Proxied (cloud naranja)
```

### 3.4 Configurar GitHub Pages para el dominio custom

1. GitHub repo `portal-gerencia-ftp` > Settings > Pages
2. Custom domain: `portal.frutostropicales.pe`
3. Click Save
4. Esperar que aparezca "DNS check successful"
5. Marcar "Enforce HTTPS"
6. GitHub creara el archivo `CNAME` en main con el dominio

### 3.5 Configurar SSL/TLS en Cloudflare

Dashboard > SSL/TLS:

- **Encryption mode:** Full (strict)
- **Edge Certificates** > Always Use HTTPS: ON
- **HSTS**: Enable con:
  - Max-Age: 6 months (gradual adoption)
  - Include subdomains: YES
  - Preload: NO (activar solo cuando este seguro)
- **Minimum TLS Version**: TLS 1.2

### 3.6 Configurar WAF

Dashboard > Security > WAF:

**Managed Rules** (activar):
- Cloudflare Managed Ruleset: ON
- OWASP Core Ruleset: ON (con sensibilidad Medium para empezar)

**Custom Rules** (agregar estas 3):

**Rule 1: Block requests with suspicious paths**
```
(http.request.uri.path contains ".env") or
(http.request.uri.path contains ".git") or
(http.request.uri.path contains "/wp-admin") or
(http.request.uri.path contains "/phpmyadmin")
-> Action: Block
```

**Rule 2: Rate limit en paths sensibles**
```
(http.request.uri.path eq "/login.html")
-> Action: Managed Challenge si > 10 requests/min desde misma IP
```

**Rule 3: Block known bad user agents**
```
(http.user_agent contains "sqlmap") or
(http.user_agent contains "nikto") or
(http.user_agent contains "nmap") or
(lower(http.user_agent) contains "havij")
-> Action: Block
```

### 3.7 Page Rules para cache

Dashboard > Rules > Page Rules (free tier permite 3):

**Rule 1: Cache assets estaticos agresivamente**
```
URL: *portal.frutostropicales.pe/assets/*
Settings:
- Cache Level: Cache Everything
- Edge Cache TTL: 1 month
- Browser Cache TTL: 1 week
```

**Rule 2: NUNCA cachear HTML (siempre fresh)**
```
URL: *portal.frutostropicales.pe/*.html
Settings:
- Cache Level: Bypass
```

**Rule 3: Cache imagenes 1 ano**
```
URL: *portal.frutostropicales.pe/*.{jpg,png,ico,svg}
Settings:
- Cache Level: Cache Everything
- Edge Cache TTL: 1 year
```

### 3.8 Bot Fight Mode

Dashboard > Security > Bots:
- **Bot Fight Mode**: ON

Esto bloquea bots automatizados abusivos sin CAPTCHA a usuarios reales.

### 3.9 Headers HTTP via Transform Rules

Dashboard > Rules > Transform Rules > HTTP Response Header Modification:

**Agregar headers que GitHub Pages no permite:**

```
Rule name: Security Headers
When: all requests
Set HTTP response header:
- Strict-Transport-Security: max-age=15552000; includeSubDomains
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: camera=(), microphone=(), geolocation=()
```

(Estos complementan los meta tags CSP que ya estan en el HTML)

## 4. Verificacion

Despues del setup, verificar con:

### 4.1 SSL Labs
https://www.ssllabs.com/ssltest/analyze.html?d=portal.frutostropicales.pe

**Target: A o A+**

### 4.2 securityheaders.com
https://securityheaders.com/?q=portal.frutostropicales.pe

**Target: A+**

Debe mostrar:
- ✓ Strict-Transport-Security
- ✓ X-Frame-Options
- ✓ X-Content-Type-Options
- ✓ Referrer-Policy
- ✓ Content-Security-Policy
- ✓ Permissions-Policy

### 4.3 Mozilla Observatory
https://observatory.mozilla.org/analyze/portal.frutostropicales.pe

**Target: A o A+**

## 5. Costos y limites (plan Free)

- Requests ilimitados
- Bandwidth ilimitado
- Analytics basico (hasta 30 dias)
- 3 Page Rules
- 5 WAF Custom Rules
- Bot Fight Mode
- SSL universal

**Plan Pro ($20/mes)** agrega:
- 20 Page Rules
- Polish image optimization
- Image resizing
- Advanced DDoS

Para un portal operacional como el FTP, el plan Free es mas que suficiente.

## 6. Bypass Cloudflare en emergencia

Si Cloudflare bloquea algo legitimo o hay un problema:

**Opcion A (rapida): desactivar proxy**
1. Dashboard > DNS
2. Click en la nube naranja del registro CNAME
3. Pasa a gris (DNS only, sin proxy)
4. Trafico va directo a GitHub Pages (sin WAF ni cache Cloudflare)
5. Re-activar cuando se resuelva

**Opcion B (granular): desactivar regla especifica**
- Security > Events > ver requests bloqueados
- Security > WAF > desactivar regla especifica
- Identificar el patron y ajustar

## 7. Monitoreo

- Dashboard > Analytics: requests, bandwidth, cache hit ratio, amenazas bloqueadas
- Notificaciones por email: configurar en Notifications > Add notification
  - Alertas: DDoS detected, SSL expiring, etc.

## 8. Integracion con el portal

El portal **no necesita cambios de codigo** para usar Cloudflare. El proxy es transparente.

**Unico cambio recomendado**: actualizar `manifest.json` si usas dominio custom:

```json
{
  "start_url": "https://portal.frutostropicales.pe/portal.html",
  "scope": "https://portal.frutostropicales.pe/"
}
```

## 9. Limpieza / desactivacion

Si en algun momento se decide NO usar Cloudflare:

1. GitHub repo > Settings > Pages > Remove custom domain
2. En el registrar, volver a los nameservers originales
3. Eliminar site en Cloudflare
4. Restaurar acceso directo a `rodrigo17312016-jpg.github.io/portal-gerencia-ftp/`

**Tiempo:** ~30 min + propagacion DNS.
