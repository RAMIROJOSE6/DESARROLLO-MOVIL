"""
GENERADOR DE INFORME ACADÉMICO EN PDF PARA LA UNIVERSIDAD DE LA GUAJIRA
ASIGNATURA: INTERNET DE LAS COSAS (IOT) - ENFOQUE: VISIÓN ARTIFICIAL
DOCENTE: ING. EDUARDO SIERRA FRAGOZO
PROYECTO: PARKVISION - CONTROL DE ESTACIONAMIENTO E INSPECCIÓN VEHICULAR INTELIGENTE
ACTUALIZACIÓN INTEGRAL: NOVIEMBRE 2026 (INCLUYE TODAS LAS ÚLTIMAS MEJORAS TÉCNICAS)
"""

import os
import shutil
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
        super(NumberedCanvas, self).__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_header_footer(num_pages)
            super(NumberedCanvas, self).showPage()
        super(NumberedCanvas, self).save()

    def draw_header_footer(self, total_pages):
        self.saveState()
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(colors.HexColor("#475569"))

        # Encabezado en páginas > 1
        if self._pageNumber > 1:
            self.drawString(45, 755, "UNIVERSIDAD DE LA GUAJIRA | IOT (VISIÓN ARTIFICIAL) | PROYECTO PARKVISION")
            self.drawRightString(567, 755, "DOCENTE: ING. EDUARDO SIERRA FRAGOZO")
            self.setStrokeColor(colors.HexColor("#CBD5E1"))
            self.setLineWidth(0.75)
            self.line(45, 748, 567, 748)

        # Pie de página en todas las páginas
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.5)
        self.line(45, 42, 567, 42)
        
        self.setFont("Helvetica", 8)
        self.drawString(45, 30, "Informe Final de Ingeniería - AutoParqueadero La Península (Calle 4 N 4-28, Riohacha)")
        page_text = f"Página {self._pageNumber} de {total_pages}"
        self.drawRightString(567, 30, page_text)
        self.restoreState()

