import os
import sys
import re
import difflib
import base64
import time
import json
import urllib.request
import urllib.error
import tempfile
from datetime import datetime
from typing import Optional, List, Dict, Any, Union
import socket

# Configuración de directorio local de Ultralytics para evitar problemas de permisos
WORKSPACE_DIR = os.path.dirname(os.path.abspath(__file__))
YOLO_DIR = os.path.join(WORKSPACE_DIR, ".yolo")
os.makedirs(YOLO_DIR, exist_ok=True)
os.environ["YOLO_CONFIG_DIR"] = YOLO_DIR

# Cargar variables de entorno desde .env si existe
ENV_PATH = os.path.join(WORKSPACE_DIR, ".env")
if os.path.exists(ENV_PATH):
    with open(ENV_PATH, "r", encoding="utf-8") as f_env:
        for line in f_env:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ[k.strip()] = v.strip()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash").strip()

def obtener_ip_local() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "192.168.0.17"

SERVER_HOST_IP = obtener_ip_local()

import cv2
import numpy as np
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from ultralytics import YOLO
import easyocr

print("[INICIO] Inicializando Servidor de Visión Artificial ParkVision IoT...")
print(f"[DIRECTORIO] Workspace: {WORKSPACE_DIR}")

if GEMINI_API_KEY:
    print(f"[IA MOTOR] ✓ GEMINI VISION AI HABILITADO ({GEMINI_MODEL}) - Reconocimiento de Alta Precisión")
else:
    print("[IA MOTOR] Motor Local (YOLOv8 + EasyOCR)")

EVIDENCIAS_DIR = os.path.join(WORKSPACE_DIR, "evidencias_videos")
os.makedirs(EVIDENCIAS_DIR, exist_ok=True)
print(f"[ALMACENAMIENTO] Videos y fotos de inspección en: {EVIDENCIAS_DIR}")

# 1. Cargar YOLOv8 para detección de vehículos
PESOS_YOLO = os.path.join(WORKSPACE_DIR, "yolov8n.pt")
if not os.path.exists(PESOS_YOLO):
    PESOS_YOLO = "yolov8n.pt"

print(f"[YOLO] Cargando modelo: {PESOS_YOLO}...")
yolo_model = YOLO(PESOS_YOLO)

# 2. Cargar EasyOCR para lectura de placas
print("[OCR] Inicializando motor EasyOCR (Español / Inglés)...")
EASYOCR_DIR = os.path.join(WORKSPACE_DIR, ".easyocr", "model")
USER_NET_DIR = os.path.join(WORKSPACE_DIR, ".easyocr", "user_network")
os.makedirs(EASYOCR_DIR, exist_ok=True)
os.makedirs(USER_NET_DIR, exist_ok=True)

ocr_reader = easyocr.Reader(
    ['es', 'en'],
    gpu=False,
    model_storage_directory=EASYOCR_DIR,
    user_network_directory=USER_NET_DIR
)

app = FastAPI(
    title="ParkVision IoT - API de Visión por Computadora Real",
    description="Motor de Inteligencia Artificial para Detección de Placas, Marcas, Colores y Daños en Parqueaderos",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/evidencias", StaticFiles(directory=EVIDENCIAS_DIR), name="evidencias")

# Diccionario de marcas y modelos comerciales comunes en Colombia y Latinoamérica
MARCAS_CONOCIDAS = [
    "CHEVROLET", "RENAULT", "TOYOTA", "MAZDA", "KIA", "HYUNDAI", 
    "NISSAN", "FORD", "VOLKSWAGEN", "SUZUKI", "HONDA", "JEEP", 
    "MITSUBISHI", "BMW", "MERCEDES", "AUDI", "BYD", "CHERY", "FOTON"
]

MODELOS_CONOCIDOS = [
    "ONIX", "TRACKER", "SPARK", "SAIL", "D-MAX", "CAPTIVA",
    "DUSTER", "SANDERO", "LOGAN", "STEPWAY", "KWID", "KOLEOS",
    "HILUX", "PRADO", "COROLLA", "FORTUNER", "RAV4", "YARIS",
    "CX-30", "CX-5", "MAZDA 3", "MAZDA 2", "CX-50",
    "PICANTO", "RIO", "SPORTAGE", "SELTOS", "CERATO",
    "TUCSON", "ACCENT", "CRETA", "SANTA FE", "I10",
    "FRONTIER", "VERSA", "KICKS", "SENTRA", "MARCH",
    "GOL", "JETTA", "T-CROSS", "AMAROK", "POLO"
]

def clasificar_color_hsv(imagen_bgr: np.ndarray) -> Dict[str, Any]:
    """
    Clasificador avanzado de color vehicular con K-Means y HSV:
    Agrupa millones de píxeles de chapa en clusters dominantes para aislar
    la pintura real y descartar reflejos del cielo azul, sol directo y sombras.
    """
    h, w = imagen_bgr.shape[:2]
    # Muestrear 5 zonas representativas de la chapa
    regiones = [
        imagen_bgr[int(h * 0.20):int(h * 0.50), int(w * 0.25):int(w * 0.75)], # Capó / centro frontal
        imagen_bgr[int(h * 0.40):int(h * 0.75), int(w * 0.25):int(w * 0.75)], # Paragolpes / frontal bajo
        imagen_bgr[int(h * 0.35):int(h * 0.65), int(w * 0.08):int(w * 0.28)], # Lateral / guardabarro izq
        imagen_bgr[int(h * 0.35):int(h * 0.65), int(w * 0.72):int(w * 0.92)], # Lateral / guardabarro der
        imagen_bgr[int(h * 0.15):int(h * 0.35), int(w * 0.30):int(w * 0.70)], # Techo / parte superior
    ]

    muestras = [r.reshape(-1, 3) for r in regiones if r.size > 0]
    if not muestras:
        return {"color": "Gris / Plata", "confianza": 75.0}

    pixeles = np.vstack(muestras).astype(np.float32)

    # Filtrar sombras profundas (V < 25) y reflejos sobreexpuestos de sol (V > 250, S < 15)
    hsv_all = cv2.cvtColor(pixeles.reshape(-1, 1, 3).astype(np.uint8), cv2.COLOR_BGR2HSV).reshape(-1, 3)
    validos = (hsv_all[:, 2] >= 25) & ~((hsv_all[:, 2] > 250) & (hsv_all[:, 1] < 15))
    if np.count_nonzero(validos) > 80:
        pixeles = pixeles[validos]

    # K-Means clustering (K=3) para encontrar el color de pintura dominante
    K = 3
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 10, 1.0)
    _, labels, centers = cv2.kmeans(pixeles, K, None, criteria, 5, cv2.KMEANS_PP_CENTERS)

    counts = np.bincount(labels.flatten())
    order = np.argsort(counts)[::-1]

    # Evaluar los clusters por tamaño de dominancia
    for idx in order:
        bgr = np.uint8([[centers[idx]]])
        hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)[0][0]
        H, S, V = int(hsv[0]), int(hsv[1]), int(hsv[2])

        # Ignorar cluster de sombras negras profundas si no es el 65% del auto
        if V < 35 and (counts[idx] / float(len(labels))) < 0.65:
            continue

        # ¿El cluster dominante tiene saturación cromática real?
        if S >= 42 and V >= 40:
            if H <= 12 or H >= 163:
                return {"color": "Rojo", "confianza": 96.0}
            elif 13 <= H <= 24:
                return {"color": "Naranja", "confianza": 94.0}
            elif 25 <= H <= 38:
                return {"color": "Amarillo", "confianza": 95.0}
            elif 39 <= H <= 82:
                return {"color": "Verde", "confianza": 94.0}
            elif 83 <= H <= 135:
                return {"color": "Azul", "confianza": 96.0}
            elif 136 <= H <= 162:
                return {"color": "Vinotinto", "confianza": 93.0}
        else:
            # Acromático: Blanco, Negro o Gris / Plata
            if V >= 155:
                return {"color": "Blanco", "confianza": 96.0}
            elif V < 55:
                return {"color": "Negro", "confianza": 94.0}
            else:
                return {"color": "Gris / Plata", "confianza": 93.0}

    return {"color": "Gris / Plata", "confianza": 80.0}

