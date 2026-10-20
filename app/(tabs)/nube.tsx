import { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { listCloudPhotos, type RemotePhoto, BUCKET } from "@/services/cloudPhotos";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function NubeScreen() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const [photos, setPhotos] = useState<RemotePhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCloudPhotos = useCallback(async () => {
    try {
      const data = await listCloudPhotos();
      setPhotos(data);
      setError(null);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No se pudieron cargar las fotos de Supabase. Verifica tu conexión y RLS."
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    listCloudPhotos()
      .then((data) => {
        if (active) {
          setPhotos(data);
          setError(null);
          setIsLoading(false);
        }
      })
      .catch((e) => {
        if (active) {
          setError(
            e instanceof Error
              ? e.message
              : "No se pudieron cargar las fotos de Supabase. Verifica tu conexión y RLS."
          );
          setIsLoading(false);
        }
      });

    // C4: Actualización en tiempo real vía Supabase Realtime
    const channel = supabase
      .channel("cloud-photos-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "photos",
        },
        () => {
          fetchCloudPhotos();
        }
      )
      .subscribe();

    return () => {
      active = false;
      // Regla obligatoria: toda suscripción se limpia al desmontar
      supabase.removeChannel(channel);
    };
  }, [fetchCloudPhotos]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchCloudPhotos();
  };

  const handleDeleteRemote = (item: RemotePhoto) => {
    Alert.alert(
      "Eliminar de la nube",
      "¿Deseas eliminar esta foto de Supabase Storage y de la base de datos?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              // Borrar de storage
              await supabase.storage.from(BUCKET).remove([item.storage_path]);
              // Borrar de postgres
              await supabase.from("photos").delete().eq("id", item.id);
              fetchCloudPhotos();
            } catch (err) {
              Alert.alert(
                "Error",
                err instanceof Error ? err.message : "No se pudo eliminar de la nube."
              );
            }
          },
        },
      ]
    );
  };

  return (
    <View className="flex-1 bg-neutral-950" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="px-5 py-4 border-b border-neutral-900 flex-row justify-between items-center bg-black/40">
        <View>
          <Text className="text-xl font-bold text-white tracking-tight">
            Respaldo en la Nube ☁️
          </Text>
          <Text className="text-neutral-400 text-xs mt-0.5" numberOfLines={1}>
            {user?.email ?? "Usuario conectado"}
          </Text>
        </View>
        <Pressable
          className="bg-neutral-900 border border-neutral-800 px-3 py-1.5 rounded-xl flex-row items-center gap-1.5 active:bg-neutral-800"
          onPress={signOut}
        >
          <Ionicons name="log-out-outline" size={16} color="#ef4444" />
          <Text className="text-neutral-300 text-xs font-semibold">Salir</Text>
        </Pressable>
      </View>

      {/* Contenido principal */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center p-6">
          <ActivityIndicator size="large" color="#10b981" />
          <Text className="text-neutral-400 text-sm mt-3">Cargando fotos de Supabase...</Text>
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center p-6">
          <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
          <Text className="text-white text-base font-bold mt-3 text-center">Error de conexión</Text>
          <Text className="text-neutral-400 text-xs text-center mt-1 px-4">{error}</Text>
          <Pressable
            className="mt-4 bg-emerald-500 px-5 py-2.5 rounded-xl"
            onPress={fetchCloudPhotos}
          >
            <Text className="text-black font-semibold text-xs">Reintentar</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={photos}
          keyExtractor={(item) => String(item.id)}
          contentContainerClassName="p-4 pb-20"
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor="#10b981"
              colors={["#10b981"]}
            />
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-20 px-6">
              <View className="w-16 h-16 rounded-2xl bg-neutral-900 items-center justify-center mb-3 border border-neutral-800">
                <Ionicons name="cloud-outline" size={32} color="#737373" />
              </View>
              <Text className="text-neutral-300 font-bold text-base text-center">
                Aún no tienes fotos en la nube
              </Text>
              <Text className="text-neutral-500 text-xs text-center mt-2 max-w-xs">
                Sube tus fotos desde la pestaña GeoCam o usa el botón &quot;Sincronizar&quot; para respaldarlas en tu bucket privado.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View className="bg-neutral-900 rounded-2xl mb-4 overflow-hidden border border-neutral-800">
              <View className="relative w-full aspect-video bg-neutral-950">
                {item.signedUrl ? (
                  <Image
                    source={{ uri: item.signedUrl }}
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="w-full h-full items-center justify-center">
                    <Ionicons name="image-outline" size={32} color="#525252" />
                    <Text className="text-neutral-500 text-xs mt-1">Generando URL firmada...</Text>
                  </View>
                )}

                {item.favorite ? (
                  <View className="absolute top-2.5 right-2.5 bg-black/70 p-1.5 rounded-full">
                    <Ionicons name="heart" size={16} color="#ef4444" />
                  </View>
                ) : null}
              </View>

              <View className="p-3.5">
                {item.note ? (
                  <Text className="text-white text-sm font-medium mb-1.5">{item.note}</Text>
                ) : null}

                <View className="flex-row items-center justify-between mt-1">
                  <View className="flex-row items-center gap-1.5">
                    <Ionicons name="time-outline" size={14} color="#737373" />
                    <Text className="text-neutral-400 text-xs">
                      {new Date(item.taken_at).toLocaleString("es-CO")}
                    </Text>
                  </View>

                  <Pressable
                    className="p-1.5 rounded-lg active:bg-red-500/10"
                    onPress={() => handleDeleteRemote(item)}
                  >
                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  </Pressable>
                </View>

                {item.latitude !== null && item.longitude !== null ? (
                  <View className="flex-row items-center gap-1.5 mt-2 pt-2 border-t border-neutral-800/80">
                    <Ionicons name="location-outline" size={13} color="#10b981" />
                    <Text className="text-neutral-400 text-[11px]">
                      {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

