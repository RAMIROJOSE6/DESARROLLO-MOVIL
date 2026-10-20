// app/_layout.tsx
import { ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '@/context/AuthContext';

function RootNavigator() {
  const { session, isLoading } = useAuth();

  if (isLoading) return <ActivityIndicator style={{ flex: 1 }} />;

  return (
    <Stack>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="index" options={{ title: 'Muro de Clase' }} />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="login" options={{ title: 'Ingresar' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
      <StatusBar style="dark" />
    </AuthProvider>
  );
}