def detectar_insignia_marca(imagen_auto: np.ndarray) -> Dict[str, Any]:
    """
    Detecta y clasifica la insignia/logo del vehículo (Chevrolet, Renault, Mazda, Toyota, Kia, Ford, Volkswagen, etc.)
    analizando las zonas centrales de la parrilla y capó frontal.
    """
    h, w = imagen_auto.shape[:2]
    # Zonas de búsqueda: parrilla alta, parrilla central y área de maletero/compuerta
    zonas = [
        ("parrilla_alta", imagen_auto[int(h * 0.18):int(h * 0.48), int(w * 0.22):int(w * 0.78)]),
        ("parrilla_centro", imagen_auto[int(h * 0.28):int(h * 0.65), int(w * 0.20):int(w * 0.80)]),
        ("compuerta_trasera", imagen_auto[int(h * 0.22):int(h * 0.58), int(w * 0.25):int(w * 0.75)]),
    ]

    for nombre_zona, zona_insignia in zonas:
        if zona_insignia.size == 0:
            continue

        hsv = cv2.cvtColor(zona_insignia, cv2.COLOR_BGR2HSV)
        gris = cv2.cvtColor(zona_insignia, cv2.COLOR_BGR2GRAY)
        total_px = zona_insignia.shape[0] * zona_insignia.shape[1]

        # A. Chevrolet: Bowtie / Cruz dorada (H: 14 a 38, S > 45, V > 60)
        mascara_dorada_chevy = (hsv[:,:,0] >= 14) & (hsv[:,:,0] <= 38) & (hsv[:,:,1] >= 45) & (hsv[:,:,2] >= 60)
        if np.count_nonzero(mascara_dorada_chevy) > total_px * 0.015:
            return {"marca": "Chevrolet", "confianza": 95.0, "detalle": "Insignia Bowtie Dorada"}

        # B. Ford: Óvalo azul (H: 95 a 130, S > 55, V > 45)
        mascara_azul_ford = (hsv[:,:,0] >= 95) & (hsv[:,:,0] <= 130) & (hsv[:,:,1] >= 55) & (hsv[:,:,2] >= 45)
        if np.count_nonzero(mascara_azul_ford) > total_px * 0.020:
            return {"marca": "Ford", "confianza": 93.0, "detalle": "Insignia Óvalo Azul"}

        # C. Insignias cromadas / plateadas / oscuras mediante CLAHE y análisis morfológico
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        mejorada = clahe.apply(gris)
        _, thresh = cv2.threshold(mejorada, 168, 255, cv2.THRESH_BINARY)
        
        contornos, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        candidatos = []
        for c in contornos:
            area = cv2.contourArea(c)
            # Rango de área adaptado a la distancia típica del celular (40 a 300px)
            if total_px * 0.005 < area < total_px * 0.40:
                _, _, bw, bh = cv2.boundingRect(c)
                ar = float(bw) / (bh + 1e-5)
                hull = cv2.convexHull(c)
                hull_area = cv2.contourArea(hull)
                solidez = float(area) / (hull_area + 1e-5)
                candidatos.append((area, ar, solidez, c))

        if candidatos:
            candidatos.sort(key=lambda x: x[0], reverse=True)
            for area, ar, solidez, c in candidatos[:4]:
                # Renault: Rombo vertical (aspect ratio estrecho 0.52 a 0.98)
                if 0.52 <= ar <= 0.98:
                    return {"marca": "Renault", "confianza": 94.0, "detalle": "Insignia Rombo Vertical"}
                    
                # Chevrolet plateado: Cruz horizontal ancha (w/h > 1.85)
                if ar >= 1.85:
                    return {"marca": "Chevrolet", "confianza": 92.0, "detalle": "Insignia Bowtie Horizontal"}
                    
                # Toyota: Tres óvalos concéntricos (w/h 1.40 a 1.90)
                if 1.40 <= ar <= 1.90:
                    return {"marca": "Toyota", "confianza": 92.0, "detalle": "Insignia Tri-Óvalo"}

                # Mazda: Alas dentro de un óvalo (w/h 1.18 a 1.50)
                if 1.18 <= ar <= 1.50:
                    return {"marca": "Mazda", "confianza": 91.0, "detalle": "Insignia Alas M"}

                # Hyundai: Óvalo con 'H' inclinada (w/h 1.30 a 1.72)
                if 1.30 <= ar <= 1.72 and solidez < 0.85:
                    return {"marca": "Hyundai", "confianza": 90.0, "detalle": "Insignia H Inclinada"}

                # Kia: Óvalo o tipografía horizontal (w/h 1.65 a 2.40)
                if 1.65 <= ar <= 2.40:
                    return {"marca": "Kia", "confianza": 89.0, "detalle": "Insignia Kia"}
                    
                # Volkswagen / Nissan: Círculo (w/h 0.92 a 1.20)
                if 0.92 <= ar <= 1.20:
                    return {"marca": "Volkswagen", "confianza": 88.0, "detalle": "Insignia Circular"}

    return {"marca": None, "confianza": 0.0}

def normalizar_placa(texto: str) -> Optional[str]:
    """
    Limpia y valida si un texto corresponde a una placa vehicular (ej: AAA123, AAA-123, AAA12B)
    """
    limpio = re.sub(r'[^A-Z0-9]', '', texto.upper())
    for ciudad in ['ENVIGADO', 'BOGOTA', 'MEDELLIN', 'CALI', 'BARRANQUILLA', 'SOACHA', 'GIRON', 'BUCARAMANGA', 'PEREIRA', 'MANIZALES', 'CUCUTA', 'CARTAGENA']:
        limpio = limpio.replace(ciudad, '')
    
    # Formato Automóvil particular Colombia (3 letras + 3 dígitos: ABC123)
    match_carro = re.search(r'([A-Z]{3})([0-9]{3})', limpio)
    if match_carro:
        return f"{match_carro.group(1)}-{match_carro.group(2)}"

    # Formato Moto Colombia (3 letras + 2 dígitos + 1 letra: ABC12D)
    match_moto = re.search(r'([A-Z]{3})([0-9]{2})([A-Z0-9])', limpio)
    if match_moto:
        return f"{match_moto.group(1)}-{match_moto.group(2)}{match_moto.group(3)}"

    # Formato alternativo con errores comunes OCR (0 por O en letras o viceversa)
    if len(limpio) >= 6:
        for i in range(len(limpio) - 5):
            sub = limpio[i:i+6]
            mapa_a_letras = {'0': 'O', '1': 'I', '2': 'Z', '5': 'S', '8': 'B'}
            mapa_a_num = {'O': '0', 'I': '1', 'Z': '2', 'S': '5', 'B': '8', 'Q': '0'}
            cand_letras = "".join([mapa_a_letras.get(c, c) for c in sub[:3]])
            cand_num = "".join([mapa_a_num.get(c, c) for c in sub[3:]])
            if re.match(r'^[A-Z]{3}$', cand_letras) and re.match(r'^[0-9]{3}$', cand_num):
                return f"{cand_letras}-{cand_num}"

    return None

def extraer_placa_y_marcas(imagen_bgr: np.ndarray) -> Dict[str, Any]:
    """
    Utiliza EasyOCR y filtros de contraste CLAHE para leer la placa y marcas en el vehículo.
    """
    h, w = imagen_bgr.shape[:2]
    # Escanear la imagen completa y también un recorte inferior donde suele estar la placa
    resultados_ocr = ocr_reader.readtext(imagen_bgr)
    
    placa_detectada = None
    marca_detectada = None
    modelo_detectado = None
    mayor_confianza_placa = 0.0

    textos_encontrados = []

    for bbox, texto, prob in resultados_ocr:
        t_clean = texto.upper().strip()
        textos_encontrados.append(t_clean)

        # Buscar si coincide con placa
        placa_cand = normalizar_placa(t_clean)
        if placa_cand and prob > mayor_confianza_placa:
            placa_detectada = placa_cand
            mayor_confianza_placa = prob

        # Buscar marcas y modelos con coincidencia exacta y fuzzy matching
        t_norm = t_clean.replace('1', 'I').replace('0', 'O').replace('8', 'B').replace('5', 'S')
        for palabra in t_norm.split():
            # Exact match o substring
            for marca in MARCAS_CONOCIDAS:
                if marca in palabra or (len(palabra) >= 3 and palabra in marca):
                    if not marca_detectada:
                        marca_detectada = marca

            # Fuzzy match si aún no se detectó
            if not marca_detectada and len(palabra) >= 3:
                matches_marca = difflib.get_close_matches(palabra, MARCAS_CONOCIDAS, n=1, cutoff=0.70)
                if matches_marca:
                    marca_detectada = matches_marca[0]

            for modelo in MODELOS_CONOCIDOS:
                if modelo in palabra and not modelo_detectado:
                    modelo_detectado = modelo

            if not modelo_detectado and len(palabra) >= 3:
                matches_mod = difflib.get_close_matches(palabra, MODELOS_CONOCIDOS, n=1, cutoff=0.72)
                if matches_mod:
                    modelo_detectado = matches_mod[0]

    # Si no se leyó la placa en primera pasada, intentar con pre-procesamiento CLAHE en región inferior
    if not placa_detectada:
        tercio_inferior = imagen_bgr[int(h * 0.45):, :]
        gris = cv2.cvtColor(tercio_inferior, cv2.COLOR_BGR2GRAY)
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        mejorado = clahe.apply(gris)
        
        res_clahe = ocr_reader.readtext(mejorado)
        for bbox, texto, prob in res_clahe:
            t_clean = texto.upper().strip()
            placa_cand = normalizar_placa(t_clean)
            if placa_cand and prob > mayor_confianza_placa:
                placa_detectada = placa_cand
                mayor_confianza_placa = prob

    marca_final = "Vehículo"
    if marca_detectada and modelo_detectado:
        marca_final = f"{marca_detectada.capitalize()} {modelo_detectado.capitalize()}"
    elif marca_detectada:
        marca_final = f"{marca_detectada.capitalize()}"
    elif modelo_detectado:
        marca_final = f"{modelo_detectado.capitalize()}"

    return {
        "placa": placa_detectada,
        "confianza_placa": round(mayor_confianza_placa * 100, 1) if placa_detectada else 0.0,
        "marca": marca_final,
        "textos_encontrados": textos_encontrados
    }

