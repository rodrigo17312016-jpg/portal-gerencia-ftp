/* ============================================================
   ocr.js — Tesseract.js wrapper con preprocesamiento agresivo.

   Estrategia:
   1) Preprocesar imagen → grayscale + binarización Otsu + crop central
   2) Multi-pass OCR con PSM 7 (single line), 11 (sparse) y 6 (block)
   3) Parser tolerante que corrige errores comunes (O→0, S→5, etc.)
   4) Priorizar resultado con mayor confianza Y valor plausible
   ============================================================ */

(function () {
  'use strict';

  const TESSERACT_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.0.5/dist/tesseract.min.js';

  // Modelos OCR: 'letsgodigital' está entrenado en displays LCD/7-segmentos
  // (mucho más preciso que eng para termómetros Hanna, Fluke, etc.)
  // 'eng' es el fallback general.
  const LANG_CONFIG = {
    letsgodigital: {
      oem: 0,                  // legacy (el modelo es Tesseract 3)
      langPath: './lib',       // sirve nuestro .traineddata local
      gzip: false              // no está comprimido
    },
    eng: {
      oem: 1,                  // LSTM
      langPath: undefined,     // CDN default de Tesseract.js
      gzip: undefined
    }
  };

  const workers = {};   // workers por idioma cacheados
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

  async function getWorker(lang = 'letsgodigital') {
    if (workers[lang]) return workers[lang];
    const cfg = LANG_CONFIG[lang] || LANG_CONFIG.eng;
    workers[lang] = (async () => {
      await loadLib();
      const opts = { logger: () => {} };
      if (cfg.langPath) opts.langPath = cfg.langPath;
      if (cfg.gzip !== undefined) opts.gzip = cfg.gzip;
      const worker = await window.Tesseract.createWorker(lang, cfg.oem, opts);
      // Charset restringido a dígitos + signos
      await worker.setParameters({
        tessedit_char_whitelist: '0123456789-.,°C ',
      });
      return worker;
    })().catch(err => {
      console.error('[ocr] no se pudo crear worker para', lang, err);
      delete workers[lang];
      throw err;
    });
    return workers[lang];
  }

  // ============== PREPROCESAMIENTO ==============

  /**
   * Convierte blob → ImageBitmap → canvas con preprocesamiento.
   * - Crop central (descarta bordes con guantes/fondo)
   * - Upscale a 1024 px de ancho mínimo
   * - Grayscale + binarización con threshold automático (Otsu)
   */
  async function preprocessImage(blob, { cropFactor = 0.70, targetWidth = 1024, binarize = true } = {}) {
    const bitmap = await createImageBitmap(blob);
    const fullW = bitmap.width;
    const fullH = bitmap.height;

    // Crop central
    const cropW = Math.round(fullW * cropFactor);
    const cropH = Math.round(fullH * cropFactor);
    const cropX = Math.round((fullW - cropW) / 2);
    const cropY = Math.round((fullH - cropH) / 2);

    // Upscale: queremos al menos targetWidth px de ancho
    const scale = Math.max(1, targetWidth / cropW);
    const outW = Math.round(cropW * scale);
    const outH = Math.round(cropH * scale);

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, cropX, cropY, cropW, cropH, 0, 0, outW, outH);
    if (bitmap.close) bitmap.close();

    // Grayscale + Otsu threshold
    const imgData = ctx.getImageData(0, 0, outW, outH);
    const data = imgData.data;
    const histogram = new Array(256).fill(0);
    const grayBuf = new Uint8ClampedArray(outW * outH);

    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      // Luminancia perceptual
      const g = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) | 0;
      grayBuf[j] = g;
      histogram[g]++;
    }

    if (binarize) {
      const threshold = otsuThreshold(histogram, outW * outH);
      // Aplicar threshold + escribir de vuelta
      for (let i = 0, j = 0; i < data.length; i += 4, j++) {
        const v = grayBuf[j] > threshold ? 255 : 0;
        data[i] = v;
        data[i + 1] = v;
        data[i + 2] = v;
        data[i + 3] = 255;
      }
    } else {
      // Solo grayscale + boost contraste lineal
      let min = 255, max = 0;
      for (let j = 0; j < grayBuf.length; j++) {
        if (grayBuf[j] < min) min = grayBuf[j];
        if (grayBuf[j] > max) max = grayBuf[j];
      }
      const range = Math.max(1, max - min);
      for (let i = 0, j = 0; i < data.length; i += 4, j++) {
        const v = Math.max(0, Math.min(255, ((grayBuf[j] - min) * 255 / range) | 0));
        data[i] = v;
        data[i + 1] = v;
        data[i + 2] = v;
        data[i + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    return canvas;
  }

  /** Otsu's method para encontrar threshold óptimo automáticamente */
  function otsuThreshold(histogram, total) {
    let sum = 0;
    for (let t = 0; t < 256; t++) sum += t * histogram[t];

    let sumB = 0, wB = 0, varMax = 0, threshold = 128;
    for (let t = 0; t < 256; t++) {
      wB += histogram[t];
      if (wB === 0) continue;
      const wF = total - wB;
      if (wF === 0) break;
      sumB += t * histogram[t];
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;
      const varBetween = wB * wF * (mB - mF) * (mB - mF);
      if (varBetween > varMax) {
        varMax = varBetween;
        threshold = t;
      }
    }
    return threshold;
  }

  /** Variante invertida (texto blanco sobre fondo oscuro: típico de displays LCD) */
  async function preprocessImageInverted(blob, opts) {
    const canvas = await preprocessImage(blob, opts);
    const ctx = canvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255 - data[i];
      data[i + 1] = 255 - data[i + 1];
      data[i + 2] = 255 - data[i + 2];
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas;
  }

  // ============== OCR MULTI-PASS ==============

  /**
   * Corre el OCR con un PSM y lang dados.
   * PSM 7  = single text line
   * PSM 11 = sparse text (encuentra texto disperso)
   * PSM 6  = single uniform block of text
   * PSM 8  = single word
   * lang:
   * - 'letsgodigital' (default): modelo entrenado en displays LCD/7-seg
   * - 'eng': modelo general
   */
  async function recognizeWithPSM(canvas, psm, lang = 'letsgodigital') {
    const worker = await getWorker(lang);
    await worker.setParameters({ tessedit_pageseg_mode: String(psm) });
    const { data } = await worker.recognize(canvas);
    return { text: data.text || '', confidence: data.confidence || 0, psm, lang };
  }

  // ============== PARSER ==============

  /**
   * Limpia errores típicos de OCR sobre dígitos:
   * O/o → 0, l/I/| → 1, S/s → 5, B → 8, Z → 2, G → 6, q → 9, T → 7
   */
  function normalizeForParse(text) {
    return String(text)
      .replace(/[Oo]/g, '0')
      .replace(/[lI|]/g, '1')
      .replace(/[Ss]/g, '5')
      .replace(/[Bb](?=\d|$)/g, '8')
      .replace(/[Zz]/g, '2')
      .replace(/[Gg]/g, '6')
      .replace(/[Tt](?=\d|$)/g, '7')
      .replace(/[qQ]/g, '9')
      .replace(/[°Cc]/g, ' ')
      .replace(/,/g, '.')
      .replace(/\s+/g, ' ');
  }

  /**
   * Heurística: cuando OCR lee dígitos sueltos sin punto decimal
   * (típico cuando el display tiene buen espaciado), intenta reconstruir.
   *
   * Ejemplos: "2 2 5" → 22.5, "2 1" → 21, "1 8 5" → 18.5, "- 2 0" → -20
   * Solo se aplica si NO hay un punto decimal en el texto original.
   */
  function joinLooseDigits(text) {
    const candidates = [];
    // Trim y normalizar espacios
    const t = text.replace(/\s+/g, ' ').trim();

    // Solo si es una secuencia de dígitos separados por espacios
    // (con signo opcional al inicio)
    const m = t.match(/^(-?)\s*((?:\d\s*){1,5}\d?)$/);
    if (!m) return [];

    const sign = m[1] === '-' ? '-' : '';
    const digitsOnly = m[2].replace(/\s/g, '');
    if (digitsOnly.length < 2) return [];

    // Probar varias interpretaciones según cantidad de dígitos
    if (digitsOnly.length === 2) {
      // "22" → 22 entero
      candidates.push(sign + digitsOnly);
    } else if (digitsOnly.length === 3) {
      // "225" → 22.5 (decimal antes del último) o 225 (entero, pero probablemente fuera de rango)
      candidates.push(sign + digitsOnly.slice(0, 2) + '.' + digitsOnly.slice(2));
      candidates.push(sign + digitsOnly);  // por si es entero válido como "120"
    } else if (digitsOnly.length === 4) {
      // "2250" → 22.50 o "225.0"
      candidates.push(sign + digitsOnly.slice(0, 2) + '.' + digitsOnly.slice(2));
      candidates.push(sign + digitsOnly.slice(0, 3) + '.' + digitsOnly.slice(3));
    } else if (digitsOnly.length === 5) {
      // muy improbable en este contexto pero igual probamos
      candidates.push(sign + digitsOnly.slice(0, 3) + '.' + digitsOnly.slice(3));
    }
    return candidates;
  }

  /**
   * Encuentra todos los números plausibles del texto OCR.
   * Devuelve { value, raw, confidence } con el más probable.
   */
  function parseTemperatura(ocrText, ocrConfidence) {
    if (!ocrText) return { value: null, raw: '', confidence: 0 };
    const cleaned = normalizeForParse(ocrText);

    // 1) Buscar números bien formados (con punto si lo hay)
    const directMatches = [...cleaned.matchAll(/-?\d{1,3}(?:\.\d{1,2})?/g)].map(m => m[0]);

    // 2) Heurística para dígitos sueltos (solo si no hay punto en el texto)
    let joinedCandidates = [];
    if (!cleaned.includes('.')) {
      joinedCandidates = joinLooseDigits(cleaned);
    }

    const allMatches = [...joinedCandidates, ...directMatches];
    if (!allMatches.length) return { value: null, raw: ocrText, confidence: ocrConfidence || 0 };

    // Plausibles: -50 a 99 °C cubre todos los casos de la planta
    const candidates = allMatches
      .map(s => ({ str: s, num: parseFloat(s) }))
      .filter(c => isFinite(c.num) && c.num >= -50 && c.num <= 99);

    if (!candidates.length) {
      return { value: null, raw: ocrText, confidence: ocrConfidence || 0, outOfRange: true };
    }

    // Priorización:
    // 1) Candidatos con punto decimal (típico de displays "22.5")
    // 2) Candidatos del joinedDigits (ya prefieren formato XX.X)
    // 3) Resto
    candidates.sort((a, b) => {
      const aHasDot = a.str.includes('.') ? 1 : 0;
      const bHasDot = b.str.includes('.') ? 1 : 0;
      if (aHasDot !== bHasDot) return bHasDot - aHasDot;
      return 0;
    });

    return { value: candidates[0].num, raw: ocrText, confidence: ocrConfidence || 0 };
  }

  // ============== API PÚBLICA ==============

  /**
   * Detecta temperatura desde un blob (foto JPEG).
   * Estrategia multi-pass con preprocesamiento.
   * onProgress(pct) opcional 0-100.
   */
  async function detectFromBlob(blob, onProgress) {
    if (typeof onProgress === 'function') onProgress(5);

    // 1) Preprocesar imagen con 2 variantes (binarized + grayscale).
    //    El joinLooseDigits del parser cubre los casos donde el display
    //    es pequeño en la foto, así que no necesitamos crop más agresivo.
    const preprocessed = [];
    const variants = [
      { cropFactor: 0.95, binarize: true,  label: 'prep-95-bin' },
      { cropFactor: 0.95, binarize: false, label: 'prep-95-gray' },
    ];
    for (const v of variants) {
      try {
        const c = await preprocessImage(blob, v);
        preprocessed.push({ src: c, label: v.label });
      } catch (e) {
        console.warn('[ocr] preprocesamiento falló', v.label, e);
      }
    }
    if (typeof onProgress === 'function') onProgress(15);

    // 2) Multi-pass: cada preprocesado + blob crudo + varios PSM
    const targets = [...preprocessed, { src: blob, label: 'raw' }];

    // PSM 11 (sparse) primero: es el mejor para fotos con mucho contexto
    // PSM 7 (single line) después: si el display ya está bien encuadrado
    const psms = [11, 7];

    // Modelos: letsgodigital es el principal (entrenado en LCDs).
    // eng como fallback para casos donde el LCD no es perfecto 7-segmentos.
    const langs = ['letsgodigital', 'eng'];

    const results = [];
    const totalSteps = targets.length * psms.length * langs.length;
    let stepDone = 0;

    outer: for (const lang of langs) {
      for (const target of targets) {
        for (const psm of psms) {
          try {
            const r = await recognizeWithPSM(target.src, psm, lang);
            stepDone++;
            if (typeof onProgress === 'function') {
              onProgress(15 + Math.floor((stepDone / totalSteps) * 70));
            }
            const parsed = parseTemperatura(r.text, r.confidence);
            if (parsed.value !== null) {
              results.push({ ...parsed, psm, lang, source: target.label });
              // Early exit: si tenemos confianza decente, paramos.
              // Threshold más bajo para letsgodigital (modelo especializado, confiable)
              const earlyThreshold = lang === 'letsgodigital' ? 50 : 65;
              if (parsed.confidence > earlyThreshold) break outer;
            }
          } catch (e) {
            stepDone++;
            console.warn('[ocr] pass falló', target.label, psm, lang, e?.message || e);
          }
        }
      }
    }

    // 3) Si nada funcionó, intentar imagen invertida (último recurso)
    if (results.length === 0) {
      try {
        const canvasInverted = await preprocessImageInverted(blob);
        for (const lang of langs) {
          for (const psm of [7, 11]) {
            try {
              const r = await recognizeWithPSM(canvasInverted, psm, lang);
              const parsed = parseTemperatura(r.text, r.confidence);
              if (parsed.value !== null) {
                results.push({ ...parsed, psm, lang, source: 'inverted' });
              }
            } catch (e) {}
          }
        }
      } catch (e) {
        console.warn('[ocr] invertido falló', e);
      }
    }

    if (typeof onProgress === 'function') onProgress(100);

    if (!results.length) {
      return { value: null, raw: '', confidence: 0 };
    }

    // Tomar el de mayor confianza, con bonus para letsgodigital (modelo especializado)
    results.forEach(r => {
      r.score = r.confidence + (r.lang === 'letsgodigital' ? 5 : 0);
    });
    results.sort((a, b) => b.score - a.score);
    const best = results[0];
    console.log('[ocr] mejor:', best.value, '°C (conf:', Math.round(best.confidence), ', lang:', best.lang, ', psm:', best.psm, ', source:', best.source, ')');
    return best;
  }

  /** Compatibilidad con código viejo */
  async function recognize(blobOrCanvas, onProgress) {
    const r = await recognizeWithPSM(blobOrCanvas, 7);
    if (typeof onProgress === 'function') onProgress(100);
    return { text: r.text, confidence: r.confidence };
  }

  /**
   * Procesa solo un rectángulo específico de la imagen (crop manual).
   * cropRect: { x, y, w, h } en coords de la imagen original
   */
  async function detectFromCrop(blob, cropRect, onProgress) {
    const bitmap = await createImageBitmap(blob);
    const { x, y, w, h } = cropRect;
    // Upscale a 1024 px ancho
    const targetWidth = 1024;
    const scale = Math.max(1, targetWidth / w);
    const outW = Math.round(w * scale);
    const outH = Math.round(h * scale);

    // Generar imagen cropped + binarizada
    const canvasBin = document.createElement('canvas');
    canvasBin.width = outW;
    canvasBin.height = outH;
    const ctxBin = canvasBin.getContext('2d', { willReadFrequently: true });
    ctxBin.imageSmoothingEnabled = true;
    ctxBin.imageSmoothingQuality = 'high';
    ctxBin.drawImage(bitmap, x, y, w, h, 0, 0, outW, outH);

    // Aplicar grayscale + Otsu
    const imgData = ctxBin.getImageData(0, 0, outW, outH);
    const data = imgData.data;
    const histogram = new Array(256).fill(0);
    const grayBuf = new Uint8ClampedArray(outW * outH);
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      const g = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) | 0;
      grayBuf[j] = g;
      histogram[g]++;
    }
    const threshold = otsuThreshold(histogram, outW * outH);
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      const v = grayBuf[j] > threshold ? 255 : 0;
      data[i] = v; data[i + 1] = v; data[i + 2] = v; data[i + 3] = 255;
    }
    ctxBin.putImageData(imgData, 0, 0);

    // Variante grayscale (sin binarización) para casos difíciles
    const canvasGray = document.createElement('canvas');
    canvasGray.width = outW; canvasGray.height = outH;
    const ctxGray = canvasGray.getContext('2d', { willReadFrequently: true });
    ctxGray.imageSmoothingEnabled = true;
    ctxGray.imageSmoothingQuality = 'high';
    ctxGray.drawImage(bitmap, x, y, w, h, 0, 0, outW, outH);
    const grayImgData = ctxGray.getImageData(0, 0, outW, outH);
    const gd = grayImgData.data;
    let min = 255, max = 0;
    for (let i = 0; i < gd.length; i += 4) {
      const g = (gd[i] * 0.299 + gd[i + 1] * 0.587 + gd[i + 2] * 0.114) | 0;
      if (g < min) min = g; if (g > max) max = g;
    }
    const range = Math.max(1, max - min);
    for (let i = 0; i < gd.length; i += 4) {
      const g = (gd[i] * 0.299 + gd[i + 1] * 0.587 + gd[i + 2] * 0.114) | 0;
      const v = Math.max(0, Math.min(255, ((g - min) * 255 / range) | 0));
      gd[i] = v; gd[i + 1] = v; gd[i + 2] = v; gd[i + 3] = 255;
    }
    ctxGray.putImageData(grayImgData, 0, 0);

    if (bitmap.close) bitmap.close();
    if (typeof onProgress === 'function') onProgress(20);

    const targets = [
      { src: canvasBin,  label: 'crop-bin' },
      { src: canvasGray, label: 'crop-gray' }
    ];
    const psms = [7, 8, 11];  // single-line + single-word + sparse
    const langs = ['letsgodigital', 'eng'];
    const results = [];
    let done = 0;
    const total = targets.length * psms.length * langs.length;

    outer: for (const lang of langs) {
      for (const target of targets) {
        for (const psm of psms) {
          try {
            const r = await recognizeWithPSM(target.src, psm, lang);
            done++;
            if (typeof onProgress === 'function') onProgress(20 + Math.floor((done/total)*70));
            const parsed = parseTemperatura(r.text, r.confidence);
            if (parsed.value !== null) {
              results.push({ ...parsed, psm, lang, source: target.label });
              if (parsed.confidence > 50) break outer;
            }
          } catch (e) {
            done++;
          }
        }
      }
    }
    if (typeof onProgress === 'function') onProgress(100);
    if (!results.length) return { value: null, raw: '', confidence: 0 };
    results.forEach(r => { r.score = r.confidence + (r.lang === 'letsgodigital' ? 5 : 0); });
    results.sort((a, b) => b.score - a.score);
    return results[0];
  }

  function destroyWorker() {
    Object.keys(workers).forEach(lang => {
      const wp = workers[lang];
      if (wp) wp.then(w => w.terminate().catch(() => {})).catch(() => {});
      delete workers[lang];
    });
  }

  window.OCRService = {
    loadLib,
    getWorker,
    recognize,
    parseTemperatura,
    detectFromBlob,
    detectFromCrop,          // crop manual del usuario
    preprocessImage,         // expuesto para debug
    preprocessImageInverted, // expuesto para debug
    destroyWorker
  };
})();
