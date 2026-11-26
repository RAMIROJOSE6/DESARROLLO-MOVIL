# DATASET DE PRUEBAS Y VALIDACIÓN – PARKVISION 🚗🅿️
## UNIVERSIDAD DE LA GUAJIRA – INGENIERÍA DE SISTEMAS
**Asignatura:** Visión Artificial  
**Docente:** Ing. Eduardo Sierra Fragozo  

Este directorio contiene las muestras fotográficas y anotaciones de prueba utilizadas para validar el sistema de visión artificial en patio real.

---

### 📂 Estructura del Dataset
```
dataset_pruebas/
├── anotaciones_ground_truth.json  # Metadatos periciales de prueba (Placa, Marca, Color, Daños, BBoxes)
├── README.md                      # Documentación del dataset
├── vehiculo_prueba_01_ingreso.jpg # Muestra de prueba: Entrada sin daños
├── vehiculo_prueba_01_salida.jpg  # Muestra de prueba: Salida con rayón simulado en puerta
└── vehiculo_prueba_02_ingreso.jpg # Muestra de prueba: Camioneta bajo sol de mediodía
```

---

### 🏷️ Resumen de Clases y Anotaciones Ground Truth
* **Clase 0 (`vehiculo`):** Delimitación de silueta del vehículo mediante bounding box normalizado `[x_center, y_center, width, height]`.
* **Clase 1 (`placa`):** Región de placa colombiana (formato 3 letras - 3 números).
* **Clase 2 (`dano_rayon`):** Discontinuidad en pintura detectada por gradientes Sobel.
* **Clase 3 (`dano_abolladura`):** Deformación volumétrica de chapa.

Consulte el archivo `anotaciones_ground_truth.json` para la validación numérica automatizada ejecutada por `evaluacion_tecnica_uniguajira.py`.