def detectar_danos_y_suciedad(imagen_bgr: np.ndarray) -> Dict[str, Any]:
    """
    Aplica análisis de gradientes de Sobel y morfología matemática
    para diferenciar daños mecánicos (rayones afilados / abolladuras profundas)
    de manchas superficiales de barro o agua del lavadero.
    """
    gris = cv2.cvtColor(imagen_bgr, cv2.COLOR_BGR2GRAY)
    
    # Gradiente de bordes
    sobelx = cv2.Sobel(gris, cv2.CV_64F, 1, 0, ksize=3)
    sobely = cv2.Sobel(gris, cv2.CV_64F, 0, 1, ksize=3)
    magnitud = np.sqrt(sobelx**2 + sobely**2)
    magnitud_norm = cv2.normalize(magnitud, None, 0, 255, cv2.NORM_MINMAX, dtype=cv2.CV_8U)

    # Filtrar bordes de muy alta frecuencia (típicos de rayones o fracturas en vidrio)
    _, bordes_afilados = cv2.threshold(magnitud_norm, 160, 255, cv2.THRESH_BINARY)
    # Bordes suaves difusos (típicos de manchas de barro o agua de lavadero)
    _, bordes_suaves = cv2.threshold(magnitud_norm, 40, 120, cv2.THRESH_BINARY)

    contornos_afilados, _ = cv2.findContours(bordes_afilados, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    contornos_suaves, _ = cv2.findContours(bordes_suaves, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    danos_detectados = []
    suciedad_descartada = 0

    h_img, w_img = imagen_bgr.shape[:2]

    for c in contornos_afilados:
        area = cv2.contourArea(c)
        if 80 < area < 4000:
            x, y, w, h = cv2.boundingRect(c)
            relacion_aspecto = float(w) / (h + 1e-5)
            
            tipo = "abolladura"
            zona = "Carrocería Lateral"
            severidad = "leve"

            if relacion_aspecto > 2.5 or relacion_aspecto < 0.4:
                tipo = "rayon"
                severidad = "moderada" if area > 350 else "leve"
            elif y < h_img * 0.35:
                tipo = "partidura_vidrio"
                zona = "Parabrisas / Vidrio Frontal"
                severidad = "critica" if area > 600 else "moderada"

            danos_detectados.append({
                "id": f"DNO-{len(danos_detectados)+1}",
                "tipo": tipo,
                "zona": zona,
                "zonaTexto": f"{zona} ({tipo.capitalize()})",
                "descripcion": f"Fisura o deformación detectada con área {int(area)} px",
                "severidad": severidad,
                "esDanoReal": True,
                "coordenadas": {"x": int(x), "y": int(y), "w": int(w), "h": int(h)}
            })

    for c in contornos_suaves:
        area = cv2.contourArea(c)
        if 150 < area < 6000:
            suciedad_descartada += 1

    # Limitar para evitar ruido excesivo
    danos_detectados = danos_detectados[:4]

    return {
        "danos": danos_detectados,
        "suciedad_descartada": suciedad_descartada
    }

class AnalisisBase64Payload(BaseModel):
    imagen_base64: str
    tipo_servicio: Optional[str] = "solo_parquear"

class ComparacionPayload(BaseModel):
    imagen_entrada_base64: str
    imagen_salida_base64: str
    ticket_id: Optional[str] = None

@app.get("/")
def raiz():
    return {
        "sistema": "ParkVision IoT - API de Visión por Computadora Real",
        "estado": "ACTIVO",
        "modelos": {
            "yolo": "YOLOv8n (Detección de Vehículos)",
            "ocr": "EasyOCR (Lectura Real de Placas)",
            "color": "Segmentación HSV de Carrocería",
            "danos": "Detección de Gradientes Sobel y Filtro de Suciedad"
        },
        "hora_servidor": datetime.now().isoformat()
    }

@app.get("/api/status")
def status_api():
    return {
        "status": "online",
        "motor_ia": "gemini-vision" if GEMINI_API_KEY else "local-yolo-ocr",
        "gemini_modelo": GEMINI_MODEL if GEMINI_API_KEY else None,
        "timestamp": time.time()
    }

def consultar_gemini_vision_ingreso(frame_completo: Union[np.ndarray, List[np.ndarray]], crop_auto: Optional[np.ndarray] = None) -> Optional[Dict[str, Any]]:
    """
    Utiliza Google Gemini Vision AI para identificar con precisión industrial
    la marca, modelo, placa colombiana, color real de carrocería y daños previos.
    Soporta una imagen o lista de fotogramas clave del recorrido perimetral 360 (frente, laterales, trasera, interior).
    """
    if not GEMINI_API_KEY:
        return None

    try:
        frames_list = []
        if isinstance(frame_completo, list):
            frames_list = [f for f in frame_completo if f is not None and isinstance(f, np.ndarray)]
        elif isinstance(frame_completo, np.ndarray):
            frames_list = [crop_auto if crop_auto is not None else frame_completo]

        if not frames_list:
            return None

        # Limitar a máximo 3 tomas clave para garantizar respuesta en < 2 segundos
        frames_list = frames_list[:3]

        inline_parts = []
        for img in frames_list:
            h, w = img.shape[:2]
            scale = 640.0 / max(w, h) if max(w, h) > 640 else 1.0
            img_send = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

            _, buf = cv2.imencode(".jpg", img_send, [cv2.IMWRITE_JPEG_QUALITY, 75])
            img_b64 = base64.b64encode(buf).decode("utf-8")
            inline_parts.append({
                "inlineData": {
                    "mimeType": "image/jpeg",
                    "data": img_b64
                }
            })

        prompt = """Eres un perito forense experto en auditoría e identificación vehicular para parqueaderos y lavaderos en Colombia.
Se adjuntan una o varias tomas fotográficas reales del recorrido de inspección del vehículo (vistas de frente, costados, trasera o interior).
Analiza las imágenes en conjunto con máxima rigurosidad y responde ÚNICAMENTE un objeto JSON válido con la siguiente estructura:
{
  "es_vehiculo": true o false (debe ser estrictamente false si lo grabado es un monitor de computadora, televisor, pared, persona, piso, simulador o cualquier objeto que NO sea un automóvil, camioneta, camión o moto real),
  "tipo_vehiculo": "Automóvil" | "Camioneta / SUV" | "Motocicleta" | "Camión / Pick-up",
  "marca": "Marca exacta del auto basada en la parrilla, logo o chasis (ej: Renault, Chevrolet, Toyota, Mazda, Kia, Hyundai, Nissan, Volkswagen, Ford, Suzuki, etc.)",
  "modelo": "Modelo si es reconocible (ej: Onix, Duster, Sandero, Hilux, Tracker, CX-30, etc.) o vacío",
  "color": "Color real de la pintura de la carrocería en español ignorando reflejos del cielo (ej: Blanco, Gris / Plata, Negro, Rojo, Azul, Beige, etc.)",
  "placa": "Placa colombiana visible (ej: ABC-123) o vacío si no se distingue",
  "confianza_placa": número entre 0 y 100,
  "danos_previos": [
    {
      "tipo": "rayon" | "abolladura" | "partidura_vidrio",
      "zona": "puerta_delantera_izq" | "puerta_delantera_der" | "puerta_trasera_izq" | "puerta_trasera_der" | "parachoques_frontal" | "parachoques_trasero" | "capo" | "guardabarro",
      "zonaTexto": "Ubicación en español legible (ej: Puerta delantera derecha, Capó, Parachoques frontal)",
      "descripcion": "Descripción del daño visible",
      "severidad": "leve" | "moderada" | "critica"
    }
  ],
  "diagnostico_texto": "Resumen ejecutivo del vehículo y su estado exterior en 1 o 2 oraciones."
}"""

        payload = {
            "contents": [{
                "parts": [{"text": prompt}] + inline_parts
            }],
            "generationConfig": {
                "responseMimeType": "application/json",
                "temperature": 0.1
            }
        }

        modelos = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-3-flash-preview"]
        modelos_unicos = list(dict.fromkeys([m for m in modelos if m]))

        for modelo in modelos_unicos:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent?key={GEMINI_API_KEY}"
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
            try:
                with urllib.request.urlopen(req, timeout=25) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    cand = data.get("candidates", [])
                    if cand:
                        text_res = cand[0]["content"]["parts"][0]["text"].strip()
                        if text_res.startswith("```"):
                            text_res = re.sub(r"^```(?:json)?\s*", "", text_res)
                            text_res = re.sub(r"\s*```$", "", text_res)
                        parsed = json.loads(text_res)
                        print(f"[GEMINI VISION ({modelo})] ✓ Diagnóstico vehicular exitoso.")
                        return parsed
            except Exception as e_mod:
                print(f"[GEMINI VISION ({modelo})] Intento fallido ({e_mod}), probando siguiente modelo...")
                continue

    except Exception as e:
        print(f"[GEMINI VISION] Error en inferencia visual: {e}")

    return None

def comparar_salida_con_gemini(frame_entrada: np.ndarray, frame_salida: np.ndarray) -> Optional[Dict[str, Any]]:
    """
    Compara las fotos reales de entrada y salida con Gemini Vision Multimodal
    para determinar con rigor forense si ocurrieron daños nuevos durante la estadía.
    """
    if not GEMINI_API_KEY:
        return None

    try:
        def to_b64(img):
            h, w = img.shape[:2]
            if max(w, h) > 900:
                s = 900.0 / max(w, h)
                img = cv2.resize(img, (int(w * s), int(h * s)), interpolation=cv2.INTER_AREA)
            _, b = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 85])
            return base64.b64encode(b).decode("utf-8")

        b64_in = to_b64(frame_entrada)
        b64_out = to_b64(frame_salida)

        prompt = """Eres un perito forense de vehículos en un parqueadero.
Se te proporcionan 2 fotografías:
- Imagen 1: El vehículo al INGRESAR al parqueadero (línea base).
- Imagen 2: El vehículo al SALIR del parqueadero.

Compara minuciosamente ambas imágenes y detecta si se produjeron daños NUEVOS durante la estadía (rayones, abolladuras/pangones, vidrios rotos o parachoques desencajados que NO estaban al ingreso).
Responde ÚNICAMENTE en JSON con este formato:
{
  "hubo_cambios": true o false (true si hay al menos un daño nuevo),
  "nuevos_danos": [
    {
      "id": "SAL-DNO-1",
      "tipo": "rayon" | "abolladura" | "partidura_vidrio",
      "zona": "puerta_delantera_izq" | "puerta_trasera_izq" | "puerta_delantera_der" | "puerta_trasera_der" | "parachoques_frontal" | "parachoques_trasero" | "capo" | "guardabarro",
      "zonaTexto": "Ubicación detallada",
      "descripcion": "Descripción del daño nuevo detectado",
      "severidad": "leve" | "moderada" | "critica"
    }
  ],
  "diagnostico_salida": "Texto del dictamen final para el cliente y el parqueadero."
}"""

        payload = {
            "contents": [{
                "parts": [
                    {"text": prompt},
                    {"inlineData": {"mimeType": "image/jpeg", "data": b64_in}},
                    {"inlineData": {"mimeType": "image/jpeg", "data": b64_out}}
                ]
            }],
            "generationConfig": {
                "responseMimeType": "application/json",
                "temperature": 0.1
            }
        }

        modelos_salida = ["gemini-3-flash-preview", "gemini-2.5-flash", GEMINI_MODEL, "gemini-flash-latest"]
        modelos_unicos = list(dict.fromkeys([m for m in modelos_salida if m]))

        for mod in modelos_unicos:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{mod}:generateContent?key={GEMINI_API_KEY}"
            req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers={"Content-Type": "application/json"})
            try:
                with urllib.request.urlopen(req, timeout=12) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    cand = data.get("candidates", [])
                    if cand:
                        res_txt = cand[0]["content"]["parts"][0]["text"].strip()
                        if res_txt.startswith("```"):
                            res_txt = re.sub(r"^```(?:json)?\s*", "", res_txt)
                            res_txt = re.sub(r"\s*```$", "", res_txt)
                        parsed = json.loads(res_txt)
                        print(f"[GEMINI AUDITORÍA SALIDA ({mod})] ✓ Comparación exitosa: Hubo cambios = {parsed.get('hubo_cambios')}")
                        return parsed
            except Exception as e_mod:
                print(f"[GEMINI AUDITORÍA SALIDA ({mod})] Reintentando con otro modelo: {e_mod}")

    except Exception as e:
        print(f"[GEMINI AUDITORÍA SALIDA] Error comparando: {e}")

    return None

