# Registro de Auditoría de IA (AI-LOG)

**Estudiante(s):** Ramiro José Gómez Agámez, Álvaro Javier Pinto Sierra  
**Semana:** 6  
**Proyecto:** GeoCam – Taller Integrador 2

---

## 1. Prompts Utilizados

- _"Escribe un Custom Hook en React Native con TypeScript que gestione la cámara del dispositivo, el ciclo de permisos completo (checking, undetermined, granted, denied, blocked) y la captura de fotos sin bloquear la UI."_
- _"Implementa un Custom Hook `useGeoLocation` con TypeScript que consulte permisos al montar sin solicitarlos, solicite permisos bajo demanda con degradación elegante, y soporte seguimiento en vivo con limpieza segura ante desmontaje rápido."_
- _"Escribe un Custom Hook `useShake` con `expo-sensors` (Accelerometer) con umbral de aceleración configurable, verificación de disponibilidad, intervalo de 100 ms, cooldown para evitar múltiples disparos y limpieza con bandera cancelled."_
- _"Diseña la pantalla `GeoCamScreen` y la pantalla `MapaScreen` con `react-native-maps`, integración de contexto global inmutable `GeoPhotosContext`, selector de galería moderno con `expo-image-picker` y soporte de Tailwind CSS con NativeWind v4."_

---

## 2. Código Generado vs. Código Modificado

### A. Hook `useShake`

- **¿Qué generó la IA inicialmente?:**
  Un hook que se suscribía directamente a `Accelerometer.addListener` dentro del `useEffect` sin verificar `isAvailableAsync()`, sin fijar `setUpdateInterval(100)` y reiniciando la suscripción en cada render porque la función `onShake` entraba en el arreglo de dependencias. Además, no incluía cooldown, disparando el evento decenas de veces en un solo agitado.
- **¿Qué modifiqué/corregí?:**
  1. Agregué verificación con `await Accelerometer.isAvailableAsync()`.
  2. Fijé la frecuencia de muestreo a 100 ms (`Accelerometer.setUpdateInterval(100)`).
  3. Almacené el callback `onShake` en un `useRef` para evitar re-suscripciones innecesarias en cada render.
  4. Implementé un tiempo de enfriamiento (`cooldownMs = 1000`) calculando `Date.now() - lastShakeTimeRef.current`.
  5. Calculé la magnitud vectorial euclidiana $\sqrt{x^2 + y^2 + z^2}$ y comparé contra el umbral configurado ($1.78\text{ g}$).
  6. Añadí la bandera booleana `cancelled` y el método `.remove()` en la función de limpieza (`cleanup`) del efecto.

### B. Hook `useGeoLocation`

- **¿Qué generó la IA inicialmente?:**
  Pedía permisos de ubicación inmediatamente al montar el hook y usaba `requestForegroundPermissionsAsync()` directo en el `useEffect`.
- **¿Qué modifiqué/corregí?:**
  1. Al montar el componente, únicamente se invoca `getForegroundPermissionsAsync()` para verificar el estado existente sin disparar el diálogo del sistema al usuario antes de tiempo.
  2. La solicitud activa se desacopló en la función `requestPermission` para invocarse sólo por acción explícita del usuario (respetando la regla de pedir en contexto).
  3. Se incluyó la bandera `cancelled` para resolver la condición de carrera si el componente se desmonta mientras la promesa de `watchPositionAsync` se encuentra pendiente.
  4. Se implementó la degradación elegante: si el usuario rechaza la ubicación, la cámara sigue operativa y el campo `coords` queda en `null` con tipado estricto `Coords | null`.

### C. Controles y Vista de Cámara

- **¿Qué generó la IA inicialmente?:**
  Intentó colocar los botones de disparo y selector de cámara como hijos directos dentro de `<CameraView>...</CameraView>`.
- **¿Qué modifiqué/corregí?:**
  En la API moderna de Expo Camera, `<CameraView>` no admite hijos. Se transformaron los controles en elementos hermanos posicionados de forma absoluta encima de la vista de la cámara usando `StyleSheet.absoluteFill` y Tailwind CSS.

---

## 3. Alucinaciones o Errores Detectados

| Error detectado / Alucinación                                                     | Diagnóstico del problema                                                                         | Corrección aplicada                                                                                      |
| :-------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------- |
| `import { Camera } from 'expo-camera'` y `Camera.requestCameraPermissionsAsync()` | API obsoleta reemplazada en las últimas versiones de Expo SDK.                                   | Se implementó `CameraView` y el hook oficial `useCameraPermissions()`.                                   |
| `import * as Permissions from 'expo-permissions'`                                 | Paquete deprecado y retirado del ecosistema moderno de Expo.                                     | Cada módulo gestiona sus permisos (`expo-camera`, `expo-location`).                                      |
| `mediaTypes: ImagePicker.MediaTypeOptions.Images`                                 | Constante obsoleta que genera advertencias o errores en SDK 52/57.                               | Se reemplazó por la nueva sintaxis recomendada: `mediaTypes: ['images']`.                                |
| Controles UI anidados dentro de `<CameraView>`                                    | No soportado en `CameraView`; causa fallos de render y controles invisibles.                     | Se estructuraron como componentes hermanos en posiciones absolutas (`z-index`).                          |
| `watchPositionAsync` sin bandera `cancelled`                                      | La promesa puede resolverse tras desmontar el componente dejando el GPS activo.                  | Manejo con bandera `let cancelled = false;` y `sub.remove()`.                                            |
| Permisos de fondo `requestBackgroundPermissionsAsync`                             | Innecesario y causa rechazo en Google Play Store / Apple App Store.                              | Se utiliza exclusivamente ubicación en primer plano (`requestForegroundPermissionsAsync`).               |
| Incompatibilidad en formato EXIF                                                  | Diferencia entre plataformas en la estructura de metadatos GPS al importar fotos.                | Lectura unificada compatible tanto para objetos Android (`GPSLatitude`) como diccionarios iOS (`{GPS}`). |
| Propiedad `newArchEnabled` en `app.json`                                          | Expo SDK 57 habilita la Nueva Arquitectura por defecto y rechaza esta clave en el schema.        | Removida la propiedad para cumplir el esquema estricto verificado con `npx expo-doctor`.                 |
| Lienzo de mapa en blanco (`#F5F3ED`) en Android                                   | Google Maps en Android bloquea la descarga de tiles sin API Key propia en producción/desarrollo. | Se integró capa libre `UrlTile` con CartoDB/OpenStreetMap y auto-enfoque con `mapRef.animateToRegion`.   |
