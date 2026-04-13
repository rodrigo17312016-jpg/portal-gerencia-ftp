#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
reporte_auto.py — Generador automatico de reportes de temperatura en PDF + envio por email.

Usa Chrome headless para abrir reporte_frio.html y exportar el PDF
identico al que genera el boton "Imprimir / PDF" de la pagina.

Uso:
  python reporte_auto.py --turno DIA              # Genera y envia reportes del turno dia (fecha de hoy)
  python reporte_auto.py --turno NOCHE             # Genera y envia reportes del turno noche
  python reporte_auto.py --turno DIA --fecha 2026-03-27  # Fecha especifica
  python reporte_auto.py --turno DIA --solo-pdf    # Solo genera PDFs, no envia email

Desarrollado por: Rodrigo Garcia — Systems Analyst & Developer-QA
"""

import argparse
import base64
import json
import os
import smtplib
import time
import requests
from datetime import datetime, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC

# ══════════════════════════════════════════════════════════════
# CONFIGURACION
# ══════════════════════════════════════════════════════════════

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(SCRIPT_DIR, 'config_reportes.json')
HTML_PATH = os.path.join(SCRIPT_DIR, 'reporte_frio.html')

# Mapeo de formatos por turno
FORMATOS_DIA = [
    {'key': 'materia-prima', 'nombre': 'Camaras de Materia Prima', 'archivo': 'CamarasMP', 'landscape': True},
    {'key': 'proceso', 'nombre': 'Sala de Proceso', 'archivo': 'SalaProceso', 'landscape': False},
    {'key': 'empaque', 'nombre': 'Sala de Empaque', 'archivo': 'SalaEmpaque', 'landscape': False},
]

FORMATOS_NOCHE = [
    {'key': 'proceso', 'nombre': 'Sala de Proceso', 'archivo': 'SalaProceso', 'landscape': False},
    {'key': 'empaque', 'nombre': 'Sala de Empaque', 'archivo': 'SalaEmpaque', 'landscape': False},
]


def load_config():
    with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
        return json.load(f)


def format_fecha(fecha_str):
    parts = fecha_str.split('-')
    return f'{parts[2]}/{parts[1]}/{parts[0]}'

# ══════════════════════════════════════════════════════════════
# CHROME HEADLESS — PDF GENERATION
# ══════════════════════════════════════════════════════════════

def crear_driver():
    """Crea una instancia de Chrome headless."""
    options = Options()
    options.add_argument('--headless=new')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--disable-gpu')
    options.add_argument('--window-size=1400,900')
    # Permitir acceso a archivos locales con fetch
    options.add_argument('--allow-file-access-from-files')
    options.add_argument('--disable-web-security')

    driver = webdriver.Chrome(options=options)
    return driver


def esperar_carga(driver, timeout=15):
    """Espera a que los datos se carguen verificando el mensaje de status."""
    try:
        WebDriverWait(driver, timeout).until(
            lambda d: 'registros cargados' in d.find_element(By.ID, 'statusMsg').text
            or 'cargados' in d.find_element(By.ID, 'statusMsg').text.lower()
        )
        return True
    except Exception:
        # Intentar verificar si hay datos en la tabla
        time.sleep(3)
        return False


def generar_pdf_chrome(driver, landscape=False):
    """Usa Chrome DevTools Protocol para generar PDF."""
    # Configurar parametros de impresion
    params = {
        'printBackground': True,
        'preferCSSPageSize': True,
        'marginTop': 0,
        'marginBottom': 0,
        'marginLeft': 0,
        'marginRight': 0,
    }

    if landscape:
        params['landscape'] = True
        params['paperWidth'] = 11.69   # A4 landscape
        params['paperHeight'] = 8.27
        params['marginTop'] = 0.2
        params['marginBottom'] = 0.2
        params['marginLeft'] = 0.2
        params['marginRight'] = 0.2
    else:
        params['landscape'] = False
        params['paperWidth'] = 8.27    # A4 portrait
        params['paperHeight'] = 11.69
        params['marginTop'] = 0
        params['marginBottom'] = 0
        params['marginLeft'] = 0
        params['marginRight'] = 0

    result = driver.execute_cdp_cmd('Page.printToPDF', params)
    return base64.b64decode(result['data'])


def generar_reportes(fecha_str, turno, output_dir):
    """Genera PDFs usando Chrome headless. DIA=3 formatos, NOCHE=2 formatos."""
    formatos = FORMATOS_DIA if turno == 'DIA' else FORMATOS_NOCHE
    print(f'[...] Iniciando Chrome headless ({len(formatos)} formatos)...')
    driver = crear_driver()
    pdf_paths = []
    resumen = {}

    try:
        for fmt in formatos:
            print(f'[...] Generando {fmt["nombre"]}...')

            # Navegar a la pagina (recargar para cada formato limpio)
            file_url = 'file:///' + HTML_PATH.replace('\\', '/')
            driver.get(file_url)
            time.sleep(2)  # Esperar carga inicial

            # Configurar fecha
            fecha_input = driver.find_element(By.ID, 'ctrlFecha')
            driver.execute_script(
                f"document.getElementById('ctrlFecha').value = '{fecha_str}';"
            )

            # Configurar turno
            turno_select = Select(driver.find_element(By.ID, 'ctrlTurno'))
            turno_select.select_by_value(turno)

            # Cambiar al formato correspondiente
            driver.execute_script(f"switchFormat('{fmt['key']}')")
            time.sleep(1)

            # Esperar auto-seleccion de inspector
            time.sleep(2)

            # Hacer clic en "Cargar datos"
            btn_load = driver.find_element(By.CSS_SELECTOR, '.btn-load')
            btn_load.click()

            # Esperar a que carguen los datos
            cargado = esperar_carga(driver, timeout=15)

            # Obtener info del status
            status_text = driver.find_element(By.ID, 'statusMsg').text
            inspector = driver.find_element(By.ID, 'ctrlInspector').value if hasattr(
                driver.find_element(By.ID, 'ctrlInspector'), 'value') else ''

            # Obtener inspector seleccionado
            inspector = driver.execute_script(
                "return document.getElementById('ctrlInspector').value;"
            )

            # Preparar la pagina para impresion (ejecutar logica de imprimirFormato)
            driver.execute_script(f"""
                document.body.classList.remove('print-mp', 'print-empaque', 'print-proceso');
                var styleTag = document.getElementById('printPageStyle');
                if (!styleTag) {{
                    styleTag = document.createElement('style');
                    styleTag.id = 'printPageStyle';
                    document.head.appendChild(styleTag);
                }}
                if ('{fmt['key']}' === 'materia-prima') {{
                    document.body.classList.add('print-mp');
                    styleTag.textContent = '@media print {{ @page {{ size: landscape; margin: 5mm; }} }}';
                }} else if ('{fmt['key']}' === 'proceso') {{
                    document.body.classList.add('print-proceso');
                    styleTag.textContent = '@media print {{ @page {{ size: A4 portrait; margin: 0; }} }}';
                }} else {{
                    document.body.classList.add('print-empaque');
                    styleTag.textContent = '@media print {{ @page {{ size: A4 portrait; margin: 0; }} }}';
                }}
            """)
            time.sleep(1)

            # Generar PDF
            pdf_data = generar_pdf_chrome(driver, landscape=fmt['landscape'])

            # Guardar archivo
            fecha_file = fecha_str.replace('-', '')
            filename = f"Temp_{fmt['archivo']}_{fecha_file}_Turno{turno}.pdf"
            output_path = os.path.join(output_dir, filename)

            with open(output_path, 'wb') as f:
                f.write(pdf_data)

            pdf_paths.append(output_path)
            size_kb = len(pdf_data) / 1024
            resumen[fmt['nombre']] = {
                'regs': status_text,
                'inspector': inspector,
            }
            print(f'[OK] {filename} ({size_kb:.0f} KB) - Inspector: {inspector}')

    finally:
        driver.quit()
        print('[OK] Chrome cerrado.')

    return pdf_paths, resumen

# ══════════════════════════════════════════════════════════════
# ENVIO DE EMAIL
# ══════════════════════════════════════════════════════════════

def enviar_email(config, pdf_paths, turno, fecha_str, resumen):
    """Envia email con los PDFs adjuntos via Gmail SMTP."""
    fecha_fmt = format_fecha(fecha_str)

    msg = MIMEMultipart()
    msg['From'] = config['email_from']
    msg['To'] = config['email_to']
    if config.get('email_cc'):
        msg['Cc'] = ', '.join(config['email_cc'])
    msg['Subject'] = f'Reporte de Temperaturas - Turno {turno} - {fecha_fmt}'

    # Cuerpo del email en HTML con firma profesional
    resumen_rows = ''
    for area, info in resumen.items():
        resumen_rows += f'''
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#334155">{area}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#334155">{info["inspector"]}</td>
        </tr>'''

    html_body = f'''
    <table cellpadding="0" cellspacing="0" width="100%" style="font-family:Segoe UI,Arial,sans-serif;max-width:600px">
      <tr><td>
      <!-- ENCABEZADO -->
      <table cellpadding="0" cellspacing="0" width="100%" style="background:linear-gradient(135deg,#2d6a1e 0%,#e8912d 100%);border-radius:12px 12px 0 0">
        <tr>
          <td style="padding:24px 28px">
            <table cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td style="vertical-align:middle">
                  <h2 style="color:#fff;margin:0;font-size:20px;font-weight:800;font-family:Georgia,serif">Reporte de Temperaturas</h2>
                  <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:13px">Turno {turno} &mdash; {fecha_fmt}</p>
                </td>
                <td style="vertical-align:middle;text-align:right">
                  <div style="background:rgba(255,255,255,0.2);border-radius:8px;padding:6px 14px;display:inline-block">
                    <span style="color:#fff;font-size:11px;font-weight:700;letter-spacing:0.5px">AUTOMATIZADO</span>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      </td></tr>

      <tr><td>
      <!-- CUERPO -->
      <table cellpadding="0" cellspacing="0" width="100%" style="background:#fff;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0">
        <tr><td style="padding:20px 24px">
          <p style="font-size:14px;color:#1e293b;margin:0 0 16px">
            Estimado(a),<br/><br/>
            Se adjuntan los formatos de control de temperatura correspondientes al
            <strong>Turno {turno}</strong> del d&iacute;a <strong>{fecha_fmt}</strong>.
          </p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <tr style="background:#f1f5f9">
              <th style="padding:10px 12px;text-align:left;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Formato</th>
              <th style="padding:10px 12px;text-align:left;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Inspector</th>
            </tr>
            {resumen_rows}
          </table>
          <p style="font-size:13px;color:#64748b;margin:16px 0 0">
            <em>{len(resumen)} archivos PDF adjuntos.</em>
          </p>
        </td></tr>
      </table>
      </td></tr>

      <tr><td>
      <!-- FIRMA -->
      <table cellpadding="0" cellspacing="0" width="100%" style="background:#f8fafc;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0">
        <tr><td style="padding:20px 24px">
          <table cellpadding="0" cellspacing="0" style="border-top:3px solid #16a34a;padding-top:14px">
            <tr>
              <td style="padding-right:16px;vertical-align:middle">
                <img src="cid:logo_empresa" alt="Frutos Tropicales" style="width:140px;height:auto" />
              </td>
              <td style="padding-left:16px;vertical-align:middle">
                <p style="margin:0;font-size:16px;font-weight:700;color:#0f172a">Rodrigo Garc&iacute;a</p>
                <p style="margin:3px 0 0;font-size:12px;color:#16a34a;font-weight:600;font-style:italic">Systems Analyst &amp; Developer-QA</p>
                <p style="margin:8px 0 0;font-size:12px;color:#334155;font-weight:700">FRUTOS TROPICALES PER&Uacute; EXPORT S.A.C.</p>
                <p style="margin:6px 0 0;font-size:12px;color:#64748b">&#128222; +51 935 293 701</p>
                <p style="margin:2px 0 0;font-size:12px;color:#64748b">&#9993; rodrigo17312016@gmail.com</p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
      </td></tr>

      <tr><td>
      <!-- BADGE AUTOMATIZACION -->
      <table cellpadding="0" cellspacing="0" width="100%" style="background:linear-gradient(135deg,#2d6a1e 0%,#e8912d 100%);border-radius:0 0 12px 12px">
        <tr><td style="padding:14px 24px;text-align:center">
          <p style="margin:0;font-size:13px;font-weight:700;color:#fff;letter-spacing:0.3px">
            &#9889; Reporte generado autom&aacute;ticamente por el Sistema de Control de Temperaturas
          </p>
          <p style="margin:4px 0 0;font-size:11px;color:rgba(255,255,255,0.75)">
            Frutos Tropicales Per&uacute; Export S.A.C. &mdash; Aseguramiento de la Calidad
          </p>
        </td></tr>
      </table>
      </td></tr>
    </table>
    '''

    # Adjuntar logo como imagen embebida (CID)
    from email.mime.image import MIMEImage
    msg_related = MIMEMultipart('related')
    msg_related.attach(MIMEText(html_body, 'html', 'utf-8'))

    logo_path = os.path.join(SCRIPT_DIR, config.get('logo_path', 'logo2.png'))
    if os.path.exists(logo_path):
        with open(logo_path, 'rb') as img_f:
            logo_img = MIMEImage(img_f.read())
            logo_img.add_header('Content-ID', '<logo_empresa>')
            logo_img.add_header('Content-Disposition', 'inline', filename='logo.png')
            msg_related.attach(logo_img)

    msg.attach(msg_related)

    # Adjuntar PDFs
    for pdf_path in pdf_paths:
        if os.path.exists(pdf_path):
            with open(pdf_path, 'rb') as f:
                part = MIMEBase('application', 'pdf')
                part.set_payload(f.read())
                encoders.encode_base64(part)
                part.add_header(
                    'Content-Disposition',
                    f'attachment; filename="{os.path.basename(pdf_path)}"'
                )
                msg.attach(part)

    # Detectar proveedor de email y enviar
    destinatarios = [config['email_to']]
    if config.get('email_cc'):
        destinatarios.extend(config['email_cc'])

    email_from = config['email_from'].lower()

    if 'outlook' in email_from or 'hotmail' in email_from or 'live' in email_from:
        # Outlook / Hotmail / Live
        with smtplib.SMTP('smtp-mail.outlook.com', 587) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(config['email_from'], config['email_password'])
            server.sendmail(config['email_from'], destinatarios, msg.as_string())
    else:
        # Gmail (default)
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(config['email_from'], config['email_password'])
            server.sendmail(config['email_from'], destinatarios, msg.as_string())

    print(f'[OK] Email enviado a {config["email_to"]}')

# ══════════════════════════════════════════════════════════════
# WHATSAPP NOTIFICATION (TWILIO)
# ══════════════════════════════════════════════════════════════

def enviar_whatsapp(config, turno, fecha_str, resumen):
    """Envia notificacion por WhatsApp via Twilio Sandbox."""
    fecha_fmt = format_fecha(fecha_str)

    # Construir mensaje con formato WhatsApp
    lines = [
        '━━━━━━━━━━━━━━━━━━━━',
        '🍊 *FRUTOS TROPICALES PERU EXPORT S.A.C.*',
        '━━━━━━━━━━━━━━━━━━━━',
        '',
        f'📋 *Reporte de Temperaturas*',
        f'📅 Turno *{turno}* — {fecha_fmt}',
        '',
        '┌─────────────────────────',
        '│ *FORMATO* → *INSPECTOR*',
        '├─────────────────────────',
    ]
    for area, info in resumen.items():
        lines.append(f'│ 🌡️ {area}')
        lines.append(f'│    👤 _{info["inspector"]}_')
    lines.append('└─────────────────────────')
    lines.append('')
    lines.append(f'📧 {len(resumen)} reportes PDF enviados por correo electronico a los destinatarios configurados.')
    lines.append('')
    lines.append('━━━━━━━━━━━━━━━━━━━━')
    lines.append('⚡ _Notificacion generada automaticamente_')
    lines.append('🤖 _Sistema de Control de Temperaturas_')
    lines.append('━━━━━━━━━━━━━━━━━━━━')
    lines.append('')
    lines.append('*Rodrigo Garcia*')
    lines.append('_Systems Analyst & Developer-QA_')
    lines.append('🏭 Frutos Tropicales Peru Export S.A.C.')
    lines.append('📞 +51 935 293 701')
    lines.append('✉️ rodrigo17312016@gmail.com')

    body = '\n'.join(lines)

    # Enviar via Twilio API
    url = f"https://api.twilio.com/2010-04-01/Accounts/{config['twilio_sid']}/Messages.json"
    data = {
        'From': config['twilio_from'],
        'To': config['whatsapp_to'],
        'Body': body,
    }
    resp = requests.post(url, data=data, auth=(config['twilio_sid'], config['twilio_token']), timeout=30)

    if resp.status_code in (200, 201):
        print(f'[OK] WhatsApp enviado a {config["whatsapp_to"]}')
    else:
        print(f'[ERROR] WhatsApp fallo: {resp.status_code} - {resp.text[:200]}')

    # Enviar a numeros adicionales
    for num in config.get('whatsapp_cc', []):
        try:
            data2 = {'From': config['twilio_from'], 'To': num, 'Body': body}
            resp2 = requests.post(url, data=data2, auth=(config['twilio_sid'], config['twilio_token']), timeout=30)
            if resp2.status_code in (200, 201):
                print(f'[OK] WhatsApp enviado a {num}')
            else:
                print(f'[ERROR] WhatsApp a {num}: {resp2.status_code}')
        except Exception as e:
            print(f'[ERROR] WhatsApp a {num}: {e}')

# ══════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description='Generador automatico de reportes de temperatura')
    parser.add_argument('--turno', required=True, choices=['DIA', 'NOCHE'], help='Turno: DIA o NOCHE')
    parser.add_argument('--fecha', default=None, help='Fecha en formato YYYY-MM-DD (default: hoy)')
    parser.add_argument('--solo-pdf', action='store_true', help='Solo genera PDFs, no envia email')
    args = parser.parse_args()

    # Cargar configuracion
    config = load_config()

    # Verificar que existe reporte_frio.html
    if not os.path.exists(HTML_PATH):
        print(f'[ERROR] No se encontro: {HTML_PATH}')
        sys.exit(1)

    # Fecha
    if args.fecha:
        fecha_str = args.fecha
    else:
        now = datetime.now()
        if args.turno == 'NOCHE' and now.hour <= 7:
            fecha_str = (now - timedelta(days=1)).strftime('%Y-%m-%d')
        else:
            fecha_str = now.strftime('%Y-%m-%d')

    # Verificar si es domingo (no se labora)
    fecha_obj = datetime.strptime(fecha_str, '%Y-%m-%d')
    if fecha_obj.weekday() == 6:  # 6 = domingo
        print(f'[i] {format_fecha(fecha_str)} es DOMINGO - No se labora. No se envian reportes.')
        print('=== PROCESO CANCELADO (DOMINGO) ===')
        return

    print('=== REPORTE AUTOMATICO DE TEMPERATURAS ===')
    print(f'Fecha: {format_fecha(fecha_str)}')
    print(f'Turno: {args.turno}')
    print(f'Metodo: Chrome Headless (PDF identico a la pagina)')
    print('==========================================')

    # Directorio de salida
    output_dir = os.path.join(SCRIPT_DIR, 'reportes_pdf')
    os.makedirs(output_dir, exist_ok=True)

    # Generar PDFs con Chrome headless
    pdf_paths, resumen = generar_reportes(fecha_str, args.turno, output_dir)

    # Verificar areas sin datos y marcarlas
    areas_sin_datos = []
    areas_con_datos = {}
    for area, info in resumen.items():
        if '0 registros' in info.get('regs', '') or info.get('inspector', '') == '':
            areas_sin_datos.append(area)
        else:
            areas_con_datos[area] = info

    if areas_sin_datos:
        print(f'[!] Areas SIN datos: {", ".join(areas_sin_datos)}')
        # Marcar en resumen que no hay datos
        for area in areas_sin_datos:
            resumen[area]['inspector'] = 'SIN DATOS - No se registraron temperaturas'

    print(f'\n[OK] PDFs generados en: {output_dir}')

    # Enviar email
    if not args.solo_pdf:
        if (config.get('email_from') and config.get('email_password')
                and config.get('email_to')
                and 'tu_correo' not in config['email_from']
                and 'contraseña' not in config['email_password']):
            print('[...] Enviando email...')
            try:
                enviar_email(config, pdf_paths, args.turno, fecha_str, resumen)
            except Exception as e:
                print(f'[ERROR] No se pudo enviar email: {e}')
        else:
            print('[!] Configura email_from y email_password en config_reportes.json')
        # Enviar WhatsApp
        if config.get('twilio_sid') and config.get('twilio_token'):
            print('[...] Enviando WhatsApp...')
            try:
                enviar_whatsapp(config, args.turno, fecha_str, resumen)
            except Exception as e:
                print(f'[ERROR] WhatsApp: {e}')
    else:
        print('[i] Modo solo-pdf: email y WhatsApp no enviados.')

    print('\n=== PROCESO COMPLETADO ===')


if __name__ == '__main__':
    main()