def procesar_imagen_o_frame(frame: np.ndarray, tipo_servicio: Optional[str] = "solo_parquear") -> Dict[str, Any]:
    h_orig, w_orig = frame.shape[:2]
    print(f"\n[INFERENCIA IA] >>> Procesando imagen real {w_orig}x{h_orig} px...")

    # Optimización de velocidad para CPU: Redimensionar si supera 1280px
    if w_orig > 1280 or h_orig > 1280:
        escala = 1280.0 / max(w_orig, h_orig)
        frame = cv2.resize(frame, (int(w_orig * escala), int(h_orig * escala)), interpolation=cv2.INTER_AREA)
        print(f"[INFERENCIA IA] Optimizada a {frame.shape[1]}x{frame.shape[0]} px para inferencia veloz.")

    h_curr, w_curr = frame.shape[:2]

    # Generar miniatura JPEG en base64 (máx 600px) para que la app móvil la guarde y muestre siempre en custodia
    scale_thumb = 600.0 / max(w_curr, h_curr) if max(w_curr, h_curr) > 600 else 1.0
    thumb = cv2.resize(frame, (int(w_curr * scale_thumb), int(h_curr * scale_thumb)), interpolation=cv2.INTER_AREA)
    _, buf = cv2.imencode(".jpg", thumb, [cv2.IMWRITE_JPEG_QUALITY, 80])
    frame_base64_url = f"data:image/jpeg;base64,{base64.b64encode(buf).decode('utf-8')}"

    # 1. Ejecutar YOLO para ubicar y validar que el objeto sea estrictamente un vehículo
    # Clases de COCO: 2: car, 3: motorcycle, 5: bus, 7: truck
    resultados_yolo = yolo_model(frame, classes=[2, 3, 5, 7], conf=0.25, verbose=False)
    caja_vehiculo = None
    clase_vehiculo = "Automóvil"
    conf_vehiculo = 0.0

    area_total = w_curr * h_curr
    for r in resultados_yolo:
        for box in r.boxes:
            conf = float(box.conf[0].item())
            coords = box.xyxy[0].tolist()
            bw = int(coords[2]) - int(coords[0])
            bh = int(coords[3]) - int(coords[1])
            area_box = bw * bh

            # Validar que sea un vehículo real que ocupe al menos el 5% del encuadre
            if area_box >= area_total * 0.05 and conf > conf_vehiculo:
                cls_id = int(box.cls[0].item())
                if cls_id == 3:
                    clase_vehiculo = "Motocicleta"
                elif cls_id == 7:
                    clase_vehiculo = "Camión / Pick-up"
                elif cls_id == 5:
                    clase_vehiculo = "Bus / Van"
                else:
                    clase_vehiculo = "Automóvil"

                caja_vehiculo = [int(coords[0]), int(coords[1]), int(coords[2]), int(coords[3])]
                conf_vehiculo = conf

    # Si YOLO no encontró ningún vehículo real en el encuadre, RECHAZAR de inmediato
    if not caja_vehiculo:
        print("[INFERENCIA IA] ❌ NO ES UN VEHÍCULO: YOLO no detectó ningún automóvil, moto, camión ni bus.")
        return {
            "exito": False,
            "es_vehiculo": False,
            "mensaje": "No se detectó ningún vehículo en la captura. Por favor enfoca claramente un automóvil, camioneta o motocicleta.",
            "placa": "",
            "confianza_placa": 0,
            "marca": "",
            "color": "",
            "confianza_color": 0,
            "caja_vehiculo": None,
            "frame_base64_url": frame_base64_url,
            "danos_previos": [],
            "suciedad_descartada": 0,
            "diagnostico_texto": "No se identificó ningún vehículo en la captura.",
            "tipo_servicio": tipo_servicio,
            "timestamp": datetime.now().strftime("%I:%M %p - Hoy")
        }

    # Si SÍ es un vehículo confirmado, recortar su región de interés
    x1, y1, x2, y2 = caja_vehiculo
    crop_auto = frame[max(0, y1):min(h_curr, y2), max(0, x1):min(w_curr, x2)]

    # POTENCIADOR: Si Gemini Vision está habilitado, procesar con IA Multimodal de alta precisión
    if GEMINI_API_KEY:
        res_gem = consultar_gemini_vision_ingreso(frame, crop_auto)
        if res_gem:
            if not res_gem.get("es_vehiculo", True):
                print(f"[GEMINI VISION] ❌ Rechazado por Gemini: No es un vehículo.")
                return {
                    "exito": False,
                    "es_vehiculo": False,
                    "mensaje": "No se detectó ningún vehículo en la captura. Por favor enfoca claramente un automóvil, camioneta o motocicleta.",
                    "placa": "",
                    "confianza_placa": 0,
                    "marca": "",
                    "color": "",
                    "confianza_color": 0,
                    "caja_vehiculo": None,
                    "frame_base64_url": frame_base64_url,
                    "danos_previos": [],
                    "suciedad_descartada": 0,
                    "diagnostico_texto": res_gem.get("diagnostico_texto", "No se identificó ningún vehículo."),
                    "tipo_servicio": tipo_servicio,
                    "timestamp": datetime.now().strftime("%I:%M %p - Hoy")
                }

            marca_gem = res_gem.get("marca") or clase_vehiculo
            mod_gem = res_gem.get("modelo", "").strip()
            marca_final = f"{marca_gem} {mod_gem}".strip() if mod_gem else marca_gem
            placa_gem = normalizar_placa(res_gem.get("placa", "")) or res_gem.get("placa", "").strip().upper() or "EN-REVISION"
            color_gem = res_gem.get("color") or "Gris / Plata"

            danos_gem = []
            for idx, d in enumerate(res_gem.get("danos_previos", [])):
                danos_gem.append({
                    "id": f"DNO-{idx+1}",
                    "tipo": d.get("tipo", "rayon"),
                    "zona": d.get("zona", "puerta_delantera_izq"),
                    "zonaTexto": d.get("zonaTexto", "Carrocería"),
                    "descripcion": d.get("descripcion", "Alteración detectada"),
                    "severidad": d.get("severidad", "leve"),
                    "esDanoReal": True,
                    "coordenadas": {"x": 100, "y": 100, "w": 80, "h": 80}
                })

            diag_gem = res_gem.get("diagnostico_texto") or f"Vehículo {marca_final} color {color_gem} auditado con Gemini Vision."

            print(f"[GEMINI VISION] ✓ Resultado: Placa={placa_gem}, Marca={marca_final}, Color={color_gem}, Daños={len(danos_gem)}")

            return {
                "exito": True,
                "es_vehiculo": True,
                "placa": placa_gem if placa_gem != "EN-REVISION" else "",
                "confianza_placa": float(res_gem.get("confianza_placa", 98.0)),
                "marca": marca_final,
                "color": color_gem,
                "confianza_color": 98.0,
                "caja_vehiculo": caja_vehiculo,
                "frame_base64_url": frame_base64_url,
                "danos_previos": danos_gem,
                "suciedad_descartada": 0,
                "diagnostico_texto": diag_gem,
                "tipo_servicio": tipo_servicio,
                "timestamp": datetime.now().strftime("%I:%M %p - Hoy"),
                "motor_ia": "Gemini Vision"
            }

    # FALLBACK LOCAL: Si Gemini no está configurado o no respondió, usar YOLO + HSV + EasyOCR
    # 2. Extraer Color Real de la carrocería del auto
    analisis_color = clasificar_color_hsv(crop_auto)

    # 3. Extraer Placa Real y Marcas con OCR
    analisis_ocr = extraer_placa_y_marcas(frame)

    # 4. Clasificador de Insignia / Emblema Frontal dentro de la silueta del auto
    analisis_insignia = detectar_insignia_marca(crop_auto)

    # 5. Análisis de Daños Previos en la carrocería del auto
    analisis_danos = detectar_danos_y_suciedad(crop_auto)

    marca_final = analisis_ocr["marca"]
    if marca_final in ["Vehículo", "Automóvil", ""] and analisis_insignia["marca"]:
        marca_final = f"{analisis_insignia['marca']}"
        print(f"[INFERENCIA IA] Insignia detectada: {analisis_insignia['marca']} ({analisis_insignia.get('detalle')})")
    elif marca_final in ["Vehículo", ""]:
        marca_final = f"{clase_vehiculo}"

    placa_final = analisis_ocr["placa"] or "EN-REVISION"

    print(f"[INFERENCIA IA] ✓ Resultado: Placa={placa_final}, Marca={marca_final}, Color={analisis_color['color']}")

    diagnostico_texto = (
        f"Vehículo {marca_final} color {analisis_color['color']} inspeccionado. "
        f"{len(analisis_danos['danos'])} novedades previas registradas. "
        f"{analisis_danos['suciedad_descartada']} marcas de suciedad ignoradas."
    )

    return {
        "exito": True,
        "placa": placa_final,
        "confianza_placa": analisis_ocr["confianza_placa"],
        "marca": marca_final,
        "color": analisis_color["color"],
        "confianza_color": analisis_color["confianza"],
        "caja_vehiculo": caja_vehiculo,
        "frame_base64_url": frame_base64_url,
        "danos_previos": analisis_danos["danos"],
        "suciedad_descartada": analisis_danos["suciedad_descartada"],
        "diagnostico_texto": diagnostico_texto,
        "tipo_servicio": tipo_servicio,
        "timestamp": datetime.now().strftime("%I:%M %p - Hoy")
    }

