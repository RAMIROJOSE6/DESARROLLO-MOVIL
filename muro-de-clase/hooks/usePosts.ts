// hooks/usePosts.ts
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { listPosts, type Post } from '@/services/posts';

export function usePosts() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setPosts(await listPosts());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el muro');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();

    // Tiempo real: ante cualquier cambio en la tabla, se vuelve a consultar
    const channel = supabase
      .channel('muro-posts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => {
        reload();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel); // misma regla de la Semana 6: toda suscripción se limpia
    };
  }, [reload]);

  return { posts, isLoading, error, reload };
}
