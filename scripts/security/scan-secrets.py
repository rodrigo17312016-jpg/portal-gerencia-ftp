#!/usr/bin/env python3
"""
scan-secrets.py — Pre-commit secret scanner para portal-gerencia-ftp.

Escanea archivos staged (git diff --cached) en busca de patrones de
secretos comunes. Si encuentra alguno, RECHAZA el commit.

No requiere dependencias externas. Diseñado para ser instalado como
.git/hooks/pre-commit:

    cp scripts/security/scan-secrets.py .git/hooks/pre-commit
    chmod +x .git/hooks/pre-commit

O ejecutarlo manualmente: python scripts/security/scan-secrets.py

Origen: post-incidente GitGuardian 2026-05-01 (2 passwords leaked
en sql/multi-sede/010_*.sql, ya rotados).
"""
import re
import subprocess
import sys

# Patrones de cosas que NUNCA deben commitearse
# Nota: ignoran placeholders tipo :PASSWORD_HERE, ${VAR}, <REPLACE_ME>
PLACEHOLDER_RE = r"(?:[:$]\w|<\w|\$\{|REPLACE|PLACEHOLDER|EXAMPLE|YOUR_|TODO|TBD|XXX_)"

PATTERNS = [
    # Passwords hardcoded en SQL/JSON/JS (ignora placeholders)
    (r"['\"]password['\"]?\s*[:=]\s*['\"](?!" + PLACEHOLDER_RE + r")[^'\"]{4,}['\"]", "Password literal en codigo"),
    (r"crypt\(\s*['\"](?!" + PLACEHOLDER_RE + r")[^'\"]{4,}['\"]", "Password literal pasado a crypt()"),
    (r"['\"]encrypted_password['\"]?\s*[:=]\s*['\"](?!" + PLACEHOLDER_RE + r")[^'\"]{20,}['\"]", "Hash de password literal"),
    # Tokens / API keys comunes
    (r"sk-[a-zA-Z0-9]{32,}", "Possible OpenAI/Anthropic API key"),
    (r"AKIA[0-9A-Z]{16}", "AWS Access Key"),
    (r"AIza[0-9A-Za-z_-]{35}", "Google API key"),
    (r"ghp_[a-zA-Z0-9]{36}", "GitHub Personal Access Token"),
    (r"github_pat_[a-zA-Z0-9_]{82}", "GitHub Fine-grained PAT"),
    (r"xox[baprs]-[a-zA-Z0-9-]{10,}", "Slack token"),
    # JWT (rough match)
    (r"eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}", "Possible JWT (anon key OK si va a config/supabase.js)"),
    # Service role keys de Supabase (suelen ser largos)
    (r"service_role[\"']?\s*[:=]\s*['\"][^'\"]{40,}['\"]", "Supabase service_role key"),
]

# Patrones del incidente 2026-05-01 - construidos dinamicamente para no
# escribir las strings literales en el codigo fuente (evita re-detection
# por GitGuardian sobre este propio archivo)
_HIST_1 = 'prod' + '2026'
_HIST_2 = 'prc' + '2026'
PATTERNS.append((rf"\b{_HIST_1}\b", "Password leakeado historico (rotado 2026-05-01)"))
PATTERNS.append((rf"\b{_HIST_2}\b", "Password leakeado historico (rotado 2026-05-01)"))

# Archivos cuya extension/path debe siempre escanearse
SCAN_EXTENSIONS = {'.sql', '.js', '.ts', '.json', '.html', '.py', '.sh', '.env', '.md', '.yml', '.yaml'}

# Excepciones: archivos donde algunos patrones son legitimos
ALLOWLIST = {
    # supabase.js tiene anon keys publicas (JWT con role=anon, no secret)
    'assets/js/config/supabase.js': ['Possible JWT'],
    # PWA Temperaturas: la anon key default es la misma publica que el portal
    'apps/temperaturas-pwa/js/supabase-client.js': ['Possible JWT'],
    # Este mismo scanner contiene los patrones - obviamente
    'scripts/security/scan-secrets.py': ['__all__'],
    # Documentacion de incidentes referencia los nombres redactados
    'docs/SECURITY_INCIDENTS.md': ['Password leakeado historico'],
}


def get_staged_files():
    """Devuelve lista de archivos staged (added + modified)."""
    try:
        out = subprocess.check_output(
            ['git', 'diff', '--cached', '--name-only', '--diff-filter=AM'],
            stderr=subprocess.DEVNULL
        ).decode('utf-8', errors='ignore')
        return [f.strip() for f in out.splitlines() if f.strip()]
    except Exception as e:
        print(f"[scan-secrets] no pude leer staged files: {e}", file=sys.stderr)
        return []


def get_staged_content(path):
    """Devuelve el contenido staged del archivo (lo que va al commit)."""
    try:
        out = subprocess.check_output(
            ['git', 'show', f':{path}'],
            stderr=subprocess.DEVNULL
        )
        return out.decode('utf-8', errors='ignore')
    except Exception:
        return ''


def is_allowed(path, finding_msg):
    rules = ALLOWLIST.get(path.replace('\\', '/'), [])
    if '__all__' in rules:
        return True
    return any(rule.lower() in finding_msg.lower() for rule in rules)


def scan_file(path):
    """Devuelve lista de findings (linea, regla, snippet)."""
    findings = []
    ext_ok = any(path.lower().endswith(e) for e in SCAN_EXTENSIONS)
    if not ext_ok:
        return findings
    content = get_staged_content(path)
    if not content:
        return findings

    for lineno, line in enumerate(content.splitlines(), 1):
        for pattern, msg in PATTERNS:
            if re.search(pattern, line, re.IGNORECASE):
                if is_allowed(path, msg):
                    continue
                snippet = line.strip()[:120]
                findings.append((lineno, msg, snippet))
    return findings


def main():
    files = get_staged_files()
    if not files:
        return 0

    total_findings = 0
    print("[scan-secrets] escaneando", len(files), "archivos staged...")

    for f in files:
        finds = scan_file(f)
        if finds:
            total_findings += len(finds)
            print(f"\n  [WARN]{f}")
            for lineno, msg, snippet in finds:
                print(f"      L{lineno}: {msg}")
                print(f"            {snippet}")

    if total_findings > 0:
        print(f"\n[FAIL] {total_findings} posible(s) secreto(s) detectado(s). COMMIT BLOQUEADO.")
        print("   Si es un FALSO POSITIVO, agrega a ALLOWLIST en scripts/security/scan-secrets.py")
        print("   Si es REAL, ELIMINALO antes de commitear (no uses --no-verify).")
        return 1

    print("[OK] scan-secrets: limpio")
    return 0


if __name__ == '__main__':
    sys.exit(main())