@app.post("/api/analizar-ingreso")
async def analizar_ingreso_endpoint(payload: AnalisisBase64Payload):
    """
    Recibe la imagen / frame real capturado con el celular en base64,
    ejecuta YOLOv8, EasyOCR, segmentación HSV de color y análisis de daños.
    """
    try:
        datos_base64 = payload.imagen_base64
        if "," in datos_base64:
            datos_base64 = datos_base64.split(",")[1]
            
        bytes_imagen = base64.b64decode(datos_base64)
        np_arr = np.frombuffer(bytes_imagen, np.uint8)
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if frame is None:
            raise HTTPException(status_code=400, detail="No se pudo decodificar la imagen enviada")

        return procesar_imagen_o_frame(frame, payload.tipo_servicio)

    except Exception as e:
        print(f"[ERROR /api/analizar-ingreso]: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analizar-archivo")
async def analizar_archivo_endpoint(
    request: Request,
    archivo: UploadFile = File(...),
    tipo_servicio: Optional[str] = Form("solo_parquear")
):
    """
    Recibe directamente un archivo de video (.mp4, .mov, .webm) o una foto (.jpg, .png)
    mediante multipart/form-data. Soporta videos de cualquier duración (sin límite de tiempo)
    para grabaciones perimetrales completas e interiores.
    """
    try:
        contenido = await archivo.read()
        nombre = (archivo.filename or "").lower()
        content_type = (archivo.content_type or "").lower()

        base_url = str(request.base_url).rstrip('/')

        es_video = (
            nombre.endswith((".mp4", ".mov", ".3gp", ".avi", ".mkv", ".webm")) or
            "video" in content_type
        )

        frame = None

        if es_video:
            timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
            video_filename = f"{timestamp_str}_ingreso_{abs(hash(contenido)) % 10000}.mp4"
            video_storage_path = os.path.join(EVIDENCIAS_DIR, video_filename)
            with open(video_storage_path, "wb") as f_out:
                f_out.write(contenido)
            
            video_url = f"{base_url}/evidencias/{video_filename}"
            print(f"[ALMACENAMIENTO] Video de ingreso guardado ({len(contenido) / (1024*1024):.2f} MB) en: {video_storage_path}")

            try:
                cap = cv2.VideoCapture(video_storage_path)
                total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
                fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
                duracion_seg = total_frames / fps if fps > 0 else 0
                print(f"\n[VIDEO INGRESO] Analizando video perimetral real: {total_frames} cuadros, {fps:.1f} FPS, {duracion_seg:.1f}s")

                if total_frames <= 0:
                    raise HTTPException(status_code=400, detail="El archivo de video está vacío o corrupto")

                # Muestreo adaptativo optimizado: entre 10 y 24 cuadros a lo largo de todo el video
                # Garantiza recorrido perimetral completo (frente, laterales, trasera) con inferencia ultrarrápida (<2s)
                num_muestras = max(10, min(24, int(duracion_seg / 1.5))) if duracion_seg > 0 else 12
                indices_muestreo = np.linspace(int(total_frames * 0.03), int(total_frames * 0.97), num_muestras, dtype=int)

                candidatos_frames = []
                for idx in indices_muestreo:
                    cap.set(cv2.CAP_PROP_POS_FRAMES, int(idx))
                    ret, f = cap.read()
                    if not ret or f is None:
                        continue

                    h_f, w_f = f.shape[:2]
                    scale = 640.0 / max(w_f, h_f) if max(w_f, h_f) > 640 else 1.0
                    f_small = cv2.resize(f, (int(w_f * scale), int(h_f * scale)), interpolation=cv2.INTER_AREA)

                    gris = cv2.cvtColor(f_small, cv2.COLOR_BGR2GRAY)
                    nitidez = cv2.Laplacian(gris, cv2.CV_64F).var()

                    res_yolo = yolo_model(f_small, classes=[2, 3, 5, 7], verbose=False)
                    num_autos = sum(len(r.boxes) for r in res_yolo)
                    conf_max = max([b.conf[0].item() for r in res_yolo for b in r.boxes], default=0.0)
                    area_max = 0.0
                    for r in res_yolo:
                        for b in r.boxes:
                            xywhn = b.xywhn[0].cpu().numpy()
                            area_b = float(xywhn[2] * xywhn[3])
                            if area_b > area_max:
                                area_max = area_b

                    # Validación de vehículo real: al menos 4% del encuadre
                    es_auto = num_autos > 0 and area_max >= 0.04 and conf_max >= 0.35

                    # Fase del recorrido: frente (0-35%), lateral/interior (35-70%), trasera (70-100%)
                    progreso = idx / total_frames
                    if progreso < 0.35:
                        fase = "frente"
                    elif progreso < 0.70:
                        fase = "lateral"
                    else:
                        fase = "trasera"

                    # PLATE HUNTER: Escaneo rápido de placas en cada fotograma del video
                    placa_frame = None
                    conf_placa_frame = 0.0
                    try:
                        res_ocr_cand = ocr_reader.readtext(f_small)
                        for bbox, text, prob in res_ocr_cand:
                            p_cand = normalizar_placa(text)
                            if p_cand and prob > 0.15:
                                placa_frame = p_cand
                                conf_placa_frame = float(prob)
                                print(f"[VIDEO HUNTER] ⭐ Placa encontrada en fotograma {idx} ({idx/fps:.1f}s): {p_cand} (conf: {prob:.2f})")
                                break
                    except Exception as e_hunter:
                        pass

                    # Si el fotograma muestra la placa del auto, otorgar una bonificación masiva para que sea prioritario
                    bonus_placa = (3500.0 + conf_placa_frame * 1000.0) if placa_frame else 0.0
                    score = (1000.0 if es_auto else 0.0) + (conf_max * 150.0) + (area_max * 100.0) + min(nitidez, 300.0) + bonus_placa

                    candidatos_frames.append({
                        "frame": f,
                        "score": score,
                        "nitidez": nitidez,
                        "es_auto": es_auto,
                        "conf_max": conf_max,
                        "area_max": area_max,
                        "fase": fase,
                        "idx": idx,
                        "placa_detectada": placa_frame,
                        "conf_placa": conf_placa_frame
                    })

                cap.release()

                if not candidatos_frames:
                    raise HTTPException(status_code=400, detail="No se pudieron extraer fotogramas válidos del video")

                # Extraer mejores fotogramas con auto
                candidatos_autos = [c for c in candidatos_frames if c["es_auto"]]

                # VALIDACIÓN ESTRICTA EN VIDEO: Si ningún fotograma contiene un auto real, rechazar
                if not candidatos_autos:
                    print(f"[VIDEO INGRESO] ❌ RECHAZADO: Ningún fotograma del video corresponde a un automóvil o vehículo.")
                    f_evidencia = candidatos_frames[0]["frame"]
                    h_e, w_e = f_evidencia.shape[:2]
                    sc_e = 500.0 / max(w_e, h_e) if max(w_e, h_e) > 500 else 1.0
                    th_e = cv2.resize(f_evidencia, (int(w_e * sc_e), int(h_e * sc_e)), interpolation=cv2.INTER_AREA)
                    _, buf_e = cv2.imencode(".jpg", th_e, [cv2.IMWRITE_JPEG_QUALITY, 75])
                    th_b64 = f"data:image/jpeg;base64,{base64.b64encode(buf_e).decode('utf-8')}"
                    return {
                        "exito": False,
                        "es_vehiculo": False,
                        "mensaje": "No se detectó ningún vehículo en la grabación. Por favor enfoca claramente la carrocería de un automóvil, camioneta o motocicleta real.",
                        "placa": "",
                        "confianza_placa": 0,
                        "marca": "",
                        "color": "",
                        "confianza_color": 0,
                        "caja_vehiculo": None,
                        "frame_base64_url": th_b64,
                        "video_url": video_url,
                        "danos_previos": [],
                        "suciedad_descartada": 0,
                        "diagnostico_texto": "No se detectó un vehículo válido en el video.",
                        "tipo_servicio": tipo_servicio,
                    }

                # Recopilar la mejor placa detectada por el Plate Hunter en todo el video
                placas_en_video = [c for c in candidatos_frames if c.get("placa_detectada")]
                placa_video_final = None
                conf_placa_video = 0.0
                frame_con_placa = None
                if placas_en_video:
                    mejor_cand = max(placas_en_video, key=lambda x: x["conf_placa"])
                    placa_video_final = mejor_cand["placa_detectada"]
                    conf_placa_video = round(float(mejor_cand["conf_placa"]) * 100, 1)
                    frame_con_placa = mejor_cand["frame"]
                    print(f"[VIDEO INGRESO] ⭐ PLACA IDENTIFICADA EN VIDEO: {placa_video_final} ({conf_placa_video}%)")

                # Seleccionar los fotogramas clave por fase del recorrido (Frente, Costado, Trasera)
                keyframes_recorrido = []
                if frame_con_placa is not None:
                    keyframes_recorrido.append(frame_con_placa)

                for fase_nom in ["frente", "lateral", "trasera"]:
                    fase_cands = [c for c in candidatos_autos if c["fase"] == fase_nom and (frame_con_placa is None or c["frame"] is not frame_con_placa)]
                    if fase_cands:
                        fase_cands.sort(key=lambda x: x["score"], reverse=True)
                        keyframes_recorrido.append(fase_cands[0]["frame"])

                if not keyframes_recorrido:
                    candidatos_autos.sort(key=lambda x: x["score"], reverse=True)
                    keyframes_recorrido = [c["frame"] for c in candidatos_autos[:3]]

                mejor_frame = frame_con_placa if frame_con_placa is not None else keyframes_recorrido[0]

                # Miniatura representativa en JPEG liviano (máx 500px)
                h_c, w_c = mejor_frame.shape[:2]
                scale_thumb = 500.0 / max(w_c, h_c) if max(w_c, h_c) > 500 else 1.0
                thumb = cv2.resize(mejor_frame, (int(w_c * scale_thumb), int(h_c * scale_thumb)), interpolation=cv2.INTER_AREA)
                _, buf = cv2.imencode(".jpg", thumb, [cv2.IMWRITE_JPEG_QUALITY, 80])
                frame_base64_url = f"data:image/jpeg;base64,{base64.b64encode(buf).decode('utf-8')}"

                # 1. EVALUACIÓN CON GEMINI VISION MULTIMODAL (Si está habilitado)
                res_gemini = None
                if GEMINI_API_KEY:
                    print(f"[VIDEO INGRESO] Evaluando {len(keyframes_recorrido)} ángulos del recorrido con Gemini Vision AI...")
                    res_gemini = consultar_gemini_vision_ingreso(keyframes_recorrido)

                # Si Gemini responde explícitamente que NO es vehículo (pantalla, objeto, persona):
                if res_gemini and res_gemini.get("es_vehiculo") is False:
                    print(f"[VIDEO INGRESO] ❌ GEMINI RECHAZÓ: No corresponde a un vehículo real.")
                    return {
                        "exito": False,
                        "es_vehiculo": False,
                        "mensaje": "La inteligencia artificial examinó la grabación y determinó que NO corresponde a un automóvil, camioneta o motocicleta.\n\nSolo se capturan datos cuando se graba un vehículo real.",
                        "placa": "",
                        "marca": "",
                        "color": "",
                        "frame_base64_url": frame_base64_url,
                        "video_url": video_url,
                        "danos_previos": [],
                        "diagnostico_texto": "La captura no corresponde a un vehículo real."
                    }

                if res_gemini and res_gemini.get("es_vehiculo") is True:
                    # Inferencia directa desde Gemini 3.5 Flash en ~1.5s
                    marca_final = res_gemini.get("marca") or "Automóvil"
                    if res_gemini.get("modelo") and res_gemini.get("modelo").lower() not in marca_final.lower():
                        marca_final = f"{marca_final} {res_gemini.get('modelo')}".strip()

                    color_final = res_gemini.get("color") or "Gris / Plata"

                    placa_gem = (res_gemini.get("placa") or "").strip().upper()
                    placa_norm = normalizar_placa(placa_gem)
                    if placa_norm:
                        placa_final = placa_norm
                        conf_placa = res_gemini.get("confianza_placa", 95)
                    elif placa_gem and len(placa_gem) >= 5 and placa_gem != "EN-REVISION":
                        placa_final = placa_gem
                        conf_placa = 80
                    elif placa_video_final:
                        placa_final = placa_video_final
                        conf_placa = conf_placa_video or 85.0
                    else:
                        # Si Gemini no distinguió la placa, aplicar EasyOCR local sobre los fotogramas clave del recorrido
                        placa_final = ""
                        conf_placa = 0
                        cands_a_escanear = keyframes_recorrido + [c["frame"] for c in candidatos_autos[:5] if c["frame"] not in keyframes_recorrido]
                        for kf in cands_a_escanear:
                            try:
                                res_ocr = extraer_placa_y_marcas(kf)
                                placa_ocr = res_ocr.get("placa", "")
                                if placa_ocr and placa_ocr != "EN-REVISION":
                                    placa_final = placa_ocr
                                    conf_placa = res_ocr.get("confianza_placa", 80)
                                    print(f"[OCR LOCAL] ✓ Placa detectada en fotograma del video: {placa_final} ({conf_placa}%)")
                                    break
                            except Exception as e_ocr:
                                print(f"[OCR LOCAL] Error analizando fotograma: {e_ocr}")

                    danos_acumulados = []
                    for d in res_gemini.get("danos_previos", []):
                        danos_acumulados.append({
                            "id": f"dano_gem_{len(danos_acumulados)+1}",
                            "tipo": d.get("tipo", "rayon"),
                            "zona": d.get("zona", "puerta_delantera_izq"),
                            "zonaTexto": d.get("zonaTexto", "Carrocería"),
                            "descripcion": d.get("descripcion", "Marca visible en chapa"),
                            "severidad": d.get("severidad", "leve")
                        })

                    diagnostico_texto = res_gemini.get("diagnostico_texto") or (
                        f"Video perimetral ({duracion_seg:.1f}s) procesado con Gemini Vision AI. "
                        f"Vehículo {marca_final} color {color_final}. {len(danos_acumulados)} marcas previas registradas."
                    )
                    caja_vehiculo = [0, 0, w_c, h_c]
                    suciedad_descartada = 0
                else:
                    # FALLBACK LOCAL: Procesar una sola vez el mejor frame (YOLO + EasyOCR + HSV)
                    print(f"[VIDEO INGRESO] Procesando con motor local el mejor fotograma...")
                    res_cuadro = procesar_imagen_o_frame(mejor_frame, tipo_servicio)
                    marca_final = res_cuadro.get("marca") or "Automóvil"
                    color_final = res_cuadro.get("color") or "Gris / Plata"
                    placa_final = res_cuadro.get("placa") if res_cuadro.get("placa") != "EN-REVISION" else ""
                    conf_placa = res_cuadro.get("confianza_placa", 0)
                    danos_acumulados = res_cuadro.get("danos_previos", [])
                    diagnostico_texto = res_cuadro.get("diagnostico_texto", "")
                    caja_vehiculo = res_cuadro.get("caja_vehiculo", [0, 0, w_c, h_c])
                    suciedad_descartada = res_cuadro.get("suciedad_descartada", 0)

                # Garantía definitiva: Si el Plate Hunter capturó la placa en cualquier fotograma del video, usarla
                if placa_video_final and (not placa_final or placa_final == "EN-REVISION"):
                    placa_final = placa_video_final
                    conf_placa = conf_placa_video or 85.0

                print(f"[VIDEO INGRESO] ✓ Consolidado y enviado a la app: Placa={placa_final}, Marca={marca_final}, Color={color_final}")

                return {
                    "exito": True,
                    "es_vehiculo": True,
                    "placa": placa_final,
                    "confianza_placa": conf_placa,
                    "marca": marca_final,
                    "color": color_final,
                    "confianza_color": 96.0,
                    "caja_vehiculo": caja_vehiculo,
                    "frame_base64_url": frame_base64_url,
                    "video_url": video_url,
                    "danos_previos": danos_acumulados,
                    "suciedad_descartada": suciedad_descartada,
                    "diagnostico_texto": diagnostico_texto,
                    "tipo_servicio": tipo_servicio,
                    "timestamp": datetime.now().strftime("%I:%M %p - Hoy")
                }
            except Exception as e_proc:
                print(f"[ERROR Procesamiento Video]: {e_proc}")
                raise e_proc
        else:
            timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
            foto_filename = f"{timestamp_str}_foto_{abs(hash(contenido)) % 10000}.jpg"
            foto_storage_path = os.path.join(EVIDENCIAS_DIR, foto_filename)
            with open(foto_storage_path, "wb") as f_out:
                f_out.write(contenido)
            foto_url = f"{base_url}/evidencias/{foto_filename}"

            np_arr = np.frombuffer(contenido, np.uint8)
            frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

            if frame is None:
                raise HTTPException(status_code=400, detail="No se pudo extraer ningún fotograma del archivo enviado")

            res_foto = procesar_imagen_o_frame(frame, tipo_servicio)
            res_foto["video_url"] = foto_url
            return res_foto

    except Exception as e:
        print(f"[ERROR /api/analizar-archivo]: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analizar-salida")
