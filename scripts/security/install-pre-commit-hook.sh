#!/bin/bash
# Instala el pre-commit hook que escanea secretos antes de cada commit.
# Ejecutar UNA VEZ tras clonar el repo:
#
#     bash scripts/security/install-pre-commit-hook.sh
#
# El hook llama a scripts/security/scan-secrets.py.
# Si encuentra un secreto candidato, BLOQUEA el commit.

set -e

REPO_ROOT="$(git rev-parse --show-toplevel)"
HOOK_PATH="$REPO_ROOT/.git/hooks/pre-commit"

cat > "$HOOK_PATH" <<'EOF'
#!/bin/bash
# Pre-commit hook: secret scanner (post-incidente 2026-05-01)
SCRIPT="$(git rev-parse --show-toplevel)/scripts/security/scan-secrets.py"
if [ -f "$SCRIPT" ]; then
  python "$SCRIPT" || exit 1
fi
EOF

chmod +x "$HOOK_PATH"
echo "✓ pre-commit hook instalado en .git/hooks/pre-commit"
echo "   Cada commit ahora ejecuta scripts/security/scan-secrets.py"
echo "   Si quieres bypassear UNA vez (no recomendado): git commit --no-verify"
