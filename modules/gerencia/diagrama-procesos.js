/* ════════════════════════════════════════════════════════
   Diagrama de Procesos - Modulo wrapper para gerencia
   El contenido visual completo esta en /docs/diagrama-procesos.html
   Este modulo solo provee acceso desde el portal.
   ════════════════════════════════════════════════════════ */

export async function init(container) {
  // Asegurar que los links abran el documento standalone correctamente
  // calculando la ruta base relativa al portal
  const links = container.querySelectorAll('a[href^="docs/diagrama-procesos.html"]');
  links.forEach(link => {
    // El portal.html y docs/ estan al mismo nivel, asi que la ruta
    // relativa funciona tal cual. Solo aseguramos target=_blank si por
    // alguna razon no esta puesto.
    if (link.getAttribute('target') !== '_blank') {
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener');
    }
  });

  // Telemetria simple (consola) cuando abren el documento
  links.forEach(link => {
    link.addEventListener('click', (e) => {
      console.info('[diagrama-procesos] Abriendo:', link.getAttribute('href'));
    });
  });
}
