# 🌡️ Temperaturas PWA — Frutos Tropicales

PWA (Progressive Web App) instalable para captura rápida de temperaturas con OCR. Reemplaza el flujo manual por WhatsApp por una app que el operario instala en su celular Android (o iPhone), funciona offline y sincroniza a Supabase automáticamente.

> **Stack:** HTML/CSS/JS vanilla · Tesseract.js (OCR cliente-side) · Supabase (REST + Storage) · IndexedDB (cola offline) · Service Worker (cache + sync background).

---

## 🚀 Setup local (5 min)

### 1. Aplicar migrations en Supabase

Ya están aplicadas en producción (`obnvrfvcujsrmifvlqni`), pero si se necesita repetir en otro proyecto:

```bash
# desde el SQL editor de Supabase, ejecutar en orden:
# 1. migrations/001_areas_temperatura.sql
# 2. migrations/002_extend_registros_temperatura.sql
# 3. migrations/003_storage_bucket.sql
```

### 2. Servir la PWA

Las PWAs requieren HTTPS (o localhost). Opciones de testing local:

```bash
# Opción A — Python (más simple)
cd temperaturas-pwa
python -m http.server 8080
# abrir http://localhost:8080
```

```bash
# Opción B — Node.js (con HTTPS para probar Service Worker)
npx serve --listen 8080 --ssl-cert cert.pem --ssl-key key.pem
```

### 3. Configuración inicial

Al abrir por primera vez, la PWA pide:

| Campo | Valor |
|---|---|
| URL Supabase | `https://obnvrfvcujsrmifvlqni.supabase.co` |
| Anon key | (la del proyecto Supabase — la pública, no service_role) |
| Sede | `FTP-HUA` / `FTP-PIU` / `PRC-MAQ` |
| Operario | Tu nombre completo |

Esos datos se guardan en `localStorage` del celular (no se transmiten a ningún server externo).

### 4. Instalar en celular

- **Chrome Android:** Menú (⋮) → "Instalar app" → ícono aparece en home.
- **iOS Safari:** Compartir → "Agregar a inicio".

---

## 📂 Estructura

```
temperaturas-pwa/
├── index.html              ← shell de la app
├── manifest.json           ← PWA manifest (ícono, nombre, colores)
├── sw.js                   ← service worker (offline + cache)
├── icons/                  ← íconos 192/512 + maskable
├── migrations/             ← SQL para aplicar en Supabase
│   ├── 001_areas_temperatura.sql        ← tabla maestra de áreas
│   ├── 002_extend_registros_temperatura.sql ← +foto, +OCR, +offline_id
│   └── 003_storage_bucket.sql           ← bucket privado para fotos
├── css/
│   ├── tokens.css          ← design tokens (colores, espaciado, dark mode)
│   ├── components.css      ← cards, buttons, inputs, navbar, status
│   └── screens.css         ← layouts por pantalla
└── js/
    ├── app.js              ← router + helpers globales
    ├── supabase-client.js  ← config + insert/upload/fetch
    ├── areas.js            ← cache de áreas (24h TTL)
    ├── camera.js           ← getUserMedia + captura JPEG
    ├── ocr.js              ← Tesseract.js wrapper
    ├── offline-queue.js    ← IndexedDB queue + auto-flush al volver red
    └── screens/
        ├── setup.js        ← onboarding (URL/key/sede/operario)
        ├── home.js         ← lista de áreas con tabs MP/Proceso/Empaque
        ├── capture.js      ← cámara con guía visual
        ├── confirm.js      ← OCR + confirmación + estado OK/ALERTA/CRÍTICO
        └── success.js      ← confirmación + auto-return
```

---

## 🔄 Flujo del operario (típico, 3 taps)

1. **Tap área** (ej. "Cámara Producto Terminado")
2. **Tap shutter** → cámara captura → OCR auto-rellena valor
3. **Tap "Guardar registro"** → Supabase ✓

Si está apurado: tap "Saltar foto" → digita el valor → guardar (2 taps).

Si está sin red: todo se guarda en IndexedDB y se sube automático cuando vuelve la señal (con dedup vía `sync_offline_id` UUID).

---

## 🧪 Áreas y rangos vigentes

| Formato | Área | Límite | Crítico | Tipo equipo |
|---|---|---|---|---|
| 🚛 MP | CAMARA DE MATERIA PRIMA | ≤ 8°C | > 13°C | visor |
| 🚛 MP | TEMPERATURA DE PRODUCTO(MP) | ≤ -20°C | > -15°C | termómetro portátil |
| 🏭 Proceso | ACONDICIONADO | ≤ 17°C | > 22°C | termómetro portátil |
| 🏭 Proceso | EMBANDEJADO | ≤ 15°C | > 20°C | termómetro portátil |
| 🏭 Proceso | LAVADO DE BANDEJAS | ≤ 18°C | > 23°C | termómetro portátil |
| 🏭 Proceso | PRE ENFRIADO | ≤ 10°C | > 15°C | termómetro portátil |
| 📦 Empaque | EMPAQUE | ≤ 5°C | > 10°C | termómetro portátil |
| 📦 Empaque | TEMPERATURA PRODUCTO | ≤ -18°C | > -13°C | termómetro portátil |
| 📦 Empaque | **CAMARA DE PRODUCTO TERMINADO** | ≤ -20°C | > -15°C | **termoregistro estático** |
| 📦 Empaque | DESPACHO | ≤ 5°C | > 10°C | termómetro portátil |

