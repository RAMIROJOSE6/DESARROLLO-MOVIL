import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

export default function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (action: typeof signIn) => {
    setMessage(null);
    if (!email.trim() || password.length < 6) {
      return setMessage('Escribe tu correo y una contraseña de al menos 6 caracteres.');
    }
    setBusy(true);
    try {
      const res = await action(email, password);
      setMessage(res);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Error inesperado');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-neutral-950"
    >
      <ScrollView
        contentContainerClassName="flex-grow justify-center px-6 py-10"
        keyboardShouldPersistTaps="handled"
      >
        <View className="items-center mb-8">
          <View className="w-16 h-16 rounded-2xl bg-emerald-500/10 items-center justify-center mb-4 border border-emerald-500/30">
            <Ionicons name="camera" size={32} color="#10b981" />
          </View>
          <Text className="text-3xl font-extrabold text-white tracking-tight">GeoCam</Text>
          <Text className="text-neutral-400 text-sm mt-1 text-center">
            Backend as a Service con Supabase
          </Text>
        </View>

        <View className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-lg shadow-black/50">
          <Text className="text-xl font-bold text-white mb-6 text-center">
            Iniciar sesión o Registrarse
          </Text>

          <View className="space-y-4 gap-4">
            <View>
              <Text className="text-neutral-400 text-xs font-semibold uppercase tracking-wider mb-2">
                Correo Electrónico
              </Text>
              <TextInput
                className="bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3.5 text-white text-base placeholder:text-neutral-600 focus:border-emerald-500"
                placeholder="ejemplo@correo.com"
                placeholderTextColor="#525252"
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <View>
              <Text className="text-neutral-400 text-xs font-semibold uppercase tracking-wider mb-2">
                Contraseña
              </Text>
              <TextInput
                className="bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3.5 text-white text-base placeholder:text-neutral-600 focus:border-emerald-500"
                placeholder="Mínimo 6 caracteres"
                placeholderTextColor="#525252"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>

            {message ? (
              <View className="bg-red-500/10 border border-red-500/20 rounded-xl p-3.5">
                <Text className="text-red-400 text-sm text-center leading-5">{message}</Text>
              </View>
            ) : null}

            <Pressable
              className={`bg-emerald-500 rounded-xl py-4 items-center justify-center mt-2 ${
                busy ? 'opacity-70' : 'active:bg-emerald-600'
              }`}
              disabled={busy}
              onPress={() => submit(signIn)}
            >
              {busy ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-black font-bold text-base tracking-wide">
                  Iniciar sesión
                </Text>
              )}
            </Pressable>

            <Pressable
              className="border border-neutral-700 bg-neutral-800 rounded-xl py-3.5 items-center justify-center active:bg-neutral-700"
              disabled={busy}
              onPress={() => submit(signUp)}
            >
              <Text className="text-neutral-200 font-semibold text-sm">
                Crear cuenta nueva
              </Text>
            </Pressable>
          </View>
        </View>

        <Text className="text-neutral-600 text-xs text-center mt-8">
          La sesión se almacena de forma segura en SecureStore.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

