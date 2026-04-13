#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
chatbot_whatsapp.py — Chatbot de WhatsApp para Frutos Tropicales Peru Export S.A.C.

Consulta datos en tiempo real desde Supabase y responde por WhatsApp.

Uso:
  python chatbot_whatsapp.py

Comandos disponibles (escribir por WhatsApp):
  stock          → Stock actual de materia prima
  temperaturas   → Ultimas temperaturas registradas hoy
  alertas        → Alertas de temperatura fuera de rango
  produccion     → Resumen de produccion del dia
  registros      → Cantidad de registros de hoy
  inspectores    → Inspectores activos hoy
  ayuda / help   → Lista de comandos disponibles

Desarrollado por: Rodrigo Garcia — Systems Analyst & Developer-QA
"""

import json
import os
import re
import tempfile
from datetime import datetime, timedelta
from flask import Flask, request
from twilio.twiml.messaging_response import MessagingResponse
import requests as req
import whisper

# ══════════════════════════════════════════════════════════════
# CONFIGURACION
# ══════════════════════════════════════════════════════════════

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(SCRIPT_DIR, 'config_reportes.json')

with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
    CONFIG = json.load(f)

SB_URL = CONFIG['supabase_url']
SB_KEY = CONFIG['supabase_key']
SB_HEADERS = {
    'apikey': SB_KEY,
    'Authorization': f'Bearer {SB_KEY}',
    'Content-Type': 'application/json'
}

# Supabase del Portal de Produccion (segunda instancia)
SB_PROD_URL = 'https://rslzosmeteyzxmgfkppe.supabase.co'
SB_PROD_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzbHpvc21ldGV5enhtZ2ZrcHBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0OTc5NTgsImV4cCI6MjA5MDA3Mzk1OH0.XwitsLRWq10UsYshg_m2ViZh4BnV48zkJCK-JsRa9cs'
SB_PROD_HEADERS = {
    'apikey': SB_PROD_KEY,
    'Authorization': f'Bearer {SB_PROD_KEY}',
    'Content-Type': 'application/json'
}

app = Flask(__name__)

# Configurar ffmpeg para whisper
FFMPEG_DIR = os.path.dirname(__import__('imageio_ffmpeg').get_ffmpeg_exe())
os.environ['PATH'] = FFMPEG_DIR + os.pathsep + os.environ.get('PATH', '')

# Cargar modelo Whisper (base = rapido y ligero, ~140MB)
print('Cargando modelo Whisper para reconocimiento de voz...')
whisper_model = whisper.load_model('base')
print('Modelo Whisper cargado OK')

# ══════════════════════════════════════════════════════════════
# TRANSCRIPCION DE AUDIO
# ══════════════════════════════════════════════════════════════

def transcribir_audio(media_url):
    """Descarga audio de WhatsApp y lo convierte a texto con Whisper."""
    try:
        # Descargar audio desde Twilio (con autenticacion)
        print(f'[AUDIO] Descargando: {media_url[:60]}...')
        resp = req.get(media_url, auth=(CONFIG['twilio_sid'], CONFIG['twilio_token']), timeout=30)
        print(f'[AUDIO] Status: {resp.status_code} | Size: {len(resp.content)} bytes | Type: {resp.headers.get("content-type", "?")}')

        if not resp.ok or len(resp.content) < 100:
            print(f'[AUDIO] Error descargando: {resp.status_code}')
            return None

        # Guardar en archivo temporal
        with tempfile.NamedTemporaryFile(suffix='.ogg', delete=False, dir=tempfile.gettempdir()) as tmp:
            tmp.write(resp.content)
            tmp_path = tmp.name
            print(f'[AUDIO] Guardado en: {tmp_path}')

        # Transcribir con Whisper
        print(f'[AUDIO] Transcribiendo con Whisper...')
        result = whisper_model.transcribe(tmp_path, language='es', fp16=False)
        texto = result.get('text', '').strip()
        print(f'[AUDIO] Resultado: "{texto}"')

        # Limpiar archivo temporal
        try:
            os.unlink(tmp_path)
        except Exception:
            pass

        return texto if texto else None
    except Exception as e:
        print(f'[AUDIO] Error transcribiendo: {e}')
        import traceback
        traceback.print_exc()
        return None

# ══════════════════════════════════════════════════════════════
# FUNCIONES DE CONSULTA A SUPABASE
# ══════════════════════════════════════════════════════════════

def get_fecha_hoy():
    """Retorna la fecha de hoy en formato YYYY-MM-DD (Lima timezone)."""
    now = datetime.utcnow() - timedelta(hours=5)  # UTC-5 Lima
    return now.strftime('%Y-%m-%d')

def get_hora_lima():
    """Retorna la hora actual de Lima."""
    now = datetime.utcnow() - timedelta(hours=5)
    return now.strftime('%H:%M')

def format_fecha(fecha_str):
    parts = fecha_str.split('-')
    return f'{parts[2]}/{parts[1]}/{parts[0]}'

def supabase_get(endpoint, params=''):
    """Consulta GET a Supabase (temperaturas)."""
    url = f"{SB_URL}/rest/v1/{endpoint}?{params}"
    try:
        resp = req.get(url, headers=SB_HEADERS, timeout=15)
        if resp.ok:
            return resp.json()
        return []
    except Exception:
        return []


def supabase_prod_get(endpoint, params=''):
    """Consulta GET a Supabase de Produccion."""
    url = f"{SB_PROD_URL}/rest/v1/{endpoint}?{params}"
    try:
        resp = req.get(url, headers=SB_PROD_HEADERS, timeout=15)
        if resp.ok:
            return resp.json()
        return []
    except Exception:
        return []


def get_firma():
    """Retorna la firma para agregar al final de cada respuesta."""
    return [
        '',
        '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬',
        '🏭 _Frutos Tropicales Peru Export S.A.C._',
        'Desarrollado por: *Rodrigo Garcia*',
        '_Systems Analyst & Developer-QA_',
    ]

# ── CONSULTAS ESPECIFICAS ──

def consultar_temperaturas():
    """Ultimas temperaturas registradas hoy, separadas por area."""
    fecha = get_fecha_hoy()
    data = supabase_get('registros_temperatura', f'fecha=eq.{fecha}&order=hora.desc&limit=500')

    if not data:
        return '🌡️ *Temperaturas de hoy*\n\nNo hay registros de temperatura para hoy.'

    # Definir grupos de areas
    grupos = {
        '🧊 CAMARAS DE MATERIA PRIMA': [
            'CAMARA MP', 'CAMARA DE MATERIA PRIMA',
            'PRODUCTO MP', 'TEMPERATURA DE PRODUCTO(MP)',
            'REEFER 1', 'REEFER 2', 'REEFER 3', 'REEFER 4', 'REEFER 5',
            'REEFER 6', 'REEFER 7', 'REEFER 8', 'REEFER 9', 'REEFER 10',
        ],
        '🏭 SALA DE PROCESO': [
            'ACONDICIONADO', 'EMBANDEJADO',
            'LAVADO DE BANDEJAS', 'PRE-ENFRIADO', 'PRE ENFRIADO',
        ],
        '📦 SALA DE EMPAQUE': [
            'TEMPERATURA PRODUCTO', 'EMPAQUE',
            'CAMARA DE PRODUCTO TERMINADO', 'DESPACHO',
        ],
    }

    # Agrupar por area (ultima lectura de cada area)
    areas = {}
    for r in data:
        area = r.get('area', 'Desconocida')
        if area not in areas:
            areas[area] = r

    lines = [
        '🤖 *Chatbot de FTP*',
        '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬',
        f'🌡️ *Temperaturas - {format_fecha(fecha)}*',
        f'🕐 Ultima actualizacion: {get_hora_lima()}',
        '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬',
    ]

    for grupo_nombre, grupo_areas in grupos.items():
        grupo_data = {a: areas[a] for a in grupo_areas if a in areas}
        if not grupo_data:
            continue

        lines.append('')
        lines.append(f'*{grupo_nombre}*')
        lines.append('▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬')

        for area, r in grupo_data.items():
            temp = r.get('temperatura', '—')
            hora = r.get('hora', '—')[:5] if r.get('hora') else '—'
            estado = r.get('estado', '')

            if estado == 'NORMAL' or estado == 'OK':
                emoji = '✅'
            elif estado == 'ALERTA' or estado == 'FUERA DE RANGO':
                emoji = '🔴'
            else:
                emoji = '🟡'

            lines.append(f'{emoji} {area}: *{temp}°C* ({hora}h)')

    # Areas que no estan en ningun grupo
    todas_agrupadas = []
    for g in grupos.values():
        todas_agrupadas.extend(g)
    otras = {a: r for a, r in areas.items() if a not in todas_agrupadas}
    if otras:
        lines.append('')
        lines.append('*📋 OTRAS AREAS*')
        for area, r in otras.items():
            temp = r.get('temperatura', '—')
            hora = r.get('hora', '—')[:5] if r.get('hora') else '—'
            lines.append(f'🟡 {area}: *{temp}°C* ({hora}h)')

    lines.append('')
    lines.append(f'📊 {len(areas)} areas monitoreadas')
    lines.extend(get_firma())

    return '\n'.join(lines)


def consultar_alertas():
    """Alertas de temperatura fuera de rango hoy."""
    fecha = get_fecha_hoy()
    data = supabase_get('registros_temperatura', f'fecha=eq.{fecha}&order=hora.desc&limit=500')

    if not data:
        return '⚠️ *Alertas*\n\nNo hay registros hoy.'

    # Filtrar alertas
    alertas = [r for r in data if r.get('estado') in ('ALERTA', 'FUERA DE RANGO', 'CRITICO')]

    lines = [
        '🤖 *Chatbot de FTP*',
        '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬',
        f'⚠️ *Alertas de Temperatura*',
        f'📅 {format_fecha(fecha)}',
        '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬',
        '',
    ]

    if not alertas:
        lines.append('✅ *Sin alertas* — Todas las temperaturas dentro de rango.')
        lines.append(f'📊 {len(data)} registros verificados.')
    else:
        lines.append(f'🔴 *{len(alertas)} alertas detectadas:*')
        lines.append('')
        for a in alertas[:10]:  # Maximo 10
            area = a.get('area', '—')
            temp = a.get('temperatura', '—')
            hora = a.get('hora', '—')[:5] if a.get('hora') else '—'
            lines.append(f'  🚨 {area}: {temp}°C a las {hora}h')

        if len(alertas) > 10:
            lines.append(f'  ... y {len(alertas) - 10} mas.')

    lines.extend(get_firma())
    return '\n'.join(lines)


def consultar_registros():
    """Cantidad de registros de temperatura hoy."""
    fecha = get_fecha_hoy()
    data = supabase_get('registros_temperatura', f'fecha=eq.{fecha}&select=id,area,turno&limit=5000')

    if not data:
        return '📋 *Registros*\n\nNo hay registros hoy.'

    # Contar por turno
    dia = len([r for r in data if r.get('turno') == 'DIA' or r.get('turno') == 'TURNO DIA (06:00-17:00)'])
    noche = len([r for r in data if r.get('turno') == 'NOCHE' or r.get('turno') == 'TURNO NOCHE (18:00-05:00)'])

    # Contar por area
    areas = {}
    for r in data:
        a = r.get('area', 'Otro')
        areas[a] = areas.get(a, 0) + 1

    lines = [
        '🤖 *Chatbot de FTP*',
        '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬',
        f'📋 *Registros de Hoy*',
        f'📅 {format_fecha(fecha)}',
        '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬',
        '',
        f'📊 *Total: {len(data)} registros*',
        f'☀️ Turno Dia: {dia}',
        f'🌙 Turno Noche: {noche}',
        '',
        '*Por area:*',
    ]

    for area, count in sorted(areas.items(), key=lambda x: -x[1]):
        lines.append(f'  • {area}: {count}')

    lines.extend(get_firma())
    return '\n'.join(lines)


def consultar_inspectores():
    """Inspectores que han registrado hoy."""
    fecha = get_fecha_hoy()
    data = supabase_get('registros_temperatura', f'fecha=eq.{fecha}&select=operario,area&limit=5000')

    if not data:
        return '👤 *Inspectores*\n\nNo hay registros hoy.'

    # Contar registros por inspector
    inspectores = {}
    for r in data:
        op = r.get('operario', 'Desconocido')
        if op:
            inspectores[op] = inspectores.get(op, 0) + 1

    lines = [
        '🤖 *Chatbot de FTP*',
        '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬',
        f'👤 *Inspectores Activos Hoy*',
        f'📅 {format_fecha(fecha)}',
        '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬',
        '',
    ]

    for op, count in sorted(inspectores.items(), key=lambda x: -x[1]):
        lines.append(f'  👤 *{op}*: {count} registros')

    lines.append(f'\n📊 Total: {len(inspectores)} inspectores activos')

    lines.extend(get_firma())
    return '\n'.join(lines)


def consultar_stock():
    """Informacion de stock / materia prima."""
    fecha = get_fecha_hoy()

    # Consultar registros de areas de materia prima
    areas_mp = ['CAMARA MP', 'CAMARA DE MATERIA PRIMA', 'TEMPERATURA DE PRODUCTO(MP)',
                'REEFER 1', 'REEFER 2', 'REEFER 3', 'REEFER 4', 'REEFER 5',
                'REEFER 6', 'REEFER 7', 'REEFER 8', 'REEFER 9', 'REEFER 10']

    data = supabase_get('registros_temperatura',
                        f'fecha=eq.{fecha}&order=hora.desc&limit=500')

    if not data:
        return '📦 *Stock / Materia Prima*\n\nNo hay datos de materia prima para hoy.'

    mp_data = [r for r in data if r.get('area') in areas_mp]

    lines = [
        '🤖 *Chatbot de FTP*',
        '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬',
        f'📦 *Materia Prima - Camaras y Reefers*',
        f'📅 {format_fecha(fecha)}',
        '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬',
        '',
    ]

    # Ultimas temperaturas de cada camara/reefer
    seen = {}
    for r in mp_data:
        area = r.get('area')
        if area not in seen:
            seen[area] = r

    if seen:
        for area, r in seen.items():
            temp = r.get('temperatura', '—')
            hora = r.get('hora', '—')[:5] if r.get('hora') else '—'
            lines.append(f'🧊 *{area}*: {temp}°C ({hora}h)')
    else:
        lines.append('Sin datos de camaras/reefers hoy.')

    lines.append(f'\n📊 {len(mp_data)} registros de materia prima hoy')

    lines.extend(get_firma())
    return '\n'.join(lines)


def _emoji_fruta(fruta):
    """Retorna emoji segun la fruta."""
    f = fruta.upper()
    if 'MANGO' in f: return '🥭'
    if 'ARANDANO' in f or 'ARÁNDANO' in f: return '🫐'
    if 'FRESA' in f: return '🍓'
    if 'GRANADA' in f: return '🪴'
    if 'PIÑA' in f or 'PINA' in f: return '🍍'
    if 'PALTA' in f: return '🥑'
    return '🍎'


def _render_turno_block(registros, turno_label, emoji):
    """Genera bloque de texto para un turno (DIA o NOCHE)."""
    if not registros:
        return []

    # Agrupar por fruta dentro del turno
    frutas = {}
    for r in registros:
        fruta = r.get('fruta', 'Sin fruta')
        if fruta not in frutas:
            frutas[fruta] = {'consumo': 0, 'pt': 0, 'regs': 0, 'ultimo': r, 'supervisor': ''}
        frutas[fruta]['consumo'] += float(r.get('consumo_kg', 0) or 0)
        frutas[fruta]['pt'] += float(r.get('pt_aprox_kg', 0) or 0)
        frutas[fruta]['regs'] += 1
        frutas[fruta]['supervisor'] = r.get('supervisor', '') or frutas[fruta]['supervisor']

    turno_consumo = sum(v['consumo'] for v in frutas.values())
    turno_pt = sum(v['pt'] for v in frutas.values())
    turno_rend = (turno_pt / turno_consumo * 100) if turno_consumo > 0 else 0

    lines = [
        '',
        f'{emoji} *TURNO {turno_label}* ({len(registros)} registros)',
        '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬',
    ]

    for fruta, info in frutas.items():
        ef = _emoji_fruta(fruta)
        rend = (info['pt'] / info['consumo'] * 100) if info['consumo'] > 0 else 0
        lines.append(f'  {ef} *{fruta}*')
        lines.append(f'     📥 Procesado: *{info["consumo"]:,.0f} kg* ({info["consumo"]/1000:.2f} TN)')
        lines.append(f'     📦 PT: *{info["pt"]:,.0f} kg* ({info["pt"]/1000:.2f} TN)')
        lines.append(f'     📊 Rend: *{rend:.1f}%*')
        if info['supervisor']:
            lines.append(f'     👤 Supervisor: {info["supervisor"]}')

    lines.append('')
    lines.append(f'  📋 *Subtotal {turno_label}:*')
    lines.append(f'     📥 Procesado: *{turno_consumo:,.0f} kg* ({turno_consumo/1000:.2f} TN)')
    lines.append(f'     📦 PT: *{turno_pt:,.0f} kg* ({turno_pt/1000:.2f} TN)')
    lines.append(f'     📊 Rend: *{turno_rend:.1f}%*')

    return lines, turno_consumo, turno_pt


def consultar_produccion():
    """Avance de produccion del dia en tiempo real, separado por turnos."""
    fecha = get_fecha_hoy()
    data = supabase_prod_get('registro_produccion', f'fecha=eq.{fecha}&order=hora.asc&limit=500')

    if not data:
        return '🤖 *Chatbot de FTP*\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n🏭 *Avance de Produccion*\n\nNo hay registros de produccion para hoy.'

    lines = [
        '🤖 *Chatbot de FTP*',
        '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬',
        f'🏭 *Avance de Produccion*',
        f'📅 {format_fecha(fecha)} - {get_hora_lima()}h',
        '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬',
    ]

    # Separar por turno
    dia_recs = [r for r in data if r.get('turno', '').upper() == 'DIA']
    noche_recs = [r for r in data if r.get('turno', '').upper() == 'NOCHE']

    total_consumo = 0
    total_pt = 0

    # Bloque TURNO DIA
    if dia_recs:
        dia_lines, dia_consumo, dia_pt = _render_turno_block(dia_recs, 'DIA', '☀️')
        lines.extend(dia_lines)
        total_consumo += dia_consumo
        total_pt += dia_pt

    # Bloque TURNO NOCHE
    if noche_recs:
        noche_lines, noche_consumo, noche_pt = _render_turno_block(noche_recs, 'NOCHE', '🌙')
        lines.extend(noche_lines)
        total_consumo += noche_consumo
        total_pt += noche_pt

    # TOTAL GENERAL
    total_rend = (total_pt / total_consumo * 100) if total_consumo > 0 else 0
    lines.append('')
    lines.append('▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬')
    lines.append(f'🏭 *TOTAL GENERAL*')
    lines.append(f'📥 Procesado: *{total_consumo:,.0f} kg* ({total_consumo/1000:.2f} TN)')
    lines.append(f'📦 PT Producido: *{total_pt:,.0f} kg* ({total_pt/1000:.2f} TN)')
    lines.append(f'📊 Rendimiento: *{total_rend:.1f}%*')
    lines.append(f'📝 Total registros: {len(data)}')

    lines.extend(get_firma())
    return '\n'.join(lines)


def mostrar_ayuda():
    """Muestra comandos disponibles."""
    return (
        '🤖 *Chatbot de FTP*\n'
        '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n'
        'Escribe cualquiera de estos comandos:\n'
        '\n'
        '🌡️ *temperaturas* — Ultimas temperaturas de hoy\n'
        '⚠️ *alertas* — Alertas fuera de rango\n'
        '📋 *registros* — Cantidad de registros hoy\n'
        '👤 *inspectores* — Inspectores activos hoy\n'
        '📦 *stock* — Estado de camaras y reefers\n'
        '🏭 *produccion* — Avance de produccion en tiempo real\n'
        '❓ *menu* — Ver este menu\n'
        '\n'
        '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n'
        '🏭 _Frutos Tropicales Peru Export S.A.C._\n'
        'Desarrollado por: *Rodrigo Garcia*\n'
        '_Systems Analyst & Developer-QA_'
    )


# ══════════════════════════════════════════════════════════════
# PROCESADOR DE MENSAJES
# ══════════════════════════════════════════════════════════════

def procesar_mensaje(texto):
    """Procesa el mensaje recibido y retorna la respuesta."""
    msg = texto.strip().lower()

    # Limpiar caracteres especiales
    msg = re.sub(r'[^\w\sáéíóúñ]', '', msg).strip()

    # Mapear comandos
    if any(w in msg for w in ['temperatura', 'temp', 'frio', 'calor', 'grados']):
        return consultar_temperaturas()

    elif any(w in msg for w in ['alerta', 'alarma', 'fuera', 'rango', 'peligro']):
        return consultar_alertas()

    elif any(w in msg for w in ['registro', 'registros', 'cuantos', 'cantidad']):
        return consultar_registros()

    elif any(w in msg for w in ['inspector', 'inspectores', 'operario', 'quien', 'quién']):
        return consultar_inspectores()

    elif any(w in msg for w in ['stock', 'materia', 'prima', 'camara', 'cámara', 'reefer', 'tonelada']):
        return consultar_stock()

    elif any(w in msg for w in ['produccion', 'producción', 'avance', 'avanza', 'avans', 'abanse', 'avanse', 'abance', 'abanc', 'avanz', 'avanc', 'abanz', 'bance', 'vance', 'banse', 'vanse', 'planta', 'proceso', 'mango', 'arandano', 'arándano', 'granada', 'fresa', 'congelado', 'linea', 'línea', 'cuanto', 'cuánto', 'tonelada', 'rendimiento', 'fruta', 'producci', 'produc']):
        return consultar_produccion()

    elif any(w in msg for w in ['menu', 'menú', 'ayuda', 'help', 'comandos', 'hola', 'hi', 'buenas', 'inicio']):
        return mostrar_ayuda()

    else:
        return (
            f'🤖 No entendi tu mensaje: "_{texto}_"\n\n'
            'Escribe *menu* para ver los comandos disponibles.'
        )


# ══════════════════════════════════════════════════════════════
# WEBHOOK FLASK
# ══════════════════════════════════════════════════════════════

@app.route('/webhook', methods=['POST'])
def webhook():
    """Recibe mensajes de WhatsApp via Twilio (texto o audio)."""
    incoming_msg = request.values.get('Body', '')
    from_number = request.values.get('From', '')
    num_media = int(request.values.get('NumMedia', 0))

    # Si hay audio o media, procesarlo
    if num_media > 0:
        media_type = request.values.get('MediaContentType0', '')
        media_url = request.values.get('MediaUrl0', '')
        print(f'[MEDIA] Tipo: {media_type} | URL: {media_url}')

        # Aceptar cualquier tipo de audio (ogg, mp3, wav, opus, etc)
        if 'audio' in media_type or 'ogg' in media_type or 'opus' in media_type or 'voice' in media_type:
            print(f'[AUDIO] Descargando y transcribiendo...')
            texto_audio = transcribir_audio(media_url)

            if texto_audio:
                print(f'[AUDIO -> TEXTO] "{texto_audio}"')
                incoming_msg = texto_audio
            else:
                resp = MessagingResponse()
                resp.message('No pude entender el audio. Intenta de nuevo o escribe *menu*.')
                return str(resp)
        else:
            # Si no es audio, intentar transcribir de todas formas
            print(f'[MEDIA] Tipo no reconocido como audio: {media_type}, intentando transcribir...')
            texto_audio = transcribir_audio(media_url)
            if texto_audio:
                print(f'[MEDIA -> TEXTO] "{texto_audio}"')
                incoming_msg = texto_audio
            elif incoming_msg:
                pass  # Usar el texto del body si hay
            else:
                resp = MessagingResponse()
                resp.message('Solo acepto mensajes de texto o audio de voz. Escribe *menu* para ver comandos.')
                return str(resp)

    print(f'[MSG] De: {from_number} | Mensaje: {incoming_msg}')

    # Procesar y responder
    respuesta = procesar_mensaje(incoming_msg)

    resp = MessagingResponse()
    resp.message(respuesta)

    print(f'[RSP] Enviado: {len(respuesta)} caracteres')
    return str(resp)


@app.route('/health', methods=['GET'])
def health():
    """Health check."""
    return {'status': 'ok', 'bot': 'Frutos Tropicales Chatbot', 'time': get_hora_lima()}


# ══════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════

if __name__ == '__main__':
    import sys, io, time, threading
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

    print('====================================')
    print('CHATBOT WHATSAPP - FRUTOS TROPICALES')
    print('====================================')
    print(f'Fecha: {format_fecha(get_fecha_hoy())} - {get_hora_lima()}')
    print(f'Supabase: {SB_URL[:40]}...')
    print()

    # ── Dominio estatico de ngrok (no cambia entre reinicios) ──
    # Si tienes un dominio reservado en ngrok, ponlo aqui.
    # Para obtener uno gratis: https://dashboard.ngrok.com/domains
    # Ejemplo: NGROK_STATIC_DOMAIN = 'tu-dominio.ngrok-free.dev'
    NGROK_STATIC_DOMAIN = os.environ.get('NGROK_DOMAIN', '')

    # Iniciar ngrok para exponer el webhook
    ngrok_url = None
    try:
        from pyngrok import ngrok

        if NGROK_STATIC_DOMAIN:
            public_url = ngrok.connect(5000, domain=NGROK_STATIC_DOMAIN)
        else:
            public_url = ngrok.connect(5000)

        ngrok_url = str(public_url)
        webhook_url = f'{ngrok_url}/webhook'

        print(f'ngrok URL: {ngrok_url}')
        print(f'Webhook URL: {webhook_url}')
        if not NGROK_STATIC_DOMAIN:
            print()
            print('⚠️  URL DINAMICA — Cada reinicio genera una URL nueva.')
            print('   Para URL fija, reserva un dominio gratis en:')
            print('   https://dashboard.ngrok.com/domains')
            print('   y setea la variable NGROK_DOMAIN en iniciar_chatbot.bat')
        print()
    except Exception as e:
        print(f'[!] ngrok no disponible: {e}')
        print('    El servidor correra en localhost:5000')
        print()

    # ── Healthcheck: monitoreo automatico para detectar caidas ──
    def healthcheck_loop():
        """Verifica cada 30s que el tunel ngrok sigue activo."""
        while True:
            time.sleep(30)
            try:
                r = req.get('http://localhost:5000/health', timeout=5)
                if not r.ok:
                    print(f'[HEALTH] ⚠️ Servidor no responde: {r.status_code}')
            except Exception as e:
                print(f'[HEALTH] ❌ Error: {e}')

            # Verificar tunel ngrok
            try:
                r = req.get('http://localhost:4040/api/tunnels', timeout=5)
                if r.ok:
                    tunnels = r.json().get('tunnels', [])
                    if not tunnels:
                        print('[HEALTH] ❌ ngrok sin tuneles activos — reconectando...')
                        try:
                            from pyngrok import ngrok as ng
                            if NGROK_STATIC_DOMAIN:
                                ng.connect(5000, domain=NGROK_STATIC_DOMAIN)
                            else:
                                ng.connect(5000)
                            print('[HEALTH] ✅ ngrok reconectado')
                        except Exception as e2:
                            print(f'[HEALTH] ❌ No se pudo reconectar ngrok: {e2}')
            except Exception:
                pass

    hc_thread = threading.Thread(target=healthcheck_loop, daemon=True)
    hc_thread.start()
    print('[HEALTH] Monitoreo automatico activado (cada 30s)')

    print('Servidor iniciado en http://localhost:5000')
    print('Escuchando mensajes de WhatsApp...')
    print('Ctrl+C para detener')
    print()

    app.run(port=5000, debug=False)