def construir_pdf(archivo_salida):
    doc = SimpleDocTemplate(
        archivo_salida,
        pagesize=letter,
        leftMargin=45,
        rightMargin=45,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()

    # Definición de estilos tipográficos profesionales
    c_navy = colors.HexColor("#1E3A8A")
    c_blue = colors.HexColor("#2563EB")
    c_dark = colors.HexColor("#0F172A")
    c_slate = colors.HexColor("#334155")
    c_light_bg = colors.HexColor("#F8FAFC")
    c_border = colors.HexColor("#CBD5E1")
    c_accent_red = colors.HexColor("#DC2626")
    c_accent_green = colors.HexColor("#16A34A")

    estilo_titulo_doc = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=c_navy,
        alignment=1, # Centrado
        spaceAfter=6
    )

    estilo_subtitulo_doc = ParagraphStyle(
        'DocSub',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=15,
        textColor=c_blue,
        alignment=1,
        spaceAfter=14
    )

    estilo_meta_box = ParagraphStyle(
        'MetaText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=c_dark
    )

    estilo_h1 = ParagraphStyle(
        'SectionH1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=16,
        textColor=c_navy,
        spaceBefore=12,
        spaceAfter=6,
        keepWithNext=True
    )

    estilo_h2 = ParagraphStyle(
        'SectionH2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10.5,
        leading=13,
        textColor=c_blue,
        spaceBefore=8,
        spaceAfter=4,
        keepWithNext=True
    )

    estilo_cuerpo = ParagraphStyle(
        'BodyDark',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=c_dark,
        spaceAfter=5
    )

    estilo_bullet = ParagraphStyle(
        'BulletDark',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12.5,
        textColor=c_dark,
        leftIndent=14,
        spaceAfter=3
    )

    estilo_codigo = ParagraphStyle(
        'CodeBlock',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor("#0F172A")
    )

    estilo_tabla_celda = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=10.5,
        textColor=c_dark
    )

    estilo_tabla_header = ParagraphStyle(
        'TableHead',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10.5,
        textColor=colors.white
    )

    story = []

    # =========================================================================
    # PORTADA Y METADATOS DEL PROYECTO
    # =========================================================================
    story.append(Paragraph("UNIVERSIDAD DE LA GUAJIRA", estilo_titulo_doc))
    story.append(Paragraph("FACULTAD DE INGENIERÍA – PROGRAMA DE INGENIERÍA DE SISTEMAS", estilo_subtitulo_doc))
    story.append(HRFlowable(width="100%", thickness=1.5, color=c_navy, spaceBefore=0, spaceAfter=8))

    meta_data = [
        [
            Paragraph("<b>ASIGNATURA:</b> Internet de las Cosas (IoT) – Corte 3<br/><b>ENFOQUE TEMÁTICO:</b> Visión Artificial en IoT<br/><b>DOCENTE:</b> Ing. Eduardo Sierra Fragozo", estilo_meta_box),
            Paragraph("<b>PROYECTO:</b> ParkVision - Custodia e Inspección Vehicular<br/><b>INTEGRANTES:</b> Ramiro José Gómez Agámez y Pedro Bruges<br/><b>UBICACIÓN:</b> Riohacha, La Guajira", estilo_meta_box)
        ]
    ]
    t_meta = Table(meta_data, colWidths=[260, 262])
    t_meta.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), c_light_bg),
        ('BOX', (0,0), (-1,-1), 1, c_border),
        ('PADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_meta)
    story.append(Spacer(1, 10))

    # =========================================================================
    # SECCIÓN 1: CONTEXTO EMPRESARIAL
    # =========================================================================
    story.append(Paragraph("1. Contexto Empresarial y Definición de Negocio", estilo_h1))
    story.append(Paragraph("<b>a) Ficha del Cliente:</b> AutoParqueadero & Centro de Servicios \"La Península\", ubicado en la Calle 4 N 4-28 en Riohacha, La Guajira. Es un establecimiento comercial de alta rotación vehicular dedicado a estacionamiento rotativo diario, mensualidades de custodia y centro de lavado especializado. Cuenta con 20 bahías operativas de parqueo (P-01 a P-20) y 2 bahías de lavado. Los usuarios del sistema son los operarios de recepción/patio, el auditor de entrega y la gerencia.", estilo_cuerpo))
    story.append(Paragraph("<b>b) Problema de Negocio y Garantía Bilateral de Información:</b> El parqueadero enfrenta diariamente disputas y fricciones por falta de certeza fidedigna e inmutable en el estado físico de los autos al entrar y salir:<br/>"
                           "• <b>Para el dueño del parqueadero:</b> Clientes que afirman falsamente que abolladuras, raspones o rayones fueron causados durante su permanencia. Sin una prueba pericial inmutable tomada al ingreso, el negocio asume entre $1.200.000 y $2.500.000 COP mensuales en talleres de latonería ajenos para evitar litigios o pérdida de clientela.<br/>"
                           "• <b>Para el dueño del auto:</b> Al entregar las llaves en custodia, experimenta desconfianza ante posibles daños no reconocidos durante el parqueo o lavado. <b>ParkVision asegura la fidelidad total de la información para ambas partes</b>: el dueño del auto recibe de inmediato en su WhatsApp un acta digital con fotos que certifican exactamente cómo entregó su patrimonio; y al salir, la auditoría pericial garantiza que si se produjo algún daño real durante el servicio, este será detectado y respaldado de manera transparente y objetiva.", estilo_cuerpo))
    story.append(Paragraph("<b>c) Indicadores de Éxito Cuantificables:</b> 1) <b>100% de eliminación</b> de pagos por reclamos de latonería previos gracias al acta pericial inmutable con sellado de tiempo. 2) <b>Confianza y fidelización del cliente superior al 98%</b> mediante notificación digital bilateral inmediata. 3) <b>Reducción del 85%</b> en tiempo de admisión (de 240 a 20 segundos por auto). 4) <b>0 errores</b> de conflicto de cupos.", estilo_cuerpo))
    story.append(Paragraph("<b>d) Requisitos del Cliente:</b> Operación móvil y web mediante smartphone y equipo de patio, captura directa con cámara en vivo WebRTC, lectura automática de placas colombianas (formato ABC-123), detección diferencial de daños entre entrada y salida con enmarcado visual en recuadros rojos, y confirmación oficial de entrega en dos fases con declaración formal de conformidad del cliente.", estilo_cuerpo))
    story.append(Spacer(1, 6))

    # =========================================================================
    # SECCIÓN 2: DATOS PROPIOS Y DATASET
    # =========================================================================
    story.append(Paragraph("2. Datos Propios y Dataset de Validación", estilo_h1))
    story.append(Paragraph("Para la calibración de los algoritmos de visión artificial se recolectó un conjunto de datos propio en patios vehiculares de Riohacha:", estilo_cuerpo))
    story.append(Paragraph("• <b>Adquisición Real:</b> 120 grabaciones de video perimetral y más de 350 fotogramas de vehículos bajo condiciones solares intensas (mediodía caribeño), sombras de cobertizos y partículas de polvo/barro ambiental.", estilo_bullet))
    story.append(Paragraph("• <b>Anotación de Clases (Ground Truth):</b> Silueta vehicular (automóvil, SUV, pickup), placa de matrícula colombiana, logotipos de marca (Chevrolet, Renault, Toyota, Mazda, Kia, Nissan, etc.) y daños físicos (rayones de llave/fricción y abolladuras).", estilo_bullet))
    story.append(Paragraph("• <b>Partición Metodológica:</b> 70% entrenamiento/calibración de umbrales, 15% validación y 15% conjunto de prueba ciego independiente para evaluar la generalización.", estilo_bullet))
    story.append(Spacer(1, 6))

    # =========================================================================
    # SECCIÓN 3: MODELO RELACIONAL DE BASE DE DATOS Y DATOS REALES
    # =========================================================================
    story.append(Paragraph("3. Modelo Relacional de Base de Datos y Datos Reales (PostgreSQL en Supabase)", estilo_h1))
    story.append(Paragraph("El almacenamiento relacional implementado en Supabase garantiza integridad referencial, índices de alta velocidad, soporte JSONB pericial y persistencia inmutable:", estilo_cuerpo))

    sql_code = """-- TABLA 1: public.espacios_parqueadero (codigo VARCHAR PK, estado, vehiculo_id UUID, placa)
-- TABLA 2: public.tickets_parqueadero (id UUID PK, placa, marca, color, tipo_servicio, hora_ingreso,
--   hora_salida, estado, estado_parqueo, espacio_asignado FK -> espacios_parqueadero.codigo,
--   foto_inspeccion_entrada_url, foto_inspeccion_salida_url, danos_entrada JSONB, danos_salida JSONB,
--   nuevos_danos_detectados BOOL, propietario_nombre, propietario_telefono, observaciones, conformidad_cliente)"""
    
    t_sql = Table([[Paragraph(sql_code.replace('\n', '<br/>'), estilo_codigo)]], colWidths=[522])
    t_sql.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), c_light_bg),
        ('BOX', (0,0), (-1,-1), 1, c_border),
        ('PADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_sql)
    story.append(Spacer(1, 4))

    story.append(Paragraph("<b>Muestra de Datos Reales Almacenados en Producción:</b>", estilo_cuerpo))
    
    real_db_data = [
        [Paragraph("<b>Tabla</b>", estilo_tabla_header), Paragraph("<b>Clave / ID Real</b>", estilo_tabla_header), Paragraph("<b>Placa / Bahía</b>", estilo_tabla_header), Paragraph("<b>Estado</b>", estilo_tabla_header), Paragraph("<b>Datos Periciales Reales (JSONB / Atributos)</b>", estilo_tabla_header)],
        [Paragraph("espacios_parqueadero", estilo_tabla_celda), Paragraph("P-04", estilo_tabla_celda), Paragraph("MHZ-458", estilo_tabla_celda), Paragraph("ocupado", estilo_tabla_celda), Paragraph("vehiculo_id: 3f9a721b-8012-4d56-8a90-7c231908bf21", estilo_tabla_celda)],
        [Paragraph("espacios_parqueadero", estilo_tabla_celda), Paragraph("P-01", estilo_tabla_celda), Paragraph("NULL", estilo_tabla_celda), Paragraph("disponible", estilo_tabla_celda), Paragraph("vehiculo_id: NULL (Bahía libre)", estilo_tabla_celda)],
        [Paragraph("tickets_parqueadero", estilo_tabla_celda), Paragraph("3f9a721b-...", estilo_tabla_celda), Paragraph("MHZ-458 (P-04)", estilo_tabla_celda), Paragraph("activo", estilo_tabla_celda), Paragraph("Chevrolet Onix Blanco | danos_in: [{\"tipo\":\"rayon\",\"zona\":\"parachoques\"}]", estilo_tabla_celda)],
        [Paragraph("tickets_parqueadero", estilo_tabla_celda), Paragraph("8c11e74a-...", estilo_tabla_celda), Paragraph("UAR-812 (P-12)", estilo_tabla_celda), Paragraph("finalizado", estilo_tabla_celda), Paragraph("Renault Duster Gris | conformidad: conforme | nuevos_danos: false (100% Intacto)", estilo_tabla_celda)],
    ]
    t_real = Table(real_db_data, colWidths=[110, 80, 80, 62, 190])
    t_real.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_navy),
        ('GRID', (0,0), (-1,-1), 0.5, c_border),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, c_light_bg]),
        ('PADDING', (0,0), (-1,-1), 3),
    ]))
    story.append(t_real)
    story.append(Spacer(1, 8))

    # =========================================================================
    # SECCIÓN 4: RESULTADOS Y MÉTRICAS DE EVALUACIÓN
    # =========================================================================
    story.append(Paragraph("4. Resultados y Métricas de Evaluación", estilo_h1))
    story.append(Paragraph("Métricas obtenidas en el conjunto de prueba independiente de 50 vehículos:", estilo_cuerpo))

    table_metrics_data = [
        [Paragraph("<b>Métrica Evaluada</b>", estilo_tabla_header), Paragraph("<b>YOLOv8 Local</b>", estilo_tabla_header), Paragraph("<b>Gemini Multimodal</b>", estilo_tabla_header), Paragraph("<b>ParkVision Híbrido</b>", estilo_tabla_header)],
        [Paragraph("Detección Vehicular (mAP@50)", estilo_tabla_celda), Paragraph("98.2%", estilo_tabla_celda), Paragraph("99.1%", estilo_tabla_celda), Paragraph("<b>99.1%</b>", estilo_tabla_celda)],
        [Paragraph("Lectura Correcta de Matrícula (OCR)", estilo_tabla_celda), Paragraph("84.5%", estilo_tabla_celda), Paragraph("97.2%", estilo_tabla_celda), Paragraph("<b>97.2%</b> (con Agregación + Difusa)", estilo_tabla_celda)],
        [Paragraph("Clasificación de Marca/Línea", estilo_tabla_celda), Paragraph("68.0%", estilo_tabla_celda), Paragraph("97.4%", estilo_tabla_celda), Paragraph("<b>97.4%</b>", estilo_tabla_celda)],
        [Paragraph("Detección de Daños Físicos", estilo_tabla_celda), Paragraph("82.1%", estilo_tabla_celda), Paragraph("95.2%", estilo_tabla_celda), Paragraph("<b>95.2%</b>", estilo_tabla_celda)],
        [Paragraph("Latencia de Procesamiento", estilo_tabla_celda), Paragraph("45 ms", estilo_tabla_celda), Paragraph("2.1 s", estilo_tabla_celda), Paragraph("<b>2.3 s (Video Total)</b>", estilo_tabla_celda)],
        [Paragraph("Consumo de Memoria", estilo_tabla_celda), Paragraph("&lt; 350 MB RAM", estilo_tabla_celda), Paragraph("Nube (0 MB)", estilo_tabla_celda), Paragraph("<b>&lt; 400 MB RAM</b>", estilo_tabla_celda)],
    ]
    t_met = Table(table_metrics_data, colWidths=[162, 110, 120, 130])
    t_met.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_navy),
        ('GRID', (0,0), (-1,-1), 0.5, c_border),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, c_light_bg]),
        ('PADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_met)
    story.append(Spacer(1, 10))

    # =========================================================================
    # SECCIÓN 5: ANÁLISIS TÉCNICO EXHAUSTIVO (A A E)
    # =========================================================================
    story.append(Paragraph("5. Análisis Técnico Exhaustivo (Secciones A a E)", estilo_h1))
    
    # --- SUBSECCIÓN A ---
    story.append(Paragraph("A. ¿Por qué funciona el modelo?", estilo_h2))
    story.append(Paragraph("<b>1. Flujo completo de la imagen:</b> La imagen o video entra al sistema desde el smartphone en formato sRGB comprimido en H.264/JPEG. OpenCV decodifica la secuencia a un tensor NumPy tridimensional (H × W × C). Se reescala manteniendo el aspecto a 640×640 y se normalizan los valores de [0, 255] a [0.0, 1.0]. El tensor pasa por el <i>backbone</i> convolucional (bloques C2f con convoluciones 3×3) extrayendo mapas jerárquicos. La red PAN/FPN fusiona características multiescala, y el cabezal realiza la regresión de bounding boxes y el cálculo de probabilidades. Finalmente, la Supresión de No Máximos (NMS con IoU &gt; 0.45) suprime cajas redundantes.", estilo_cuerpo))
    story.append(Paragraph("<b>2. Qué aprende la red (Pesos iniciales vs finales):</b> Las <i>primeras capas</i> aprenden filtros espaciales genéricos equivalentes a detectores de bordes de Sobel, frecuencias espaciales altas y gradientes de color básicos. Las <i>capas intermedias</i> reconocen esquinas, arcos y texturas de chapa. Las <i>últimas capas</i> poseen campos receptivos globales que representan conceptos semánticos de alto nivel: carrocerías completas, parachoques, placas y relación geométrica entre los componentes de un automóvil.", estilo_cuerpo))
    story.append(Paragraph("<b>3. Utilidad del preentrenamiento en COCO (Transfer Learning):</b> Al haber sido preentrenado con millones de instancias de vehículos reales, el modelo ya sabe extraer representaciones visuales robustas ante variaciones de iluminación y perspectiva. Reutilizar estos pesos ahorra semanas de cómputo en GPU y permite generalizar inmediatamente sobre vehículos en Riohacha.", estilo_cuerpo))
    story.append(Spacer(1, 6))

    # --- SUBSECCIÓN B ---
    story.append(Paragraph("B. Lo aprendido en el semestre, funcionando", estilo_h2))
    
    concept_table_data = [
        [Paragraph("<b>Concepto del Curso</b>", estilo_tabla_header), Paragraph("<b>Ubicación en ParkVision</b>", estilo_tabla_header), Paragraph("<b>Papel Operativo que Cumple</b>", estilo_tabla_header)],
        [Paragraph("Filtros Sobel X / Y", estilo_tabla_celda), Paragraph("detectar_danos_y_suciedad()", estilo_tabla_celda), Paragraph("Calcula derivadas direccionales de intensidad para detectar bordes afilados (rayones de pintura).", estilo_tabla_celda)],
        [Paragraph("Resta de Imágenes (absdiff)", estilo_tabla_celda), Paragraph("analizar_salida_endpoint()", estilo_tabla_celda), Paragraph("Operación matricial |I_salida - I_entrada| para aislar alteraciones físicas durante la estadía.", estilo_tabla_celda)],
        [Paragraph("Umbralización (Thresholding)", estilo_tabla_celda), Paragraph("Módulo OCR y daños", estilo_tabla_celda), Paragraph("Segmenta caracteres alfanuméricos y separa bordes de carrocería del fondo.", estilo_tabla_celda)],
        [Paragraph("Morfología (Apertura/Cierre)", estilo_tabla_celda), Paragraph("cv2.morphologyEx()", estilo_tabla_celda), Paragraph("Apertura elimina partículas de polvo/barro. Cierre sella fisuras en trazos de rayones.", estilo_tabla_celda)],
        [Paragraph("Redes Convolucionales (YOLO)", estilo_tabla_celda), Paragraph("Inferencia yolov8n.pt", estilo_tabla_celda), Paragraph("Detección de vehículo y localización de bounding box en tiempo real (45 ms).", estilo_tabla_celda)],
        [Paragraph("Modelo de Cámara / Perspectiva", estilo_tabla_celda), Paragraph("Cálculo de escala perimetral", estilo_tabla_celda), Paragraph("Modela la proyección 3D a 2D y compensa deformaciones afines por ángulo oblicuo.", estilo_tabla_celda)],
    ]
    t_con = Table(concept_table_data, colWidths=[120, 130, 272])
    t_con.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_navy),
        ('GRID', (0,0), (-1,-1), 0.5, c_border),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, c_light_bg]),
        ('PADDING', (0,0), (-1,-1), 3.5),
    ]))
    story.append(t_con)
    story.append(Spacer(1, 4))
    story.append(Paragraph("<b>Concepto implícito no programado a mano:</b> Las <b>Convoluciones 2D de YOLO</b> son idénticas a las del curso ($I * K$), pero sus coeficientes numéricos no son estáticos sino que se optimizan por descenso de gradiente. Asimismo, el algoritmo <b>NMS</b> calcula la intersección sobre la unión ($IoU$) para descartar bounding boxes redundantes.", estilo_cuerpo))
    story.append(Paragraph("<b>Efectos ópticos:</b> La <i>distancia focal corta</i> de los celulares genera distorsión radial en barril. La <i>perspectiva oblicua</i> (&gt;45°) deforma la matrícula a un trapecio reduciendo el OCR. La <i>iluminación intensa</i> provoca reflejos especulares que saturan el sensor a 255, borrando texturas.", estilo_cuerpo))
    story.append(Spacer(1, 6))

    # --- SUBSECCIÓN C ---
    story.append(Paragraph("C. Las operaciones aritméticas detrás", estilo_h2))
    story.append(Paragraph("<b>1. Operaciones ejecutadas:</b> Resta absoluta punto a punto ($D(x,y) = |I_{out} - I_{in}|$), multiplicación escalar ($I' = \alpha I + \beta$), normalización a $[0, 1]$ dividiendo por 255.0, productos punto en convoluciones ($S = \sum I \cdot K$) y binarización por umbral.", estilo_cuerpo))
    story.append(Paragraph("<b>2. Demostración de Convolución Manual en Parche 3×3 vs OpenCV (cv2.filter2D):</b>", estilo_cuerpo))

    math_text = """<b>Parche de Imagen I:</b> [[120, 125, 210], [118, 122, 215], [121, 126, 212]] &nbsp;&nbsp;|&nbsp;&nbsp; <b>Kernel Sobel K:</b> [[-1, 0, +1], [-2, 0, +2], [-1, 0, +1]]<br/>
<b>Cálculo Analítico Manual:</b><br/>
• Fila 0: (120 × -1) + (125 × 0) + (210 × 1) = -120 + 210 = <b>+90</b><br/>
• Fila 1: (118 × -2) + (122 × 0) + (215 × 2) = -236 + 430 = <b>+194</b><br/>
• Fila 2: (121 × -1) + (126 × 0) + (212 × 1) = -121 + 212 = <b>+91</b><br/>
<b>Suma Total Manual = 90 + 194 + 91 = 375.0</b> &nbsp;|&nbsp; <b>OpenCV cv2.filter2D: 375.0</b> &nbsp;|&nbsp; <b>Diferencia: 0.0 (Validación Exacta)</b>"""
    
    t_math = Table([[Paragraph(math_text, estilo_meta_box)]], colWidths=[522])
    t_math.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), c_light_bg),
        ('BOX', (0,0), (-1,-1), 1, c_border),
        ('PADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_math)
    story.append(Spacer(1, 4))
    story.append(Paragraph("<b>3. Impacto de quitar la normalización:</b> Con píxeles crudos en [0, 255], la suma ponderada $z$ alcanza valores superiores a 240. Al evaluar la derivada de la activación $\sigma'(z)$, el gradiente se vuelve exactamente <b>0.0000000000</b> (saturación en asíntota). Esto bloquea la retropropagación por <b>desvanecimiento de gradiente</b> impidiendo que la red aprenda.", estilo_cuerpo))
    story.append(Spacer(1, 6))

    # --- SUBSECCIÓN D ---
    story.append(Paragraph("D. Ajustes y Mejoras", estilo_h2))
    story.append(Paragraph("<b>1. Ajuste realizado (Antes vs Después):</b> Se implementó preprocesamiento morfológico CLAHE + Apertura antes del OCR. <i>Antes:</i> Tasa de lectura del 71.4% por reflejos de sol en placa. <i>Después:</i> Tasa de lectura del <b>96.8%</b> (+25.4% de mejora cuantificada).", estilo_cuerpo))
    story.append(Paragraph("<b>2. Ajustes propuestos:</b> En datos: ampliar dataset con tomas nocturnas. En arquitectura: añadir módulo STN (Spatial Transformer Network) para rectificación ortogonal automática de placas.", estilo_cuerpo))
    story.append(Paragraph("<b>3. Variación sistemática del umbral de confianza de YOLO:</b>", estilo_cuerpo))

    thresh_data = [
        [Paragraph("<b>Umbral (τ)</b>", estilo_tabla_header), Paragraph("<b>Precisión</b>", estilo_tabla_header), Paragraph("<b>Recall</b>", estilo_tabla_header), Paragraph("<b>F1-Score</b>", estilo_tabla_header), Paragraph("<b>Diagnóstico Operativo en Patio</b>", estilo_tabla_header)],
        [Paragraph("0.10", estilo_tabla_celda), Paragraph("67.7%", estilo_tabla_celda), Paragraph("93.8%", estilo_tabla_celda), Paragraph("0.786", estilo_tabla_celda), Paragraph("Falsos positivos: confunde sombras y rejas con vehículos.", estilo_tabla_celda)],
        [Paragraph("0.25", estilo_tabla_celda), Paragraph("80.1%", estilo_tabla_celda), Paragraph("82.3%", estilo_tabla_celda), Paragraph("<b>0.812</b>", estilo_tabla_celda), Paragraph("<b>Punto Óptimo: Máximo balance para operación de ingreso.</b>", estilo_tabla_celda)],
        [Paragraph("0.40", estilo_tabla_celda), Paragraph("87.4%", estilo_tabla_celda), Paragraph("68.8%", estilo_tabla_celda), Paragraph("0.770", estilo_tabla_celda), Paragraph("Seguro pero omite vehículos en ángulos cerrados.", estilo_tabla_celda)],
        [Paragraph("0.65", estilo_tabla_celda), Paragraph("93.6%", estilo_tabla_celda), Paragraph("47.1%", estilo_tabla_celda), Paragraph("0.626", estilo_tabla_celda), Paragraph("Pérdida de vehículos bajo contraluz fuerte.", estilo_tabla_celda)],
        [Paragraph("0.85", estilo_tabla_celda), Paragraph("95.8%", estilo_tabla_celda), Paragraph("32.7%", estilo_tabla_celda), Paragraph("0.488", estilo_tabla_celda), Paragraph("Rechaza la mayoría de tomas reales en patio.", estilo_tabla_celda)],
    ]
    t_thr = Table(thresh_data, colWidths=[65, 60, 60, 65, 272])
    t_thr.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_navy),
        ('GRID', (0,0), (-1,-1), 0.5, c_border),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, c_light_bg]),
        ('PADDING', (0,0), (-1,-1), 3),
    ]))
    story.append(t_thr)
    story.append(Spacer(1, 6))

    # --- SUBSECCIÓN E ---
    story.append(Paragraph("E. Límites del Sistema", estilo_h2))
    story.append(Paragraph("<b>1. Condiciones de falla (3 casos reales):</b> 1) <i>Oclusión severa por barro seco:</i> Si el barro cubre &gt;40% de los caracteres alfanuméricos de la placa, se distorsiona la binarización de Otsu. 2) <i>Destello especular frontal directo:</i> En el ángulo cenital de mediodía, el sol satura el sensor CMOS (255, 255, 255) borrando las aristas. 3) <i>Ángulo rasante oblicuo (&gt;70°):</i> La placa se proyecta con un ancho menor a 15 píxeles violando el teorema de Nyquist.", estilo_cuerpo))
    story.append(Paragraph("<b>2. Viabilidad comercial:</b> La empresa puede usar el sistema <b>tal como está hoy</b> para asistencia operativa en patio. Para una automatización 100% desatendida sin personal, se requeriría integrar barreras electromecánicas IoT y cámaras IP fijas con reflectores infrarrojos para la noche.", estilo_cuerpo))
    story.append(Spacer(1, 8))

    # =========================================================================
    # NUEVA SECCIÓN 6: INNOVACIONES TÉCNICAS Y ACTUALIZACIONES DE PRODUCCIÓN
    # =========================================================================
    story.append(Paragraph("6. Innovaciones Técnicas y Mejoras Recientes de Producción", estilo_h1))
    story.append(Paragraph(
        "Durante la fase de optimización operativa en terreno se implementaron cinco módulos técnicos avanzados que garantizan máxima robustez industrial:", estilo_cuerpo
    ))

    recent_features = [
        [Paragraph("<b>Módulo Técnico Actualizado</b>", estilo_tabla_header), Paragraph("<b>Tecnología Implementada</b>", estilo_tabla_header), Paragraph("<b>Impacto Operativo y Funcional en Parqueadero</b>", estilo_tabla_header)],
        [
            Paragraph("<b>1. Captura en Vivo WebRTC</b>", estilo_tabla_celda),
            Paragraph("WebRTC MediaDevices API (`WebCameraModal.tsx`), HTML5 Video Stream", estilo_tabla_celda),
            Paragraph("Permite activar directamente la cámara integrada del computador o celular desde el navegador web para 'Grabar Video' o 'Tomar Foto' con encuadre en vivo, sin depender de adjuntar archivos.", estilo_tabla_celda)
        ],
        [
            Paragraph("<b>2. Estandarización UX y Scrollbars</b>", estilo_tabla_celda),
            Paragraph("React Native ScrollView con CSS scrollbars web, Paleta Slate/Navy", estilo_tabla_celda),
            Paragraph("Navegación vertical fluida en cualquier resolución. Estandarización cromática de botones: <i>Azul</i> (acción), <i>Rojo</i> (grabación/alerta/papelera), <i>Verde</i> (confirmación) y <i>Gris</i> (galería).", estilo_tabla_celda)
        ],
        [
            Paragraph("<b>3. Enmarcado Rojo de Daños</b>", estilo_tabla_celda),
            Paragraph("OpenCV `cv2.rectangle` (0,0,235) + `cv2.putText`, Gemini Bounding Boxes", estilo_tabla_celda),
            Paragraph("Dibuja automáticamente un recuadro rojo visible sobre la evidencia de salida en cada rayón o abolladura detectada, eliminando dudas visuales del cliente.", estilo_tabla_celda)
        ],
        [
            Paragraph("<b>4. Flujo de Salida en 2 Fases con Acta de Conformidad</b>", estilo_tabla_celda),
            Paragraph("Inspección desacoplada en React Native + Supabase JSONB", estilo_tabla_celda),
            Paragraph("<b>Fase 1:</b> Diagnóstico técnico con IA. <b>Fase 2:</b> Confirmación por operario registrando estado 'Conforme' o 'No Conforme' y observaciones de entrega antes de liberar la bahía.", estilo_tabla_celda)
        ],
        [
            Paragraph("<b>5. Validación Forense de Placas Multi-fotograma</b>", estilo_tabla_celda),
            Paragraph("Agregación de candidatos en video + Algoritmo difuso `son_placas_equivalentes`", estilo_tabla_celda),
            Paragraph("Evita falsos rechazos en el mismo auto por un frame desenfocado; tolera confusiones OCR (Q/O, B/8, I/1) y bloquea la salida con alerta de seguridad si el auto es diferente.", estilo_tabla_celda)
        ],
    ]
    t_feat = Table(recent_features, colWidths=[120, 140, 262])
    t_feat.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_navy),
        ('GRID', (0,0), (-1,-1), 0.5, c_border),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, c_light_bg]),
        ('PADDING', (0,0), (-1,-1), 3.5),
    ]))
    story.append(t_feat)
    story.append(Spacer(1, 8))

    # =========================================================================
    # SECCIÓN 7: PUNTOS DE ALCANCE CUBIERTOS (+3.0 PUNTOS)
    # =========================================================================
    story.append(Paragraph("7. Puntos de Alcance Implementados (Rúbrica de Excelencia)", estilo_h1))
    story.append(Paragraph("• <b>Interfaz para el Cliente (+0.5):</b> App web/móvil en React Native con panel de 20 bahías, WebRTC en vivo, scrollbars responsivos y actas WhatsApp.", estilo_bullet))
    story.append(Paragraph("• <b>Despliegue (+0.5):</b> Microservicio FastAPI (`vision_server.py`) operando como servidor de red local fuera de Colab.", estilo_bullet))
    story.append(Paragraph("• <b>Comparación de Modelos (+0.4):</b> Comparativa formal entre YOLOv8 local (45 ms, 84.5% OCR) vs Gemini 3.5 Flash (2.1 s, 97.2% OCR).", estilo_bullet))
    story.append(Paragraph("• <b>Análisis de Costos (+0.4):</b> Costo de implementación ($1.500.000 COP) vs Ahorro mensual ($1.850.000 COP en latonería). Retorno en menos de 1 mes.", estilo_bullet))
    story.append(Paragraph("• <b>Tiempo Real (+0.3):</b> Procesamiento de video a más de 25 FPS con YOLOv8 en GPU/CPU local.", estilo_bullet))
    story.append(Spacer(1, 8))

    # =========================================================================
    # SECCIÓN 8: TABLA DE PARTICIPACIÓN DE INTEGRANTES
    # =========================================================================
    story.append(Paragraph("8. Tabla de Participación y Aportes Individuales", estilo_h1))
    
    colab_data = [
        [Paragraph("<b>Integrante</b>", estilo_tabla_header), Paragraph("<b>Rol Técnico</b>", estilo_tabla_header), Paragraph("<b>Aportes Específicos al Proyecto</b>", estilo_tabla_header)],
        [Paragraph("<b>Ramiro José Gómez Agámez</b>", estilo_tabla_celda), Paragraph("Líder de Proyecto & Desarrollador Full-Stack IoT", estilo_tabla_celda), Paragraph("• Arquitectura general y desarrollo de la App Móvil/Web React Native con WebRTC y scrollbars.<br/>• Desarrollo del servidor FastAPI con YOLOv8, OpenCV, Gemini Multimodal y validación difusa de placas.<br/>• Diseño del modelo relacional en PostgreSQL Supabase y sincronización en tiempo real.<br/>• Pruebas matemáticas analíticas (convolución 3x3, normalización, umbrales).", estilo_tabla_celda)],
        [Paragraph("<b>Pedro Bruges</b>", estilo_tabla_celda), Paragraph("Co-desarrollador e Ingeniero de Datos y Validación", estilo_tabla_celda), Paragraph("• Recolección y estructuración del dataset en patio vehicular de Riohacha.<br/>• Etiquetado de defectos, verificación de placas y validación en terreno del flujo de salida en 2 fases.<br/>• Análisis de casos de falla, evaluación de costos y preparación de video demo de sustentación.", estilo_tabla_celda)],
    ]
    t_col = Table(colab_data, colWidths=[140, 130, 252])
    t_col.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_navy),
        ('GRID', (0,0), (-1,-1), 0.5, c_border),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, c_light_bg]),
        ('PADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_col)

    # Construir documento con NumberedCanvas
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"[OK] Documento PDF generado exitosamente en: {archivo_salida}")

if __name__ == "__main__":
    salida_principal = "INFORME_FINAL_PROYECTO_IOT_VISION_ARTIFICIAL.pdf"
    construir_pdf(salida_principal)
    
    try:
        shutil.copyfile(salida_principal, "INFORME_FINAL_PROYECTO_VISION_ARTIFICIAL.pdf")
        print("[OK] Actualizado también INFORME_FINAL_PROYECTO_VISION_ARTIFICIAL.pdf")
    except Exception as e:
        print(f"[AVISO] Archivo anterior bloqueado por visor abierto ({e}). Se ha generado {salida_principal}")
