#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generador de PDF: Diagramas de flujo de las 6 apps del portal.
Output: docs/diagramas/Diagramas_Flujo_Apps_FTP.pdf

NOTA: reportlab built-in fonts (Helvetica) no soportan emojis Unicode.
Por eso usamos labels descriptivos en mayusculas en vez de emojis.
"""

from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import cm
from reportlab.lib.colors import HexColor, white
from reportlab.pdfgen import canvas
import os
import math

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "docs", "diagramas")
os.makedirs(OUTPUT_DIR, exist_ok=True)
OUTPUT_PDF = os.path.join(OUTPUT_DIR, "Diagramas_Flujo_Apps_FTP.pdf")

# Paleta corporativa FTP
COLORS = {
    "verde":   HexColor("#16a34a"),
    "verde_bg": HexColor("#dcfce7"),
    "naranja": HexColor("#ea580c"),
    "naranja_bg": HexColor("#fed7aa"),
    "azul":    HexColor("#2563eb"),
    "azul_bg": HexColor("#dbeafe"),
    "cyan":    HexColor("#0891b2"),
    "cyan_bg": HexColor("#cffafe"),
    "purple":  HexColor("#7c3aed"),
    "purple_bg": HexColor("#ede9fe"),
    "amber":   HexColor("#d97706"),
    "amber_bg": HexColor("#fef3c7"),
    "rojo":    HexColor("#dc2626"),
    "rojo_bg": HexColor("#fee2e2"),
    "gris":    HexColor("#475569"),
    "gris_bg": HexColor("#f1f5f9"),
    "muted":   HexColor("#64748b"),
    "border":  HexColor("#cbd5e1"),
    "texto":   HexColor("#0f172a"),
    "white":   white,
}

# ──────────────── Datos de las apps (sin emojis Unicode) ────────────────
APPS = [
    {
        "nombre": "Registro de Produccion",
        "id": "registro-produccion",
        "color": "verde",
        "tag": "PROD",
        "proposito": "Registrar produccion de acondicionado hora por hora (consumo MP, PT, rendimiento, personal).",
        "tabla": "registro_produccion",
        "conflict": "fecha + hora + linea",
        "flujo": [
            ("INICIO", "Usuario abre app", "inicio"),
            ("AUTH", "auth-guard valida JWT\n(redirige a login si falta)", "decision"),
            ("FECHA/TURNO", "Selecciona Fecha + Turno (DIA/NOCHE)\n+ Fruta + Hora + Linea", "proceso"),
            ("PROYECCION", "Ingresa Proyectado TN/dia\n+ Consumo MP (kg)\n+ Rendimiento %", "proceso"),
            ("AUTOCALC", "PT Aprox = Consumo x Rend / 100\n(editable)", "proceso"),
            ("PERSONAL", "Ingresa N Personas\n+ Supervisor + Observacion", "proceso"),
            ("DUPLICADO?", "Existe registro con\nmisma fecha+hora+linea+fruta?", "decision"),
            ("CONFIRMAR", "Confirm: Reemplazar?", "decision"),
            ("UPSERT BD", "supabase.upsert(registro_produccion)\nonConflict: fecha+hora+linea", "supabase"),
            ("FIN OK", "Toast verde + refresh KPIs/charts/tabla\n+ avanza al siguiente slot horario", "fin"),
        ],
        "datos": "fecha, hora, turno, fruta, linea, proyectado_tn, consumo_kg, pt_aprox_kg, rendimiento, personas, supervisor, observacion, almuerzo_inicio/fin",
        "validaciones": "- Supabase conectado\n- Consumo > 0\n- Rendimiento > 0\n- Hora no vacia\n- Anti-doble-click (_registrandoHora)",
        "feedback": "Toast verde 'Registro guardado' + indicador Supabase verde + refresca 5 KPIs + 4 charts + tabla + auto-avanza siguiente slot",
    },
    {
        "nombre": "Registro de Personal",
        "id": "registro-personal",
        "color": "naranja",
        "tag": "PERS",
        "proposito": "Registrar dotacion de personal por hora con distribucion por area (balance de linea).",
        "tabla": "registro_personal",
        "conflict": "fecha + hora + linea",
        "flujo": [
            ("INICIO", "Usuario abre app", "inicio"),
            ("AUTH", "auth-guard valida JWT", "decision"),
            ("CONTEXTO", "Selecciona Fecha + Hora + Fruta\n+ Linea (Gen/L1/L2) + Turno", "proceso"),
            ("TOTAL", "Ingresa N Total Personal\n+ Registrado por", "proceso"),
            ("DISTRIBUIR", "Distribuye total entre areas/labores\n(inputs dinamicos)", "proceso"),
            ("VALIDA", "Suma distribucion\n= total declarado?", "decision"),
            ("CUSTOM?", "Agrega labores custom?\n-> tabla labores_custom", "proceso"),
            ("OBSERVACION", "Ingresa Observacion (textarea)", "proceso"),
            ("UPSERT BD", "supabase.upsert(registro_personal)\nonConflict: fecha+hora+linea", "supabase"),
            ("FIN OK", "Toast verde + refresh dashboard\n+ guarda 'registrado_por' en localStorage", "fin"),
        ],
        "datos": "fecha, hora, turno, fruta, linea, num_personal, distribucion (JSON), observacion, registrado_por",
        "validaciones": "- Campos obligatorios completos\n- Supabase conectado\n- Advertencia si distribucion != total",
        "feedback": "Toast 'Registro guardado correctamente' + 6 KPIs + 2 charts + recuerda registrado_por en localStorage",
    },
    {
        "nombre": "Registro de Tuneles IQF",
        "id": "registro-tuneles",
        "color": "cyan",
        "tag": "TUN",
        "proposito": "Controlar ciclos de congelamiento en 3 tuneles estaticos IQF (inicio/fin con calculo de eficiencia).",
        "tabla": "registro_tuneles",
        "conflict": "fecha + tunel + hora_inicio",
        "flujo": [
            ("INICIO", "Usuario abre app", "inicio"),
            ("AUTH", "auth-guard valida JWT", "decision"),
            ("VIEW", "Ver 3 cards Tunel\n(DISPONIBLE / CONGELANDO)", "proceso"),
            ("INICIAR", "PASO 1: Selecciona Tunel libre\n+ Fecha + Turno + Fruta", "proceso"),
            ("DATOS_INI", "Ingresa Hora Inicio + Coches\n+ Kg + Temp Ingreso + Operador", "proceso"),
            ("CONFLICTO?", "Tunel ya tiene\nciclo activo?", "decision"),
            ("INSERT_INI", "Insert con hora_fin = null\n-> Tunel pasa a CONGELANDO", "supabase"),
            ("MONITOR", "Timer en vivo: transcurrido\n+ tiempo restante", "proceso"),
            ("FINALIZAR", "PASO 2: Ingresa Temp Final\n+ Hora Fin (manual o now)", "proceso"),
            ("CALC", "Calcula hrs_congelamiento\n+ eficiencia = std/real x 100", "proceso"),
            ("UPDATE BD", "supabase.update(hora_fin,\ntemp_final, eficiencia)", "supabase"),
            ("FIN OK", "Toast verde + Card vuelve a DISPONIBLE\n+ refresh 9 KPIs + 6 charts", "fin"),
        ],
        "datos": "fecha, turno, tunel, fruta, hora_inicio, hora_fin, coches, kg, temp_ingreso, temp_final, hrs_congelamiento, eficiencia, operador",
        "validaciones": "- Fecha + hora_inicio obligatorios\n- Operador obligatorio\n- Solo un ciclo activo por tunel\n- Temp final requerida para finalizar",
        "feedback": "Toast cyan al iniciar / verde al finalizar + cards cambian color + timers en vivo + chips de filtro",
    },
    {
        "nombre": "Registro de Costos",
        "id": "registro-costos",
        "color": "amber",
        "tag": "COST",
        "proposito": "Configurar parametros de costo del dia (tarifa almuerzo, tipo cambio, costo HH, costo/kg).",
        "tabla": "config_costos",
        "conflict": "fecha + turno",
        "flujo": [
            ("INICIO", "Usuario abre app", "inicio"),
            ("AUTH", "auth-guard valida JWT", "decision"),
            ("CONTEXTO", "Selecciona Fecha + Turno + Fruta", "proceso"),
            ("MONEDA", "Ingresa Tarifa Almuerzo S/\n+ Tipo de Cambio", "proceso"),
            ("AUTOCALC1", "Tarifa USD = soles / TC\n(automatico)", "proceso"),
            ("HH", "Ingresa Costo Hora Hombre (S/)", "proceso"),
            ("KG", "Costo/Kg Congelado ($) auto\nde tabla DEFAULTS por fruta", "proceso"),
            ("MANUAL?", "Override manual\nde costo/kg?", "decision"),
            ("META", "Ingresa Registrado por\n+ Observacion", "proceso"),
            ("UPSERT BD", "supabase.upsert(config_costos)\nonConflict: fecha+turno", "supabase"),
            ("BROADCAST", "Dispara 'storage' event\npara que otras apps refresquen", "proceso"),
            ("FIN OK", "Toast verde + 6 KPIs + 2 charts\n+ tabla hora a hora", "fin"),
        ],
        "datos": "fecha, turno, fruta, tarifa_almuerzo_soles, tipo_cambio, tarifa_usd, costo_kg_congelado, costo_hora_hombre, registrado_por",
        "validaciones": "- Tarifa > 0\n- Tipo cambio > 0\n- Registrado_por no vacio\n- Supabase conectado",
        "feedback": "Toast 'Configuracion guardada' + 'storage' event + KPIs y vista previa se recalculan + toggle moneda S/ <-> $",
    },
    {
        "nombre": "Empaque Congelado",
        "id": "empaque-congelado",
        "color": "purple",
        "tag": "PACK",
        "proposito": "Registrar produccion del area de empaque congelado por hora (cajas, kg PT, productividad).",
        "tabla": "registro_empaque_congelado",
        "conflict": "fecha + hora + turno",
        "flujo": [
            ("INICIO", "Usuario abre app", "inicio"),
            ("AUTH", "auth-guard valida JWT", "decision"),
            ("CONTEXTO", "Selecciona Fecha + Turno Empaque\n+ Proceso (EMPAQUE/REEMPAQUE)\n+ Turno Origen", "proceso"),
            ("FRUTA", "Selecciona Fruta -> habilita Corte", "proceso"),
            ("TIPO", "Tipo (CONVENCIONAL/ORGANICO)\n+ Hora + KG Presentacion", "proceso"),
            ("CAJAS", "Ingresa N Cajas", "proceso"),
            ("AUTOCALC1", "KG PT = cajas x kg_pres", "proceso"),
            ("OPERARIOS", "Ingresa N Operarios", "proceso"),
            ("AUTOCALC2", "CJ/HRxOP = cajas / operarios", "proceso"),
            ("META", "Cliente + Lote MP + Trazabilidad\n+ Supervisor + Observacion", "proceso"),
            ("UPSERT BD", "supabase.upsert(registro_\nempaque_congelado)\nonConflict: fecha+hora+turno", "supabase"),
            ("FIN OK", "Toast verde + auto-avanza\nsiguiente slot horario", "fin"),
        ],
        "datos": "fecha, hora, turno, turno_origen, tipo_registro, fruta, tipo, corte, kg_presentacion, cajas, kg_pt, cj_hr_op, operarios, cliente, lote_mp, supervisor",
        "validaciones": "- Fruta obligatoria\n- Cajas > 0\n- KG presentacion > 0\n- Persiste supervisor/cliente en localStorage",
        "feedback": "Toast 'Registro de empaque guardado' + calcPreview en vivo + 6 KPIs + 3 charts + auto-avanza hora",
    },
    {
        "nombre": "PWA Captura de Temperaturas",
        "id": "temperaturas-pwa",
        "color": "azul",
        "tag": "TEMP",
        "proposito": "PWA movil para captura rapida de temperaturas con camara + OCR Gemini Vision en MP/Proceso/Empaque.",
        "tabla": "registros_temperatura",
        "conflict": "(insert con sync_offline_id UUID)",
        "flujo": [
            ("INICIO", "Usuario abre PWA en movil", "inicio"),
            ("SETUP?", "Es primera vez?\n(sin config local)", "decision"),
            ("CONFIG", "Ingresa URL Supabase + Anon Key\n+ Sede + Operario\n-> guarda en localStorage", "proceso"),
            ("AREAS", "fetchAreasActivas() de Supabase\n-> cache 24h en localStorage", "supabase"),
            ("HOME", "Home: turno automatico + chip online\n+ tabs MP/Proceso/Empaque\n+ cards de areas con ult. temp", "proceso"),
            ("ELIGE", "Toca card de area\n-> navega a capture", "proceso"),
            ("CAMARA", "Stream camara con guia visual\n+ shutter o 'Saltar foto'", "proceso"),
            ("OCR?", "Tomo foto?", "decision"),
            ("OCR EDGE", "Edge Function 'detect-temperatura'\nGemini Vision sugiere temp", "supabase"),
            ("CONFIRM", "Confirm screen: ajusta con +/-\n(stepTemp 0.1 grados C)", "proceso"),
            ("ESTADO", "calcEstado(temp, limite, critico)\n-> OK / ALERTA / CRITICO", "proceso"),
            ("META", "Accion tomada + Observaciones", "proceso"),
            ("ENCOLA", "OfflineQueue.enqueue()\n(siempre, garantiza no perdida)", "proceso"),
            ("ONLINE?", "Hay red?", "decision"),
            ("FLUSH BD", "supabase.insert(registros_\ntemperatura) con sync_offline_id", "supabase"),
            ("SUCCESS", "Success: resumen + foto\n+ chip Sincronizado/Pendiente", "fin"),
        ],
        "datos": "fecha (Lima TZ), hora, area, temperatura, estado, operario, turno, observaciones, sede_codigo, origen (pwa_ocr/manual), ocr_valor_detectado, ocr_confianza, sync_offline_id",
        "validaciones": "- Temperatura numero finito\n- calcEstado por limites del area\n- Cola offline (no perdida)\n- Permiso notificaciones no-bloqueante",
        "feedback": "Toast 'Conectado - N areas cargadas' + recordatorios horarios 3-capas + vibracion 40ms al capturar / 15ms al ajustar + tabs con contador X/Y areas",
    },
]

# ──────────────── Helpers de dibujo ────────────────

def draw_box(c, x, y, w, h, text, kind="proceso", font_size=8):
    text_color = COLORS["texto"]

    if kind == "inicio":
        fill = COLORS["verde"]
        text_color = white
        c.setFillColor(fill)
        c.setStrokeColor(fill)
        c.roundRect(x, y, w, h, 8, fill=1, stroke=1)
    elif kind == "fin":
        fill = COLORS["verde"]
        text_color = white
        c.setFillColor(fill)
        c.setStrokeColor(fill)
        c.roundRect(x, y, w, h, 8, fill=1, stroke=1)
    elif kind == "decision":
        fill = COLORS["amber_bg"]
        border = COLORS["amber"]
        cx, cy = x + w / 2, y + h / 2
        c.setFillColor(fill)
        c.setStrokeColor(border)
        c.setLineWidth(1.5)
        path = c.beginPath()
        path.moveTo(cx, y + h)
        path.lineTo(x + w, cy)
        path.lineTo(cx, y)
        path.lineTo(x, cy)
        path.close()
        c.drawPath(path, fill=1, stroke=1)
    elif kind == "supabase":
        fill = COLORS["azul_bg"]
        border = COLORS["azul"]
        c.setFillColor(fill)
        c.setStrokeColor(border)
        c.setLineWidth(2)
        c.roundRect(x, y, w, h, 4, fill=1, stroke=1)
    else:
        fill = COLORS["gris_bg"]
        border = COLORS["border"]
        c.setFillColor(fill)
        c.setStrokeColor(border)
        c.setLineWidth(1)
        c.roundRect(x, y, w, h, 4, fill=1, stroke=1)

    c.setFillColor(text_color)
    c.setFont("Helvetica-Bold" if kind in ("inicio", "fin") else "Helvetica", font_size)
    lines = text.split("\n")
    line_h = font_size * 1.2
    total_h = line_h * len(lines)
    start_y = y + h / 2 + (total_h / 2) - line_h * 0.8
    for i, ln in enumerate(lines):
        c.drawCentredString(x + w / 2, start_y - i * line_h, ln)


def draw_arrow(c, x1, y1, x2, y2, color=None):
    color = color or COLORS["muted"]
    c.setStrokeColor(color)
    c.setFillColor(color)
    c.setLineWidth(1.2)
    c.line(x1, y1, x2, y2)
    angle = math.atan2(y2 - y1, x2 - x1)
    arrow_len = 8
    ax1 = x2 - arrow_len * math.cos(angle - math.pi / 8)
    ay1 = y2 - arrow_len * math.sin(angle - math.pi / 8)
    ax2 = x2 - arrow_len * math.cos(angle + math.pi / 8)
    ay2 = y2 - arrow_len * math.sin(angle + math.pi / 8)
    path = c.beginPath()
    path.moveTo(x2, y2)
    path.lineTo(ax1, ay1)
    path.lineTo(ax2, ay2)
    path.close()
    c.drawPath(path, fill=1, stroke=0)


def wrap_text(text, max_chars):
    words = text.split(" ")
    lines = []
    cur = ""
    for w in words:
        if len(cur) + len(w) + 1 <= max_chars:
            cur = cur + " " + w if cur else w
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


# ──────────────── Página de app ────────────────

def draw_app_page(c, app, page_num, total):
    page_w, page_h = landscape(A4)
    margin = 1.2 * cm
    color = COLORS[app["color"]]
    color_bg = COLORS[app["color"] + "_bg"]

    # Header banner
    c.setFillColor(color)
    c.rect(0, page_h - 2.5 * cm, page_w, 2.5 * cm, fill=1, stroke=0)

    # Tag de la app (en lugar de emoji)
    c.setFillColor(white)
    c.setStrokeColor(white)
    c.setLineWidth(2)
    tag_x, tag_y = margin, page_h - 2.0 * cm
    c.roundRect(tag_x, tag_y, 1.5 * cm, 1.0 * cm, 4, fill=0, stroke=1)
    c.setFont("Helvetica-Bold", 12)
    c.drawCentredString(tag_x + 0.75 * cm, tag_y + 0.3 * cm, app["tag"])

    # Titulo
    c.setFont("Helvetica-Bold", 22)
    c.drawString(margin + 2 * cm, page_h - 1.4 * cm, app["nombre"])
    c.setFont("Helvetica", 10)
    c.drawString(margin + 2 * cm, page_h - 2.05 * cm,
                 f"apps/{app['id']}/   |   Tabla destino: {app['tabla']}")

    c.setFont("Helvetica", 9)
    c.drawRightString(page_w - margin, page_h - 1.4 * cm, f"Pagina {page_num} / {total}")
    c.drawRightString(page_w - margin, page_h - 2.05 * cm, "Frutos Tropicales Peru Export S.A.C.")

    # Proposito
    c.setFillColor(color_bg)
    c.rect(margin, page_h - 3.5 * cm, page_w - 2 * margin, 0.85 * cm, fill=1, stroke=0)
    c.setFillColor(COLORS["texto"])
    c.setFont("Helvetica-Bold", 9)
    c.drawString(margin + 0.2 * cm, page_h - 3.1 * cm, "PROPOSITO:")
    c.setFont("Helvetica", 9)
    c.drawString(margin + 2.5 * cm, page_h - 3.1 * cm, app["proposito"])

    # Diagrama de flujo
    flujo = app["flujo"]
    n = len(flujo)

    if n <= 10:
        cols = 5
    elif n <= 12:
        cols = 6
    else:
        cols = 8
    rows = (n + cols - 1) // cols

    diag_x = margin
    diag_y_top = page_h - 4 * cm
    diag_y_bot = 7.5 * cm
    diag_h = diag_y_top - diag_y_bot
    diag_w = page_w - 2 * margin

    box_w = (diag_w - (cols - 1) * 0.5 * cm) / cols
    box_h = min(2.0 * cm, (diag_h - (rows - 1) * 1.0 * cm) / rows)
    gap_x = 0.5 * cm
    gap_y = 1.0 * cm

    positions = []
    for i, (label, text, kind) in enumerate(flujo):
        row = i // cols
        col = i % cols
        if row % 2 == 1:
            col = cols - 1 - col
        x = diag_x + col * (box_w + gap_x)
        y = diag_y_top - (row + 1) * (box_h + gap_y) + gap_y
        positions.append((x, y, x + box_w, y + box_h))
        draw_box(c, x, y, box_w, box_h, text, kind, font_size=7)

    for i in range(n - 1):
        x1a, y1a, x1b, y1b = positions[i]
        x2a, y2a, x2b, y2b = positions[i + 1]
        cy1 = (y1a + y1b) / 2
        cy2 = (y2a + y2b) / 2
        cx1 = (x1a + x1b) / 2
        cx2 = (x2a + x2b) / 2
        row1 = i // cols
        row2 = (i + 1) // cols
        if row1 == row2:
            if row1 % 2 == 0:
                draw_arrow(c, x1b, cy1, x2a, cy2)
            else:
                draw_arrow(c, x1a, cy1, x2b, cy2)
        else:
            draw_arrow(c, cx1, y1a, cx2, y2b)

    # Footer 3 columnas
    foot_y = 6.5 * cm
    col_w = (page_w - 2 * margin - 1 * cm) / 3

    # Datos capturados
    c.setFillColor(COLORS["gris_bg"])
    c.rect(margin, 1.2 * cm, col_w, 5 * cm, fill=1, stroke=0)
    c.setFillColor(COLORS["texto"])
    c.setFont("Helvetica-Bold", 9)
    c.drawString(margin + 0.2 * cm, foot_y, "DATOS CAPTURADOS")
    c.setFont("Helvetica", 7.5)
    text_obj = c.beginText(margin + 0.2 * cm, foot_y - 0.4 * cm)
    text_obj.setLeading(10)
    for line in wrap_text(app["datos"], 50):
        text_obj.textLine(line)
    c.drawText(text_obj)

    # Validaciones
    val_x = margin + col_w + 0.5 * cm
    c.setFillColor(COLORS["amber_bg"])
    c.rect(val_x, 1.2 * cm, col_w, 5 * cm, fill=1, stroke=0)
    c.setFillColor(COLORS["texto"])
    c.setFont("Helvetica-Bold", 9)
    c.drawString(val_x + 0.2 * cm, foot_y, "VALIDACIONES")
    c.setFont("Helvetica", 7.5)
    text_obj = c.beginText(val_x + 0.2 * cm, foot_y - 0.4 * cm)
    text_obj.setLeading(10)
    for line in app["validaciones"].split("\n"):
        for sub in wrap_text(line, 50):
            text_obj.textLine(sub)
    c.drawText(text_obj)

    # Feedback
    fb_x = val_x + col_w + 0.5 * cm
    c.setFillColor(COLORS["verde_bg"])
    c.rect(fb_x, 1.2 * cm, col_w, 5 * cm, fill=1, stroke=0)
    c.setFillColor(COLORS["texto"])
    c.setFont("Helvetica-Bold", 9)
    c.drawString(fb_x + 0.2 * cm, foot_y, "FEEDBACK AL USUARIO")
    c.setFont("Helvetica", 7.5)
    text_obj = c.beginText(fb_x + 0.2 * cm, foot_y - 0.4 * cm)
    text_obj.setLeading(10)
    for line in wrap_text(app["feedback"], 50):
        text_obj.textLine(line)
    c.drawText(text_obj)

    # Footer linea
    c.setFillColor(COLORS["muted"])
    c.setFont("Helvetica-Oblique", 7)
    c.drawString(margin, 0.6 * cm, "Conflict-resolution: " + app["conflict"])
    c.drawCentredString(page_w / 2, 0.6 * cm, "Diagrama de Flujo - Apps FTP - 2026-04-23")
    c.drawRightString(page_w - margin, 0.6 * cm, "Generado con reportlab")


# ──────────────── Portada ────────────────

def draw_cover(c):
    page_w, page_h = landscape(A4)

    c.setFillColor(COLORS["verde"])
    c.rect(0, 0, page_w, page_h, fill=1, stroke=0)

    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 38)
    c.drawCentredString(page_w / 2, page_h - 5.5 * cm, "Diagramas de Flujo")
    c.setFont("Helvetica-Bold", 26)
    c.drawCentredString(page_w / 2, page_h - 7 * cm, "Apps del Portal FTP")

    c.setFont("Helvetica", 14)
    c.drawCentredString(page_w / 2, page_h - 8.3 * cm, "Frutos Tropicales Peru Export S.A.C.")

    c.setStrokeColor(white)
    c.setLineWidth(2)
    c.line(page_w / 3, page_h - 9.5 * cm, 2 * page_w / 3, page_h - 9.5 * cm)

    c.setFont("Helvetica-Bold", 13)
    apps_y = page_h - 11.5 * cm
    c.drawCentredString(page_w / 2, apps_y, "6 Aplicaciones documentadas:")

    c.setFont("Helvetica", 12)
    icons = ["[ PROD ] - Registro de Produccion",
             "[ PERS ] - Registro de Personal",
             "[ TUN  ] - Registro de Tuneles IQF",
             "[ COST ] - Registro de Costos",
             "[ PACK ] - Empaque Congelado",
             "[ TEMP ] - PWA Captura de Temperaturas"]
    for i, line in enumerate(icons):
        c.drawCentredString(page_w / 2, apps_y - 1 * cm - i * 0.7 * cm, line)

    c.setFont("Helvetica-Oblique", 9)
    c.drawCentredString(page_w / 2, 1.5 * cm, "Generado el 2026-04-23 - Documento de procesos para auditoria")


# ──────────────── Pagina resumen ────────────────

def draw_summary_page(c, total_pages):
    page_w, page_h = landscape(A4)
    margin = 1.5 * cm

    c.setFillColor(COLORS["azul"])
    c.rect(0, page_h - 2 * cm, page_w, 2 * cm, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 18)
    c.drawString(margin, page_h - 1.3 * cm, "Resumen consolidado")
    c.setFont("Helvetica", 9)
    c.drawRightString(page_w - margin, page_h - 1.3 * cm, f"Pagina {total_pages} / {total_pages}")

    c.setFillColor(COLORS["texto"])
    c.setFont("Helvetica-Bold", 10)
    y = page_h - 3 * cm
    headers = ["App", "Tag", "Tabla Supabase", "Conflict resolution", "Tipo"]
    col_xs = [margin, margin + 7 * cm, margin + 9 * cm, margin + 16 * cm, margin + 22 * cm]
    for i, h in enumerate(headers):
        c.drawString(col_xs[i], y, h)
    c.setStrokeColor(COLORS["border"])
    c.line(margin, y - 0.2 * cm, page_w - margin, y - 0.2 * cm)

    y -= 0.7 * cm
    c.setFont("Helvetica", 9)
    for app in APPS:
        c.setFillColor(COLORS[app["color"]])
        c.circle(col_xs[0] - 0.3 * cm, y + 0.1 * cm, 0.15 * cm, fill=1, stroke=0)
        c.setFillColor(COLORS["texto"])
        c.drawString(col_xs[0], y, app["nombre"])
        c.drawString(col_xs[1], y, app["tag"])
        c.drawString(col_xs[2], y, app["tabla"])
        c.drawString(col_xs[3], y, app["conflict"])
        tipo = "PWA movil" if app["id"] == "temperaturas-pwa" else "Web app"
        c.drawString(col_xs[4], y, tipo)
        y -= 0.7 * cm

    y -= 1 * cm
    c.setFillColor(COLORS["azul_bg"])
    c.rect(margin, y - 4.5 * cm, page_w - 2 * margin, 4.5 * cm, fill=1, stroke=0)
    c.setFillColor(COLORS["texto"])
    c.setFont("Helvetica-Bold", 11)
    c.drawString(margin + 0.3 * cm, y - 0.4 * cm, "Arquitectura comun")
    c.setFont("Helvetica", 9)

    notas = [
        "- Las 5 web apps comparten arquitectura: auth-guard.js (JWT Supabase) + app-base.css + app-utils.js + chart-helpers.js + sync-button.js.",
        "- Doble persistencia: localStorage (cache) + Supabase upsert con onConflict (idempotente).",
        "- Todas usan Supabase JS v2 via CDN con SRI hashes (Subresource Integrity).",
        "- Indicador de conexion Supabase con dot verde/rojo en topbar.",
        "- Toast notifications con feedback inmediato (verde OK / rojo error).",
        "- La PWA temperaturas-pwa tiene OfflineQueue: encola siempre, flush cuando hay red.",
        "- Audit log automatico en Supabase: trigger fn_audit_log_trigger captura cada INSERT/UPDATE/DELETE.",
        "- RLS estricto: anon SELECT only, authenticated escribe segun rol (admin/produccion/calidad/mantenimiento/rrhh).",
        "- CSP + SRI + security headers en todos los HTML files.",
    ]
    text_obj = c.beginText(margin + 0.3 * cm, y - 1 * cm)
    text_obj.setLeading(13)
    for n in notas:
        text_obj.textLine(n)
    c.drawText(text_obj)

    # Leyenda nodos
    leg_y = y - 5.5 * cm
    c.setFillColor(COLORS["texto"])
    c.setFont("Helvetica-Bold", 11)
    c.drawString(margin, leg_y, "Leyenda de nodos del flujo:")

    legend_items = [
        ("INICIO/FIN", "inicio"),
        ("Proceso", "proceso"),
        ("Decision", "decision"),
        ("Supabase", "supabase"),
    ]
    cur_x = margin
    leg_y2 = leg_y - 1 * cm
    for label, kind in legend_items:
        draw_box(c, cur_x, leg_y2, 3.5 * cm, 1.2 * cm, label, kind, font_size=9)
        cur_x += 4.5 * cm

    c.setFillColor(COLORS["muted"])
    c.setFont("Helvetica-Oblique", 8)
    c.drawCentredString(page_w / 2, 0.8 * cm,
                        "Diagramas de Flujo Apps FTP - 2026-04-23 - Confidencial - Solo uso interno")


# ──────────────── Build PDF ────────────────

def build_pdf():
    c = canvas.Canvas(OUTPUT_PDF, pagesize=landscape(A4))
    c.setTitle("Diagramas de Flujo - Apps FTP")
    c.setAuthor("Frutos Tropicales Peru Export S.A.C.")
    c.setSubject("Diagramas de flujo de las 6 aplicaciones del portal")
    c.setCreator("Generador automatico - Portal FTP")

    total_pages = len(APPS) + 2

    draw_cover(c)
    c.showPage()

    for i, app in enumerate(APPS):
        draw_app_page(c, app, i + 2, total_pages)
        c.showPage()

    draw_summary_page(c, total_pages)
    c.showPage()

    c.save()
    size_kb = os.path.getsize(OUTPUT_PDF) / 1024
    print(f"OK PDF generado: {OUTPUT_PDF}")
    print(f"Paginas: {total_pages}")
    print(f"Tamano: {size_kb:.1f} KB")


if __name__ == "__main__":
    build_pdf()