REEFERs 1-10 están en BD pero **inactivos** (`activa = FALSE`). Para reactivarlos:
```sql
UPDATE public.areas_temperatura SET activa = TRUE WHERE codigo LIKE 'REEFER %';
```

---

## 🛡️ Seguridad

- ✅ Las credenciales (URL + anon key) **nunca están hardcodeadas**: las ingresa el usuario en setup y se guardan en `localStorage`. Cumple regla `feedback_no_hardcoded_secrets`.
- ✅ La anon key es pública por diseño (RLS la protege). No es un secreto.
- ✅ Las fotos se suben a bucket **privado** y se consultan via signed URL desde el dashboard.
- ✅ RLS de `registros_temperatura`: anon puede INSERT solo registros con fecha entre `today-30d` y `tomorrow`. Previene inserciones masivas con fechas inválidas.

---

## 📷 OCR — cómo funciona

- **Tesseract.js** corre 100% en el celular (sin enviar fotos a ningún server).
- Lib se descarga 1ra vez (~2MB) y se cachea en SW para uso offline.
- Charset restringido a `0-9 - . , °C` para acertar más en displays digitales.
- PSM=7 (single line) → ideal para visualizadores.
- Si la confianza es baja o la lectura es absurda (>99°C o <-50°C), el operario digita manualmente.
- Se guarda en `ocr_valor_detectado` y `ocr_confianza` para auditar la calidad del OCR a futuro.

---

## 🌐 Offline-first

- **App shell** (HTML/CSS/JS) cacheada en `temperaturas-shell-v1`.
- **Tesseract.js + traineddata** cacheada en `temperaturas-tesseract-v1` (cache-first agresivo).
- **API Supabase** network-first con timeout 5s y fallback a cache.
- **Inserts en cola IndexedDB** + auto-flush al recuperar red (evento `online`).
- **Background Sync** (cuando el browser lo soporta).

---

## 🔄 Integración con dashboard existente

El dashboard legacy (`_legacy/dashboards-old/temperaturas.html`) sigue funcionando — la PWA inserta en la **misma tabla** `registros_temperatura`. Solo agrega 5 columnas nuevas (`foto_url`, `ocr_valor_detectado`, `ocr_confianza`, `origen`, `sync_offline_id`) que el dashboard puede ignorar o mostrar.

Filtro útil para ver solo registros de la PWA:
```sql
SELECT * FROM registros_temperatura
WHERE origen IN ('pwa_ocr', 'pwa_manual')
ORDER BY fecha DESC, hora DESC;
```

---

## 🐛 Bugs conocidos / mejoras a futuro

- [ ] Recordatorios push horarios (depende de auth + suscripción FCM)
- [ ] Panel admin para editar áreas/rangos sin SQL
- [ ] Visor de fotos pendientes en la PWA (para verificar antes de subir)
- [ ] Modo "auditor" que muestra registros recientes con foto miniatura
- [ ] Soporte para escanear QR de equipos (al apuntar a etiqueta del visor, autoselecciona área)

---

## ✅ Verificación post-deploy

Para confirmar que todo está bien después de un deploy:

```sql
-- 1. Áreas activas (debe ser 10)
SELECT COUNT(*) FROM areas_temperatura WHERE activa = TRUE;

-- 2. Columnas nuevas en registros_temperatura (debe ser 5)
SELECT COUNT(*) FROM information_schema.columns
WHERE table_name = 'registros_temperatura'
  AND column_name IN ('foto_url','ocr_valor_detectado','ocr_confianza','origen','sync_offline_id');

-- 3. Bucket existe
SELECT * FROM storage.buckets WHERE id = 'temperaturas-fotos';

-- 4. Últimos registros de la PWA
SELECT fecha, hora, area, temperatura, estado, operario, origen, foto_url IS NOT NULL AS tiene_foto
FROM registros_temperatura
WHERE origen IN ('pwa_ocr', 'pwa_manual')
ORDER BY fecha DESC, hora DESC
LIMIT 20;
```

---

## 📝 Changelog

- **v1 (2026-05-02)** — Release inicial con: setup, home, capture, OCR, confirm, success, offline queue, service worker, 3 migrations aplicadas a producción, auto-auditoría con 7 bugs corregidos.
