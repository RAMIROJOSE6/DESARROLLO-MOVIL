# ParkVision – Sistema Inteligente de Control de Estacionamiento e Inspección Vehicular 🚗🅿️

**Universidad de La Guajira – Facultad de Ingeniería**  
**Asignatura:** Internet de las Cosas (IoT) – Corte 3  
**Enfoque Temático:** Visión Artificial aplicada a Dispositivos IoT  
**Docente:** Ing. Eduardo Sierra Fragozo  
**Integrantes:** Ramiro José Gómez Agámez & Pedro Bruges  
**Cliente:** AutoParqueadero & Centro de Servicios "La Península" (Calle 4 N 4-28, Riohacha)  

---

## 📑 Entregables Académicos Oficiales

| Documento / Recurso | Descripción | Enlace Directo |
| :--- | :--- | :---: |
| **📄 Informe Final Completo (PDF)** | Informe técnico formal con ficha de cliente, problema, metodología, resultados, análisis A-E y costos. | [INFORME_FINAL_PROYECTO_IOT_VISION_ARTIFICIAL.pdf](./INFORME_FINAL_PROYECTO_IOT_VISION_ARTIFICIAL.pdf) |
| **📝 Informe Final Completo (Markdown)** | Versión Markdown estructurada del informe académico con fórmulas matemáticas y tablas. | [INFORME_FINAL_PROYECTO_VISION_ARTIFICIAL.md](./INFORME_FINAL_PROYECTO_VISION_ARTIFICIAL.md) |
| **🎬 Guía Oficial de Sustentación (PDF)** | Guion técnico detallado para el video de 5 minutos, con división de roles (Ramiro & Pedro) y cues en pantalla. | [GUIA_SUSTENTACION_PARKVISION.pdf](./GUIA_SUSTENTACION_PARKVISION.pdf) |
| **🧮 Script de Validación Técnica** | Demostración matemática ejecutable: parche 3x3 a mano vs OpenCV, normalización, umbrales YOLO y comparación. | [evaluacion_tecnica_uniguajira.py](./evaluacion_tecnica_uniguajira.py) |
| **🗄️ Modelo Relacional SQL** | Script DDL de tablas `tickets_parqueadero` y `espacios_parqueadero` para PostgreSQL en Supabase. | [supabase_schema.sql](./supabase_schema.sql) |
| **📊 Dataset de Pruebas** | Muestras de prueba reales y anotaciones ground truth (vehículo, placa, daños). | [dataset_pruebas/](./dataset_pruebas/) |

---

## 🏗️ Arquitectura Limpia del Proyecto

```
ParkVision/
├── INFORME_FINAL_PROYECTO_IOT_VISION_ARTIFICIAL.pdf  # 📄 Informe final en PDF
├── INFORME_FINAL_PROYECTO_VISION_ARTIFICIAL.md       # 📝 Informe final en Markdown
├── GUIA_SUSTENTACION_PARKVISION.pdf                  # 🎬 Guía oficial de sustentación (5 min)
├── GUION_VIDEO_DEMO_5_MINUTOS.md                     # 📋 Guion del video demo
├── evaluacion_tecnica_uniguajira.py                  # 🧮 Script de validación técnica A a E
├── generar_pdf_informe.py                            # ⚙️ Generador automatizado del informe PDF
├── generar_guia_pdf.py                               # ⚙️ Generador automatizado de la guía PDF
├── supabase_schema.sql                               # 🗄️ DDL relacional para PostgreSQL Supabase
├── vision_server.py                                  # 🚀 Servidor FastAPI (YOLOv8 + EasyOCR + Gemini Vision)
├── yolov8n.pt                                        # 🧠 Pesos del modelo YOLOv8n (PyTorch)
├── requirements.txt                                  # 📦 Dependencias Python del backend
├── .env.example                                      # 🔐 Plantilla de variables de entorno del servidor
├── iniciar_servidor_vision.bat                       # ⚡ Script de inicio del servidor en Windows
├── iniciar_app_web.bat                               # ⚡ Script de inicio de la app web en Windows
├── dataset_pruebas/                                  # 📊 Dataset propio de validación
│   ├── anotaciones_ground_truth.json
│   └── README.md
│
└── parkvision-app/                                   # 📱 Frontend Móvil y Web (React Native + Expo SDK 52)
    ├── app/                                          # Rutas Expo Router (Tabs: Bahías, Entrada, Salida, Historial)
    │   ├── (tabs)/
    │   │   ├── index.tsx                             # Tab 1: Mapa dinámico de bahías (20 cupos) y estado en vivo
    │   │   ├── nuevo-ingreso.tsx                     # Tab 2: Registro perimetral, cámara WebRTC y acta
    │   │   ├── auditoria.tsx                         # Tab 3: Inspección de salida, daños en rojo y entrega
    │   │   └── historial.tsx                         # Tab 4: Historial de tickets y actas en Supabase
    │   └── vehiculo/[id].tsx                         # Vista pericial detallada
    ├── src/
    │   ├── components/WebCameraModal.tsx             # Modal de cámara en vivo WebRTC (getUserMedia)
    │   ├── services/inspectionService.ts             # Lógica de sincronización y conexión con IA
    │   ├── lib/supabase.ts                           # Conector Supabase PostgreSQL
    │   └── types/index.ts                            # Definiciones TypeScript del dominio
    └── package.json
```

