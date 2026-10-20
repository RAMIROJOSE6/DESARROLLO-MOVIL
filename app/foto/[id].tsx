import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useGeoPhotos } from "@/context/GeoPhotosContext";
import { useAuth } from "@/context/AuthContext";
import { Ionicons } from "@expo/vector-icons";

export default function PhotoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { photos, updatePhoto, removePhoto, syncPhoto } = useGeoPhotos();
  const { user } = useAuth();

  const photo = photos.find((p) => p.id === id);

  const [note, setNote] = useState(photo?.note ?? "");
  const [favorite, setFavorite] = useState(Boolean(photo?.favorite));
  const [prevId, setPrevId] = useState(photo?.id);

  if (photo && photo.id !== prevId) {
    setPrevId(photo.id);
    setNote(photo.note ?? "");
    setFavorite(Boolean(photo.favorite));
  }

  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);

  if (!photo) {
    return (
      <View className="flex-1 bg-neutral-950 items-center justify-center p-6">
        <Ionicons name="image-outline" size={48} color="#737373" />
        <Text className="text-white text-lg font-bold mt-4">Foto no encontrada</Text>
        <Pressable
          className="mt-6 bg-emerald-500 px-6 py-2.5 rounded-xl"
          onPress={() => router.back()}
        >
          <Text className="text-black font-semibold">Volver</Text>
        </Pressable>
      </View>
    );
  }

  const isSynced = Boolean(
    photo.syncedAt &&
      (!photo.updatedAt || new Date(photo.syncedAt).getTime() >= new Date(photo.updatedAt).getTime())
  );

  const handleToggleFavorite = async () => {
    const next = !favorite;
    setFavorite(next);
    try {
      await updatePhoto(photo.id, { favorite: next });
    } catch {
      setFavorite(!next);
      Alert.alert("Error", "No se pudo actualizar el estado de favorito.");
    }
  };

  const handleSaveNote = async () => {
    setIsSavingNote(true);
    try {
      await updatePhoto(photo.id, { note: note.trim() });
      Alert.alert("Guardado", "Nota actualizada correctamente.");
    } catch {
      Alert.alert("Error", "No se pudo guardar la nota.");
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleUpload = async () => {
    if (!user) {
      return Alert.alert("Autenticación requerida", "Debes tener una sesión activa.");
    }
    setIsUploading(true);
    try {
      await syncPhoto(photo.id);
      Alert.alert("Éxito", "Foto subida correctamente a Supabase Storage y registrada en PostgreSQL.");
    } catch (e) {
      Alert.alert(
        "Error al subir",
        e instanceof Error ? e.message : "Fallo de conexión al subir la foto a Supabase."
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      "Eliminar foto",
      isSynced
        ? "Esta foto está en la nube. Se eliminará tanto del almacenamiento local como de Supabase."
        : "¿Deseas eliminar esta foto de tu dispositivo?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            setIsDeleting(true);
            try {
              await removePhoto(photo.id);
              router.back();
            } catch (e) {
              Alert.alert(
                "No se pudo eliminar",
                e instanceof Error ? e.message : "Error al eliminar la foto."
              );
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-neutral-950"
    >
      <ScrollView contentContainerClassName="p-4 pb-12" keyboardShouldPersistTaps="handled">
        {/* Imagen principal */}
        <View className="relative w-full aspect-square rounded-2xl overflow-hidden bg-neutral-900 border border-neutral-800">
          <Image source={{ uri: photo.uri }} className="w-full h-full" resizeMode="cover" />

          {/* Badge de sincronización */}
          <View className="absolute top-3 left-3 flex-row items-center bg-black/70 px-3 py-1.5 rounded-full border border-neutral-700">
            <Ionicons
              name={isSynced ? "cloud-done" : "cloud-offline-outline"}
              size={16}
              color={isSynced ? "#10b981" : "#f59e0b"}
            />
            <Text
              className={`text-xs font-semibold ml-1.5 ${
                isSynced ? "text-emerald-400" : "text-amber-400"
              }`}
            >
              {isSynced ? "En la nube" : "Solo local"}
            </Text>
          </View>

          {/* Botón de favorito */}
          <Pressable
            className="absolute top-3 right-3 bg-black/70 w-10 h-10 rounded-full items-center justify-center border border-neutral-700 active:scale-95"
            onPress={handleToggleFavorite}
          >
            <Ionicons
              name={favorite ? "heart" : "heart-outline"}
              size={22}
              color={favorite ? "#ef4444" : "#ffffff"}
            />
          </Pressable>
        </View>

        {/* Metadatos */}
        <View className="bg-neutral-900 rounded-2xl p-4 border border-neutral-800 mt-4 gap-2">
          <View className="flex-row justify-between items-center py-1 border-b border-neutral-800/60">
            <Text className="text-neutral-400 text-xs">Fecha de captura</Text>
            <Text className="text-neutral-200 text-xs font-medium">
              {new Date(photo.createdAt).toLocaleString("es-CO")}
            </Text>
          </View>

          <View className="flex-row justify-between items-center py-1 border-b border-neutral-800/60">
            <Text className="text-neutral-400 text-xs">Origen</Text>
            <Text className="text-neutral-200 text-xs font-medium capitalize">
              {photo.source === "camera" ? "Cámara del dispositivo" : "Galería"}
            </Text>
          </View>

          <View className="flex-row justify-between items-center py-1 border-b border-neutral-800/60">
            <Text className="text-neutral-400 text-xs">Coordenadas</Text>
            <Text className="text-neutral-200 text-xs font-medium">
              {photo.coords
                ? `${photo.coords.latitude.toFixed(5)}, ${photo.coords.longitude.toFixed(5)}`
                : "Sin ubicación"}
            </Text>
          </View>

          <View className="flex-row justify-between items-center py-1">
            <Text className="text-neutral-400 text-xs">Client ID (UUID)</Text>
            <Text className="text-neutral-400 text-[10px] font-mono">
              {photo.clientId ?? "No asignado"}
            </Text>
          </View>
        </View>

        {/* Nota */}
        <View className="bg-neutral-900 rounded-2xl p-4 border border-neutral-800 mt-4">
          <Text className="text-neutral-300 font-semibold text-sm mb-2">Nota personal</Text>
          <TextInput
            className="bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-white text-sm min-h-[70px]"
            placeholder="Agrega una descripción o comentario a esta foto..."
            placeholderTextColor="#525252"
            multiline
            value={note}
            onChangeText={setNote}
          />
          <Pressable
            className="mt-3 bg-neutral-800 border border-neutral-700 py-2.5 rounded-xl items-center"
            disabled={isSavingNote}
            onPress={handleSaveNote}
          >
            {isSavingNote ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text className="text-white text-xs font-semibold">Guardar nota</Text>
            )}
          </Pressable>
        </View>

        {/* Acciones: Subir a la nube y Eliminar */}
        <View className="mt-6 gap-3">
          <Pressable
            className={`flex-row items-center justify-center py-3.5 px-4 rounded-xl gap-2 ${
              isSynced
                ? "bg-emerald-950 border border-emerald-800"
                : "bg-emerald-500 active:bg-emerald-600"
            }`}
            disabled={isUploading}
            onPress={handleUpload}
          >
            {isUploading ? (
              <ActivityIndicator color={isSynced ? "#10b981" : "#000000"} />
            ) : (
              <>
                <Ionicons
                  name={isSynced ? "cloud-done" : "cloud-upload"}
                  size={20}
                  color={isSynced ? "#10b981" : "#000000"}
                />
                <Text
                  className={`font-bold text-sm ${
                    isSynced ? "text-emerald-400" : "text-black"
                  }`}
                >
                  {isSynced ? "Volver a sincronizar con la nube" : "Subir a la nube"}
                </Text>
              </>
            )}
          </Pressable>

          <Pressable
            className="flex-row items-center justify-center py-3.5 px-4 rounded-xl bg-red-950/40 border border-red-800/60 active:bg-red-900/50 gap-2"
            disabled={isDeleting}
            onPress={handleDelete}
          >
            {isDeleting ? (
              <ActivityIndicator color="#ef4444" />
            ) : (
              <>
                <Ionicons name="trash-outline" size={18} color="#ef4444" />
                <Text className="text-red-400 font-semibold text-sm">Eliminar foto</Text>
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
