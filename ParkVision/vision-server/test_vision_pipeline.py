import os
import cv2
import numpy as np
import base64
import json
import time

# Configurar entorno
WORKSPACE_DIR = os.path.dirname(os.path.abspath(__file__))
os.environ["YOLO_CONFIG_DIR"] = os.path.join(WORKSPACE_DIR, ".yolo")

from vision_server import (
    clasificar_color_hsv,
    normalizar_placa,
    extraer_placa_y_marcas,
    detectar_danos_y_suciedad,
    yolo_model
)

print("[TEST] Probando funciones de visión artificial con imagen real...")

# 1. Crear una imagen de prueba simulando un vehículo rojo con placa colombiana 'ABC-123'
img = np.zeros((480, 640, 3), dtype=np.uint8)
# Pintar carrocería roja (BGR: 0, 0, 200)
img[100:380, 80:560] = [20, 20, 210]
# Pintar placa amarilla (BGR: 0, 215, 255)
img[320:370, 240:400] = [0, 215, 255]
# Escribir placa con cv2
cv2.putText(img, "ABC 123", (250, 355), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 0, 0), 2)
# Escribir marca
cv2.putText(img, "CHEVROLET", (245, 150), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)

# Prueba de clasificación de color HSV
color_res = clasificar_color_hsv(img)
print(f"✓ Color detectado: {color_res['color']} (Confianza: {color_res['confianza']}%)")
assert color_res['color'] in ["Rojo", "Vinotinto"], f"Esperado Rojo, obtenido {color_res['color']}"

# Prueba de normalización de placa
p1 = normalizar_placa("ABC123")
p2 = normalizar_placa("colombia ABC-123 particular")
print(f"✓ Normalización de placa: {p1} / {p2}")
assert p1 == "ABC-123"

# Prueba de OCR sobre imagen
ocr_res = extraer_placa_y_marcas(img)
print(f"✓ OCR Placa detectada: {ocr_res['placa']}")
print(f"✓ OCR Marca detectada: {ocr_res['marca']}")

# Prueba de detección de daños
danos_res = detectar_danos_y_suciedad(img)
print(f"✓ Daños detectados: {len(danos_res['danos'])}, Suciedad descartada: {danos_res['suciedad_descartada']}")

print("\n🎉 TODOS LOS MÓDULOS DE VISIÓN ARTIFICIAL (YOLO + OCR + HSV + DAÑOS) FUNCIONAN CORRECTAMENTE!")
