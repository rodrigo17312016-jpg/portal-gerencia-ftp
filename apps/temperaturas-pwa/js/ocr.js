/* ============================================================
   ocr.js — Tesseract.js wrapper.
   - Carga lib desde CDN on-demand (no bloquea el shell)
   - Whitelist de chars para temperaturas: dígitos + signo - + . ,
   - Extrae primer número significativo del texto OCR
   ============================================================ */

(function () {
  'use strict';

  const TESSERACT_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.0.5/dist/tesseract.min.js';
  let workerPromise = null;
  let libLoaded = false;

  function loadLib() {
    if (libLoaded) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = TESSERACT_CDN;
      s.async = true;
      s.onload = () => { libLoaded = true; resolve(); };
      s.onerror = () => reject(new Error('No se pudo cargar Tesseract.js (sin conexión?)'));
      document.head.appendChild(s);
    });
  }

  async function getWorker() {
    if (workerPromise) return workerPromise;
    workerPromise = (async () => {
      await loadLib();
      // Tesseract v5 API: createWorker(lang, oem, options)
      const worker = await window.Tesseract.createWorker('eng', 1, {
        // Logger silencioso para no inundar consola
        logger: () => {}
      });
      // Charset restringido: solo lo que aparece en displays digitales de termómetros
      await worker.setParameters({
        tessedit_char_whitelist: '0123456789-.,°C ',
        tessedit_pageseg_mode: '7'  // single line, ideal para displays
      });
      return worker;
    })();
    return workerPromise;
  }

  async function recognize(blobOrCanvas, onProgress) {
    const worker = await getWorker();
    // Para v5 con setParameters ya seteado, basta worker.recognize(blob)
    let lastPct = 0;
    if (typeof onProgress === 'function') {
      // v5 no expone progress por worker.recognize directamente.
      // Simulamos progreso con timer mientras no termina (UX).
      const ti = setInterval(() => {
        lastPct = Math.min(95, lastPct + 5);
        onProgress(lastPct);
      }, 120);
      try {
        const { data } = await worker.recognize(blobOrCanvas);
        clearInterval(ti);
        onProgress(100);
        return data;
      } catch (e) {
        clearInterval(ti);
        throw e;
      }
    } else {
      const { data } = await worker.recognize(blobOrCanvas);
      return data;
    }
  }

  /**
   * Extrae el primer número (puede ser negativo, con decimal) del texto.
   * Devuelve { value: number | null, raw: string, confidence: number }
   */
  function parseTemperatura(ocrText, ocrConfidence) {
    if (!ocrText) return { value: null, raw: '', confidence: 0 };
    const cleaned = String(ocrText)
      .replace(/[°Cc\s]/g, ' ')
      .replace(/,/g, '.')
      .trim();
    // Regex: opcional signo, dígitos, opcional decimal
    // Acepta -20, -20.5, 20, 5.5, etc.
    const m = cleaned.match(/-?\d{1,3}(?:\.\d{1,2})?/);
    if (!m) return { value: null, raw: ocrText, confidence: ocrConfidence || 0 };
    const num = parseFloat(m[0]);
    if (!isFinite(num)) return { value: null, raw: ocrText, confidence: ocrConfidence || 0 };
    // Sanity: temperaturas plausibles entre -50 y +99
    if (num < -50 || num > 99) {
      return { value: null, raw: ocrText, confidence: ocrConfidence || 0, outOfRange: true };
    }
    return { value: num, raw: ocrText, confidence: ocrConfidence || 0 };
  }

  /** Atajo: detectar y parsear de un blob/imagen. */
  async function detectFromBlob(blob, onProgress) {
    const data = await recognize(blob, onProgress);
    const text = (data && data.text) || '';
    const conf = (data && data.confidence) || 0;
    const parsed = parseTemperatura(text, conf);
    return parsed;
  }

  function destroyWorker() {
    if (workerPromise) {
      workerPromise.then(w => w.terminate().catch(() => {})).catch(() => {});
      workerPromise = null;
    }
  }

  window.OCRService = {
    loadLib,
    getWorker,
    recognize,
    parseTemperatura,
    detectFromBlob,
    destroyWorker
  };
})();