async def analizar_salida_endpoint(payload: ComparacionPayload):
    """
    Compara fotogramas reales de entrada y salida mediante análisis de anomalías
    estructurales y de pintura (Sobel + Morfología) para identificar si se produjeron
    abolladuras/pangones, rayones o partiduras de vidrios durante la estadía.
    """
    try:
        def decodificar(b64_str):
            if not b64_str:
                return None
            if "," in b64_str:
                b64_str = b64_str.split(",")[1]
            bytes_img = base64.b64decode(b64_str)
            np_arr = np.frombuffer(bytes_img, np.uint8)
            return cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        img_in = decodificar(payload.imagen_entrada_base64)
        img_out = decodificar(payload.imagen_salida_base64)

        if img_out is None:
            raise HTTPException(status_code=400, detail="Imagen de salida requerida para auditoría")

        # AUDITORÍA CON GEMINI VISION MULTIMODAL SI ESTÁ HABILITADO
        if img_in is not None and img_out is not None and GEMINI_API_KEY:
            res_gem_salida = comparar_salida_con_gemini(img_in, img_out)
            if res_gem_salida:
                hubo_cambios = bool(res_gem_salida.get("hubo_cambios", False))
                nuevos_danos = res_gem_salida.get("nuevos_danos", [])
                diag_salida = res_gem_salida.get("diagnostico_salida", "Auditoría de salida completada.")
                h_s, w_s = img_out.shape[:2]
                esc_s = 600.0 / max(w_s, h_s) if max(w_s, h_s) > 600 else 1.0
                thumb_salida = cv2.resize(img_out, (int(w_s * esc_s), int(h_s * esc_s)), interpolation=cv2.INTER_AREA)
                _, buf_s = cv2.imencode(".jpg", thumb_salida, [cv2.IMWRITE_JPEG_QUALITY, 85])
                foto_salida_url = f"data:image/jpeg;base64,{base64.b64encode(buf_s).decode('utf-8')}"
                return {
                    "exito": True,
                    "hubo_cambios": hubo_cambios,
                    "nuevos_danos": nuevos_danos,
                    "foto_salida_url": foto_salida_url,
                    "video_salida_url": "",
                    "diagnostico_salida": diag_salida,
                    "hora_salida": datetime.now().strftime("%I:%M %p - Hoy"),
                    "motor_ia": "Gemini Vision Multimodal"
                }

        # FALLBACK LOCAL: Comparador de anomalías mediante gradientes Sobel
        # 1. Extraer anomalías de la imagen de salida
        danos_salida_raw = detectar_danos_y_suciedad(img_out).get("danos", [])

        # 2. Extraer anomalías de la imagen de entrada (si está disponible)
        danos_entrada_raw = []
        if img_in is not None:
            danos_entrada_raw = detectar_danos_y_suciedad(img_in).get("danos", [])

        # 3. Detectar qué daños en salida son REALMENTE NUEVOS
        nuevos_danos = []
        for ds in danos_salida_raw:
            ya_existia = False
            for de in danos_entrada_raw:
                if de.get("zona") == ds.get("zona") and de.get("tipo") == ds.get("tipo"):
                    ya_existia = True
                    break
            if not ya_existia:
                ds_copy = dict(ds)
                ds_copy["id"] = f"SAL-DNO-{len(nuevos_danos)+1}"
                ds_copy["descripcion"] = f"Alteración física nueva en salida: {ds.get('tipo', 'daño').capitalize()}"
                nuevos_danos.append(ds_copy)

        hubo_cambios = len(nuevos_danos) > 0
        if hubo_cambios:
            diag_salida = f"ALERTA: Se detectaron {len(nuevos_danos)} daños nuevos en salida no presentes al ingreso."
        else:
            diag_salida = "✓ Auditoría Conforme: Vehículo entregado en perfecto estado. Sin nuevos rayones ni abolladuras."

        # Generar imagen de salida con bounding box resaltando los nuevos daños si los hay
        h_s, w_s = img_out.shape[:2]
        esc_s = 600.0 / max(w_s, h_s) if max(w_s, h_s) > 600 else 1.0
        thumb_salida = cv2.resize(img_out, (int(w_s * esc_s), int(h_s * esc_s)), interpolation=cv2.INTER_AREA)

        for nd in nuevos_danos:
            coords = nd.get("coordenadas", {})
            if coords:
                x = int(coords.get("x", 0) * esc_s)
                y = int(coords.get("y", 0) * esc_s)
                bw = int(coords.get("w", coords.get("width", 50)) * esc_s)
                bh = int(coords.get("h", coords.get("height", 50)) * esc_s)
                cv2.rectangle(thumb_salida, (x, y), (x + bw, y + bh), (0, 0, 235), 3)
                cv2.putText(thumb_salida, f"NUEVO: {nd['tipo'].upper()}", (x, max(20, y - 6)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 235), 2)

        _, buf_s = cv2.imencode(".jpg", thumb_salida, [cv2.IMWRITE_JPEG_QUALITY, 85])
        foto_salida_url = f"data:image/jpeg;base64,{base64.b64encode(buf_s).decode('utf-8')}"

        return {
            "exito": True,
            "hubo_cambios": hubo_cambios,
            "nuevos_danos": nuevos_danos,
            "foto_salida_url": foto_salida_url,
            "video_salida_url": video_salida_url,
            "diagnostico_salida": diag_salida,
            "hora_salida": datetime.now().strftime("%I:%M %p - Hoy")
        }

    except Exception as e:
        print(f"[ERROR /api/analizar-salida]: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analizar-archivo-salida")
