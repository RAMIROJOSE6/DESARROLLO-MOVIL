// app/index.tsx
import { useState } from 'react';
import { Alert, FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/context/AuthContext';
import { usePosts } from '@/hooks/usePosts';
import { createPost, deletePost, imageUrl } from '@/services/posts';

export default function MuroScreen() {
  const insets = useSafeAreaInsets();
  const { session, signOut } = useAuth();
  const { posts, isLoading, error, reload } = usePosts();
  const [content, setContent] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const user = session!.user; // esta pantalla solo existe con sesión (Stack.Protected)

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return Alert.alert('Se necesita permiso de cámara');
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.5 });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

  const publish = async () => {
    if (!content.trim()) return;
    setSending(true);
    try {
      await createPost({ userId: user.id, email: user.email ?? 'anónimo', content, imageUri });
      setContent('');
      setImageUri(null);
    } catch (e) {
      Alert.alert('No se pudo publicar', e instanceof Error ? e.message : undefined);
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="¿Qué está pasando en clase?"
          value={content}
          onChangeText={setContent}
          maxLength={280}
          multiline
        />
        {imageUri && <Image source={{ uri: imageUri }} style={styles.preview} />}
        <View style={styles.row}>
          <Pressable onPress={takePhoto}>
            <Text>{imageUri ? 'Cambiar foto' : 'Tomar foto'}</Text>
          </Pressable>
          <Pressable style={styles.button} onPress={publish} disabled={sending}>
            <Text style={styles.buttonText}>{sending ? 'Publicando…' : 'Publicar'}</Text>
          </Pressable>
        </View>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={posts}
        keyExtractor={(p) => String(p.id)}
        refreshing={isLoading}
        onRefresh={reload}
        ListEmptyComponent={<Text style={styles.empty}>Aún no hay publicaciones.</Text>}
        renderItem={({ item }) => (
          <Pressable
            style={styles.post}
            onLongPress={() =>
              item.user_id === user.id &&
              Alert.alert('Eliminar publicación', undefined, [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Eliminar', style: 'destructive', onPress: () => deletePost(item) },
              ])
            }
          >
            <Text style={styles.author}>{item.author_email}</Text>
            <Text>{item.content}</Text>
            {item.image_path && <Image source={{ uri: imageUrl(item.image_path) }} style={styles.image} />}
            <Text style={styles.date}>{new Date(item.created_at).toLocaleString('es-CO')}</Text>
          </Pressable>
        )}
      />

      <Pressable
        style={[styles.signOut, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}
        onPress={signOut}
      >
        <Text>Cerrar sesión ({user.email})</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  composer: { padding: 16, gap: 8, borderBottomWidth: 1, borderColor: '#eee' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, minHeight: 60 },
  preview: { width: 80, height: 80, borderRadius: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  button: { backgroundColor: '#111', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  buttonText: { color: '#fff', fontWeight: '600' },
  error: { color: '#DC2626', padding: 16 },
  empty: { textAlign: 'center', marginTop: 40, color: '#888' },
  post: { padding: 16, gap: 6, borderBottomWidth: 1, borderColor: '#f2f2f2' },
  author: { fontWeight: '700' },
  image: { width: '100%', aspectRatio: 1, borderRadius: 10 },
  date: { color: '#888', fontSize: 12 },
  signOut: { padding: 16, alignItems: 'center', borderTopWidth: 1, borderColor: '#eee' },
});
