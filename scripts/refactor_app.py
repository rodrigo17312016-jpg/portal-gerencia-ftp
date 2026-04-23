#!/usr/bin/env python3
"""
Extrae <style>...</style> y el <script>...</script> inline mas grande
de una app/*/index.html a archivos separados style.css y app.js.

Uso: python refactor_app.py <app-dir>
     (relativo a proyecto/apps/, ej "registro-costos")
"""
import re
import sys
from pathlib import Path


def extract_and_replace(html_path: Path) -> dict:
    content = html_path.read_text(encoding='utf-8')
    original_len = len(content)
    app_dir = html_path.parent
    results = {'css_lines': 0, 'js_lines': 0}

    # 1) Extraer primer <style>...</style> (asumimos uno solo)
    style_re = re.compile(r'<style[^>]*>([\s\S]*?)</style>', re.IGNORECASE)
    m = style_re.search(content)
    if m and m.group(1).strip():
        css = m.group(1).strip() + '\n'
        (app_dir / 'style.css').write_text(css, encoding='utf-8')
        results['css_lines'] = css.count('\n')
        # Reemplazar bloque completo por link externo
        content = content.replace(m.group(0), '<link rel="stylesheet" href="style.css">')

    # 2) Extraer el <script>...</script> INLINE mas grande (sin src=)
    # Regex: script sin atributo src, con contenido no vacio
    script_re = re.compile(
        r'<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)</script>',
        re.IGNORECASE,
    )
    candidates = [m for m in script_re.finditer(content) if m.group(2).strip()]
    if candidates:
        # Tomar el MAS GRANDE (la logica principal de la app)
        biggest = max(candidates, key=lambda m: len(m.group(2)))
        js = biggest.group(2).strip() + '\n'
        (app_dir / 'app.js').write_text(js, encoding='utf-8')
        results['js_lines'] = js.count('\n')
        # Reemplazar por referencia externa con defer (no bloquea parsing)
        content = content.replace(biggest.group(0), '<script defer src="app.js"></script>')

    # 3) Guardar el HTML limpio
    html_path.write_text(content, encoding='utf-8')
    results['html_before'] = original_len
    results['html_after'] = len(content)
    results['saved'] = original_len - len(content)
    return results


def main():
    if len(sys.argv) < 2:
        print('Usage: refactor_app.py <app-dir>', file=sys.stderr)
        sys.exit(1)
    app = sys.argv[1]
    script_dir = Path(__file__).parent
    apps_dir = script_dir.parent / 'apps' / app
    html = apps_dir / 'index.html'
    if not html.exists():
        print(f'ERROR: {html} not found', file=sys.stderr)
        sys.exit(2)

    r = extract_and_replace(html)
    print(f'[{app}]')
    print(f'  style.css: {r["css_lines"]} lines')
    print(f'  app.js:    {r["js_lines"]} lines')
    print(f'  index.html: {r["html_before"]} -> {r["html_after"]} bytes (-{r["saved"]})')


if __name__ == '__main__':
    main()
