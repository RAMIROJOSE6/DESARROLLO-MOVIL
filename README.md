# Desarrollo Móvil – Repositorio de Proyectos 📱☁️

**Universidad de La Guajira**  
**Autores:** Ramiro José Gómez Agámez y Álvaro Javier Pinto Sierra  
**Tecnologías:** React Native, Expo SDK, Expo Router, TypeScript, SQLite (Drizzle ORM), Supabase (Auth, PostgreSQL, Storage, Realtime), IA Generativa (Gemini Nano Banana), NativeWind (Tailwind CSS).

---

## 📂 Estructura del Repositorio

Este repositorio contiene los proyectos desarrollados:

```
DESARROLLO-MOVIL/
├── einuushi-app/     # 🧵 Einuushi: Tienda Móvil de Artesanías Wayuu + Panel Admin + Diseñador IA (Nano Banana)
├── GeoCam/           # 📷 Taller Integrador: Persistencia local SQLite + Respaldo privado en Supabase
├── muro-de-clase/    # 🧱 Ejemplo de Clase: Muro colaborativo en tiempo real con Supabase
├── README.md         # 📄 Documentación general del repositorio
└── .gitignore        # 🛡️ Protección de credenciales y dependencias
```

---

## 1. 🧵 [Einuushi – Tienda Móvil & Panel Administrativo](./einuushi-app)

Aplicación móvil integral de comercio electrónico de artesanías tradicionales Wayuu con asistente de diseño inteligente (IA generativa Nano Banana de Gemini Pro) y panel de control operativo y de auditoría.

- **Frontend:** React Native con Expo SDK 54, Expo Router v4 y TypeScript.
- **Backend as a Service:** Supabase (PostgreSQL, Storage de imágenes en bucket `einuushi-media`, Realtime).
- **Diseñador de Artesanías IA:** Generador interactivo de patrones y mochilas Wayuu con prompts calibrados en Nano Banana (Gemini Pro).
- **Panel Administrativo con Auditoría:** Gestión de catálogo, actualización de stock, confirmación y despacho de pedidos, atención de chat en vivo y registro inmutable de trazabilidad por administrador responsable.
- **Seguridad Jerárquica:** Superadministrador principal con permisos exclusivos de creación y administración de usuarios vs Administradores operativos con aislamiento de datos.
- **Recuperación de Contraseña:** Flujo seguro por correo con códigos temporales (EmailJS).

👉 **[Ver documentación completa de Einuushi](./einuushi-app/README.md)**

---

## 2. 📷 [GeoCam (Taller Integrador 2 – Proyecto Principal)](./GeoCam)

Aplicación móvil **offline-first** para captura fotográfica con geolocalización, persistencia local y sincronización con Supabase.

- **Persistencia local:** SQLite (`geocam.db`) con tabla `geo_photos` y migraciones automáticas versionadas (`drizzle-kit`).
- **Autenticación segura:** Supabase Auth con adaptador por fragmentos en `expo-secure-store` (evita los límites de iOS Keychain y el almacenamiento en texto plano).
- **Rutas protegidas:** Uso de `<Stack.Protected guard={...}>` en Expo Router.
- **Respaldo en la nube:** Bucket privado `geocam` con aislamiento por carpeta de usuario (`<userId>/<clientId>.jpg`) y políticas RLS estrictas.
- **Subida de imágenes binarias:** Conversión estricta a `ArrayBuffer` mediante `base64-arraybuffer` y `expo-file-system`.
- **Sincronización:** Botón "Sincronizar" con reporte de avance paso a paso ("Subiendo 3 de 7"), prevención de archivos huérfanos y borrado coherente.
- **Pestaña Nube en tiempo real:** Carga de imágenes mediante URLs firmadas (`signedUrl`) y actualización instantánea con `postgres_changes`.
- **Aislamiento por usuario:** Cada usuario ve y gestiona exclusivamente sus propias fotos locales y remotas (`ownerId` / RLS).

👉 **[Ver documentación completa, diagramas y evidencias de GeoCam](./GeoCam/README.md)**

---

## 3. 🧱 [Muro de Clase (Ejemplo Guiado de Clase)](./muro-de-clase)

Muro colaborativo en tiempo real donde los estudiantes se registran, publican mensajes con foto opcional y visualizan en vivo las publicaciones de sus compañeros.

- **Auth:** Registro e inicio de sesión con correo y contraseña.
- **Base de datos remota:** Tabla `posts` protegida con Row Level Security (`auth.uid() = user_id`).
- **Storage:** Bucket público `muro` para imágenes de publicaciones.
- **Realtime:** Suscripción reactiva mediante `usePosts` y canales WebSocket de Supabase.

👉 **[Ver instrucciones de ejecución de Muro de Clase](./muro-de-clase/README.md)**

---

## 🛡️ Auditoría de Seguridad y Credenciales

- Todos los proyectos tienen sus archivos `.env` ignorados en `.gitignore`.
- Se versionan únicamente los archivos de plantilla `.env.example`.
- **Verificación en el historial:** Ningún commit contiene llaves secretas (`service_role`) ni contraseñas de base de datos.
