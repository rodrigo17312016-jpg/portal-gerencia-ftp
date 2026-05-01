/* ============================================================
   share-card.js — genera comprobante visual para compartir.
   Replica el formato del mensaje de WhatsApp:
     - Header con nombre del inspector + año
     - Foto del termómetro (si hay)
     - Texto: temperatura · área · estado · rango · hora
   API:
     - generateCard({...}) → Promise<Blob>  (PNG)
     - composeText({...})  → String         (plain text para compartir)
     - share(blob, text)   → Promise        (Web Share API + fallbacks)
   ============================================================ */

(function () {
  'use strict';

  const CARD_W = 1080;   // ratio similar a story de instagram para WhatsApp
  const CARD_PAD = 48;

  /** Carga blob como ImageBitmap. */
  async function blobToBitmap(blob) {
    if (!blob) return null;
    try {
      return await createImageBitmap(blob);
    } catch (e) {
      console.warn('[share] blobToBitmap failed', e);
      return null;
    }
  }

  function wrapText(ctx, text, maxWidth) {
    const words = String(text || '').split(/\s+/);
    const lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function roundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /**
   * Genera el comprobante.
   * Espera: { fotoBlob, inspector, areaNombre, temperatura, estado,
   *           limite, critico, hora, observaciones, anio }
   */
  async function generateCard(data) {
    const fotoBitmap = await blobToBitmap(data.fotoBlob);

    // Calcular alto dinámico según contenido
    const headerH = 100;
    const photoH = fotoBitmap ? Math.round(CARD_W * 1.2) : 0;
    const baseTextH = 380;  // espacio para los datos textuales
    const obsH = data.observaciones ? 80 : 0;

    const totalH = headerH + photoH + baseTextH + obsH + CARD_PAD * 2;

    const canvas = document.createElement('canvas');
    canvas.width = CARD_W;
    canvas.height = totalH;
    const ctx = canvas.getContext('2d');

    // Fondo blanco con sutil borde redondeado simulado
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, CARD_W, totalH);

    // ========== HEADER ==========
    // Bloque azul superior con nombre del inspector
    const headerGrad = ctx.createLinearGradient(0, 0, CARD_W, headerH);
    headerGrad.addColorStop(0, '#0EA5E9');
    headerGrad.addColorStop(1, '#1E40AF');
    ctx.fillStyle = headerGrad;
    ctx.fillRect(0, 0, CARD_W, headerH);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 42px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const inspectorTitle = `${data.inspector} · Calidad ${data.anio}`;
    ctx.fillText(inspectorTitle, CARD_PAD, headerH / 2, CARD_W - CARD_PAD * 2);

    // ========== FOTO ==========
    let cursorY = headerH + CARD_PAD;
    if (fotoBitmap && photoH > 0) {
      // Fondo negro detrás de la foto (estilo polaroid)
      const photoX = CARD_PAD;
      const photoY = cursorY;
      const photoW = CARD_W - CARD_PAD * 2;
      const photoH2 = photoH - CARD_PAD;

      ctx.fillStyle = '#0F172A';
      roundedRect(ctx, photoX, photoY, photoW, photoH2, 24);
      ctx.fill();

      // Calcular crop para que la foto entre proporcional ("cover")
      const srcRatio = fotoBitmap.width / fotoBitmap.height;
      const dstRatio = photoW / photoH2;
      let sx, sy, sw, sh;
      if (srcRatio > dstRatio) {
        // foto más ancha que destino: crop horizontal
        sh = fotoBitmap.height;
        sw = Math.round(sh * dstRatio);
        sx = Math.round((fotoBitmap.width - sw) / 2);
        sy = 0;
      } else {
        // foto más alta que destino: crop vertical (centrar al medio donde suele estar el display)
        sw = fotoBitmap.width;
        sh = Math.round(sw / dstRatio);
        sx = 0;
        sy = Math.round((fotoBitmap.height - sh) / 2);
      }

      // Clip rounded
      ctx.save();
      roundedRect(ctx, photoX, photoY, photoW, photoH2, 24);
      ctx.clip();
      ctx.drawImage(fotoBitmap, sx, sy, sw, sh, photoX, photoY, photoW, photoH2);
      ctx.restore();

      cursorY = photoY + photoH2 + CARD_PAD;

      try { fotoBitmap.close && fotoBitmap.close(); } catch (e) {}
    }

    // ========== TEXTO DEL REGISTRO ==========
    // Línea principal: "Temperatura sala de [Área]"
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 56px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const tituloLineas = wrapText(ctx, `Temperatura ${data.areaNombre}`, CARD_W - CARD_PAD * 2);
    for (const line of tituloLineas) {
      ctx.fillText(line, CARD_PAD, cursorY);
      cursorY += 70;
    }
    cursorY += 12;

    // Estado con badge
    const estado = (data.estado || 'OK').toUpperCase();
    const estadoMap = {
      OK:      { bg: '#10B981', icon: '✅', label: 'Dentro de rango' },
      ALERTA:  { bg: '#F59E0B', icon: '⚠️', label: 'Fuera de rango' },
      CRITICO: { bg: '#EF4444', icon: '🚨', label: 'CRÍTICO — fuera de rango' }
    };
    const em = estadoMap[estado] || estadoMap.OK;

    // Pill de estado
    ctx.font = 'bold 44px Inter, system-ui, sans-serif';
    const estadoTextW = ctx.measureText(em.label).width;
    const pillPadX = 32;
    const pillH = 70;
    const pillW = estadoTextW + pillPadX * 2 + 60;  // +60 para emoji
    ctx.fillStyle = em.bg;
    roundedRect(ctx, CARD_PAD, cursorY, pillW, pillH, pillH / 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${em.icon}  ${em.label}`, CARD_PAD + pillPadX, cursorY + pillH / 2 + 2);
    ctx.textBaseline = 'top';
    cursorY += pillH + 24;

    // Temperatura grande
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 96px Inter, system-ui, sans-serif';
    const tempStr = `${Number(data.temperatura).toFixed(1)} °C`;
    ctx.fillText(tempStr, CARD_PAD, cursorY);
    cursorY += 110;

    // Rango y hora
    ctx.fillStyle = '#64748B';
    ctx.font = '36px Inter, system-ui, sans-serif';
    const rangoStr = `Rango ≤ ${data.limite}°C · Crítico > ${data.critico}°C`;
    ctx.fillText(rangoStr, CARD_PAD, cursorY);
    cursorY += 50;

    ctx.fillStyle = '#94A3B8';
    ctx.font = '32px Inter, system-ui, sans-serif';
    ctx.fillText(`🕒 ${data.hora}  ·  ${new Date().toLocaleDateString('es-PE')}`, CARD_PAD, cursorY);
    cursorY += 48;

    // Observaciones (si hay)
    if (data.observaciones) {
      ctx.fillStyle = '#475569';
      ctx.font = 'italic 28px Inter, system-ui, sans-serif';
      const obsLines = wrapText(ctx, '"' + data.observaciones + '"', CARD_W - CARD_PAD * 2);
      for (const line of obsLines.slice(0, 2)) {
        ctx.fillText(line, CARD_PAD, cursorY);
        cursorY += 38;
      }
    }

    // Pie con marca FTP
    ctx.fillStyle = '#CBD5E1';
    ctx.font = '24px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('🌡️ Frutos Tropicales · Portal Gerencia',
                 CARD_W - CARD_PAD, totalH - CARD_PAD / 2);

    // Convertir a Blob PNG
    return new Promise(resolve => {
      canvas.toBlob(b => resolve(b), 'image/png');
    });
  }

  /** Texto plano para compartir (igual al mensaje de WhatsApp) */
  function composeText(data) {
    const estadoTexto = ({
      OK:      '✅ Dentro de rango',
      ALERTA:  '⚠️ Fuera de rango',
      CRITICO: '🚨 CRÍTICO — fuera de rango'
    })[(data.estado || 'OK').toUpperCase()] || 'Dentro de rango';

    const lines = [
      `*${data.inspector}* · Calidad ${data.anio}`,
      ``,
      `🌡️ Temperatura ${data.areaNombre}: *${Number(data.temperatura).toFixed(1)} °C*`,
      estadoTexto,
      `Rango ≤ ${data.limite}°C · Crítico > ${data.critico}°C`,
      `🕒 ${data.hora}`
    ];
    if (data.observaciones) lines.push(``, `📝 ${data.observaciones}`);
    return lines.join('\n');
  }

  /**
   * Comparte la card via Web Share API.
   * Si el browser no soporta files: cae a share solo texto.
   * Si tampoco soporta share: copia al clipboard y descarga la imagen.
   */
  async function share({ blob, text, title }) {
    const file = blob ? new File([blob], 'temperatura.png', { type: 'image/png' }) : null;

    // 1) Web Share API con archivos (Android Chrome moderno)
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text, title });
        return { ok: true, method: 'share-with-file' };
      } catch (e) {
        if (e.name === 'AbortError') return { ok: false, method: 'cancelled' };
        console.warn('[share] file share failed', e);
      }
    }

    // 2) Web Share API solo texto
    if (navigator.share) {
      try {
        await navigator.share({ text, title });
        return { ok: true, method: 'share-text-only' };
      } catch (e) {
        if (e.name === 'AbortError') return { ok: false, method: 'cancelled' };
        console.warn('[share] text share failed', e);
      }
    }

    // 3) Fallback: copiar texto al clipboard + descargar imagen
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      }
    } catch (e) { /* ignore */ }

    if (blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'temperatura-' + Date.now() + '.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    return { ok: true, method: 'fallback-clipboard-download' };
  }

  window.ShareCard = {
    generateCard,
    composeText,
    share
  };
})();
