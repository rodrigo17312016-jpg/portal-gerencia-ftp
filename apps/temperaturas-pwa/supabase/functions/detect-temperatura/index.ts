// =====================================================
// Edge Function: detect-temperatura
//
// Recibe una imagen base64 y devuelve la temperatura detectada
// vía Gemini 2.5 Flash Vision API.
//
// Uso desde la PWA: window.SBClient.detectTemperaturaAI(blob)
//
// Seguridad: la API key se lee de public.app_secrets
// (RLS bloquea anon, service_role bypassea).
// La key NUNCA toca el frontend.
//
// Deploy: ya deployada en proyecto Supabase obnvrfvcujsrmifvlqni.
// Para redeployar manualmente:
//   supabase functions deploy detect-temperatura --project-ref obnvrfvcujsrmifvlqni
// =====================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MODEL = 'gemini-2.5-flash'

const PROMPT = `Look at this digital thermometer display and tell me what temperature number is shown.

Respond with ONLY the number (no units, no other text). Examples of valid responses:
22.5
-15
14.9
17.0

If you cannot read the number clearly, respond exactly: null

Ignore brand names, units (°C/°F), and surrounding context.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return jsonResp({ error: 'method not allowed' }, 405)

  try {
    const body = await req.json()
    const imageBase64 = (body?.image_base64 || '').replace(/^data:image\/[a-z]+;base64,/, '')
    const mimeType = body?.mime_type || 'image/jpeg'
    if (!imageBase64 || imageBase64.length < 100) {
      return jsonResp({ error: 'image_base64 is required' }, 400)
    }

    // Leer la API key desde la BD (RLS solo permite service_role)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const { data: secret, error: secErr } = await supabase
      .from('app_secrets')
      .select('value')
      .eq('key', 'GEMINI_API_KEY')
      .single()
    if (secErr || !secret?.value) {
      console.error('[detect-temperatura] secret not found', secErr)
      return jsonResp({ error: 'API key not configured', detail: secErr?.message }, 500)
    }
    const apiKey = secret.value

    // Llamar a Gemini Vision
    const t0 = Date.now()
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`
    const geminiResp = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: PROMPT },
            { inline_data: { mime_type: mimeType, data: imageBase64 } }
          ]
        }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 200,
          // thinkingBudget: 0 evita que el modelo gaste tokens en "thinking"
          // antes de responder (importante en Gemini 2.5+ que soporta thinking)
          thinkingConfig: { thinkingBudget: 0 }
        }
      })
    })

    if (!geminiResp.ok) {
      const errText = await geminiResp.text()
      console.error('[detect-temperatura] gemini error', geminiResp.status, errText.slice(0, 400))
      return jsonResp({
        error: 'Gemini API error',
        status: geminiResp.status,
        detail: errText.slice(0, 200)
      }, 502)
    }

    const result = await geminiResp.json()
    const elapsed = Date.now() - t0
    const text = (result?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim()
    const finishReason = result?.candidates?.[0]?.finishReason

    // Parsear respuesta
    let value: number | null = null
    let confidence = 'medium'
    if (text && text.toLowerCase() !== 'null') {
      const m = text.match(/-?\d{1,3}(?:[\.,]\d{1,2})?/)
      if (m) {
        const n = parseFloat(m[0].replace(',', '.'))
        if (isFinite(n) && n >= -50 && n <= 99) {
          value = n
          // Si la respuesta es solo el número (sin texto extra), confianza alta
          if (text.replace(/[^\d.\-,]/g, '') === text.trim().replace(/[^\d.\-,]/g, '')) {
            confidence = 'high'
          }
        }
      }
    }

    return jsonResp({
      value,
      confidence,
      raw: text,
      finish_reason: finishReason,
      elapsed_ms: elapsed,
      provider: MODEL
    })
  } catch (e) {
    console.error('[detect-temperatura] unexpected error', e)
    return jsonResp({ error: 'internal error', message: (e as Error).message }, 500)
  }
})

function jsonResp(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
  })
}
