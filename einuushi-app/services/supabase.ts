import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Variables de entorno expuestas automáticamente por Expo (prefijo EXPO_PUBLIC_)
const rawUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').trim();
const rawKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '').trim();

function formatSupabaseUrl(url: string): string {
  if (!url || url.includes('placeholder')) return 'https://placeholder.supabase.co';
  let clean = url;
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    clean = `https://${clean}`;
  }
  return clean.replace(/\/+$/, '');
}

const SUPABASE_URL = formatSupabaseUrl(rawUrl);
const SUPABASE_ANON_KEY = rawKey || 'placeholder-anon-key';

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    rawUrl && 
    rawKey && 
    !rawUrl.includes('tu-proyecto') &&
    !rawUrl.includes('placeholder') &&
    rawKey !== 'placeholder-anon-key'
  );
};

// Cliente oficial de Supabase con persistencia
export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      storage: Platform.OS === 'web' ? undefined : AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

export const BUCKET_NAME = 'einuushi-media';

/**
 * Convierte un DataURI (base64) o URI local a ArrayBuffer/Blob para subir a Supabase Storage
 */
async function uriToArrayBuffer(uri: string): Promise<{ data: Uint8Array; contentType: string }> {
  if (uri.startsWith('data:')) {
    const match = uri.match(/^data:([^;]+);base64,(.+)$/);
    const contentType = match ? match[1] : 'image/jpeg';
    const base64Data = match ? match[2] : uri.split(',')[1];
    
    // Decodificar Base64 a bytes sin dependencias externas
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let bufferLength = base64Data.length * 0.75;
    if (base64Data[base64Data.length - 1] === '=') {
      bufferLength--;
      if (base64Data[base64Data.length - 2] === '=') bufferLength--;
    }
    const bytes = new Uint8Array(bufferLength);
    let p = 0;
    for (let i = 0; i < base64Data.length; i += 4) {
      const enc1 = chars.indexOf(base64Data[i]);
      const enc2 = chars.indexOf(base64Data[i + 1]);
      const enc3 = chars.indexOf(base64Data[i + 2]);
      const enc4 = chars.indexOf(base64Data[i + 3]);
      bytes[p++] = (enc1 << 2) | (enc2 >> 4);
      if (enc3 !== 64 && enc3 !== -1) bytes[p++] = ((enc2 & 15) << 4) | (enc3 >> 2);
      if (enc4 !== 64 && enc4 !== -1) bytes[p++] = ((enc3 & 3) << 6) | enc4;
    }
    return { data: bytes, contentType };
  }

  // Si es URI local (file://, content:// o blob:)
  const response = await fetch(uri);
  const blob = await response.blob();
  const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(blob);
  });
  return { 
    data: new Uint8Array(arrayBuffer), 
    contentType: blob.type || 'image/jpeg' 
  };
}

/**
 * Sube una imagen (foto de perfil, producto o cotización) a Supabase Storage
 * y retorna la URL pública permanente.
 */
export async function uploadMediaToSupabase(
  uriOrBase64: string,
  folder: 'avatars' | 'products' | 'quotes' | 'payments' | 'qr',
  customFileName?: string
): Promise<string> {
  // Si no está configurado Supabase o ya es una URL remota http/https, devolverla intacta
  if (!isSupabaseConfigured()) {
    return uriOrBase64;
  }
  if (uriOrBase64.startsWith('http://') || uriOrBase64.startsWith('https://')) {
    return uriOrBase64;
  }

  try {
    const { data: buffer, contentType } = await uriToArrayBuffer(uriOrBase64);
    const extension = contentType.includes('png') ? 'png' : 'jpg';
    const cleanName = customFileName 
      ? customFileName.replace(/[^a-zA-Z0-9_-]/g, '_') 
      : `img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const filePath = `${folder}/${cleanName}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, buffer, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      console.warn('Advertencia al subir a Supabase Storage:', uploadError.message);
      return uriOrBase64; // Retorna el base64 original como fallback para no bloquear al usuario
    }

    const { data: publicData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    return publicData.publicUrl;
  } catch (error) {
    console.warn('Error en uploadMediaToSupabase:', error);
    return uriOrBase64;
  }
}

