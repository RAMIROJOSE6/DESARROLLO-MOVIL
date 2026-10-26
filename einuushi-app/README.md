# Einuushi – Tienda Móvil de Artesanías Wayuu & Panel Administrativo 🧵🎒

Aplicación móvil integral desarrollada con **React Native** y **Expo Router**, conectada a **Supabase (BaaS)** y potenciada con Inteligencia Artificial generativa (**Gemini Pro / Nano Banana**) para diseño y personalización de mochilas y artesanías Wayuu.

---

## 🌟 Características Principales

### 👤 1. Experiencia del Cliente (Tienda Móvil)
- **Catálogo Interactivo:** Exploración de mochilas, mantas, chinchorros y accesorios tradicionales Wayuu con fotos en alta resolución alojadas en Supabase Storage.
- **Visualizador Fullscreen (Lightbox):** Apertura de imágenes a pantalla completa con zoom, detalles del producto y precio.
- **Carrito y Checkout:** Gestión de pedidos con cálculos de subtotales, descuentos y envío.
- **Cotizador Personalizado:** Solicitud de cotizaciones a medida con especificaciones de colores, figuras (Kanaas) y tamaño.
- **Diseñador de Artesanías con IA:** Generador interactivo de conceptos artesanales potenciado con prompts especializados para artesanías Wayuu usando el modelo Nano Banana en Gemini.
- **Chat de Asistencia en Tiempo Real:** Comunicación directa entre el cliente y el equipo de soporte de Einuushi.
- **Recuperación Segura de Contraseña:** Envío de códigos OTP de 6 dígitos mediante servidor **EmailJS**.

### 🛡️ 2. Backoffice & Panel de Administración (`/admin`)
- **Jerarquía de Seguridad Estricta:**
  - **Superadministrador:** Único autorizado para dar de alta a nuevos administradores, asignarles o cambiarles contraseñas, y acceder a métricas completas de usuarios.
  - **Administrador Operativo:** Enfocado en la gestión de inventario, cambio de estados de pedidos (Pendiente -> Pagado -> Despachado -> Entregado) y respuesta de cotizaciones. Posee aislamiento de datos para proteger la información del Superadministrador y del directorio de clientes.
- **Trazabilidad y Bitácora de Auditoría:** Registro cronológico inmutable de movimientos (quién cambió un precio, quién despachó un pedido, quién creó un usuario).
- **Gestión Multimedia en la Nube:** Subida directa de fotos desde la cámara o galería al bucket `einuushi-media` de Supabase.

---

## 🛠️ Stack Tecnológico

- **Framework Móvil:** React Native / Expo SDK 54 / Expo Router v4
- **Lenguaje:** TypeScript (Tipado estricto)
- **Backend as a Service (BaaS):** Supabase
  - PostgreSQL Database (Tablas: `products`, `orders`, `users`, `categories`, `custom_quotes`, `chat_messages`, `admin_activity_logs`, `email_config`)
  - Supabase Storage (Bucket: `einuushi-media`)
  - Row Level Security (RLS) y Políticas de Acceso
- **Notificaciones por Correo:** EmailJS REST API
- **IA Generativa:** Google Gemini Pro (Nano Banana Prompt Crafting)
- **Almacenamiento Local:** AsyncStorage (Persistencia de sesiones seguras offline-ready)

---

## 🚀 Instalación y Puesta en Marcha

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/RAMIROJOSE6/DESARROLLO-MOVIL.git
   cd DESARROLLO-MOVIL/einuushi-app
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno:**
   Copia el archivo de plantilla `.env.example` como `.env` y coloca las credenciales de tu proyecto Supabase:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://ismvmlcemxkawdwextzk.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-aqui
   ```

4. **Ejecutar en modo desarrollo:**
   ```bash
   npx expo start
   ```

5. **Verificaciones de Calidad:**
   ```bash
   npx tsc --noEmit        # Verificación de TypeScript (0 errores)
   npx expo-doctor         # Diagnóstico de dependencias
   ```

---

## 👥 Autores
- **Universidad de La Guajira**
- **Desarrollador:** Ramiro Gómez
