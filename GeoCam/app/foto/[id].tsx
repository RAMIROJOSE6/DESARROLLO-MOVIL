// app/foto/[id].tsx
// C3: ver una foto, editar su nota, marcarla como favorita, moverla de álbum y eliminarla.
// Semana 10: IA Generativa Multimodal con Google Gemini (Describir con IA, tags, historial y privacidad).
import { useEffect, useState } from 'react';
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
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { usePhoto } from '@/hooks/usePhoto';
import { usePhotos } from '@/hooks/usePhotos';
import { useAlbums } from '@/hooks/useAlbums';
import { isPending, useSync } from '@/hooks/useSync';
import { describirFotoConIA, type VisionOptions } from '@/services/vision';
import { photosRepo } from '@/db/repositories/photos';
import { aiHistoryRepo } from '@/db/repositories/aiHistory';
import type { AiHistoryItem } from '@/db/schema';

type ToneOption = NonNullable<VisionOptions['tono']>;

export default function PhotoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const photoId = Number(id);

  const { photo, isLoading } = usePhoto(photoId);
  const { updatePhoto, removePhoto } = usePhotos();
  const { albums } = useAlbums();
  const sync = useSync();

  const [note, setNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Estados de IA (Semana 10)
  const [aiDesc, setAiDesc] = useState('');
  const [aiTags, setAiTags] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [savingAi, setSavingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [selectedTone, setSelectedTone] = useState<ToneOption>('natural');
  const [history, setHistory] = useState<AiHistoryItem[]>([]);

  // Cargar nota y descripción previa guardada
  useEffect(() => {
    if (photo) {
      setNote(photo.note ?? '');
      setAiDesc(photo.aiDescription ?? '');
      if (photo.aiTags) {
        setAiTags(photo.aiTags.split(',').map((t) => t.trim()).filter(Boolean));
      } else {
        setAiTags([]);
      }
      // Cargar historial de IA de SQLite (C1)
      aiHistoryRepo.listByPhoto(photo.id).then(setHistory).catch(console.warn);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo?.id]);

  if (isLoading) {
    return <View className="flex-1 bg-neutral-950" />;
  }

  if (!photo) {
    return (
      <View className="flex-1 items-center justify-center bg-neutral-950 px-8">
        <Text className="text-center text-neutral-300">Esta foto ya no existe.</Text>
      </View>
    );
  }

  const noteChanged = note.trim() !== (photo.note ?? '');
  const aiChanged = aiDesc.trim() !== (photo.aiDescription ?? '');
  const hasLocation = photo.latitude != null && photo.longitude != null;

  const saveNote = async () => {
    setSavingNote(true);
    try {
      await updatePhoto(photo.id, { note: note.trim() || null });
    } finally {
      setSavingNote(false);
    }
  };

  // Semana 10 (T2, T4, T5, T6, C4): Describir foto con IA
  const handleDescribeWithAI = async () => {
    if (!sync.isOnline) {
      Alert.alert(
        'Sin conexión a internet',
        'El análisis visual con IA requiere conexión para consultar la Edge Function y Google Gemini. Conéctate a una red e intenta nuevamente.'
      );
      return;
    }

    setIsAnalyzing(true);
    setAiError(null);

    try {
      const result = await describirFotoConIA(photo.uri, {
        tono: selectedTone,
      });

      setAiDesc(result.descripcion);
      setAiTags(result.etiquetas);

      // Guardar inmediatamente en SQLite (T3, T5)
      const tagsString = result.etiquetas.join(', ');
      await photosRepo.setAiDescription(photo.id, result.descripcion, tagsString);

      // Guardar en el historial de SQLite (C1)
      await aiHistoryRepo.save({
        photoId: photo.id,
        prompt: `Análisis multimodal con tono ${selectedTone}`,
        response: result.descripcion,
        tags: tagsString,
        tone: selectedTone,
      });

      // Recargar historial
      const updatedHistory = await aiHistoryRepo.listByPhoto(photo.id);
      setHistory(updatedHistory);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al analizar la foto';
      setAiError(msg);
      Alert.alert('Error con IA', msg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveAiDescription = async () => {
    setSavingAi(true);
    try {
      const tagsString = aiTags.join(', ');
      await photosRepo.setAiDescription(photo.id, aiDesc.trim(), tagsString);
      Alert.alert('Guardado', 'Descripción de IA actualizada. Se sincronizará con la nube.');
    } finally {
      setSavingAi(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert('Eliminar foto', '¿Eliminar esta foto de GeoCam?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await removePhoto(photo.id);
          router.back();
        },
      },
    ]);
  };

  const tones: { label: string; value: ToneOption }[] = [
    { label: '🌿 Natural', value: 'natural' },
    { label: '🔍 Detallado', value: 'detallado' },
    { label: '🎨 Poético', value: 'poetico' },
    { label: '⚙️ Técnico', value: 'tecnico' },
  ];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-neutral-950"
    >
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 18 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Imagen principal */}
        <Image
          source={{ uri: photo.uri }}
          className="aspect-square w-full rounded-2xl bg-neutral-900"
          resizeMode="cover"
        />

        {/* Datos y favorita */}
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 gap-1">
            <Text className="font-semibold text-white">
              {photo.source === 'gallery' ? 'Importada de galería' : 'Tomada con cámara'}
            </Text>
            <Text className="font-mono text-xs text-emerald-300">
              {hasLocation
                ? `${photo.latitude!.toFixed(5)}, ${photo.longitude!.toFixed(5)}`
                : 'Sin ubicación'}
            </Text>
            <Text className="text-xs text-neutral-400">{photo.createdAt.toLocaleString('es-CO')}</Text>
          </View>
          <Pressable
            onPress={() => updatePhoto(photo.id, { favorite: !photo.favorite })}
            className="h-11 w-11 items-center justify-center rounded-full bg-neutral-900"
            accessibilityRole="button"
            accessibilityLabel={photo.favorite ? 'Quitar de favoritas' : 'Marcar como favorita'}
          >
            <Ionicons
              name={photo.favorite ? 'star' : 'star-outline'}
              size={24}
              color={photo.favorite ? '#facc15' : '#a3a3a3'}
            />
          </Pressable>
        </View>

        {/* ============================================================== */}
        {/* SECCIÓN SEMANA 10: ASISTENTE IA MULTIMODAL (GOOGLE GEMINI)    */}
        {/* ============================================================== */}
        <View className="gap-3 rounded-2xl border border-violet-500/30 bg-neutral-900/90 p-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Ionicons name="sparkles" size={20} color="#a855f7" />
              <Text className="font-bold text-white">Descripción con IA</Text>
            </View>
            <View className="rounded-full bg-violet-950 px-2.5 py-0.5 border border-violet-800">
              <Text className="text-[10px] font-semibold text-violet-300">Gemini Vision</Text>
            </View>
          </View>

          {/* Selector de tono / estilo (C2) */}
          <View className="flex-row gap-1.5 flex-wrap">
            {tones.map((t) => (
              <Pressable
                key={t.value}
                onPress={() => setSelectedTone(t.value)}
                disabled={isAnalyzing}
                className={`rounded-full px-3 py-1.5 border ${
                  selectedTone === t.value
                    ? 'bg-violet-600 border-violet-500'
                    : 'bg-neutral-800 border-neutral-700'
                }`}
              >
                <Text
                  className={`text-xs ${
                    selectedTone === t.value ? 'font-semibold text-white' : 'text-neutral-300'
                  }`}
                >
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Botón principal Describir con IA (T4) */}
          <Pressable
            onPress={handleDescribeWithAI}
            disabled={isAnalyzing || !sync.isOnline}
            className={`flex-row items-center justify-center gap-2 rounded-xl p-3.5 ${
              !sync.isOnline
                ? 'bg-neutral-800 opacity-60'
                : isAnalyzing
                  ? 'bg-violet-800'
                  : 'bg-gradient-to-r bg-violet-600'
            }`}
            accessibilityRole="button"
          >
            {isAnalyzing ? (
              <>
                <ActivityIndicator color="#ffffff" size="small" />
                <Text className="font-semibold text-white">Analizando imagen con Gemini…</Text>
              </>
            ) : (
              <>
                <Ionicons name="sparkles-outline" size={18} color="#ffffff" />
                <Text className="font-semibold text-white">
                  {!sync.isOnline ? 'IA no disponible sin red' : '✨ Describir con IA'}
                </Text>
              </>
            )}
          </Pressable>

          {/* Aviso de privacidad legal (T6) */}
          <Text className="text-center text-[11px] text-neutral-400">
            🔒 La foto optimizada se envía de forma segura a Google Gemini para su análisis.
          </Text>

          {/* Error de IA con reintento (C4) */}
          {aiError && (
            <View className="rounded-xl border border-red-500/30 bg-red-950/40 p-3">
              <View className="flex-row items-center gap-1.5 mb-1">
                <Ionicons name="alert-circle" size={16} color="#f87171" />
                <Text className="font-semibold text-xs text-red-300">No se pudo describir</Text>
              </View>
              <Text className="text-xs text-red-200">{aiError}</Text>
            </View>
          )}

          {/* Campo editable de la descripción sugerida por IA (T6, C3) */}
          {(aiDesc.length > 0 || isAnalyzing) && (
            <View className="gap-2 pt-2 border-t border-neutral-800">
              <Text className="text-xs font-semibold text-violet-300">
                Sugerencia generada (editable):
              </Text>
              <TextInput
                value={aiDesc}
                onChangeText={setAiDesc}
                placeholder="La descripción generada aparecerá aquí…"
                placeholderTextColor="#737373"
                multiline
                className="min-h-20 rounded-xl bg-neutral-950 p-3 text-sm text-neutral-100 border border-neutral-800"
                textAlignVertical="top"
              />

              {/* Etiquetas / Tags generadas (C3) */}
              {aiTags.length > 0 && (
                <View className="flex-row flex-wrap gap-1.5 items-center mt-1">
                  <Text className="text-[11px] text-neutral-400 mr-1">Etiquetas:</Text>
                  {aiTags.map((tag, idx) => (
                    <View
                      key={idx}
                      className="rounded-md bg-violet-950/80 px-2 py-0.5 border border-violet-800/60"
                    >
                      <Text className="text-[11px] text-violet-300">#{tag}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Botón para guardar cambios de la descripción (T5) */}
              {aiChanged && (
                <Pressable
                  onPress={handleSaveAiDescription}
                  disabled={savingAi}
                  className="mt-2 items-center rounded-xl bg-violet-500 p-2.5"
                >
                  <Text className="font-semibold text-neutral-950 text-xs">
                    {savingAi ? 'Guardando…' : 'Guardar descripción de IA'}
                  </Text>
                </Pressable>
              )}
            </View>
          )}

          {/* Historial de consultas de IA (C1) */}
          {history.length > 1 && (
            <View className="pt-2 border-t border-neutral-800">
              <Text className="text-[11px] font-semibold text-neutral-400 mb-1.5">
                Historial de análisis previos ({history.length}):
              </Text>
              {history.slice(1, 3).map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => setAiDesc(item.response)}
                  className="mb-1 rounded-lg bg-neutral-950 p-2 border border-neutral-800/50"
                >
                  <Text className="text-[11px] text-neutral-300" numberOfLines={2}>
                    • {item.response}
                  </Text>
                  <Text className="text-[9px] text-neutral-500 mt-0.5">
                    {item.createdAt.toLocaleTimeString('es-CO')} · Tono {item.tone}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Nota manual del usuario */}
        <View className="gap-2">
          <Text className="text-sm font-semibold text-neutral-200">Nota manual</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Escribe una nota personal…"
            placeholderTextColor="#737373"
            multiline
            className="min-h-20 rounded-xl bg-neutral-900 p-3 text-white"
            textAlignVertical="top"
          />
          <Pressable
            onPress={saveNote}
            disabled={!noteChanged || savingNote}
            className={`items-center rounded-xl p-3 ${noteChanged ? 'bg-emerald-500' : 'bg-neutral-800'}`}
            accessibilityRole="button"
          >
            <Text className={noteChanged ? 'font-semibold text-neutral-950' : 'text-neutral-500'}>
              {savingNote ? 'Guardando…' : 'Guardar nota'}
            </Text>
          </Pressable>
        </View>

        {/* Álbum */}
        <View className="gap-2">
          <Text className="text-sm font-semibold text-neutral-200">Álbum</Text>
          <View className="flex-row flex-wrap gap-2">
            {[{ id: null as number | null, name: 'Sin álbum' }, ...albums].map((album) => {
              const selected = photo.albumId === album.id;
              return (
                <Pressable
                  key={album.id ?? 'none'}
                  onPress={() => updatePhoto(photo.id, { albumId: album.id })}
                  className={`rounded-full border px-4 py-2 ${
                    selected ? 'border-emerald-500 bg-emerald-500' : 'border-neutral-700'
                  }`}
                >
                  <Text className={selected ? 'font-semibold text-neutral-950' : 'text-neutral-200'}>
                    {album.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {albums.length === 0 && (
            <Text className="text-xs text-neutral-500">Crea álbumes desde la pestaña Fotos.</Text>
          )}
        </View>

        {/* Nube: estado de sincronización */}
        <View className="gap-2">
          <Text className="text-sm font-semibold text-neutral-200">Nube</Text>
          {isPending(photo) ? (
            <Pressable
              onPress={() => sync.syncNow()}
              disabled={!sync.isOnline || sync.isSyncing}
              className="flex-row items-center gap-2 rounded-xl bg-neutral-900 p-3"
              accessibilityRole="button"
            >
              <Ionicons name="cloud-upload-outline" size={18} color="#fbbf24" />
              <Text className="flex-1 text-neutral-200">
                {sync.isSyncing
                  ? 'Sincronizando…'
                  : sync.isOnline
                    ? 'Pendiente de subir · toca para sincronizar'
                    : 'Pendiente · se subirá al volver la conexión'}
              </Text>
            </Pressable>
          ) : (
            <View className="flex-row items-center gap-2 rounded-xl bg-neutral-900 p-3">
              <Ionicons name="cloud-done-outline" size={18} color="#10b981" />
              <Text className="flex-1 text-neutral-200">Sincronizada</Text>
            </View>
          )}
          {sync.error && <Text className="text-xs text-red-400">{sync.error.message}</Text>}
        </View>

        {/* Eliminar */}
        <Pressable
          onPress={confirmDelete}
          className="flex-row items-center justify-center gap-2 rounded-xl border border-red-500/60 p-3"
          accessibilityRole="button"
        >
          <Ionicons name="trash-outline" size={18} color="#f87171" />
          <Text className="font-semibold text-red-400">Eliminar foto</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
