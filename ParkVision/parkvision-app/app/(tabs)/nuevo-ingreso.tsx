import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
  StatusBar,
  Share,
  Linking,
  Platform,
  Modal,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { inspectionService } from '../../src/services/inspectionService';
import { TipoServicio, DanoVehiculo, EspacioParqueo } from '../../src/types';

export default function NuevoIngresoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ espacioPreseleccionado?: string }>();

  // Estados de formulario
  const [placa, setPlaca] = useState('');
  const [marca, setMarca] = useState('');
  const [color, setColor] = useState('');
  const [tipoServicio, setTipoServicio] = useState<TipoServicio>('solo_parquear');
  const [espacioAsignado, setEspacioAsignado] = useState('');
  const [bahiasDisponibles, setBahiasDisponibles] = useState<EspacioParqueo[]>([]);

  // Datos del cliente (se toman tras grabar el video)
  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteWhatsapp, setClienteWhatsapp] = useState('');
  const [observaciones, setObservaciones] = useState('');

  // Evidencia
  const [videoEntradaUri, setVideoEntradaUri] = useState<string | null>(null);
  const [fotoEvidenciaUri, setFotoEvidenciaUri] = useState<string | null>(null);

  // Estados IA
  const [analizandoVideo, setAnalizandoVideo] = useState(false);
  const [videoProcesado, setVideoProcesado] = useState(false);
  const [danosEntrada, setDanosEntrada] = useState<DanoVehiculo[]>([]);
  const [diagnosticoTexto, setDiagnosticoTexto] = useState('');
  const [suciedadFiltrada, setSuciedadFiltrada] = useState(0);

  // Servidor Python de Visión
  const [servidorConectado, setServidorConectado] = useState<boolean | null>(null);
  const [serverUrlInput, setServerUrlInput] = useState('http://192.168.0.17:8000');
  const [modalServerVisible, setModalServerVisible] = useState(false);

  useEffect(() => {
    cargarBahias();
    verificarEstadoServidor();

    // Verificación periódica del estado del servidor (cada 5 segundos)
    const interval = setInterval(() => {
      verificarEstadoServidor();
    }, 5000);

    return () => clearInterval(interval);
  }, [params.espacioPreseleccionado]);

  // Refrescar automáticamente bahías disponibles al entrar a la pantalla
  useFocusEffect(
    useCallback(() => {
      cargarBahias();
    }, [])
  );

  const verificarEstadoServidor = async () => {
    const estado = await inspectionService.verificarServidorVision();
    setServidorConectado(estado.conectado);
    setServerUrlInput(estado.url);
  };

  const guardarServerUrl = async () => {
    if (serverUrlInput.trim()) {
      await inspectionService.setVisionServerUrl(serverUrlInput.trim());
      await verificarEstadoServidor();
      setModalServerVisible(false);
    }
  };

  const probarConexionModal = async () => {
    if (serverUrlInput.trim()) {
      await inspectionService.setVisionServerUrl(serverUrlInput.trim());
    }
    const estado = await inspectionService.verificarServidorVision();
    setServidorConectado(estado.conectado);
    if (estado.conectado) {
      Alert.alert('✓ Conexión Exitosa', `Servidor Python respondiendo correctamente en:\n${estado.url}`);
    } else {
      Alert.alert(
        '⚠️ Sin Respuesta',
        `No se pudo contactar ${serverUrlInput}.\n\nAsegúrate de ejecutar en PowerShell en tu PC:\npython vision_server.py\n\nY que el celular esté conectado a la misma red Wi-Fi.`
      );
    }
  };

  const cargarBahias = () => {
    const libres = inspectionService.getEspaciosDisponibles();
    setBahiasDisponibles(libres);

    if (params.espacioPreseleccionado) {
      setEspacioAsignado(params.espacioPreseleccionado);
    } else if (libres.length > 0 && !espacioAsignado) {
      setEspacioAsignado(libres[0].codigo);
    }
  };

  // 1. Grabar Video con Cámara del Celular (Tiempo Ilimitado)
  const grabarVideoDeIngreso = async () => {
    const estado = await inspectionService.verificarServidorVision();
    setServidorConectado(estado.conectado);

    if (!estado.conectado) {
      Alert.alert(
        '⚠️ Servidor IA Desconectado',
        `No se pudo conectar a ${serverUrlInput}.\n\nPara que la IA capture la placa, marca y daños reales, inicia el servidor en tu PC con:\npython vision_server.py\n\n¿Deseas continuar grabando el video de todas formas?`,
        [
          { text: 'Esperar a encender PC', style: 'cancel' },
          { text: 'Grabar ahora', onPress: () => abrirCamaraVideo() },
        ]
      );
      return;
    }

    await abrirCamaraVideo();
  };

  const abrirCamaraVideo = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso Requerido', 'Se requiere acceso a la cámara para grabar el video del auto.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['videos'],
      quality: 0.6,
    });

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setVideoEntradaUri(uri);
      ejecutarDiagnostico(uri, true);
    }
  };

  // Tomar Foto de Alta Resolución con Cámara del Celular
  const tomarFotoDeIngreso = async () => {
    const estado = await inspectionService.verificarServidorVision();
    setServidorConectado(estado.conectado);

    if (!estado.conectado) {
      Alert.alert(
        '⚠️ Servidor IA Desconectado',
        `No se pudo conectar a ${serverUrlInput}.\n\nPara análisis automático por IA, corre en tu PC:\npython vision_server.py\n\n¿Deseas tomar la foto de todas formas?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Tomar Foto', onPress: () => abrirCamaraFoto() },
        ]
      );
      return;
    }

    await abrirCamaraFoto();
  };

  const abrirCamaraFoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso Requerido', 'Se requiere acceso a la cámara para fotografiar el auto.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      const b64 = result.assets[0].base64 || undefined;
      setVideoEntradaUri(uri);
      setFotoEvidenciaUri(uri);
      ejecutarDiagnostico(uri, false, b64);
    }
  };

  // Seleccionar Video o Foto existente desde la Galería
  const seleccionarDeGaleria = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso Requerido', 'Se requiere acceso a la galería.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos', 'images'],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const uri = asset.uri;
      const isVid =
        asset.type === 'video' ||
        (asset.mimeType ? asset.mimeType.startsWith('video/') : false) ||
        /\.(mp4|mov|webm|avi|mkv|3gp)$/i.test(asset.fileName || uri);
      setVideoEntradaUri(uri);
      if (!isVid) setFotoEvidenciaUri(uri);
      ejecutarDiagnostico(uri, isVid);
    }
  };

  const ejecutarDiagnostico = async (uri: string, esVideo: boolean = true, base64Directo?: string) => {
    setAnalizandoVideo(true);
    try {
      const resultado = await inspectionService.analizarVideoInmediato(uri, esVideo, tipoServicio, base64Directo);

      if ((resultado as any).esVehiculo === false) {
        setPlaca('');
        setMarca('');
        setColor('');
        setVideoProcesado(false);
        setDanosEntrada([]);
        setFotoEvidenciaUri(null);
        setVideoEntradaUri(null);
        Alert.alert(
          '⚠️ Vehículo No Detectado',
          (resultado as any).mensajeError ||
            'La inteligencia artificial examinó la captura y determinó que NO corresponde a un automóvil, camioneta o motocicleta.\n\nSolo se capturan datos cuando se graba un vehículo real. Por favor vuelve a enfocar el auto.'
        );
        return;
      }

      setPlaca(resultado.placa || '');
      setMarca(resultado.marca && resultado.marca !== 'Vehículo' ? resultado.marca : 'Automóvil');
      setColor(resultado.color || 'Gris / Plata');
      if (resultado.frameCapturadoUrl) setFotoEvidenciaUri(resultado.frameCapturadoUrl);
      if ((resultado as any).videoUrlServidor) setVideoEntradaUri((resultado as any).videoUrlServidor);
      setDanosEntrada(resultado.danosEntrada || []);
      setDiagnosticoTexto(resultado.diagnosticoTexto || '');
      setSuciedadFiltrada(resultado.suciedadFiltrada || 0);

      // Si no venía preseleccionado, usar el asignado por el servicio
      if (!espacioAsignado) {
        setEspacioAsignado(resultado.espacioAsignado);
      }

      setVideoProcesado(true);

      if (!resultado.servidorConectado) {
        Alert.alert(
          'Aviso de Conexión',
          `El procesamiento en ${serverUrlInput} tardó o no respondió a tiempo. Puedes ingresar o editar los datos reales manualmente.`
        );
      }
    } catch (e) {
      Alert.alert('Aviso', 'Registro guardado. Puedes verificar los datos manualmente.');
    } finally {
      setAnalizandoVideo(false);
    }
  };

  // Descartar video o foto actual y permitir grabar otro
  const descartarCaptura = () => {
    const ejecutarDescarte = () => {
      setVideoEntradaUri(null);
      setFotoEvidenciaUri(null);
      setVideoProcesado(false);
      setPlaca('');
      setMarca('');
      setColor('');
      setDanosEntrada([]);
      setDiagnosticoTexto('');
      setSuciedadFiltrada(0);
    };

    if (Platform.OS === 'web') {
      const ok = typeof window !== 'undefined'
        ? window.confirm('¿Descartar captura actual? Se borrará la vista previa y los datos leídos para que puedas seleccionar o grabar otro video.')
        : true;
      if (ok) {
        ejecutarDescarte();
      }
      return;
    }

    Alert.alert(
      '¿Descartar captura actual?',
      'Se borrará la vista previa y los datos leídos para que puedas grabar o seleccionar un nuevo video.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, descartar',
          style: 'destructive',
          onPress: ejecutarDescarte,
        },
      ]
    );
  };

  // Limpiar ventana por completo y refrescar bahías para el próximo vehículo
  const limpiarFormulario = () => {
    setVideoEntradaUri(null);
    setFotoEvidenciaUri(null);
    setVideoProcesado(false);
    setPlaca('');
    setMarca('');
    setColor('');
    setEspacioAsignado('');
    setClienteNombre('');
    setClienteWhatsapp('');
    setObservaciones('');
    setDanosEntrada([]);
    setDiagnosticoTexto('');
    setSuciedadFiltrada(0);
    cargarBahias();
  };

  // 2. Guardar en Base de Datos y Enviar por WhatsApp
  const guardarIngresoYEnviarWsp = async () => {
    if (!videoEntradaUri && !placa) {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert('Video o Foto requerida: Selecciona o graba el vehículo antes de registrar.');
      } else {
        Alert.alert('Video o Foto requerida', 'Presiona el botón para capturar el vehículo.');
      }
      return;
    }

    if (!placa.trim() || !marca.trim()) {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert('Faltan datos: Por favor verifica la placa y marca del vehículo.');
      } else {
        Alert.alert('Faltan datos', 'Por favor verifica la placa y marca detectadas.');
      }
      return;
    }

    const bahiaFinal = espacioAsignado || inspectionService.getPrimerEspacioDisponible();
    const ahora = new Date();
    const horaIngreso = `${ahora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - Hoy`;

    try {
      const ticketCreado = await inspectionService.registrarIngreso({
        placa: placa.toUpperCase().trim(),
        marca: marca.trim(),
        color: color.trim() || 'No especificado',
        tipoServicio,
        espacioAsignado: bahiaFinal,
        horaIngreso,
        fotoPlacaUrl: fotoEvidenciaUri || videoEntradaUri || '',
        videoEntradaUrl: videoEntradaUri || '',
        fotoInspeccionEntradaUrl: fotoEvidenciaUri || videoEntradaUri || '',
        danosEntrada,
        diagnosticoEntradaTexto: diagnosticoTexto,
        propietarioNombre: clienteNombre.trim() || 'Cliente Parqueadero',
        propietarioTelefono: clienteWhatsapp.trim(),
        observaciones: observaciones.trim(),
        suciedadIgnoradaContador: suciedadFiltrada,
      });

      // Generar y enviar mensaje por WhatsApp al cliente
      const mensajeWsp = inspectionService.generarReporteIngresoWhatsApp(ticketCreado);

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        // En Web: si hay WhatsApp, abrir pestaña de WhatsApp Web de inmediato con el acta
        if (clienteWhatsapp.trim()) {
          const telLimpio = clienteWhatsapp.replace(/[^0-9]/g, '');
          window.open(
            `https://api.whatsapp.com/send?phone=${telLimpio}&text=${encodeURIComponent(mensajeWsp)}`,
            '_blank'
          );
        }
        window.alert(
          `✓ INGRESO REGISTRADO EXITOSAMENTE\n\n🚗 Vehículo: ${placa.toUpperCase()} (${marca})\n📍 Bahía Asignada: ${bahiaFinal}\n\nSe ha emitido el acta de custodia del vehículo.`
        );
        limpiarFormulario();
        router.push('/(tabs)/');
        return;
      }

      // En Móvil: Diálogo nativo con opciones
      Alert.alert(
        '✓ Ingreso Registrado',
        `🚗 Vehículo: ${placa.toUpperCase()} (${marca})\n📍 Bahía Asignada: ${bahiaFinal}\n\n¿Deseas enviar el acta de ingreso por WhatsApp al cliente ahora?`,
        [
          {
            text: 'Solo Guardar',
            onPress: () => {
              limpiarFormulario();
              router.push('/(tabs)/');
            },
          },
          {
            text: '📲 Enviar por WhatsApp',
            onPress: async () => {
              try {
                const url = `whatsapp://send?phone=${clienteWhatsapp}&text=${encodeURIComponent(mensajeWsp)}`;
                const can = await Linking.canOpenURL(url);
                if (can) {
                  await Linking.openURL(url);
                } else {
                  await Share.share({ message: mensajeWsp });
                }
              } catch (err) {
                await Share.share({ message: mensajeWsp });
              }
              limpiarFormulario();
              router.push('/(tabs)/');
            },
          },
        ]
      );
    } catch (e) {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert('Error: No se pudo guardar el registro en la base de datos.');
      } else {
        Alert.alert('Error', 'No se pudo guardar el registro en la base de datos.');
      }
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <StatusBar barStyle="light-content" />

      {/* ESTADO DEL SERVIDOR DE VISIÓN ARTIFICIAL LOCAL */}
      <TouchableOpacity
        onPress={() => setModalServerVisible(true)}
        style={[
          styles.serverStatusBadge,
          { borderColor: servidorConectado ? '#10B981' : '#F59E0B' },
        ]}
      >
        <View
          style={[
            styles.statusDot,
            { backgroundColor: servidorConectado ? '#10B981' : '#F59E0B' },
          ]}
        />
        <Text style={styles.serverStatusText}>
          {servidorConectado
            ? `🟢 Motor IA Online (${serverUrlInput})`
            : `🟡 Servidor IA: ${serverUrlInput} (Toca para cambiar IP)`}
        </Text>
        <Ionicons name="settings-sharp" size={14} color="#94A3B8" />
      </TouchableOpacity>

      {/* MODAL CONFIGURACIÓN IP SERVIDOR */}
      <Modal visible={modalServerVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Configurar Servidor de Visión</Text>
            <Text style={styles.modalSubtitle}>
              Ingresa la dirección IP de tu PC donde corre "python vision_server.py":
            </Text>
            <TextInput
              style={styles.modalInput}
              value={serverUrlInput}
              onChangeText={setServerUrlInput}
              placeholder="http://192.168.0.17:8000"
              placeholderTextColor="#64748B"
              autoCapitalize="none"
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                onPress={() => setModalServerVisible(false)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelBtnText}>Cerrar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={probarConexionModal}
                style={[styles.modalCancelBtn, { backgroundColor: '#334155' }]}
              >
                <Text style={[styles.modalCancelBtnText, { color: '#38BDF8' }]}>Probar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={guardarServerUrl} style={styles.modalSaveBtn}>
                <Text style={styles.modalSaveBtnText}>Conectar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* PASO 1: CAPTURA CON CELULAR (VIDEO O FOTO) */}
      <View style={styles.card}>
        <View style={styles.stepTitleRow}>
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>PASO 1</Text>
          </View>
          <Text style={styles.stepTitle}>Captura del Vehículo</Text>
        </View>

        <Text style={styles.stepDesc}>
          Graba el video perimetral o toma una foto para registrar el ingreso del vehículo.
        </Text>

        <View style={styles.captureBtnsContainer}>
          {/* BOTÓN 1: GRABAR VIDEO (ACCIÓN PRINCIPAL DE INGRESO) */}
          <TouchableOpacity
            onPress={grabarVideoDeIngreso}
            disabled={analizandoVideo}
            style={[styles.recordBtn, { flex: 1, marginRight: 6 }]}
          >
            <LinearGradient
              colors={['#1D4ED8', '#1E40AF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.recordGradient}
            >
              {analizandoVideo ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <View style={styles.btnRow}>
                  <Ionicons name="videocam-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.recordBtnText}>GRABAR VIDEO</Text>
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* BOTÓN 2: TOMAR FOTO (ACCIÓN SECUNDARIA) */}
          <TouchableOpacity
            onPress={tomarFotoDeIngreso}
            disabled={analizandoVideo}
            style={[
              styles.recordBtn,
              {
                flex: 1,
                marginLeft: 6,
                backgroundColor: '#1E293B',
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#334155',
                overflow: 'hidden',
              },
            ]}
          >
            <View
              style={[
                styles.recordGradient,
                { backgroundColor: '#1E293B' },
              ]}
            >
              {analizandoVideo ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <View style={styles.btnRow}>
                  <Ionicons name="camera-outline" size={20} color="#93C5FD" />
                  <Text style={[styles.recordBtnText, { color: '#F1F5F9' }]}>TOMAR FOTO</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* BOTÓN 3: ELEGIR DE GALERÍA (VIDEO O FOTO) */}
        <TouchableOpacity
          onPress={seleccionarDeGaleria}
          disabled={analizandoVideo}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#1E293B',
            paddingVertical: 10,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: '#334155',
            marginTop: 8,
            gap: 8,
          }}
        >
          <Ionicons name="images-outline" size={18} color="#94A3B8" />
          <Text style={{ color: '#E2E8F0', fontSize: 13, fontWeight: '600' }}>
            O seleccionar video/foto guardado en Galería
          </Text>
        </TouchableOpacity>

        {/* TARJETA DEL DIAGNÓSTICO EXTRAÍDO POR VISIÓN ARTIFICIAL REAL */}
        {videoProcesado && (
          <View style={styles.diagCard}>
            <View style={styles.diagHeader}>
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              <Text style={styles.diagHeaderTitle}>Datos del Vehículo</Text>
            </View>

            {/* FOTO REAL CAPTURADA DEL VEHÍCULO */}
            {fotoEvidenciaUri && (
              <View style={styles.previewImageContainer}>
                <Image source={{ uri: fotoEvidenciaUri }} style={styles.previewImage} resizeMode="cover" />
                <View style={styles.previewImageBadge}>
                  <Ionicons name="camera" size={11} color="#FFFFFF" />
                  <Text style={styles.previewImageBadgeText}>EVIDENCIA DE INGRESO</Text>
                </View>
                <TouchableOpacity
                  onPress={descartarCaptura}
                  style={{
                    position: 'absolute',
                    top: 10,
                    right: 10,
                    backgroundColor: 'rgba(220, 38, 38, 0.9)',
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 20,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Ionicons name="trash-outline" size={13} color="#FFFFFF" />
                  <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>Descartar</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* PLACA COLOMBIANA EDITABLE */}
            <View style={styles.plateEditContainer}>
              <Text style={styles.diagLabel}>PLACA CAPTURADA (EDITABLE SI REQUIERE AJUSTE):</Text>
              <View style={styles.plateContainer}>
                <View style={styles.colombianPlateBox}>
                  <Text style={styles.plateCountry}>COLOMBIA</Text>
                  <TextInput
                    style={styles.plateInputReal}
                    value={placa}
                    onChangeText={(val) => setPlaca(val.toUpperCase())}
                    placeholder="ABC-123"
                    placeholderTextColor="#78350F"
                    autoCapitalize="characters"
                    maxLength={8}
                  />
                </View>
              </View>
            </View>

            {/* MARCA Y COLOR EDITABLES */}
            <View style={styles.diagInputsGrid}>
              <View style={{ flex: 1, marginRight: 6 }}>
                <Text style={styles.diagLabel}>MARCA / MODELO:</Text>
                <TextInput
                  style={styles.diagTextInput}
                  value={marca}
                  onChangeText={setMarca}
                  placeholder="Ej: Chevrolet Onix"
                  placeholderTextColor="#64748B"
                />
              </View>
              <View style={{ flex: 1, marginLeft: 6 }}>
                <Text style={styles.diagLabel}>COLOR:</Text>
                <TextInput
                  style={styles.diagTextInput}
                  value={color}
                  onChangeText={setColor}
                  placeholder="Ej: Rojo, Blanco, Gris"
                  placeholderTextColor="#64748B"
                />
              </View>
            </View>

            {/* CHIPS RÁPIDOS DE MARCAS PRINCIPALES */}
            <View style={{ marginBottom: 10 }}>
              <Text style={{ color: '#94A3B8', fontSize: 10, fontWeight: '700', marginBottom: 5 }}>
                SELECCIÓN RÁPIDA DE MARCA:
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {['Chevrolet', 'Renault', 'Toyota', 'Mazda', 'Kia', 'Nissan', 'Hyundai', 'Volkswagen', 'Ford', 'Suzuki'].map((b) => (
                  <TouchableOpacity
                    key={b}
                    onPress={() => setMarca(b)}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 12,
                      backgroundColor: marca.toLowerCase().includes(b.toLowerCase()) ? '#2563EB' : '#1E293B',
                      borderWidth: 1,
                      borderColor: marca.toLowerCase().includes(b.toLowerCase()) ? '#60A5FA' : '#334155',
                    }}
                  >
                    <Text style={{
                      color: marca.toLowerCase().includes(b.toLowerCase()) ? '#FFFFFF' : '#CBD5E1',
                      fontSize: 11,
                      fontWeight: '700'
                    }}>
                      {b}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* CHIPS RÁPIDOS DE COLOR */}
            <View style={{ marginBottom: 12 }}>
              <Text style={{ color: '#94A3B8', fontSize: 10, fontWeight: '700', marginBottom: 5 }}>
                SELECCIÓN RÁPIDA DE COLOR:
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {['Blanco', 'Gris / Plata', 'Negro', 'Rojo', 'Azul', 'Amarillo', 'Naranja', 'Verde', 'Vinotinto'].map((c) => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setColor(c)}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 12,
                      backgroundColor: color.toLowerCase() === c.toLowerCase() ? '#059669' : '#1E293B',
                      borderWidth: 1,
                      borderColor: color.toLowerCase() === c.toLowerCase() ? '#34D399' : '#334155',
                    }}
                  >
                    <Text style={{
                      color: color.toLowerCase() === c.toLowerCase() ? '#FFFFFF' : '#CBD5E1',
                      fontSize: 11,
                      fontWeight: '700'
                    }}>
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.diagReportBox}>
              <Text style={styles.diagReportTitle}>📋 Diagnóstico Inicial de Carrocería:</Text>
              <Text style={styles.diagReportText}>{diagnosticoTexto}</Text>
              {danosEntrada.map((d) => (
                <Text key={d.id} style={styles.danoItem}>
                  ⚠️ {d.zonaTexto}: {d.descripcion} ({d.tipo.toUpperCase()})
                </Text>
              ))}
            </View>

            {/* BOTÓN PROMINENTE PARA DESCARTAR VIDEO/FOTO Y REPETIR GRABACIÓN */}
            <TouchableOpacity
              onPress={descartarCaptura}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#1E293B',
                borderWidth: 1.5,
                borderColor: '#EF4444',
                paddingVertical: 12,
                borderRadius: 12,
                marginTop: 14,
                gap: 8,
              }}
            >
              <Ionicons name="trash-bin-outline" size={18} color="#EF4444" />
              <Text style={{ color: '#FCA5A5', fontSize: 13, fontWeight: '700' }}>
                ¿No te gustó la captura? Descartar y grabar de nuevo
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* PASO 2: ASIGNACIÓN DE BAHÍA DISPONIBLE Y SERVICIO */}
      <View style={styles.card}>
        <View style={styles.stepTitleRow}>
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>PASO 2</Text>
          </View>
          <Text style={styles.stepTitle}>Asignación de Bahía y Servicio</Text>
        </View>

        {/* SELECCIÓN DE BAHÍA DE LAS DISPONIBLES */}
        <Text style={styles.fieldLabel}>Selecciona la Bahía a Ubicar (Disponibles):</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.baySelectRow}>
          {bahiasDisponibles.map((b) => {
            const isSelected = espacioAsignado === b.codigo;
            return (
              <TouchableOpacity
                key={b.id}
                onPress={() => setEspacioAsignado(b.codigo)}
                style={[styles.bayChip, isSelected && styles.bayChipActive]}
              >
                <Text style={[styles.bayChipText, isSelected && styles.bayChipTextActive]}>
                  {b.codigo}
                </Text>
                <Text style={[styles.bayChipSub, isSelected && styles.bayChipTextActive]}>
                  LIBRE
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* TIPO DE SERVICIO: SOLO PARQUEAR, LAVAR Y PARQUEAR, SOLO LAVAR */}
        <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Tipo de Servicio a Realizar:</Text>
        <View style={styles.servicesGrid}>
          <TouchableOpacity
            onPress={() => setTipoServicio('solo_parquear')}
            style={[styles.serviceOption, tipoServicio === 'solo_parquear' && styles.serviceOptionActive]}
          >
            <Ionicons
              name="car"
              size={18}
              color={tipoServicio === 'solo_parquear' ? '#FFFFFF' : '#94A3B8'}
            />
            <Text
              style={[
                styles.serviceOptionText,
                tipoServicio === 'solo_parquear' && styles.serviceOptionTextActive,
              ]}
            >
              Solo Parquear
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setTipoServicio('lavar_y_parquear')}
            style={[styles.serviceOption, tipoServicio === 'lavar_y_parquear' && styles.serviceOptionActive]}
          >
            <Ionicons
              name="sparkles"
              size={18}
              color={tipoServicio === 'lavar_y_parquear' ? '#FFFFFF' : '#94A3B8'}
            />
            <Text
              style={[
                styles.serviceOptionText,
                tipoServicio === 'lavar_y_parquear' && styles.serviceOptionTextActive,
              ]}
            >
              Lavar y Parquear
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setTipoServicio('solo_lavar')}
            style={[styles.serviceOption, tipoServicio === 'solo_lavar' && styles.serviceOptionActive]}
          >
            <Ionicons
              name="water"
              size={18}
              color={tipoServicio === 'solo_lavar' ? '#FFFFFF' : '#94A3B8'}
            />
            <Text
              style={[
                styles.serviceOptionText,
                tipoServicio === 'solo_lavar' && styles.serviceOptionTextActive,
              ]}
            >
              Solo Lavar
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* PASO 3: DATOS DEL CLIENTE (TOMADOS TRAS EL VIDEO) */}
      <View style={styles.card}>
        <View style={styles.stepTitleRow}>
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>PASO 3</Text>
          </View>
          <Text style={styles.stepTitle}>Datos del Cliente que Lleva el Vehículo</Text>
        </View>

        <Text style={styles.stepDesc}>
          Ingresa el nombre y WhatsApp del cliente para remitir el acta de ingreso y custodia:
        </Text>

        <View style={styles.inputGroup}>
          <Text style={styles.fieldLabel}>Nombre Completo del Cliente:</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Ej: Carlos Mendoza"
            placeholderTextColor="#64748B"
            value={clienteNombre}
            onChangeText={setClienteNombre}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.fieldLabel}>Número de WhatsApp del Cliente:</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Ej: +57 300 123 4567"
            placeholderTextColor="#64748B"
            keyboardType="phone-pad"
            value={clienteWhatsapp}
            onChangeText={setClienteWhatsapp}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.fieldLabel}>Observaciones Adicionales (Opcional):</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Ej: Deja llaves en recepción, retira a las 5:00 PM"
            placeholderTextColor="#64748B"
            value={observaciones}
            onChangeText={setObservaciones}
          />
        </View>
      </View>

      {/* BOTÓN FINAL DE GUARDAR INGRESO Y EMITIR ACTA */}
      <TouchableOpacity onPress={guardarIngresoYEnviarWsp} style={styles.submitBtn}>
        <LinearGradient
          colors={['#059669', '#047857']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.submitGradient}
        >
          <Ionicons name="checkmark-done-circle-outline" size={22} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.submitBtnText}>
            REGISTRAR INGRESO Y EMITIR ACTA
          </Text>
        </LinearGradient>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  card: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
  },
  stepTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepBadge: {
    backgroundColor: '#1E40AF',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  stepBadgeText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 10,
  },
  stepTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    flex: 1,
  },
  stepDesc: {
    color: '#94A3B8',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 12,
  },
  boldWhite: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  recordBtn: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  recordGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  recordBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  diagCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderColor: '#059669',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
  },
  diagHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  diagHeaderTitle: {
    color: '#10B981',
    fontWeight: '800',
    fontSize: 12,
  },
  diagDataRow: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  diagCol: {
    flex: 1,
  },
  diagLabel: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '700',
  },
  diagPlate: {
    color: '#FBBF24',
    fontSize: 14,
    fontWeight: '900',
  },
  diagValue: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  diagReportBox: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
  },
  diagReportTitle: {
    color: '#CBD5E1',
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 2,
  },
  diagReportText: {
    color: '#94A3B8',
    fontSize: 10,
    lineHeight: 14,
  },
  danoItem: {
    color: '#F59E0B',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 3,
  },
  dirtFilterNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dirtFilterNoticeText: {
    color: '#38BDF8',
    fontSize: 9,
    fontWeight: '600',
  },
  fieldLabel: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
  },
  baySelectRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  bayChip: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    alignItems: 'center',
  },
  bayChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#3B82F6',
  },
  bayChipText: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '900',
  },
  bayChipTextActive: {
    color: '#FFFFFF',
  },
  bayChipSub: {
    color: '#10B981',
    fontSize: 8,
    fontWeight: '800',
    marginTop: 1,
  },
  servicesGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  serviceOption: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 4,
  },
  serviceOptionActive: {
    backgroundColor: 'rgba(37, 99, 235, 0.25)',
    borderColor: '#2563EB',
  },
  serviceOptionText: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '800',
    textAlign: 'center',
  },
  serviceOptionTextActive: {
    color: '#FFFFFF',
  },
  inputGroup: {
    marginBottom: 10,
  },
  textInput: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: '#FFFFFF',
    fontSize: 12,
  },
  submitBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 15,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  serverStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 12,
    alignSelf: 'flex-start',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  serverStatusText: {
    color: '#CBD5E1',
    fontSize: 10,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 380,
    borderColor: '#334155',
    borderWidth: 1,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  modalSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 14,
    lineHeight: 18,
  },
  modalInput: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#3B82F6',
    borderRadius: 10,
    color: '#FFFFFF',
    padding: 12,
    fontSize: 13,
    marginBottom: 16,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#334155',
  },
  modalCancelBtnText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
  },
  modalSaveBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#2563EB',
  },
  modalSaveBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  captureBtnsContainer: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  plateEditContainer: {
    marginBottom: 10,
  },
  plateContainer: {
    alignItems: 'center',
    marginTop: 6,
  },
  colombianPlateBox: {
    backgroundColor: '#FBBF24',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 18,
    alignItems: 'center',
    minWidth: 160,
  },
  plateCountry: {
    color: '#000000',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 2,
  },
  plateInputReal: {
    color: '#000000',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 3,
    textAlign: 'center',
    padding: 0,
    margin: 0,
  },
  diagInputsGrid: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  diagTextInput: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  previewImageContainer: {
    position: 'relative',
    height: 180,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 14,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewImageBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  previewImageBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
