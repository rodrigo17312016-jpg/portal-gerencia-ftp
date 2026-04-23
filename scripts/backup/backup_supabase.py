#!/usr/bin/env python3
"""
═══════════════════════════════════════════════════════════════════
BACKUP SUPABASE - Portal Frutos Tropicales Peru Export S.A.C.
═══════════════════════════════════════════════════════════════════

Exporta todas las tablas del portal a JSON con timestamp.
Estrategia: backup externo complementario al PITR nativo de Supabase.

Uso:
    python backup_supabase.py              # Backup completo
    python backup_supabase.py --quick      # Solo tablas criticas
    python backup_supabase.py --restore FECHA  # Muestra cómo restaurar

Requiere:
    - Variable de entorno SUPABASE_SERVICE_ROLE_KEY (no la anon!)
    - pip install requests

Programar via cron (diario 2am):
    0 2 * * * /usr/bin/python3 /path/to/backup_supabase.py

Retencion recomendada (BRCGS 3 anos / FDA 5 anos):
    - Backups diarios: mantener 30 dias
    - Backups semanales: mantener 1 ano
    - Backups mensuales: mantener 5 anos
═══════════════════════════════════════════════════════════════════
"""

import os
import sys
import json
import gzip
import argparse
import datetime
import hashlib
from pathlib import Path

try:
    import requests
except ImportError:
    print("ERROR: pip install requests", file=sys.stderr)
    sys.exit(1)

# ─── Configuracion ───
PROJECTS = {
    "principal": {
        "url": "https://rslzosmeteyzxmgfkppe.supabase.co",
        "tables": [
            # Operacionales (criticas para BRCGS/FDA)
            "registro_produccion", "registro_personal", "registro_tuneles",
            "registro_empaque_congelado", "config_costos", "labores_custom",
            # Audit trail (tamper-evident)
            "audit_log",
            # Mantenimiento
            "Employee", "AttendanceRecord", "MealRecord", "TareoRecord",
            "Plant", "Incident", "Alert", "SystemConfig"
        ]
    },
    "calidad": {
        "url": "https://obnvrfvcujsrmifvlqni.supabase.co",
        "tables": [
            "registros_temperatura", "consumos_insumos",
            "alertas", "auditoria", "avance_produccion",
            "codigos_qr", "configuracion", "metas_diarias",
            "trabajadores", "turnos", "palets_mp", "reportes_mp",
            "viajes_mp", "materia_prima_mango"
        ]
    }
}

QUICK_TABLES = [
    "registro_produccion", "registro_empaque_congelado",
    "audit_log", "registros_temperatura"
]

BACKUP_DIR = Path(__file__).parent / "backups"


