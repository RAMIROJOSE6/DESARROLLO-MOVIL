// app/(tabs)/nube.tsx
// C2: Pestaña Nube con useInfiniteQuery sobre la tabla remota en Supabase.
// Paginación por cursor, infinite scroll en FlatList, búsqueda en vivo con debounce,
// y manejo de los cuatro estados de UI (carga, error con reintento, vacío y sin conexión).
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useIsOnline } from '@/lib/queryClient';
import {
  listCloudPhotosPage,
  signedUrl,
  type RemotePhotoItem,
} from '@/services/cloudPhotos';
import { SyncBadge } from '@/components/SyncBadge';

function CloudPhotoCard({ item }: { item: RemotePhotoItem }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    signedUrl(item.storage_path)
      .then((url) => {
        if (active) setImageUrl(url);
      })
      .catch((e) => console.warn('Error obteniendo signedUrl:', e));
    return () => {
      active = false;
    };
  }, [item.storage_path]);

  return (
    <View className="mb-3 flex-row gap-3 rounded-xl bg-neutral-900/90 p-3">
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} className="h-20 w-20 rounded-lg bg-neutral-800" />
      ) : (
        <View className="h-20 w-20 items-center justify-center rounded-lg bg-neutral-800">
          <ActivityIndicator size="small" color="#10b981" />
        </View>
      )}

      <View className="flex-1 justify-center gap-1">
        <Text className="font-semibold text-white" numberOfLines={2}>
          {item.favorite ? '★ ' : ''}
          {item.note || (item.source === 'gallery' ? 'Importada de galería' : 'Tomada con cámara')}
        </Text>
        {item.latitude != null && item.longitude != null && (
          <Text className="font-mono text-xs text-emerald-400">
            {item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}
          </Text>
        )}
        <Text className="text-xs text-neutral-400">
          {new Date(item.taken_at).toLocaleString('es-CO')}
        </Text>
      </View>
    </View>
  );
}

export default function NubeScreen() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const isOnline = useIsOnline();

  const feed = useInfiniteQuery({
    queryKey: ['cloud-photos', { search: debouncedSearch }],
    queryFn: ({ pageParam }) =>
      listCloudPhotosPage({ cursor: pageParam, search: debouncedSearch }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    placeholderData: keepPreviousData,
  });

  const photos = useMemo(
    () => feed.data?.pages.flatMap((page) => page.items) ?? [],
    [feed.data]
  );

  return (
    <View className="flex-1 bg-neutral-950 px-4 pt-14">
      {/* Cabecera con SyncBadge */}
      <View className="mb-4 flex-row items-center justify-between">
        <View>
          <Text className="text-2xl font-bold text-white">Nube (Supabase)</Text>
          <Text className="text-xs text-neutral-400">TanStack Query Feed Remoto</Text>
        </View>
        <SyncBadge />
      </View>

      {/* Estado: Sin conexión (Aviso con datos de caché) */}
      {!isOnline && (
        <View className="mb-3 flex-row items-center gap-2 rounded-xl bg-amber-500/10 p-3 border border-amber-500/20">
          <Ionicons name="cloud-offline" size={16} color="#fbbf24" />
          <Text className="flex-1 text-xs text-amber-300">
            Sin conexión. Mostrando datos guardados en la caché local.
          </Text>
        </View>
      )}

      {/* Buscador reactivo con debounce */}
      <View className="mb-3 flex-row items-center rounded-xl bg-neutral-900 px-3 py-2">
        <Ionicons name="search" size={18} color="#a3a3a3" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar foto remota por nota…"
          placeholderTextColor="#737373"
          className="ml-2 flex-1 text-sm text-white"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color="#737373" />
          </Pressable>
        )}
      </View>

      {/* Estado 1: Carga inicial */}
      {feed.status === 'pending' && feed.fetchStatus === 'fetching' && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#10b981" />
          <Text className="mt-3 text-sm text-neutral-400">Cargando fotos de Supabase…</Text>
        </View>
      )}

      {/* Estado 2: Sin datos y sin conexión */}
      {feed.status === 'pending' && feed.fetchStatus === 'paused' && (
        <View className="flex-1 items-center justify-center p-6">
          <Ionicons name="wifi-outline" size={48} color="#737373" />
          <Text className="mt-3 text-center text-sm text-neutral-300">
            Conéctate a internet para cargar las publicaciones de la nube.
          </Text>
        </View>
      )}

      {/* Estado 3: Error con botón de reintento */}
      {feed.status === 'error' && (
        <View className="flex-1 items-center justify-center p-6">
          <Ionicons name="alert-circle-outline" size={48} color="#f87171" />
          <Text className="mt-2 text-center text-sm text-red-400">
            {feed.error.message}
          </Text>
          <Pressable
            onPress={() => feed.refetch()}
            className="mt-4 rounded-xl bg-emerald-600 px-4 py-2"
          >
            <Text className="font-semibold text-white">Reintentar</Text>
          </Pressable>
        </View>
      )}

      {/* Estado 4: Éxito con FlatList e Infinite Scroll */}
      {feed.status === 'success' && (
        <FlatList
          data={photos}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <CloudPhotoCard item={item} />}
          refreshing={feed.isRefetching && !feed.isFetchingNextPage}
          onRefresh={() => feed.refetch()}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (feed.hasNextPage && !feed.isFetchingNextPage) {
              feed.fetchNextPage();
            }
          }}
          ListEmptyComponent={
            <View className="mt-16 items-center">
              <Ionicons name="cloud-outline" size={48} color="#737373" />
              <Text className="mt-3 text-center text-neutral-400">
                {debouncedSearch
                  ? 'Ninguna foto remota coincide con la búsqueda.'
                  : 'Aún no hay fotos en la nube.'}
              </Text>
            </View>
          }
          ListFooterComponent={
            feed.isFetchingNextPage ? (
              <View className="py-4">
                <ActivityIndicator color="#10b981" />
              </View>
            ) : undefined
          }
        />
      )}
    </View>
  );
}
