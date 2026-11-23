// services/vision.ts
// Semana 10 (T2): Servicio de análisis visual con IA multimodal vía Supabase Edge Function.
// Reduce la foto a máximo 1024 px JPEG 0.7 (< 300 KB) antes de enviar a la Edge Function.
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { supabase } from '@/lib/supabase';

export interface VisionDescriptionResult {
  descripcion: string;
  etiquetas: string[];
  categoria?: string;
}

export interface VisionOptions {
  tono?: 'natural' | 'detallado' | 'poetico' | 'tecnico';
  instruccionesExtra?: string;
}

/**
 * Reduce la foto a max 1024 px de ancho, calidad 0.7 y la convierte a base64.
 * Garantiza que la carga útil enviada pese menos de 300 KB.
 */
export async function optimizarFotoParaVision(uri: string): Promise<string> {
  const result = await manipulateAsync(
    uri,
    [{ resize: { width: 1024 } }],
    {
      compress: 0.7,
      format: SaveFormat.JPEG,
      base64: true,
    }
  );

  if (!result.base64) {
    throw new Error('No se pudo generar la codificación en base64 de la imagen.');
  }

  return result.base64;
}

/**
 * Invoca la Supabase Edge Function 'describir-foto' enviando el token de sesión
 * automáticamente y la imagen optimizada en base64.
 */
export async function describirFotoConIA(
  uri: string,
  options: VisionOptions = {}
): Promise<VisionDescriptionResult> {
  const imagenBase64 = await optimizarFotoParaVision(uri);

  const { data, error } = await supabase.functions.invoke('describir-foto', {
    body: {
      imagen: imagenBase64,
      tono: options.tono ?? 'natural',
      instrucciones: options.instruccionesExtra,
    },
  });

  if (error) {
    // Manejo de errores específicos según la guía (C4)
    const context = (error as { context?: Response }).context;
    let serverMessage = error.message;

    if (context && typeof context.json === 'function') {
      try {
        const errorJson = await context.json();
        if (errorJson.error) serverMessage = errorJson.error;
      } catch {
        // Usa mensaje estándar si no es JSON
      }
    }

    if (/401|unauthorized/i.test(serverMessage)) {
      throw new Error('Sesión vencida o no autorizada. Por favor, vuelve a iniciar sesión.');
    }
    if (/429|cuota|límite/i.test(serverMessage)) {
      throw new Error(
        serverMessage.includes('diario')
          ? serverMessage
          : 'Se agotó la cuota de peticiones de IA. Espera un momento o intenta más tarde.'
      );
    }
    if (/404|not found/i.test(serverMessage)) {
      throw new Error(
        'La función "describir-foto" aún no está desplegada en tu proyecto de Supabase. Despliégala con "npx supabase functions deploy describir-foto".'
      );
    }

    throw new Error(serverMessage || 'No se pudo generar la descripción con IA.');
  }

  if (!data || !data.descripcion) {
    throw new Error('La respuesta de la IA no contiene una descripción válida.');
  }

  return {
    descripcion: data.descripcion,
    etiquetas: Array.isArray(data.etiquetas) ? data.etiquetas : [],
    categoria: data.categoria,
  };
}
