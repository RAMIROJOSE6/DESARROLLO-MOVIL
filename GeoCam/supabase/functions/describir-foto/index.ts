// supabase/functions/describir-foto/index.ts
// Semana 10 (T1, C3, C5): Supabase Edge Function para descripción multimodal con Google Gemini.
// Protege la GEMINI_API_KEY en el servidor, valida sesión (401), controla límite diario en uso_ia (C5, 429)
// y retorna una respuesta JSON estructurada con generateText / Gemini Vision.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const PRIMARY_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.6-flash';
const FALLBACK_MODELS = [PRIMARY_MODEL, 'gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-3-flash-preview', 'gemini-pro-latest'];
const LIMITE_DIARIO = parseInt(Deno.env.get('LIMITE_DIARIO') ?? '10', 10);

Deno.serve(async (req) => {
  // Manejo de preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Validar autenticación del usuario mediante Supabase JWT (T1)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No autorizado. Se requiere token de sesión.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Cliente que actúa en nombre del usuario autenticado (respeta RLS)
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Token de sesión inválido o expirado. Inicia sesión nuevamente.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Control de límite diario por usuario (C5: cuota de 24 horas en tabla uso_ia)
    const hace24Horas = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await userClient
      .from('uso_ia')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', hace24Horas);

    if (!countError && typeof count === 'number' && count >= LIMITE_DIARIO) {
      return new Response(
        JSON.stringify({
          error: `Has superado el límite diario permitido (${LIMITE_DIARIO} análisis por día). Por favor intenta de nuevo mañana.`,
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Procesar cuerpo de la petición
    const body = await req.json();
    const { imagen, tono = 'natural', instrucciones = '' } = body;

    if (!imagen) {
      return new Response(
        JSON.stringify({ error: 'Falta la imagen en base64 en el cuerpo de la petición.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({
          error:
            'GEMINI_API_KEY no está configurada como secreto en Supabase. Configúrala con: npx supabase secrets set GEMINI_API_KEY=AIza...',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Registrar uso del usuario en la tabla uso_ia (C5)
    await userClient.from('uso_ia').insert({ user_id: user.id });

    // 5. Llamar a la API de Google Gemini (Multimodal / Visión)
    const systemPrompt = `Eres el asistente de visión por computadora de GeoCam.
Analiza la foto proporcionada y genera:
1. Una descripción precisa, clara y natural en español (máximo 2 a 3 oraciones).
2. De 3 a 5 etiquetas clave (tags) representativas de lo visible.
3. Una categoría temática general (por ejemplo: Paisaje, Urbano, Comida, Documento, Persona, Objeto, Naturaleza).

Tono solicitado: ${tono}.
${instrucciones ? `Instrucciones adicionales del usuario: ${instrucciones}` : ''}

IMPORTANTE: Responde ÚNICAMENTE un objeto JSON válido con la siguiente estructura sin comillas de markdown:
{"descripcion": "...", "etiquetas": ["etiqueta1", "etiqueta2"], "categoria": "..."}`;

    // Limpiar prefijo data:image/jpeg;base64, si viene incluido
    const base64Data = imagen.replace(/^data:image\/\w+;base64,/, '');

    // Probar modelos candidatos con fallback automático en caso de alta demanda o modelo deprecado
    const uniqueModels = [...new Set(FALLBACK_MODELS)];
    let candidateText: string | null = null;
    let lastErrorStatus = 500;

    for (const modelName of uniqueModels) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`;
        const geminiResponse = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [
                  { text: systemPrompt },
                  {
                    inlineData: {
                      mimeType: 'image/jpeg',
                      data: base64Data,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 600,
              responseMimeType: 'application/json',
            },
          }),
        });

        if (geminiResponse.ok) {
          const geminiData = await geminiResponse.json();
          candidateText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
          if (candidateText) {
            console.log(`[Gemini Success] Analizado exitosamente con modelo ${modelName}`);
            break;
          }
        } else {
          lastErrorStatus = geminiResponse.status;
          const errText = await geminiResponse.text();
          console.warn(`[Gemini Model ${modelName} returned ${geminiResponse.status}]`, errText.slice(0, 150));
        }
      } catch (e) {
        console.warn(`[Gemini Model ${modelName} fetch error]`, e);
      }
    }

    if (!candidateText) {
      if (lastErrorStatus === 429) {
        return new Response(
          JSON.stringify({ error: 'Se agotó temporalmente la cuota de Gemini. Por favor espera un minuto.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ error: 'El servicio de IA no pudo responder en este momento. Intenta nuevamente en unos segundos.' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let parsedResult;
    try {
      parsedResult = JSON.parse(candidateText.trim());
    } catch {
      // Fallback si viene texto plano
      parsedResult = {
        descripcion: candidateText.trim(),
        etiquetas: ['geocam', 'foto'],
        categoria: 'General',
      };
    }

    return new Response(JSON.stringify(parsedResult), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno en la Edge Function';
    console.error('[describir-foto error]', err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