def get_service_key():
    """Obtiene service role key desde variable de entorno o .env local."""
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if key:
        return key
    # Fallback a .env (que NO debe committearse)
    env_path = Path(__file__).parent / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith("SUPABASE_SERVICE_ROLE_KEY="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    print("ERROR: Configurar SUPABASE_SERVICE_ROLE_KEY", file=sys.stderr)
    print("       Opcion 1: export SUPABASE_SERVICE_ROLE_KEY=eyJ...", file=sys.stderr)
    print("       Opcion 2: crear scripts/backup/.env (NO committear)", file=sys.stderr)
    sys.exit(2)


def fetch_table(base_url, api_key, table_name, page_size=1000):
    """Descarga todas las filas de una tabla paginando."""
    rows = []
    offset = 0
    while True:
        r = requests.get(
            f"{base_url}/rest/v1/{table_name}",
            params={"select": "*", "limit": page_size, "offset": offset},
            headers={
                "apikey": api_key,
                "Authorization": f"Bearer {api_key}",
                "Prefer": "count=exact",
            },
            timeout=60,
        )
        if not r.ok:
            print(f"  ERROR {r.status_code}: {r.text[:200]}", file=sys.stderr)
            return None
        page = r.json()
        rows.extend(page)
        if len(page) < page_size:
            break
        offset += page_size
    return rows


def backup_project(project_key, quick=False):
    cfg = PROJECTS[project_key]
    api_key = get_service_key()  # Debe ser service role para lectura completa
    tables = [t for t in cfg["tables"] if (not quick or t in QUICK_TABLES)]

    ts = datetime.datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    out_dir = BACKUP_DIR / project_key / ts
    out_dir.mkdir(parents=True, exist_ok=True)

    manifest = {
        "project": project_key,
        "url": cfg["url"],
        "timestamp_utc": datetime.datetime.utcnow().isoformat() + "Z",
        "tables": {},
        "quick_mode": quick
    }

    print(f"\n═══ Backup proyecto '{project_key}' → {out_dir} ═══")

    for table in tables:
        print(f"  [{table}] fetching...", end=" ", flush=True)
        rows = fetch_table(cfg["url"], api_key, table)
        if rows is None:
            manifest["tables"][table] = {"status": "error"}
            continue

        # Guardar comprimido
        file_path = out_dir / f"{table}.json.gz"
        raw = json.dumps(rows, ensure_ascii=False, default=str).encode("utf-8")
        with gzip.open(file_path, "wb") as f:
            f.write(raw)

        sha = hashlib.sha256(raw).hexdigest()
        manifest["tables"][table] = {
            "rows": len(rows),
            "size_bytes": file_path.stat().st_size,
            "sha256": sha
        }
        print(f"{len(rows)} rows, {file_path.stat().st_size} bytes")

    # Manifest con hashes para verificar integridad
    (out_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False),
        encoding="utf-8"
    )

    print(f"\nOK backup guardado en: {out_dir}")
    return out_dir


def cmd_backup(args):
    if args.project:
        backup_project(args.project, quick=args.quick)
    else:
        for p in PROJECTS:
            backup_project(p, quick=args.quick)


def cmd_restore(args):
    print(f"""
╔═══════════════════════════════════════════════════════════════╗
║ GUIA DE RESTAURACION                                          ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║ 1. Identifica el backup a restaurar:                          ║
║    ls {BACKUP_DIR}                                            ║
║                                                               ║
║ 2. Recomendado: restaurar a NUEVO proyecto Supabase           ║
║    (para no sobrescribir prod) y comparar antes de swap.     ║
║                                                               ║
║ 3. Crear schema en proyecto destino (aplicar migrations).     ║
║                                                               ║
║ 4. Para cada tabla:                                           ║
║    gunzip -c registro_produccion.json.gz | \\                  ║
║      jq -c '.[]' | while read row; do                         ║
║        curl -X POST "$NEW_URL/rest/v1/registro_produccion" \\  ║
║          -H "apikey: $NEW_KEY" \\                              ║
║          -H "Authorization: Bearer $NEW_KEY" \\                ║
║          -H "Content-Type: application/json" \\                ║
║          -d "$row"                                            ║
║      done                                                     ║
║                                                               ║
║ 5. Verificar counts vs manifest.json y hash SHA-256.          ║
║                                                               ║
║ 6. Re-aplicar RLS policies via migrations Supabase.           ║
║                                                               ║
║ 7. Validar integridad audit_log (que hashes coincidan).       ║
║                                                               ║
║ Tiempo estimado: 15-60 min segun volumen.                     ║
║ Si necesitas restore < 7 dias, usar PITR de Supabase nativo.  ║
╚═══════════════════════════════════════════════════════════════╝
""")


def main():
    parser = argparse.ArgumentParser(description="Backup Supabase FTP Portal")
    parser.add_argument("--project", choices=list(PROJECTS.keys()), help="Solo un proyecto")
    parser.add_argument("--quick", action="store_true", help="Solo tablas criticas")
    parser.add_argument("--restore", metavar="FECHA", help="Mostrar guia de restauracion")
    args = parser.parse_args()

    if args.restore:
        cmd_restore(args)
    else:
        cmd_backup(args)


if __name__ == "__main__":
    main()
