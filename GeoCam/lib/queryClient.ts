// lib/queryClient.ts
import { useEffect, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import * as Network from 'expo-network';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient, focusManager, onlineManager } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // durante 30 s no se repite una consulta que ya está en caché
      gcTime: 1000 * 60 * 60 * 24, // 24 horas para persistencia en disco (C3)
      retry: 2,
    },
  },
});

// C3: Persistencia de caché en AsyncStorage que sobrevive al cierre de la app
export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
});

// 1. TanStack Query se entera del estado de la red
onlineManager.setEventListener((setOnline) => {
  let initialised = false;
  const subscription = Network.addNetworkStateListener((state) => {
    initialised = true;
    setOnline(!!state.isConnected);
  });
  Network.getNetworkStateAsync()
    .then((state) => {
      if (!initialised) setOnline(!!state.isConnected);
    })
    .catch(() => {});
  return () => subscription.remove();
});

// 2. TanStack Query se entera de cuándo la app vuelve a primer plano
export function useAppFocusManager() {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (Platform.OS !== 'web') focusManager.setFocused(status === 'active');
    });
    return () => subscription.remove();
  }, []);
}

// 3. Hook para que la UI muestre si hay conexión
export function useIsOnline() {
  return useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline()
  );
}
