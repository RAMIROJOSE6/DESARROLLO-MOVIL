import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Clave pública suministrada por el usuario
export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_SHbTlthJgsiLMNQN8F_EEg_djIuEJSZ';

// URL del Proyecto Supabase limpia (sin subrutas como /rest/v1/)
const rawUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://ifqtrbkaoqqlyotnwzuj.supabase.co';

export const SUPABASE_URL = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');

export const isSupabaseConfigured = () => {
  return (
    SUPABASE_URL !== 'https://tu-proyecto.supabase.co' &&
    SUPABASE_URL.includes('.supabase.co') &&
    Boolean(SUPABASE_ANON_KEY)
  );
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
