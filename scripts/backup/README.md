# Backup Supabase — Portal FTP

Script de backup externo complementario al PITR nativo de Supabase.

## Uso rapido

```bash
# 1. Configurar service key (nunca committear)
export SUPABASE_SERVICE_ROLE_KEY="eyJ..."

# 2. Instalar dependencia
pip install requests

# 3. Ejecutar backup completo
python backup_supabase.py

# Variantes
python backup_supabase.py --quick                # solo criticas
python backup_supabase.py --project principal    # solo un proyecto
python backup_supabase.py --restore FECHA        # guia de restauracion
```

## Programar backup automatico

### Windows (Task Scheduler)

```powershell
schtasks /Create /SC DAILY /ST 02:00 /TN "FTP Backup Supabase" `
  /TR "python C:\ruta\scripts\backup\backup_supabase.py"
```

### Linux/Mac (cron)

```cron
# Diario 2am
0 2 * * * /usr/bin/python3 /ruta/backup_supabase.py >> /var/log/ftp-backup.log 2>&1
```

## Retencion recomendada (BRCGS/FDA)

- **Diarios**: mantener 30 dias (hot storage)
- **Semanales**: mantener 1 ano (warm storage)
- **Mensuales**: mantener 5 anos (cold/S3 Glacier)

## Verificacion de integridad

Cada backup incluye `manifest.json` con SHA-256 por tabla. Para verificar:

```python
import json, hashlib, gzip
from pathlib import Path

backup = Path("backups/principal/20260423_020000")
manifest = json.loads((backup / "manifest.json").read_text())
for table, meta in manifest["tables"].items():
    data = gzip.decompress((backup / f"{table}.json.gz").read_bytes())
    actual = hashlib.sha256(data).hexdigest()
    ok = "✓" if actual == meta["sha256"] else "✗"
    print(f"{ok} {table}: {meta['rows']} rows")
```

## Seguridad

- El archivo `.env` local y la carpeta `backups/` NO se committean (ver .gitignore)
- Service role key NUNCA en el codigo
- Para storage offsite: rsync/rclone a S3/Glacier/Azure/GDrive encriptado
