/* ============================================================
   camera.js — wrapper de getUserMedia + captura + compresión.
   ============================================================ */

(function () {
  'use strict';

  let activeStream = null;

  /**
   * Solicita acceso a cámara trasera. Devuelve MediaStream.
   * Cae a cualquier cámara si no encuentra "environment".
   */
  async function startStream(videoEl) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Tu navegador no soporta acceso a cámara.');
    }
    stopStream(); // limpieza previa

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width:  { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
    } catch (e1) {
      // Fallback a cámara cualquiera
      console.warn('[camera] env failed, fallback', e1);
      stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
    }

    activeStream = stream;
    videoEl.srcObject = stream;
    videoEl.setAttribute('playsinline', 'true');
    videoEl.muted = true;
    await videoEl.play().catch(() => {});
    // Esperar a que las dimensiones del video estén disponibles (necesario para capturePhoto)
    if (!videoEl.videoWidth) {
      await new Promise((resolve) => {
        const onMeta = () => { videoEl.removeEventListener('loadedmetadata', onMeta); resolve(); };
        videoEl.addEventListener('loadedmetadata', onMeta, { once: true });
        // timeout de seguridad 3s
        setTimeout(resolve, 3000);
      });
    }
    return stream;
  }

  function stopStream() {
    if (activeStream) {
      try { activeStream.getTracks().forEach(t => t.stop()); } catch (e) {}
      activeStream = null;
    }
  }

  /**
   * Captura frame del <video> a un canvas y devuelve Blob JPEG comprimido.
   * targetWidth controla resolución final (default 1024 px).
   */
  async function capturePhoto(videoEl, { targetWidth = 1024, quality = 0.78 } = {}) {
    if (!videoEl || !videoEl.videoWidth) {
      throw new Error('Video no listo');
    }
    const vw = videoEl.videoWidth;
    const vh = videoEl.videoHeight;
    const ratio = vh / vw;
    const w = Math.min(vw, targetWidth);
    const h = Math.round(w * ratio);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoEl, 0, 0, w, h);

    const blob = await new Promise(resolve =>
      canvas.toBlob(resolve, 'image/jpeg', quality)
    );
    if (!blob) throw new Error('No se pudo generar la imagen');

    // Si excede 480 KB, recomprimir más agresivo
    if (blob.size > 480 * 1024) {
      return new Promise(resolve =>
        canvas.toBlob(b => resolve(b || blob), 'image/jpeg', 0.6)
      );
    }
    return blob;
  }

  /** Convierte Blob a object URL para preview. */
  function blobToObjectURL(blob) {
    return URL.createObjectURL(blob);
  }

  function revokeObjectURL(url) {
    try { URL.revokeObjectURL(url); } catch (e) {}
  }

  /** Verifica permisos de cámara (devuelve estado o null si no soportado) */
  async function checkPermission() {
    if (!navigator.permissions) return null;
    try {
      const p = await navigator.permissions.query({ name: 'camera' });
      return p.state; // 'granted' | 'denied' | 'prompt'
    } catch (e) {
      return null;
    }
  }

  window.CameraService = {
    startStream,
    stopStream,
    capturePhoto,
    blobToObjectURL,
    revokeObjectURL,
    checkPermission
  };
})();
