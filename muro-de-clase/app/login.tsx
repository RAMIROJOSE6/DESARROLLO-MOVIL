// app/login.tsx
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/context/AuthContext';

export default function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (action: typeof signIn) => {
    if (!email.trim() || password.length < 6) {
      return setMessage('Escribe tu correo y una contraseña de al menos 6 caracteres.');
    }
    setBusy(true);
    setMessage(await action(email, password));
    setBusy(false);
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Correo"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {message && <Text style={styles.message}>{message}</Text>}
      <Pressable style={[styles.button, busy && { opacity: 0.6 }]} disabled={busy} onPress={() => submit(signIn)}>
        <Text style={styles.buttonText}>Iniciar sesión</Text>
      </Pressable>
      <Pressable style={styles.link} disabled={busy} onPress={() => submit(signUp)}>
        <Text>Crear cuenta</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 12, justifyContent: 'center', backgroundColor: '#fff' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 16 },
  message: { color: '#DC2626' },
  button: { backgroundColor: '#111', padding: 14, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
  link: { alignItems: 'center', padding: 8 },
});