---

## ✨ Características Técnicas Destacadas

1. **Recepción e Ingreso Vehicular con Cámara en Vivo (WebRTC)**:
   - Integración nativa con la API `navigator.mediaDevices.getUserMedia` para capturar fotos o grabar videos directamente desde la cámara del computador o smartphone.
   - Reconocimiento automático de placa amarilla colombiana mediante máscara reflectiva HSV, realce CLAHE y EasyOCR.
   - Diagnóstico pericial inicial de abolladuras o rayones preexistentes.
   - Asignación inteligente de bahía libre (`P-01` a `P-20`) y selección del servicio (*Solo Parquear*, *Lavar y Parquear*, *Solo Lavar*).
   - Botón de descarte inmediato (papelera roja) para reiniciar la captura limpiamente.
   - Generación de acta de custodia bilateral con fotos y sellado de tiempo.

2. **Mapa de Bahías y Capacidad en Tiempo Real**:
   - Monitoreo interactivo de 20 bahías con estados dinámicos: azul/verde (disponible) y pizarra con placa (ocupada).
   - Sincronización instantánea con PostgreSQL en Supabase.

3. **Auditoría de Salida en Dos Fases con Enmarcado Rojo**:
   - **Fase 1 (Diagnóstico IA):** Análisis perimetral del video de salida comparando fotograma a fotograma con el estado de ingreso mediante Google Gemini 3.5 Flash Vision. Los daños nuevos se enmarcan visualmente con un recuadro rojo grueso (`cv2.rectangle` con etiqueta `CAMBIO: RAYON/ABOLLADURA`).
   - **Fase 2 (Confirmación Oficial del Operador):** El operario revisa el diagnóstico junto al cliente y registra formalmente si el cliente se retira **Conforme** o **No Conforme**, guardando las observaciones antes de liberar la bahía.

4. **Validación Forense de Placas Multi-fotograma**:
   - Agregación de candidatos a lo largo de todo el video de salida para evitar falsos rechazos en tomas en ángulo o con desenfoque temporal.
   - Algoritmo de equivalencia difusa (`son_placas_equivalentes`) tolerante a ruido óptico de OCR (`Q/O/0`, `B/8`, `I/1/T`, `Z/2`, `S/5`, `C/6`).
   - Bloqueo estricto e inmediato de seguridad si el auto grabado es diferente al que ingresó en la bahía.

---

## 🚀 Guía de Instalación y Uso Rápido

### 1. Iniciar el Servidor de Visión Artificial (Backend Python)
```bash
cd ParkVision
pip install -r requirements.txt
cp .env.example .env
# Configura tu GEMINI_API_KEY en .env
python vision_server.py
# O simplemente ejecuta: iniciar_servidor_vision.bat
```

### 2. Iniciar la Aplicación Móvil / Web (Frontend React Native)
```bash
cd ParkVision/parkvision-app
npm install
npx expo start --web
# O simplemente ejecuta: iniciar_app_web.bat
```

---

## 🛡️ Seguridad y Buenas Prácticas
* **Sin archivos basura:** El repositorio se mantiene depurado sin cachés, sin scripts de prueba obsoletos y sin dependencias no rastreadas.
* **Secretos protegidos:** Los archivos `.env` reales con claves API y credenciales de base de datos están rigurosamente excluidos en `.gitignore`.
