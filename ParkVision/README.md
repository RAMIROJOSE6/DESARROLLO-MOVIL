# ParkVision – Sistema Inteligente de Control de Estacionamiento e Inspección Vehicular 🚗🅿️

**ParkVision** es una solución integral móvil y de visión computacional para la gestión operativa de parqueaderos comerciales, centros de lavado automotriz y custodia de vehículos. Combina una aplicación móvil en **React Native / Expo** con un servidor backend en **FastAPI** potenciado por **YOLOv8** y modelos multimodales **Google Gemini Flash** para automatizar el registro, la lectura de matrículas, la asignación de bahías y la auditoría perimetral de daños entre el ingreso y la salida.

---

## 🏗️ Arquitectura del Sistema

```
ParkVision/
├── parkvision-app/           # Aplicación Móvil (React Native + Expo SDK 52 + NativeWind)
│   ├── app/                  # Rutas Expo Router (Tabs: Bahías, Entrada, Salida, Historial)
│   │   ├── (tabs)/
│   │   │   ├── index.tsx         # Tab 1: Mapa dinámico de bahías (20 cupos) y métricas en vivo
│   │   │   ├── nuevo-ingreso.tsx # Tab 2: Registro perimetral (video/foto) y emisión de acta
│   │   │   ├── auditoria.tsx     # Tab 3: Inspección de salida y detección diferencial de daños
│   │   │   └── historial.tsx     # Tab 4: Archivo histórico de actas de custodia
│   │   └── vehiculo/[id].tsx     # Vista pericial detallada del vehículo
│   ├── src/
│   │   ├── services/         # inspectionService: Sincronización Supabase y reglas de negocio
│   │   ├── lib/              # Cliente Supabase
│   │   └── types/            # Tipos TypeScript del dominio
│   └── package.json
│
├── vision-server/            # Microservicio de Visión por Computadora e IA
│   ├── vision_server.py      # Servidor FastAPI con endpoints de análisis perimetral y diferencial
│   ├── yolov8n.pt            # Modelo de detección local ultrarrápido YOLOv8
│   ├── iniciar_servidor_vision.bat # Script de inicio rápido en Windows
│   └── requirements.txt      # Dependencias Python
│
├── supabase_schema.sql       # Script DDL de PostgreSQL para tablas, índices y RLS
└── README.md
```

---

## ✨ Características Principales

1. **Recepción y Entrada (Proceso Azul Cobalto)**:
   - Captura en video perimetral o fotografía del vehículo.
   - Detección automática de tipo de vehículo, placa colombiana, color y marca.
   - Diagnóstico pericial inicial de abolladuras, rayones y estado de carrocería.
   - Asignación inteligente de bahía libre (`P-01` a `P-20`) y selección del servicio (*Solo Parquear*, *Lavar y Parquear*, *Solo Lavar*).
   - Botón de descarte inmediato si la toma no es satisfactoria.
   - Emisión y envío automático de acta de custodia por WhatsApp al cliente.

2. **Mapa de Bahías y Capacidad en Vivo**:
   - Monitoreo en tiempo real de 20 bahías con código de color: verde (libre) y gris pizarra con placa (ocupada).
   - Acceso táctil directo para registrar ingreso sobre una bahía libre o auditar salida sobre una ocupada.

3. **Salida y Auditoría Perimetral Diferencial (Proceso Granate)**:
   - Grabación perimetral de salida con comparación fotograma a fotograma contra el estado de ingreso.
   - Bounding boxes con clasificación de daños no existentes al entrar (rayón, abolladura, golpe).
   - Generación de acta de descargo y liquidación de salida con actualización instantánea de la bahía a estado disponible.

4. **Persistencia y Respaldo en la Nube**:
   - Backend as a Service con **Supabase PostgreSQL** (`tickets_parqueadero`, `espacios_parqueo`).
   - Sincronización en tiempo real y fallback offline para continuidad operativa.

---

## 🚀 Guía de Instalación y Uso

### 1. Requisitos Previos
- Node.js 18+ y npm
- Python 3.10+
- Cuenta de Supabase (tablas creadas con `supabase_schema.sql`)
- Clave de API de Google Gemini

### 2. Configuración del Servidor de Visión (`vision-server`)
```bash
cd vision-server
pip install -r requirements.txt
cp .env.example .env
# Configura tu GEMINI_API_KEY en .env
python vision_server.py
# O ejecuta iniciar_servidor_vision.bat en Windows
```

### 3. Configuración de la App Móvil (`parkvision-app`)
```bash
cd parkvision-app
npm install
cp .env.example .env
# Configura EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY y EXPO_PUBLIC_VISION_SERVER_URL
npx expo start
```

---

## 🛡️ Seguridad y Credenciales
Los archivos `.env` reales que contienen claves de Supabase y tokens de Gemini se encuentran excluidos mediante `.gitignore` para proteger la seguridad de la infraestructura. Consulte los archivos `.env.example` en cada subcarpeta para configurar las variables requeridas.
