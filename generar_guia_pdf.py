import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        
        # Header (pages > 1)
        if self._pageNumber > 1:
            self.drawString(54, letter[1] - 36, "PARKVISION IoT — Guía Oficial de Sustentación (Video 5 min)")
            self.drawRightString(letter[0] - 54, letter[1] - 36, "IoT Corte 3 | Ramiro & Pedro")
            self.setStrokeColor(colors.HexColor("#CBD5E1"))
            self.setLineWidth(0.5)
            self.line(54, letter[1] - 42, letter[0] - 54, letter[1] - 42)

        # Footer (all pages)
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.5)
        self.line(54, 45, letter[0] - 54, 45)
        
        self.drawString(54, 32, "Sistema Inteligente de Inspección Perimetral Vehicular con IA y Visión Artificial")
        page_text = f"Página {self._pageNumber} de {page_count}"
        self.drawRightString(letter[0] - 54, 32, page_text)
        self.restoreState()

def generar_pdf(ruta_salida):
    doc = SimpleDocTemplate(
        ruta_salida,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()

    # Colores corporativos del proyecto ParkVision
    c_primary = colors.HexColor("#0F172A")    # Slate 900
    c_blue = colors.HexColor("#1D4ED8")       # Blue 700
    c_cyan = colors.HexColor("#0284C7")       # Sky 600
    c_ramiro = colors.HexColor("#1E40AF")     # Blue 800
    c_pedro = colors.HexColor("#047857")      # Emerald 700
    c_bg_ramiro = colors.HexColor("#EFF6FF")  # Light blue
    c_bg_pedro = colors.HexColor("#ECFDF5")   # Light green
    c_card_bg = colors.HexColor("#F8FAFC")
    c_border = colors.HexColor("#CBD5E1")
    c_dark = colors.HexColor("#1E293B")
    c_text = colors.HexColor("#334155")
    c_muted = colors.HexColor("#64748B")

    # Estilos de párrafo personalizados
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=c_primary,
        alignment=1, # Centrado
        spaceAfter=6
    )

    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=11,
        leading=15,
        textColor=c_cyan,
        alignment=1,
        spaceAfter=15
    )

    meta_style = ParagraphStyle(
        'DocMeta',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=13,
        textColor=c_muted,
        alignment=1
    )

    h1_style = ParagraphStyle(
        'Heading1_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=17,
        textColor=c_primary,
        spaceBefore=12,
        spaceAfter=6,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'Heading2_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=15,
        textColor=c_blue,
        spaceBefore=8,
        spaceAfter=4,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'Body_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=c_text,
        spaceAfter=5
    )

    body_bold = ParagraphStyle(
        'Body_Bold_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=13,
        textColor=c_dark,
        spaceAfter=4
    )

    script_ramiro = ParagraphStyle(
        'Script_Ramiro',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=9,
        leading=13.5,
        textColor=colors.HexColor("#1E3A8A"),
        spaceAfter=4
    )

    script_pedro = ParagraphStyle(
        'Script_Pedro',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=9,
        leading=13.5,
        textColor=colors.HexColor("#065F46"),
        spaceAfter=4
    )

    table_header = ParagraphStyle(
        'TH_Style',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.white,
        alignment=1
    )

    table_cell = ParagraphStyle(
        'TD_Style',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=11,
        textColor=c_dark
    )

    table_cell_bold = ParagraphStyle(
        'TD_Style_Bold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=11,
        textColor=c_primary
    )

    cue_style = ParagraphStyle(
        'Cue_Style',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11.5,
        textColor=colors.HexColor("#B45309")
    )

    story = []

    # =========================================================================
    # ENCABEZADO Y PORTADA EJECUTIVA
    # =========================================================================
    story.append(Paragraph("PARKVISION IoT — GUÍA OFICIAL DE SUSTENTACIÓN", title_style))
    story.append(Paragraph("Guion Técnico Estructurado para Video de 5 Minutos (División por Roles: Ramiro & Pedro)", subtitle_style))
    story.append(Paragraph("<b>Materia:</b> Internet de las Cosas (IoT) - Corte 3 &nbsp;|&nbsp; <b>Integrantes:</b> Ramiro &amp; Pedro &nbsp;|&nbsp; <b>Duración Objetivo:</b> 5:00 minutos exactos", meta_style))
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=1.5, color=c_blue, spaceBefore=4, spaceAfter=12))

    # =========================================================================
    # SECCIÓN 1: FICHA TÉCNICA DEL SISTEMA (¿CÓMO ESTÁ HECHA Y CONFORMADA?)
    # =========================================================================
    story.append(Paragraph("1. Ficha Técnica y Arquitectura Integral del Sistema", h1_style))
    story.append(Paragraph(
        "ParkVision IoT es una plataforma distribuida concebida para la gestión integral, seguridad perimetral y auditoría automatizada "
        "de vehículos en estacionamientos mediante Visión Artificial, Deep Learning y Modelos Multimodales en la nube.", body_style
    ))
    story.append(Spacer(1, 4))

    tech_data = [
        [Paragraph("Componente", table_header), Paragraph("Tecnología / Lenguaje", table_header), Paragraph("Función / Responsabilidad Técnica", table_header)],
        [
            Paragraph("<b>Frontend Móvil / Web</b>", table_cell_bold),
            Paragraph("TypeScript, React Native (Expo v51, Expo Router v3)", table_cell),
            Paragraph("Interfaz multiplataforma reactiva (Web y Celular), gestión de bahías P-01 a P-20, captura con WebRTC Camera API y selector dinámico.", table_cell)
        ],
        [
            Paragraph("<b>Backend de Visión IA</b>", table_cell_bold),
            Paragraph("Python 3.11, FastAPI, Uvicorn, Asynchronous REST", table_cell),
            Paragraph("Microservicio RESTful para ingesta de video/fotos multipart, orquestación de modelos de visión y cálculo diferencial forense.", table_cell)
        ],
        [
            Paragraph("<b>Detección de Vehículo</b>", table_cell_bold),
            Paragraph("YOLOv8n (Ultralytics, PyTorch Deep Learning)", table_cell),
            Paragraph("Reconocimiento de silueta vehicular, localización por bounding box y validación de presencia real de automóvil.", table_cell)
        ],
        [
            Paragraph("<b>Lectura de Placas (OCR)</b>", table_cell_bold),
            Paragraph("OpenCV (HSV, CLAHE, Contornos) + EasyOCR", table_cell),
            Paragraph("Segmentación cromática de placa amarilla colombiana, agregación multi-fotograma y lógica difusa de tolerancia a ruido óptico.", table_cell)
        ],
        [
            Paragraph("<b>Peritaje Forense de Daños</b>", table_cell_bold),
            Paragraph("Google Gemini 3.5 Flash Vision Multimodal API", table_cell),
            Paragraph("Auditoría visual comparativa entrada vs salida: detecta rayones, abolladuras o vidrios rotos y encuadra los daños en rojo.", table_cell)
        ],
        [
            Paragraph("<b>Persistencia y Estado</b>", table_cell_bold),
            Paragraph("Supabase (PostgreSQL) + AsyncStorage local", table_cell),
            Paragraph("Almacenamiento relacional de tickets, evidencias fotográficas, fechas ISO, tarifas y estado de bahías en tiempo real.", table_cell)
        ]
    ]

    t_tech = Table(tech_data, colWidths=[1.4*inch, 2.0*inch, 3.6*inch])
    t_tech.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), c_primary),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.5, c_border),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, c_card_bg])
    ]))
    story.append(t_tech)
    story.append(Spacer(1, 14))

    # =========================================================================
    # SECCIÓN 2: DISTRIBUCIÓN GENERAL DEL VIDEO (5 MINUTOS)
    # =========================================================================
    story.append(Paragraph("2. Tabla de Distribución de Tiempos y Secciones (5 Minutos)", h1_style))
    story.append(Paragraph(
        "Para mantener el dinamismo y asegurar la calificación completa, las secciones están perfectamente intercaladas entre <b>Ramiro</b> y <b>Pedro</b>:", body_style
    ))
    story.append(Spacer(1, 4))

    time_data = [
        [Paragraph("Tiempo", table_header), Paragraph("Bloque / Tema", table_header), Paragraph("Expositor Principal", table_header), Paragraph("Objetivo Clave en Pantalla", table_header)],
        [
            Paragraph("00:00 - 00:45 (45s)", table_cell_bold),
            Paragraph("Bloque 1: Introducción, Problema e Impacto", table_cell),
            Paragraph("<b>RAMIRO</b>", ParagraphStyle('R', parent=table_cell_bold, textColor=c_ramiro)),
            Paragraph("Mostrar Dashboard general de bahías y bienvenida profesional.", table_cell)
        ],
        [
            Paragraph("00:45 - 01:45 (60s)", table_cell_bold),
            Paragraph("Bloque 2: Frontend, WebRTC y Registro de Ingreso", table_cell),
            Paragraph("<b>PEDRO</b>", ParagraphStyle('P', parent=table_cell_bold, textColor=c_pedro)),
            Paragraph("Mostrar pestaña Entrada, cámara WebRTC en vivo y asignación de bahía.", table_cell)
        ],
        [
            Paragraph("01:45 - 02:45 (60s)", table_cell_bold),
            Paragraph("Bloque 3: Backend Python, YOLOv8 y OCR de Placas", table_cell),
            Paragraph("<b>RAMIRO</b>", ParagraphStyle('R', parent=table_cell_bold, textColor=c_ramiro)),
            Paragraph("Mostrar consola FastAPI, logs de OpenCV, EasyOCR y lógica difusa.", table_cell)
        ],
        [
            Paragraph("02:45 - 03:45 (60s)", table_cell_bold),
            Paragraph("Bloque 4: Gemini Vision y Detección Forense de Daños", table_cell),
            Paragraph("<b>PEDRO</b>", ParagraphStyle('P', parent=table_cell_bold, textColor=c_pedro)),
            Paragraph("Mostrar pestaña Salida, análisis perimetral y cuadros rojos de daños.", table_cell)
        ],
        [
            Paragraph("03:45 - 04:30 (45s)", table_cell_bold),
            Paragraph("Bloque 5: Demostración Antifraude y Entrega en 2 Fases", table_cell),
            Paragraph("<b>RAMIRO &amp; PEDRO</b> (Intercalado)", table_cell_bold),
            Paragraph("Alerta auto distinto (Ramiro) + Conformidad cliente y salida (Pedro).", table_cell)
        ],
        [
            Paragraph("04:30 - 05:00 (30s)", table_cell_bold),
            Paragraph("Bloque 6: Conclusiones, IoT y Cierre", table_cell),
            Paragraph("<b>RAMIRO</b> (Cierre con Pedro)", table_cell_bold),
            Paragraph("Vista de Historial / Supabase y agradecimiento final.", table_cell)
        ]
    ]

    t_time = Table(time_data, colWidths=[1.2*inch, 2.3*inch, 1.4*inch, 2.1*inch])
    t_time.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), c_primary),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, c_border),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, c_card_bg])
    ]))
    story.append(t_time)
    story.append(Spacer(1, 14))

    # =========================================================================
    # SECCIÓN 3: GUION DETALLADO PALABRA POR PALABRA (SECCIONES RAMIRO / PEDRO)
    # =========================================================================
    story.append(Paragraph("3. Guion Detallado de Exposición con Cues de Grabación", h1_style))
    story.append(Paragraph("A continuación se desglosa exactamente qué debe decir cada expositor y qué elemento visual debe estar viéndose en pantalla:", body_style))
    story.append(Spacer(1, 6))

    def make_speaker_box(speaker_name, time_str, role_color, bg_color, cue_text, script_text, tech_notes):
        header_p = Paragraph(f"<b>{speaker_name.upper()}</b> &nbsp;|&nbsp; <b>Tiempo:</b> {time_str}", ParagraphStyle('SBH', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=9.5, leading=12, textColor=role_color))
        cue_p = Paragraph(f"<b>[EN PANTALLA]:</b> {cue_text}", cue_style)
        speech_p = Paragraph(f"<b>Lo que debe decir:</b> \"{script_text}\"", script_ramiro if "RAMIRO" in speaker_name else script_pedro)
        notes_p = Paragraph(f"<b>Conceptos técnicos clave:</b> {tech_notes}", body_style)

        table_data = [
            [header_p],
            [cue_p],
            [speech_p],
            [notes_p]
        ]
        t_box = Table(table_data, colWidths=[6.9*inch])
        t_box.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), bg_color),
            ('BACKGROUND', (0, 1), (-1, -1), c_card_bg),
            ('BOX', (0, 0), (-1, -1), 1, role_color),
            ('LINEBELOW', (0, 0), (-1, 0), 1, role_color),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ]))
        return t_box

    # BLOQUE 1 - RAMIRO
    story.append(make_speaker_box(
        speaker_name="Sección 1 — Ramiro: Introducción y Contexto IoT",
        time_str="00:00 a 00:45 (45 segundos)",
        role_color=c_ramiro,
        bg_color=c_bg_ramiro,
        cue_text="Mostrar la pantalla de Bahías con las celdas P-01 a P-20 y el indicador en verde 'Motor IA Online (http://192.168.0.17:8000)'.",
        script_text="Buenas tardes profesor y compañeros. Hoy junto a mi compañero Pedro les presentamos ParkVision IoT, una solución tecnológica diseñada para resolver uno de los problemas más críticos en estacionamientos y centros de custodia vehicular: los reclamos fraudulentos por rayones, golpes o abolladuras que los clientes aseguran no haber tenido al ingresar. Nuestro sistema combina dispositivos IoT con visión artificial perimetral, creando un gemelo digital del estado del automóvil al momento del ingreso y comparándolo de manera automática al momento de la salida. Ahora mi compañero Pedro explicará cómo está estructurado el frontend y la captura multimedia.",
        tech_notes="Mencionar: problemática de custodia vehicular, gemelo digital de inspección, arquitectura IoT distribuida con servidor local y cliente móvil/web."
    ))
    story.append(Spacer(1, 10))

    # BLOQUE 2 - PEDRO
    story.append(make_speaker_box(
        speaker_name="Sección 2 — Pedro: Arquitectura Frontend y Captura WebRTC",
        time_str="00:45 a 01:45 (60 segundos)",
        role_color=c_pedro,
        bg_color=c_bg_pedro,
        cue_text="Hacer clic en la pestaña 'Entrada'. Mostrar el Paso 1: botón 'GRABAR VIDEO' y 'TOMAR FOTO'. Abrir el modal de cámara web en vivo, capturar el vehículo, seleccionar la bahía P-01 y el servicio 'Lavado y Parqueo'.",
        script_text="Gracias Ramiro. Para la aplicación cliente utilizamos React Native con TypeScript sobre el ecosistema de Expo Router v3, lo que nos permite un despliegue híbrido tanto en navegadores Web de escritorio como en dispositivos móviles Android e iOS. En la pestaña de Recepción Vehicular, implementamos un modal de cámara interactivo utilizando WebRTC y la API MediaDevices del navegador para capturar el video perimetral en tiempo real. La interfaz sigue un estándar de diseño accesible, con colores específicos según la función: botones azules para acciones primarias, rojos para grabación y alertas, y verdes para confirmaciones. Al capturar el video, el operador selecciona la bahía disponible, el tipo de servicio y los datos del cliente, enviando el contenido de forma asíncrona mediante FormData multipart hacia nuestro backend.",
        tech_notes="Mencionar: React Native + Expo Router v3, TypeScript, WebRTC (getUserMedia), diseño UX/UI accesible y envío asíncrono Multipart/FormData."
    ))
    story.append(Spacer(1, 10))

    # BLOQUE 3 - RAMIRO
    story.append(make_speaker_box(
        speaker_name="Sección 3 — Ramiro: Backend Python, YOLOv8 y OCR de Placas",
        time_str="01:45 a 02:45 (60 segundos)",
        role_color=c_ramiro,
        bg_color=c_bg_ramiro,
        cue_text="Cambiar brevemente a la consola de PowerShell donde corre 'python vision_server.py'. Mostrar los logs de FastAPI recibiendo el archivo, la detección de YOLOv8n y el log de placa detectada.",
        script_text="En el núcleo de procesamiento desarrollamos un microservicio en Python 3.11 sobre FastAPI y Uvicorn. Al recibir el video, primero ejecutamos el modelo YOLOv8 de Ultralytics en PyTorch, el cual verifica que exista un vehículo real en la escena y localiza su caja delimitadora. Luego entra nuestro módulo de visión por computador con OpenCV y EasyOCR: aplicamos una máscara cromática HSV calibrada entre 12 y 42 grados para aislar el amarillo reflectivo de la placa colombiana, aplicamos filtros de contraste CLAHE y realizamos agregación de candidatos a lo largo de múltiples fotogramas del video. Además, desarrollamos un algoritmo de equivalencia difusa que tolera confusiones ópticas típicas de caracteres como la Q con la O o el 8 con la B, garantizando una lectura robusta sin falsos rechazos.",
        tech_notes="Mencionar: Python 3.11, FastAPI, YOLOv8n (detección de objetos), OpenCV (HSV, CLAHE), EasyOCR, agregación de fotogramas y función son_placas_equivalentes()."
    ))
    story.append(Spacer(1, 10))

    # BLOQUE 4 - PEDRO
    story.append(make_speaker_box(
        speaker_name="Sección 4 — Pedro: Inspección Forense Multimodal (Gemini Vision)",
        time_str="02:45 a 03:45 (60 segundos)",
        role_color=c_pedro,
        bg_color=c_bg_pedro,
        cue_text="Regresar al navegador web y hacer clic en la pestaña 'Salida'. Cargar el video de salida y presionar '1. ANALIZAR E INSPECCIONAR SALIDA'. Mostrar cómo se procesa y cómo aparecen los cuadros rojos sobre los daños nuevos.",
        script_text="Al momento de la entrega del vehículo nos trasladamos a la pestaña de Salida. Aquí conectamos la visión artificial con el modelo multimodal Google Gemini 3.5 Flash mediante su API generativa estructurada en JSON. El servidor envía los fotogramas clave de entrada y salida simultáneamente. Gemini actúa como un perito forense automatizado: primero verifica si la silueta, modelo, color y detalles del auto de salida corresponden al mismo vehículo que ingresó. Si se confirma la identidad, realiza una sustracción diferencial de anomalías físicas. Si el vehículo sufrió un nuevo rayón o golpe durante la estadía en el parqueadero, OpenCV dibuja automáticamente un recuadro rojo grueso con la etiqueta del daño sobre la imagen y genera el reporte técnico del cambio.",
        tech_notes="Mencionar: Google Gemini 3.5 Flash Vision Multimodal API, peritaje fotograma a fotograma, dibujo en OpenCV con cv2.rectangle (rojo) y cv2.putText, respuesta en JSON estructurado."
    ))
    story.append(Spacer(1, 10))

    # BLOQUE 5 - RAMIRO & PEDRO
    story.append(make_speaker_box(
        speaker_name="Sección 5 — Ramiro & Pedro: Seguridad Antifraude y Flujo de Salida en 2 Fases",
        time_str="03:45 a 04:30 (45 segundos)",
        role_color=c_primary,
        bg_color=colors.HexColor("#F1F5F9"),
        cue_text="Ramiro: Explicar la alerta de seguridad si se coloca otro auto. Pedro: Mostrar el botón '2. CONFIRMAR Y REGISTRAR SALIDA OFICIAL', la selección de conformidad del cliente (Conforme / No Conforme) y la observación.",
        script_text="RAMIRO: Un aspecto crucial que implementamos es la seguridad antifraude: si alguien intenta dar salida a un vehículo grabando o adjuntando un auto con placa o características distintas a las de la bahía, el sistema bloquea inmediatamente la salida con una alerta roja de seguridad impidiendo el retiro. // PEDRO: Y además, la salida no se realiza a ciegas: el sistema trabaja en dos fases. La fase 1 inspecciona y diagnostica el auto; luego el operador revisa los resultados y en la fase 2 ejecuta la confirmación oficial, donde registra en Supabase si el cliente se retira conforme o inconforme con la entrega, guardando las observaciones y liberando la bahía.",
        tech_notes="Mencionar: Bloqueo de salida por placa o modelo divergente, flujo de salida en 2 fases (Inspección previa + Confirmación formal con acta de conformidad y liberación de cupo en BD)."
    ))
    story.append(Spacer(1, 10))

    # BLOQUE 6 - RAMIRO & PEDRO
    story.append(make_speaker_box(
        speaker_name="Sección 6 — Ramiro & Pedro: Conclusiones, IoT y Cierre",
        time_str="04:30 a 05:00 (30 segundos)",
        role_color=c_ramiro,
        bg_color=c_bg_ramiro,
        cue_text="Ir a la pestaña 'Historial' para mostrar el registro guardado con el ticket finalizado, fotos y observaciones. Luego ambos se despiden ante la cámara.",
        script_text="RAMIRO: En conclusión, ParkVision IoT demuestra cómo la convergencia de dispositivos periféricos, microservicios en Python y modelos de IA de última generación pueden transformar un proceso manual y conflictivo en una solución transparente, auditable y en tiempo real. // PEDRO: Toda la información queda almacenada de forma segura para consultas legales o administrativas. Agradecemos su atención y quedamos atentos a sus preguntas.",
        tech_notes="Mencionar: Pestaña Historial, base de datos relacional Supabase / PostgreSQL, trazabilidad y cierre formal de la presentación."
    ))
    story.append(Spacer(1, 14))

    # =========================================================================
    # SECCIÓN 4: CONSEJOS Y CHECKLIST PARA LA GRABACIÓN DEL VIDEO
    # =========================================================================
    story.append(Paragraph("4. Checklist y Recomendaciones Clave para la Grabación", h1_style))
    story.append(Paragraph(
        "Sigan estos puntos prácticos antes de presionar el botón de grabar para garantizar la máxima calificación:", body_style
    ))
    story.append(Spacer(1, 4))

    checklist_items = [
        [Paragraph("Aspecto", table_header), Paragraph("Recomendación Práctica para el Video", table_header)],
        [
            Paragraph("<b>Control del Tiempo</b>", table_cell_bold),
            Paragraph("Tengan un cronómetro visible en el teléfono. La meta son <b>4:50 a 5:00 minutos</b>. No pasarse de 5:15 ni quedarse por debajo de 4:30.", table_cell)
        ],
        [
            Paragraph("<b>Software de Grabación</b>", table_cell_bold),
            Paragraph("Utilicen OBS Studio o Clipchamp grabando la pantalla completa a 1080p y con las cámaras de ambos visibles en la esquina superior/inferior.", table_cell)
        ],
        [
            Paragraph("<b>Preparación Previa</b>", table_cell_bold),
            Paragraph("Tener `python vision_server.py` corriendo y el navegador abierto en `http://localhost:8081` o la IP local con al menos un vehículo ya ingresado en P-01 para agilizar la demo.", table_cell)
        ],
        [
            Paragraph("<b>Audio y Fluidez</b>", table_cell_bold),
            Paragraph("Usar audífonos con micrófono. Cuando uno termine su bloque, dar el pase verbal por el nombre: <i>'Ahora mi compañero Pedro explicará...'</i> o <i>'Le doy la palabra a Ramiro...'</i>.", table_cell)
        ]
    ]

    t_check = Table(checklist_items, colWidths=[1.8*inch, 5.2*inch])
    t_check.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), c_primary),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.5, c_border),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, c_card_bg])
    ]))
    story.append(t_check)

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"PDF generado con éxito en: {ruta_salida}")

if __name__ == "__main__":
    salida = os.path.join(os.path.dirname(os.path.abspath(__file__)), "GUIA_SUSTENTACION_PARKVISION.pdf")
    generar_pdf(salida)
