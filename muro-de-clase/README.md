# Muro de Clase 🧱

Ejemplo de clase de la **Semana 8: Backend as a Service con Supabase**.
Programación Móvil Avanzada · Universidad de La Guajira.

Muro compartido del curso: cada persona se registra, publica un mensaje con foto opcional y ve las publicaciones de los demás en tiempo real.

**Versiones:** Expo SDK 57 · Expo Router · supabase-js 2 · expo-secure-store.

## Qué demuestra

| Pieza de Supabase | Dónde está |
| --- | --- |
| Auth (correo y contraseña) | `context/AuthContext.tsx`, `app/login.tsx` |
| Sesión segura en el teléfono | `lib/secureStorage.ts` (SecureStore por fragmentos) |
| Rutas protegidas | `app/_layout.tsx` con `Stack.Protected` |
| Tabla con Row Level Security | `supabase/schema.sql` |
| Storage (subida de fotos) | `services/posts.ts` |
| Realtime | `hooks/usePosts.ts` |

## Cómo ejecutarlo

1. **Proyecto en Supabase.** Crea un proyecto y ejecuta `supabase/schema.sql` en el SQL Editor.
2. **Confirmación por correo.** Para clase, desactívala en la configuración del proveedor Email de Authentication. Así el registro inicia sesión de inmediato.
3. **Credenciales.** Copia `.env.example` como `.env` y pon la URL y la publishable key de tu proyecto.
4. **Instalar y correr.**

   ```bash
   npm install
   npx expo install --fix
   npx expo start -c
   ```

> Después de crear o cambiar `.env` hay que reiniciar con `-c`: las variables se leen al empaquetar.

## Pruebas

- [ ] Regístrate y publica un mensaje con foto.
- [ ] Abre la app en un segundo teléfono con otra cuenta: la publicación aparece sola.
- [ ] Cierra la app por completo y vuelve a abrir: la sesión sigue iniciada.
- [ ] Mantén presionada una publicación tuya para eliminarla. En las ajenas no pasa nada.
- [ ] Cierra sesión: la app vuelve al login sin navegar a mano.

## Seguridad

- `.env` está en `.gitignore`. Verifícalo con `git status` antes del primer commit.
- En la app solo va la publishable key. La secret key y la contraseña de la base nunca.
- Si compartes la URL y la llave con el salón, al terminar la clase rota la llave o pausa el proyecto.

## Errores frecuentes

| Síntoma | Causa | Solución |
| --- | --- | --- |
| "Faltan EXPO_PUBLIC_SUPABASE_URL..." | No existe `.env` o no se reinició | Crear `.env` y `npx expo start -c` |
| El registro dice "Revisa tu correo" | La confirmación por correo está activa | Desactivarla o confirmar el correo |
| El feed llega vacío sin error | Falta la política de `select` o no hay sesión | Revisar `schema.sql` |
| "new row violates row-level security policy" al subir | La ruta no empieza por el id del usuario | Revisar `uploadImage` |
| Las publicaciones nuevas no aparecen solas | La tabla no está en `supabase_realtime` | Ejecutar el `alter publication` |

## Documentación

- [Supabase con Expo React Native](https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native)
- [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/)
- [Autenticación en Expo Router](https://docs.expo.dev/router/advanced/authentication/)
- [Control de acceso en Supabase Storage](https://supabase.com/docs/guides/storage/security/access-control)
