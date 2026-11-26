# GUION OFICIAL PARA VIDEO DEMOSTRACIÓN (MÁXIMO 5 MINUTOS)
## PROYECTO FINAL: PARKVISION – ASIGNATURA IOT (ENFOQUE EN VISIÓN ARTIFICIAL)
**Universidad de La Guajira – Facultad de Ingeniería**  
**Docente:** Ing. Eduardo Sierra Fragozo  
**Plataforma de Entrega:** Enlace de YouTube (No listado) o Google Drive  
**Duración Total:** 4:45 a 5:00 minutos  

---

### ESTRUCTURA DE TIEMPO Y PARTICIPACIÓN

```
[00:00 - 00:45] Bloque 1: Presentación, Cliente y Problema de Negocio (Integrante 1)
[00:45 - 02:00] Bloque 2: Demostración en Vivo: Proceso de Ingreso y Mapa de Bahías (Integrante 1)
[02:00 - 03:00] Bloque 3: Demostración en Vivo: Auditoría Pericial de Salida y WhatsApp (Integrante 2)
[03:00 - 04:15] Bloque 4: Explicación Técnica y Operaciones del Semestre (Integrante 3 / Integrante 1)
[04:15 - 05:00] Bloque 5: Métricas, Casos de Falla y Cierre (Todos los Integrantes)
```

---

### MINUTO A MINUTO DETALLADO

#### ⏱️ MINUTO 0:00 - 0:45 | BLOQUE 1: INTRODUCCIÓN Y CLIENTE
* **Qué se muestra en pantalla:** Cámara con los integrantes presentándose y diapositiva / pantalla inicial de ParkVision con el logo de la Universidad de La Guajira.
* **Qué decir:**
  > "Buenas tardes, profesor Eduardo Sierra y compañeros. Presentamos el proyecto final de la asignatura Internet de las Cosas (IoT), con enfoque en Visión Artificial: **ParkVision**, desarrollado para el **AutoParqueadero y Centro de Servicios El Rodadero** en la ciudad de Riohacha.
  > 
  > El problema crítico que resuelve el sistema son los constantes reclamos económicos por rayones y abolladuras que los clientes aseguran haber sufrido dentro del parqueadero, costándole al negocio más de un millón de pesos mensuales en latonería, además de la lentitud del registro manual. Hoy demostraremos cómo automatizamos la custodia vehicular de punta a punta mediante visión artificial y una app móvil conectada a una base de datos en tiempo real."

---

#### ⏱️ MINUTO 0:45 - 02:00 | BLOQUE 2: DEMOSTRACIÓN EN VIVO: INGRESO VEHICULAR
* **Qué se muestra en pantalla:** Grabación de pantalla del celular con la app móvil ParkVision y vista de la cámara filmando un automóvil real.
* **Qué decir:**
  > "Aquí tenemos la aplicación móvil desarrollada en React Native y Expo. En la pantalla principal observamos el mapa interactivo con las 20 bahías del parqueadero, donde las verdes indican disponibilidad inmediata.
  > 
  > Cuando el vehículo llega al patio, el operario presiona **'REGISTRAR INGRESO'**. Con la cámara del smartphone graba el video perimetral del auto. El video se envía a nuestro servidor FastAPI. En menos de 2.5 segundos, el sistema procesa los fotogramas y extrae automáticamente:
  > 1. La matrícula colombiana.
  > 2. La marca y modelo.
  > 3. El color de carrocería.
  > 4. El diagnóstico inicial de abolladuras o rayones previos.
  > 
  > El operario selecciona la bahía libre (por ejemplo P-04), el tipo de servicio y presiona **'REGISTRAR INGRESO Y EMITIR ACTA'**. Al instante, la bahía P-04 pasa a estado ocupado en el mapa en tiempo real y el cliente recibe su acta por WhatsApp."

---

#### ⏱️ MINUTO 02:00 - 03:00 | BLOQUE 3: DEMOSTRACIÓN EN VIVO: SALIDA Y AUDITORÍA
* **Qué se muestra en pantalla:** Pestaña de Salida / Auditoría en el celular, filmando el vehículo antes de salir y mostrando la comparación diferencial.
* **Qué decir:**
  > "Al momento en que el cliente retira su vehículo, pasamos a la pestaña de **Salida**. Seleccionamos el vehículo en el listado y grabamos el video o foto de inspección de entrega.
  > 
  > Nuestro algoritmo compara matemáticamente el fotograma de salida contra el de entrada. Si el auto sale exactamente igual, el sistema emite el acta de descargo conforme: '100% Intacto'. Pero si se produjo un nuevo rayón o abolladura durante la estadía, el sistema lo delimita en pantalla con un recuadro rojo, clasifica el tipo de daño y genera la alerta pericial.
  > 
  > Al generar la salida, la bahía queda liberada automáticamente en la base de datos de Supabase y el formulario se reinicia para el siguiente turno."

---

#### ⏱️ MINUTO 03:00 - 04:15 | BLOQUE 4: SUSTENTACIÓN TÉCNICA Y OPERACIONES DEL SEMESTRE
* **Qué se muestra en pantalla:** Fragmentos de código en VS Code (`vision_server.py`, `evaluacion_tecnica_uniguajira.py`) y terminal ejecutando las pruebas.
* **Qué decir:**
  > "¿Cómo funciona por dentro? Combinamos las técnicas fundamentales vistas en el curso:
  > 1. **Detección con YOLOv8:** Identifica la silueta vehicular y aísla la región de interés.
  > 2. **Operaciones Aritméticas:** Para la detección de daños utilizamos la resta absoluta de imágenes con `cv2.absdiff` entre los fotogramas de entrada y salida, midiendo la energía de la diferencia.
  > 3. **Filtros Espaciales de Sobel:** Calculamos los gradientes horizontales y verticales para detectar bordes agudos correspondientes a rayones de pintura.
  > 4. **Morfología Matemática:** Aplicamos operaciones de Apertura para eliminar falsos positivos provocados por motas de polvo o barro seco de Riohacha, conservando únicamente las líneas continuas de daño estructural.
  > 5. **Normalización:** Comprobamos analíticamente que sin dividir los píxeles entre 255, el gradiente se satura a cero anulando el aprendizaje de la red neuronal."

---

#### ⏱️ MINUTO 04:15 - 05:00 | BLOQUE 5: MÉTRICAS, PUNTOS DE ALCANCE Y CONCLUSIÓN
* **Qué se muestra en pantalla:** Tabla de métricas, base de datos en Supabase con los registros y cámara con todos los integrantes despidiéndose.
* **Qué decir:**
  > "El sistema alcanzó una precisión del **99.1%** en detección de vehículos y **96.8%** en lectura de placas. En la base de datos PostgreSQL de Supabase quedan almacenados todos los registros con su fecha, hora, fotografías e historial de daños.
  > 
  > Para los puntos de alcance de la rúbrica implementamos:
  > • La aplicación móvil nativa para el cliente (+0.5).
  > • El despliegue de servidor FastAPI fuera de Colab (+0.5).
  > • La comparación entre YOLOv8 local y Gemini Multimodal (+0.4).
  > • El análisis de costos con retorno de inversión en menos de un mes (+0.4).
  > • Y la inferencia en tiempo real a más de 25 cuadros por segundo (+0.3).
  > 
  > Con esto demostramos un sistema completo, robusto y aplicable a nuestra región. Muchas gracias."