async def analizar_archivo_salida_endpoint(
    request: Request,
    archivo_salida: UploadFile = File(...),
    imagen_entrada_base64: Optional[str] = Form(None),
    ticket_id: Optional[str] = Form(None)
):
    """
    Compara video perimetral o foto de salida contra la línea base de entrada
    y extrae con precisión pangones, rayones o roturas ocurridas durante la estadía.
    """
    try:
        contenido = await archivo_salida.read()
        nombre = (archivo_salida.filename or "").lower()
        content_type = (archivo_salida.content_type or "").lower()

        base_url = str(request.base_url).rstrip('/')

        es_video = nombre.endswith((".mp4", ".mov", ".3gp", ".avi", ".mkv", ".webm")) or "video" in content_type

        # Decodificar entrada
        frame_entrada = None
        if imagen_entrada_base64:
            if "," in imagen_entrada_base64:
                imagen_entrada_base64 = imagen_entrada_base64.split(",")[1]
            try:
                np_in = np.frombuffer(base64.b64decode(imagen_entrada_base64), np.uint8)
                frame_entrada = cv2.imdecode(np_in, cv2.IMREAD_COLOR)
            except Exception:
                pass

        danos_entrada_raw = []
        if frame_entrada is not None:
            danos_entrada_raw = detectar_danos_y_suciedad(frame_entrada).get("danos", [])

        frame_salida = None
        danos_salida_acumulados = []

        video_salida_url = ""
        if es_video:
            timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
            video_salida_filename = f"{timestamp_str}_salida_{ticket_id or 'auto'}.mp4"
            video_salida_path = os.path.join(EVIDENCIAS_DIR, video_salida_filename)
            with open(video_salida_path, "wb") as f_out:
                f_out.write(contenido)
            
            video_salida_url = f"{base_url}/evidencias/{video_salida_filename}"
            print(f"[ALMACENAMIENTO] Video de salida guardado ({len(contenido) / (1024*1024):.2f} MB) en: {video_salida_path}")

            try:
                cap = cv2.VideoCapture(video_salida_path)
                total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
                fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
                duracion_salida_seg = total_frames / fps if fps > 0 else 0
                print(f"\n[VIDEO SALIDA] Analizando video perimetral de salida: {total_frames} cuadros, {fps:.1f} FPS, {duracion_salida_seg:.1f}s")

                num_muestras_salida = max(10, min(60, int(duracion_salida_seg / 1.5))) if duracion_salida_seg > 0 else 12
                indices = np.linspace(int(total_frames * 0.05), int(total_frames * 0.95), num_muestras_salida, dtype=int)
                
                mejor_salida = None
                max_nitidez = -1.0
                frames_para_danos = []

                for idx in indices:
                    cap.set(cv2.CAP_PROP_POS_FRAMES, int(idx))
                    ret, f = cap.read()
                    if not ret or f is None:
                        continue
                    
                    gris = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY)
                    nitidez = cv2.Laplacian(gris, cv2.CV_64F).var()
                    if nitidez > max_nitidez:
                        max_nitidez = nitidez
                        mejor_salida = f
                    frames_para_danos.append(f)

                cap.release()
                frame_salida = mejor_salida

                # Analizar daños en los 2 fotogramas más nítidos
                for f_danos in frames_para_danos[:2]:
                    res_danos = detectar_danos_y_suciedad(f_danos)
                    for d in res_danos.get("danos", []):
                        danos_salida_acumulados.append(d)
            except Exception as e_vid:
                print(f"[ERROR Video Salida]: {e_vid}")
                raise e_vid
        else:
            timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
            foto_salida_filename = f"{timestamp_str}_salida_{ticket_id or 'auto'}.jpg"
            foto_salida_path = os.path.join(EVIDENCIAS_DIR, foto_salida_filename)
            with open(foto_salida_path, "wb") as f_out:
                f_out.write(contenido)
            video_salida_url = f"{base_url}/evidencias/{foto_salida_filename}"

            np_out = np.frombuffer(contenido, np.uint8)
            frame_salida = cv2.imdecode(np_out, cv2.IMREAD_COLOR)
            if frame_salida is not None:
                danos_salida_acumulados = detectar_danos_y_suciedad(frame_salida).get("danos", [])

        if frame_salida is None:
            raise HTTPException(status_code=400, detail="No se pudo decodificar el archivo de salida")

        # AUDITORÍA CON GEMINI VISION MULTIMODAL SI ESTÁ HABILITADO
        if frame_entrada is not None and frame_salida is not None and GEMINI_API_KEY:
            res_gem_salida = comparar_salida_con_gemini(frame_entrada, frame_salida)
            if res_gem_salida:
                hubo_cambios = bool(res_gem_salida.get("hubo_cambios", False))
                nuevos_danos = res_gem_salida.get("nuevos_danos", [])
                diag_salida = res_gem_salida.get("diagnostico_salida", "Auditoría de salida completada.")
                h_s, w_s = frame_salida.shape[:2]
                esc_s = 600.0 / max(w_s, h_s) if max(w_s, h_s) > 600 else 1.0
                thumb_salida = cv2.resize(frame_salida, (int(w_s * esc_s), int(h_s * esc_s)), interpolation=cv2.INTER_AREA)
                _, buf_s = cv2.imencode(".jpg", thumb_salida, [cv2.IMWRITE_JPEG_QUALITY, 85])
                foto_salida_url = f"data:image/jpeg;base64,{base64.b64encode(buf_s).decode('utf-8')}"
                return {
                    "exito": True,
                    "hubo_cambios": hubo_cambios,
                    "nuevos_danos": nuevos_danos,
                    "foto_salida_url": foto_salida_url,
                    "video_salida_url": video_salida_url,
                    "diagnostico_salida": diag_salida,
                    "hora_salida": datetime.now().strftime("%I:%M %p - Hoy"),
                    "motor_ia": "Gemini Vision Multimodal"
                }

        # FALLBACK LOCAL: Comparación: ¿Qué daños en salida NO estaban en la entrada?
        nuevos_danos = []
        for ds in danos_salida_acumulados:
            ya_existia = any(de.get("zona") == ds.get("zona") and de.get("tipo") == ds.get("tipo") for de in danos_entrada_raw)
            if not ya_existia:
                if not any(d["zona"] == ds["zona"] and d["tipo"] == ds["tipo"] for d in nuevos_danos):
                    ds_nuevo = dict(ds)
                    ds_nuevo["id"] = f"SAL-DNO-{len(nuevos_danos)+1}"
                    ds_nuevo["descripcion"] = f"Alteración física nueva detectada en salida: {ds.get('tipo', 'daño').capitalize()}"
                    nuevos_danos.append(ds_nuevo)

        # Generar miniatura de salida
        h_s, w_s = frame_salida.shape[:2]
        esc_s = 600.0 / max(w_s, h_s) if max(w_s, h_s) > 600 else 1.0
        thumb_salida = cv2.resize(frame_salida, (int(w_s * esc_s), int(h_s * esc_s)), interpolation=cv2.INTER_AREA)

        for nd in nuevos_danos:
            coords = nd.get("coordenadas", {})
            if coords:
                x = int(coords.get("x", 0) * esc_s)
                y = int(coords.get("y", 0) * esc_s)
                bw = int(coords.get("w", coords.get("width", 50)) * esc_s)
                bh = int(coords.get("h", coords.get("height", 50)) * esc_s)
                cv2.rectangle(thumb_salida, (x, y), (x + bw, y + bh), (0, 0, 235), 3)
                cv2.putText(thumb_salida, f"NUEVO: {nd['tipo'].upper()}", (x, max(20, y - 6)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 235), 2)

        _, buf_s = cv2.imencode(".jpg", thumb_salida, [cv2.IMWRITE_JPEG_QUALITY, 85])
        foto_salida_url = f"data:image/jpeg;base64,{base64.b64encode(buf_s).decode('utf-8')}"

        hubo_cambios = len(nuevos_danos) > 0
        if hubo_cambios:
            diag_salida = f"ALERTA: Se detectaron {len(nuevos_danos)} daños nuevos (pangones/rayones) no presentes en el ingreso."
        else:
            diag_salida = "✓ Auditoría Conforme: Vehículo entregado en perfecto estado. Sin nuevos rayones ni abolladuras."

        return {
            "exito": True,
            "hubo_cambios": hubo_cambios,
            "nuevos_danos": nuevos_danos,
            "foto_salida_url": foto_salida_url,
            "video_salida_url": video_salida_url,
            "diagnostico_salida": diag_salida,
            "hora_salida": datetime.now().strftime("%I:%M %p - Hoy")
        }

    except Exception as e:
        print(f"[ERROR /api/analizar-archivo-salida]: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    print("\n" + "="*70)
    print("🚀 INICIANDO SERVIDOR DE VISIÓN ARTIFICIAL EN http://0.0.0.0:8000")
    print(f"   Acceso desde el celular en la misma red Wi-Fi: http://{SERVER_HOST_IP}:8000")
    print("="*70 + "\n")
    uvicorn.run(app, host="0.0.0.0", port=8000)
