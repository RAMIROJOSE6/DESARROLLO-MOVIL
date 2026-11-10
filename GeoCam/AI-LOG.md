# 🤖 Registro de Auditoría de IA (AI-LOG)

**Estudiante(s):** Ramiro José Gómez Agámez, Álvaro Javier Pinto Sierra  
**Semana:** 9  
**Proyecto:** GeoCam sincronizada – Taller Integrador 2  

---

## 1. Prompts Utilizados

- *"Implementa una arquitectura de sincronización bidireccional Offline-First entre SQLite (Drizzle ORM) y Supabase (PostgreSQL + Storage) usando TanStack Query v5 en React Native / Expo SDK 57."*
- *"Configura el cliente TanStack Query conectando onlineManager con expo-network y useAppFocusManager con AppState para reanudar sincronización al reconectar o volver a primer plano."*
- *"Crea el flujo pull y push en services/sync.ts con cursor de servidor (server_updated_at), regla de resolución de conflictos remoteWins() (gana el último cambio) y tabla sync_meta."*

---

## 2. Código Generado vs. Código Modificado

- **¿Qué generó la IA inicialmente?:**
  - Un hook `useMutation` que intentaba subir primero los datos locales con `insert` sin manejar conflictos, y luego borraba toda la base local para reemplazarla con un `select` de Supabase.
  - Generó un `useQuery(['sync'], syncAll, { cacheTime: 0 })` con la firma obsoleta de TanStack Query v3/v4.
  - Faltaba el manejo de desconexión en segundo plano; no se conectaban los eventos de `expo-network` al `onlineManager`.
- **¿Qué modifiqué/corregí?:**
  - Se invirtió el orden del ciclo: **primero bajar (`pull`), después subir (`push`)**. Esto previene que un cambio local desactualizado sobreescriba una modificación remota más reciente antes de compararlos.
  - Se cambió `insert` por `upsert` con `{ onConflict: 'client_id' }`, logrando operaciones idempotentes que no duplican filas al reintentar.
  - Se utilizó `remoteWins()` para comparar `updatedAt` local vs `updated_at` remoto fila por fila.
  - Se actualizó a la API moderna de TanStack Query v5: `useQuery({ queryKey: ['sync', userId], queryFn: () => syncAll(userId!), gcTime: 0 })`.
  - Se integró `onlineManager.setEventListener` con `expo-network` y `focusManager` con `AppState`.

---

## 3. Alucinaciones o Errores Detectados

| Error detectado / Alucinación | Diagnóstico del problema | Corrección aplicada |
| :--- | :--- | :--- |
| `useQuery(['posts'], fetchPosts)` | Firma obsoleta de v3/v4; en TanStack Query v5 solo se admite la forma con objeto. | `useQuery({ queryKey: ['posts'], queryFn: fetchPosts })` |
| `cacheTime: 0` y `status === 'loading'` | Propiedades deprecadas y removidas en TanStack Query v5. | `gcTime: 0` y `status === 'pending'` |
| `useInfiniteQuery` sin `initialPageParam` | En TanStack Query v5 es obligatorio declarar y tipar `initialPageParam`. | `initialPageParam: null as string | null` |
| `window.addEventListener('online')` | En React Native no existe el objeto global `window` para eventos de red. | `onlineManager.setEventListener` enlazado con `Network.addNetworkStateListener` de `expo-network`. |
| Subir primero y bajar después | Si se sube primero, un cambio local viejo pisa un cambio remoto más nuevo. | Se baja primero (`pull`), se comparan versiones con `remoteWins` y luego se suben pendientes (`push`). |
| Usar `id` autoincremental para emparejar | El id numérico local difiere entre teléfonos y causa colisiones. | Se utiliza un UUID persistente en `clientId` (`client_id` en Supabase). |
| `syncedAt = new Date()` al terminar de subir | Si el usuario edita la foto mientras se sube, se pierde la edición. | `syncedAt` se iguala estrictamente al `updatedAt` de la versión que fue enviada. |
| Cursor de bajada con `updated_at` | Fotos editadas sin conexión el lunes y subidas el miércoles no eran descargadas por teléfonos sincronizados el martes. | Cursor de bajada basado en `server_updated_at` generado por PostgreSQL mediante trigger. |
| Fallo `server_updated_at does not exist` en Supabase | La consulta `pull()` fallaba completamente si el backend no había ejecutado el SQL de migración. | Manejo resiliente con fallback automático a `updated_at` y script maestro `supabase_setup.sql`. |
| Desfase Expo SDK 57 vs Expo Go SDK 58 en móvil | Expo Go en el teléfono rechazaba el proyecto por diferencia de versión mayor de SDK. | Actualización completa a Expo SDK 58 (`React Native 0.88.1`, `React 19.3.0`) con `expo install --fix`. |
