import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Share,
  Linking,
  Platform,
  StyleSheet,
  StatusBar,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useFocusEffect, router } from 'expo-router';
 import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { inspectionService } from '../../src/services/inspectionService';
import { VehiculoTicket, DanoVehiculo } from '../../src/types';
import { WebCameraModal } from '../../src/components/WebCameraModal';

export default function AuditoriaScreen() {
  const params = useLocalSearchParams<{ ticketIdPreseleccionado?: string }>();
  const [vehiculosActivos, setVehiculosActivos] = useState<VehiculoTicket[]>([]);
  const [vehiculoSeleccionado, setVehiculoSeleccionado] = useState<VehiculoTicket | null>(null);

  // Evidencias de salida
  const [videoSalidaUri, setVideoSalidaUri] = useState<string | null>(null);
  const [fotoSalidaUri, setFotoSalidaUri] = useState<string | null>(null);

  // Modal de Cámara Web para PC
  const [modalWebCamVisible, setModalWebCamVisible] = useState(false);
  const [modoWebCam, setModoWebCam] = useState<'foto' | 'video'>('video');

  // Control IA y Modo de Auditoría
  const [analizando, setAnalizando] = useState(false);
  const [analisisRealizado, setAnalisisRealizado] = useState(false);
  const [datosInspeccion, setDatosInspeccion] = useState<{
    nuevosDanos: DanoVehiculo[];
    diagnostico: string;
    fotoSalidaUrl?: string;
    videoSalidaUrl?: string;
    huboCambios: boolean;
  } | null>(null);
  const [conformidadCliente, setConformidadCliente] = useState<'conforme' | 'no_conforme'>('conforme');
  const [observacionesEntrega, setObservacionesEntrega] = useState('Vehículo entregado a satisfacción del cliente sin novedades.');
  const [procesandoSalidaFinal, setProcesandoSalidaFinal] = useState(false);

  const [resultadoAuditoria, setResultadoAuditoria] = useState<VehiculoTicket | null>(null);

  useEffect(() => {
    cargarVehiculos();
    const unsubscribe = inspectionService.subscribe(() => cargarVehiculos());
    return () => unsubscribe();
  }, [params.ticketIdPreseleccionado]);

  // Refrescar automáticamente al enfocar la pantalla
  useFocusEffect(
    useCallback(() => {
      cargarVehiculos();
    }, [])
  );

  const cargarVehiculos = (idForzado?: string | null) => {
    const lista = inspectionService.getVehiculosActivos();

    // Asegurar unicidad total en UI (por si la BD tiene registros antiguos pendientes)
    const placasVistas = new Set<string>();
    const bahiasVistas = new Set<string>();
    const listaUnica = lista.filter((v) => {
      const placaNorm = (v.placa || '').trim().toUpperCase();
      const bahiaNorm = (v.espacioAsignado || '').trim().toUpperCase();
      if (placaNorm && placasVistas.has(placaNorm)) return false;
      if (bahiaNorm && bahiasVistas.has(bahiaNorm)) return false;
      if (placaNorm) placasVistas.add(placaNorm);
      if (bahiaNorm) bahiasVistas.add(bahiaNorm);
      return true;
    });

    setVehiculosActivos(listaUnica);

    if (idForzado !== undefined) {
      if (idForzado === null) {
        setVehiculoSeleccionado(listaUnica.length > 0 ? listaUnica[0] : null);
      } else {
        const match = listaUnica.find((v) => v.id === idForzado);
        setVehiculoSeleccionado(match || (listaUnica.length > 0 ? listaUnica[0] : null));
      }
      return;
    }

    if (params.ticketIdPreseleccionado) {
      const match = listaUnica.find((v) => v.id === params.ticketIdPreseleccionado);
      if (match) {
        setVehiculoSeleccionado(match);
        return;
      }
    }

    if (vehiculoSeleccionado) {
      const sigueActivo = listaUnica.find((v) => v.id === vehiculoSeleccionado.id);
      if (!sigueActivo) {
        setVehiculoSeleccionado(listaUnica.length > 0 ? listaUnica[0] : null);
      }
    } else if (listaUnica.length > 0) {
      setVehiculoSeleccionado(listaUnica[0]);
    } else {
      setVehiculoSeleccionado(null);
    }
  };

  // Limpiar ventana de salida por completo y refrescar los vehículos en parqueo
  const limpiarVentanaSalida = () => {
    setVideoSalidaUri(null);
    setFotoSalidaUri(null);
    setResultadoAuditoria(null);
    setAnalisisRealizado(false);
    setDatosInspeccion(null);
    setConformidadCliente('conforme');
    setObservacionesEntrega('Vehículo entregado a satisfacción del cliente sin novedades.');
    cargarVehiculos(null);
  };

  const grabarVideoSalida = async () => {
    // En navegador Web: Abrir cámara web del equipo directamente
    if (Platform.OS === 'web') {
      setModoWebCam('video');
      setModalWebCamVisible(true);
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso Requerido', 'Se requiere acceso a la cámara para grabar la salida.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['videos'],
      quality: 0.5,
    });

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setVideoSalidaUri(uri);
      setFotoSalidaUri(uri);
    }
  };

  const tomarFotoSalida = async () => {
    // En navegador Web: Abrir cámara web del equipo directamente
    if (Platform.OS === 'web') {
      setModoWebCam('foto');
      setModalWebCamVisible(true);
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso Requerido', 'Se requiere acceso a la cámara para fotografiar la salida.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setVideoSalidaUri(null);
      setFotoSalidaUri(uri);
    }
  };

  const onWebCamCaptureSalida = (uri: string, esVideo: boolean) => {
    if (esVideo) {
      setVideoSalidaUri(uri);
      setFotoSalidaUri(uri);
    } else {
      setVideoSalidaUri(null);
      setFotoSalidaUri(uri);
    }
  };

  const seleccionarSalidaGaleria = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso Requerido', 'Se requiere acceso a la galería.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos', 'images'],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const uri = asset.uri;
      const isVid =
        asset.type === 'video' ||
        (asset.mimeType ? asset.mimeType.startsWith('video/') : false) ||
        /\.(mp4|mov|webm|avi|mkv|3gp)$/i.test(asset.fileName || uri);
      if (isVid) {
        setVideoSalidaUri(uri);
        setFotoSalidaUri(uri);
      } else {
        setVideoSalidaUri(null);
        setFotoSalidaUri(uri);
      }
    }
  };

  // FASE 1: Análisis e Inspección Previa de Salida (100% Real con IA)
  const ejecutarAnalisisSalida = async () => {
    if (!vehiculoSeleccionado) {
      Alert.alert('Selecciona un vehículo', 'Elige el auto que va a salir.');
      return;
    }

    const uriSalida = videoSalidaUri || fotoSalidaUri;
    if (!uriSalida) {
      Alert.alert(
        'Captura Requerida',
        'Por favor graba el video o toma la foto de inspección de salida antes de continuar.'
      );
      return;
    }

    setAnalizando(true);

    try {
      let nuevosDanosDetectados: DanoVehiculo[] = [];
      let diagnosticoSalida = '✓ Auditoría Conforme: Vehículo entregado en perfecto estado. Sin nuevos daños.';
      let fotoSalidaFinal = fotoSalidaUri || uriSalida || vehiculoSeleccionado.fotoInspeccionEntradaUrl;
      let videoSalidaFinal = videoSalidaUri || undefined;
      let huboCambios = false;

      // Ejecución con Visión Artificial Real
      const compReal = await inspectionService.compararVideosSalidaReal(
        vehiculoSeleccionado.id,
        uriSalida,
        !!videoSalidaUri
      );

      // VALIDACIÓN ESTRICTA EN TIEMPO REAL: ¿Es el mismo vehículo?
      if (compReal.esMismoVehiculo === false) {
        const alertaMsg = compReal.alertaVehiculoDistinto || 
          `El vehículo capturado en la salida no coincide con el vehículo registrado al ingreso (${vehiculoSeleccionado.placa} - ${vehiculoSeleccionado.marca} ${vehiculoSeleccionado.color}).`;
        
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.alert(`🚨 ALERTA DE SEGURIDAD VEHICULAR:\n\n${alertaMsg}\n\nPor seguridad la salida ha sido BLOQUEADA. Por favor graba o adjunta nuevamente el video del vehículo correcto.`);
        } else {
          Alert.alert(
            '🚨 ALERTA: VEHÍCULO NO COINCIDE',
            `${alertaMsg}\n\nPor seguridad la salida ha sido BLOQUEADA. Por favor graba o adjunta nuevamente el video del vehículo correcto.`
          );
        }
        setVideoSalidaUri(null);
        setFotoSalidaUri(null);
        setAnalizando(false);
        return;
      }

      if (compReal.nuevosDanos && compReal.nuevosDanos.length > 0) {
        nuevosDanosDetectados = compReal.nuevosDanos;
      }
      if (compReal.diagnostico) {
        diagnosticoSalida = compReal.diagnostico;
      }
      if (compReal.fotoSalidaUrl) {
        fotoSalidaFinal = compReal.fotoSalidaUrl;
      }
      if (compReal.videoSalidaUrl) {
        videoSalidaFinal = compReal.videoSalidaUrl;
      }
      huboCambios = !!compReal.huboCambios;

      setDatosInspeccion({
        nuevosDanos: nuevosDanosDetectados,
        diagnostico: diagnosticoSalida,
        fotoSalidaUrl: fotoSalidaFinal,
        videoSalidaUrl: videoSalidaFinal,
        huboCambios,
      });

      if (huboCambios || nuevosDanosDetectados.length > 0) {
        setConformidadCliente('no_conforme');
        setObservacionesEntrega('Cliente en desacuerdo por novedad o rayón detectado en la inspección de entrega.');
      } else {
        setConformidadCliente('conforme');
        setObservacionesEntrega('Vehículo entregado a entera satisfacción del cliente sin novedades.');
      }

      setAnalisisRealizado(true);
    } catch (e: any) {
      Alert.alert('Error en Inspección', e?.message || 'No se pudo completar el análisis del video de salida.');
    } finally {
      setAnalizando(false);
    }
  };

  // FASE 2: Confirmación Oficial y Registro de Salida en BD
  const confirmarYFinalizarSalida = async () => {
    if (!vehiculoSeleccionado || !datosInspeccion) {
      Alert.alert('Error', 'No se ha realizado el análisis de inspección previo.');
      return;
    }

    setProcesandoSalidaFinal(true);

    try {
      const ticketFinalizado = await inspectionService.registrarSalida(
        vehiculoSeleccionado.id,
        datosInspeccion.nuevosDanos,
        datosInspeccion.diagnostico,
        datosInspeccion.fotoSalidaUrl,
        datosInspeccion.videoSalidaUrl,
        observacionesEntrega,
        conformidadCliente
      );

      setVideoSalidaUri(null);
      setFotoSalidaUri(null);
      setAnalisisRealizado(false);
      const listaRestante = inspectionService.getVehiculosActivos();
      setVehiculosActivos(listaRestante);
      setResultadoAuditoria(ticketFinalizado);

      if (datosInspeccion.nuevosDanos.length > 0) {
        Alert.alert(
          '⚠️ Salida Registrada con Novedad',
          `Se registraron ${datosInspeccion.nuevosDanos.length} daño(s) y la observación de entrega. Bahía ${vehiculoSeleccionado.espacioAsignado} liberada.`
        );
      } else {
        Alert.alert(
          '✓ Salida Exitosa y Bahía Liberada',
          `El vehículo ${ticketFinalizado.placa} fue retirado conforme. Bahía ${ticketFinalizado.espacioAsignado} disponible.`
        );
      }
    } catch (e) {
      Alert.alert('Error', 'No se pudo procesar la salida en la base de datos.');
    } finally {
      setProcesandoSalidaFinal(false);
    }
  };

  const compartirPorWhatsApp = async (ticket: VehiculoTicket) => {
    const mensaje = inspectionService.generarReporteSalidaWhatsApp(ticket);

    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.open(
          `https://api.whatsapp.com/send?phone=${ticket.propietarioTelefono || ''}&text=${encodeURIComponent(mensaje)}`,
          '_blank'
        );
        limpiarVentanaSalida();
        return;
      }

      const url = `whatsapp://send?phone=${ticket.propietarioTelefono || ''}&text=${encodeURIComponent(mensaje)}`;
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        await Share.share({ message: mensaje, title: 'Acta de Salida' });
      }
    } catch (e) {
      await Share.share({ message: mensaje, title: 'Acta de Salida' });
    } finally {
      limpiarVentanaSalida();
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 100 }}
      showsVerticalScrollIndicator={true}
    >
      <StatusBar barStyle="dark-content" />

      {/* 1. SELECCIÓN DEL AUTO EN SALIDA */}
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <Text style={styles.cardTitle}>1. Bahía y Vehículo para Salida</Text>
          {vehiculoSeleccionado && (
            <View
              style={{
                backgroundColor: '#EFF6FF',
                borderWidth: 1,
                borderColor: '#BFDBFE',
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 8,
              }}
            >
              <Text style={{ color: '#2563EB', fontSize: 12, fontWeight: '800' }}>
                📍 Bahía: {vehiculoSeleccionado.espacioAsignado}
              </Text>
            </View>
          )}
        </View>

        {!vehiculoSeleccionado ? (
          <View style={{ alignItems: 'center', paddingVertical: 20 }}>
            <Ionicons name="car-outline" size={40} color="#64748B" />
            <Text style={{ color: '#64748B', fontSize: 13, marginTop: 8, textAlign: 'center' }}>
              No hay vehículos activos en el parqueadero actualmente.
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/nuevo-ingreso')}
              style={{
                marginTop: 12,
                backgroundColor: '#2563EB',
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 8,
              }}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 12 }}>
                Registrar Nuevo Ingreso
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            <Text style={styles.cardSubtitle}>
              Vehículo en custodia al que se le realizará la auditoría de salida:
            </Text>

            {/* TARJETA PRINCIPAL DEL VEHÍCULO SELECCIONADO */}
            <View
              style={{
                backgroundColor: '#F8FAFC',
                borderColor: '#2563EB',
                borderWidth: 1.5,
                borderRadius: 14,
                padding: 14,
                marginBottom: vehiculosActivos.length > 1 ? 12 : 4,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={{ color: '#64748B', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}>
                    PLACA DEL VEHÍCULO
                  </Text>
                  <View
                    style={{
                      backgroundColor: '#FBBF24',
                      borderRadius: 6,
                      paddingHorizontal: 12,
                      paddingVertical: 4,
                      alignSelf: 'flex-start',
                      marginTop: 4,
                      borderWidth: 1,
                      borderColor: '#D97706',
                    }}
                  >
                    <Text style={{ color: '#000000', fontWeight: '900', fontSize: 17, letterSpacing: 1 }}>
                      {vehiculoSeleccionado.placa}
                    </Text>
                  </View>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: '#64748B', fontSize: 10, fontWeight: '800' }}>
                    BAHÍA A DESOCUPAR
                  </Text>
                  <View
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#0284C7',
                      borderWidth: 1.5,
                      borderRadius: 8,
                      paddingHorizontal: 12,
                      paddingVertical: 5,
                      marginTop: 4,
                    }}
                  >
                    <Text style={{ color: '#0284C7', fontWeight: '900', fontSize: 15 }}>
                      📍 {vehiculoSeleccionado.espacioAsignado}
                    </Text>
                  </View>
                </View>
              </View>

              <View
                style={{
                  height: 1,
                  backgroundColor: '#E2E8F0',
                  marginVertical: 10,
                }}
              />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <View>
                  <Text style={{ color: '#475569', fontSize: 12 }}>
                    <Text style={{ fontWeight: '700', color: '#0F172A' }}>Marca/Modelo: </Text>
                    {vehiculoSeleccionado.marca}
                  </Text>
                  <Text style={{ color: '#475569', fontSize: 12, marginTop: 4 }}>
                    <Text style={{ fontWeight: '700', color: '#0F172A' }}>Color: </Text>
                    {vehiculoSeleccionado.color}
                  </Text>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: '#475569', fontSize: 12 }}>
                    <Text style={{ fontWeight: '700', color: '#0F172A' }}>Hora Ingreso: </Text>
                    {vehiculoSeleccionado.horaIngreso}
                  </Text>
                  <Text style={{ color: '#475569', fontSize: 12, marginTop: 4 }}>
                    <Text style={{ fontWeight: '700', color: '#0F172A' }}>Servicio: </Text>
                    {vehiculoSeleccionado.tipoServicio === 'solo_lavar' || vehiculoSeleccionado.tipoServicio === 'lavadero'
                      ? 'Solo Lavado'
                      : vehiculoSeleccionado.tipoServicio === 'lavar_y_parquear' || vehiculoSeleccionado.tipoServicio === 'ambos'
                      ? 'Parqueo + Lavado'
                      : 'Parqueo General'}
                  </Text>
                </View>
              </View>
            </View>

            {/* SI HAY OTROS VEHÍCULOS DISTINTOS ESTACIONADOS, PERMITIR CAMBIAR DE VEHÍCULO */}
            {vehiculosActivos.length > 1 && (
              <View style={{ marginTop: 4 }}>
                <Text style={{ color: '#94A3B8', fontSize: 11, fontWeight: '700', marginBottom: 6 }}>
                  ¿Deseas dar salida a otro vehículo? ({vehiculosActivos.length} activos en parqueo):
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.carListRow}>
                  {vehiculosActivos.map((v) => {
                    const isSelected = vehiculoSeleccionado?.id === v.id;
                    return (
                      <TouchableOpacity
                        key={v.id}
                        onPress={() => {
                          setVehiculoSeleccionado(v);
                          setResultadoAuditoria(null);
                          setFotoSalidaUri(null);
                          setVideoSalidaUri(null);
                        }}
                        style={[
                          styles.carSelectBox,
                          isSelected && styles.carSelectBoxActive,
                          { minWidth: 110, padding: 8 },
                        ]}
                      >
                        <View style={styles.badgePlate}>
                          <Text style={styles.badgePlateText}>{v.placa}</Text>
                        </View>
                        <Text style={styles.carSelectName} numberOfLines={1}>
                          {v.marca}
                        </Text>
                        <Text style={styles.carSelectBay}>📍 Bahía {v.espacioAsignado}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </View>
        )}
      </View>

      {/* 2. GRABACIÓN DE VIDEO DE SALIDA Y COMPARADOR */}
      {vehiculoSeleccionado && !resultadoAuditoria && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>2. Grabación de Salida</Text>
          <Text style={styles.cardSubtitle}>
            Graba el video o toma la foto para registrar la salida del vehículo:
          </Text>

          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
            <TouchableOpacity onPress={grabarVideoSalida} style={[styles.recordExitBtn, { flex: 1 }]}>
              <LinearGradient
                colors={['#DC2626', '#B91C1C']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.recordExitGradient}
              >
                <Ionicons name="videocam" size={24} color="#FFFFFF" />
                <Text style={styles.recordExitTitle}>Grabar Video</Text>
                <Text style={styles.recordExitSub}>
                  {videoSalidaUri ? '✓ Video listo' : 'Inspección Video'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={tomarFotoSalida} style={[styles.recordExitBtn, { flex: 1 }]}>
              <LinearGradient
                colors={['#2563EB', '#1D4ED8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.recordExitGradient}
              >
                <Ionicons name="camera" size={24} color="#FFFFFF" />
                <Text style={styles.recordExitTitle}>Tomar Foto</Text>
                <Text style={styles.recordExitSub}>
                  {fotoSalidaUri && !videoSalidaUri ? '✓ Foto lista' : 'Inspección Foto'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={seleccionarSalidaGaleria}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#F1F5F9',
              paddingVertical: 10,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: '#CBD5E1',
              marginBottom: 10,
              gap: 8,
            }}
          >
            <Ionicons name="images-outline" size={16} color="#475569" />
            <Text style={{ color: '#334155', fontSize: 12, fontWeight: '700' }}>
              O elegir video/foto de salida desde Galería
            </Text>
          </TouchableOpacity>

          {/* VISTA PREVIA Y BOTÓN PARA DESCARTAR VIDEO / FOTO DE SALIDA */}
          {(videoSalidaUri || fotoSalidaUri) && (
            <View
              style={{
                backgroundColor: '#FEF2F2',
                borderRadius: 10,
                padding: 12,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: '#FCA5A5',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flex: 1, marginRight: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons
                    name={videoSalidaUri ? 'videocam' : 'camera'}
                    size={16}
                    color="#059669"
                  />
                  <Text style={{ color: '#0F172A', fontSize: 13, fontWeight: '700' }}>
                    {videoSalidaUri ? 'Video de Salida Grabado' : 'Foto de Salida Capturada'}
                  </Text>
                </View>
                <Text style={{ color: '#64748B', fontSize: 11, marginTop: 2 }}>
                  ¿Deseas repetir la toma antes de auditar?
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => {
                  const ejecutarDescarteSalida = () => {
                    setVideoSalidaUri(null);
                    setFotoSalidaUri(null);
                  };

                  if (Platform.OS === 'web') {
                    const ok = typeof window !== 'undefined'
                      ? window.confirm('¿Descartar captura de salida? Se eliminará este video para que puedas grabar uno nuevo.')
                      : true;
                    if (ok) {
                      ejecutarDescarteSalida();
                    }
                    return;
                  }

                  Alert.alert(
                    '¿Descartar captura de salida?',
                    'Se eliminará este video para que puedas grabar uno nuevo.',
                    [
                      { text: 'Cancelar', style: 'cancel' },
                      {
                        text: 'Sí, descartar',
                        style: 'destructive',
                        onPress: ejecutarDescarteSalida,
                      },
                    ]
                  );
                }}
                style={{
                  backgroundColor: '#DC2626',
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Ionicons name="trash-outline" size={15} color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>
                  Descartar
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* FASE 1: BOTÓN DE ANÁLISIS E INSPECCIÓN (100% REAL) */}
          {!analisisRealizado && (
            <TouchableOpacity
              onPress={ejecutarAnalisisSalida}
              disabled={analizando}
              style={[styles.generateExitBtn, { marginTop: (videoSalidaUri || fotoSalidaUri) ? 0 : 8 }]}
            >
              <LinearGradient
                colors={['#2563EB', '#1D4ED8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.generateExitGradient}
              >
                {analizando ? (
                  <>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.generateExitText}>
                      ANALIZANDO E INSPECCIONANDO VEHÍCULO CON IA...
                    </Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="scan-outline" size={22} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.generateExitText}>1. ANALIZAR E INSPECCIONAR SALIDA</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* FASE 2: DETALLE DE INSPECCIÓN, CONFORMIDAD Y BOTÓN FINAL DE SALIDA */}
          {analisisRealizado && datosInspeccion && (
            <View style={{ marginTop: 14 }}>
              {/* COMPARADOR VISUAL DE ENTRADA VS SALIDA */}
              <View style={styles.compareImagesSection}>
                <Text style={styles.imageLabel}>📸 Inspección Inicial (Video Entrada):</Text>
                <View style={styles.imageFrame}>
                  <Image
                    source={{ uri: vehiculoSeleccionado.fotoInspeccionEntradaUrl }}
                    style={styles.comparisonImage}
                    resizeMode="cover"
                  />
                  <View style={styles.imageOverlayBar}>
                    <Text style={styles.imageOverlayText}>Hora: {vehiculoSeleccionado.horaIngreso}</Text>
                    <Text style={styles.imageOverlayBadgeGreen}>Estado al Entrar</Text>
                  </View>
                </View>

                <Text style={styles.imageLabel}>🔍 Evidencia de Salida Analizada:</Text>
                <View style={styles.imageFrame}>
                  <Image
                    source={{ uri: datosInspeccion.fotoSalidaUrl }}
                    style={styles.comparisonImage}
                    resizeMode="cover"
                  />

                  {/* BOUNDING BOX ROJO (CUADRO ROJO) SOBRE EL DAÑO DETECTADO */}
                  {(datosInspeccion.nuevosDanos && datosInspeccion.nuevosDanos.length > 0
                    ? datosInspeccion.nuevosDanos
                    : (datosInspeccion.huboCambios ? [{ id: 'SAL-DEF', tipo: 'ALTERACIÓN / RAYÓN', zonaTexto: 'Carrocería', coordenadas: { x: 36, y: 40, width: 28, height: 20 } }] : [])
                  ).map((dano, idx) => (
                    <View
                      key={dano.id || idx}
                      style={[
                        styles.boundingBox,
                        {
                          left: `${dano.coordenadas?.x || 36}%`,
                          top: `${dano.coordenadas?.y || 40}%`,
                          width: `${dano.coordenadas?.width || 28}%`,
                          height: `${dano.coordenadas?.height || 20}%`,
                        },
                      ]}
                    >
                      <View style={styles.boxTag}>
                        <Text style={styles.boxTagText}>
                          ⚠️ {dano.tipo.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  ))}

                  <View style={styles.imageOverlayBar}>
                    <Text style={styles.imageOverlayText}>Revisión de Salida</Text>
                    <Text
                      style={
                        datosInspeccion.nuevosDanos.length > 0 || datosInspeccion.huboCambios
                          ? styles.imageOverlayBadgeRed
                          : styles.imageOverlayBadgeGreen
                      }
                    >
                      {datosInspeccion.nuevosDanos.length > 0 || datosInspeccion.huboCambios ? '⚠️ Daño Señalado en Recuadro Rojo' : '✓ 100% Intacto'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* CUADRO ROJO DE DETALLES Y CAMBIOS */}
              {datosInspeccion.nuevosDanos.length > 0 || datosInspeccion.huboCambios ? (
                <View style={styles.cuadroRojoDetalles}>
                  <View style={styles.cuadroRojoHeader}>
                    <View style={styles.cuadroRojoBadgeIcon}>
                      <Ionicons name="alert-circle" size={24} color="#DC2626" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cuadroRojoTitle}>
                        CUADRO ROJO DE NOVEDADES Y CAMBIOS DETECTADOS
                      </Text>
                      <Text style={styles.cuadroRojoSubtitle}>
                        La visión artificial identificó {datosInspeccion.nuevosDanos.length || 1} diferencia(s) física(s) no registradas al momento del ingreso:
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cuadroRojoDivider} />

                  {(datosInspeccion.nuevosDanos.length > 0
                    ? datosInspeccion.nuevosDanos
                    : [{
                        id: 'SAL-GEN',
                        tipo: 'Rayón / Deformación',
                        zonaTexto: 'Carrocería Lateral / Puerta',
                        descripcion: 'Alteración física detectada por análisis comparativo entre video de entrada y salida.',
                        severidad: 'moderada'
                      }]
                  ).map((d, index) => (
                    <View key={d.id || index} style={styles.cuadroRojoItemCard}>
                      <View style={styles.cuadroRojoItemHeader}>
                        <View style={styles.cuadroRojoPill}>
                          <Text style={styles.cuadroRojoPillText}>
                            CAMBIO #{index + 1}
                          </Text>
                        </View>
                        <Text style={styles.cuadroRojoTipoText}>
                          {d.tipo.toUpperCase()}
                        </Text>
                        <View style={styles.cuadroRojoSeveridadBadge}>
                          <Text style={styles.cuadroRojoSeveridadText}>
                            {(d.severidad || 'MODERADA').toUpperCase()}
                          </Text>
                        </View>
                      </View>

                      <View style={{ marginTop: 6, gap: 4 }}>
                        <Text style={styles.cuadroRojoDataText}>
                          <Text style={{ fontWeight: '800', color: '#991B1B' }}>📍 Pieza / Zona Afectada: </Text>
                          {d.zonaTexto}
                        </Text>
                        <Text style={styles.cuadroRojoDataText}>
                          <Text style={{ fontWeight: '800', color: '#991B1B' }}>🔍 Hallazgo Forense: </Text>
                          {d.descripcion}
                        </Text>
                      </View>
                    </View>
                  ))}

                  <View style={styles.cuadroRojoDictamenBox}>
                    <Text style={styles.cuadroRojoDictamenTitle}>📋 Dictamen Oficial de Auditoría:</Text>
                    <Text style={styles.cuadroRojoDictamenText}>
                      {datosInspeccion.diagnostico || 'Se detectaron alteraciones en la carrocería que no estaban presentes al ingreso.'}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.cuadroVerdeConforme}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Ionicons name="checkmark-circle" size={26} color="#059669" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#065F46', fontSize: 13, fontWeight: '800' }}>
                        ✓ AUDITORÍA CONFORME: SIN NOVEDADES
                      </Text>
                      <Text style={{ color: '#047857', fontSize: 11, marginTop: 2, lineHeight: 16 }}>
                        La comparación automática entre el video de entrada y salida confirma que el vehículo se encuentra en el mismo estado inicial. No se generaron rayones ni abolladuras durante la custodia.
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* SECCIÓN DE CONFORMIDAD DEL CLIENTE Y OBSERVACIONES */}
              <View style={styles.conformidadContainer}>
                <Text style={styles.conformidadSectionTitle}>
                  3. Declaración de Conformidad y Observaciones
                </Text>
                <Text style={styles.conformidadSectionSub}>
                  Especifica el acuerdo del cliente antes de liberar la bahía de parqueo:
                </Text>

                <View style={styles.conformidadSelectorRow}>
                  <TouchableOpacity
                    onPress={() => {
                      setConformidadCliente('conforme');
                      setObservacionesEntrega('Vehículo entregado a entera satisfacción del cliente.');
                    }}
                    style={[
                      styles.conformidadBtn,
                      conformidadCliente === 'conforme' && styles.conformidadBtnActiveConforme,
                    ]}
                  >
                    <Ionicons
                      name="checkmark-circle"
                      size={18}
                      color={conformidadCliente === 'conforme' ? '#059669' : '#64748B'}
                    />
                    <Text
                      style={[
                        styles.conformidadBtnText,
                        conformidadCliente === 'conforme' && styles.conformidadBtnTextActiveConforme,
                      ]}
                    >
                      ✓ Conforme / Aceptado
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      setConformidadCliente('no_conforme');
                      setObservacionesEntrega('Cliente en desacuerdo por novedad/rayón identificado en entrega.');
                    }}
                    style={[
                      styles.conformidadBtn,
                      conformidadCliente === 'no_conforme' && styles.conformidadBtnActiveNoConforme,
                    ]}
                  >
                    <Ionicons
                      name="alert-circle"
                      size={18}
                      color={conformidadCliente === 'no_conforme' ? '#DC2626' : '#64748B'}
                    />
                    <Text
                      style={[
                        styles.conformidadBtnText,
                        conformidadCliente === 'no_conforme' && styles.conformidadBtnTextActiveNoConforme,
                      ]}
                    >
                      ⚠️ No Conforme / Con Reclamo
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* CAMPO DE OBSERVACIONES */}
                <Text style={styles.observacionesLabel}>Observaciones de Entrega del Vehículo:</Text>
                <TextInput
                  value={observacionesEntrega}
                  onChangeText={setObservacionesEntrega}
                  placeholder="Detalla aquí notas de entrega, firmas o reclamos del cliente..."
                  placeholderTextColor="#94A3B8"
                  multiline
                  numberOfLines={3}
                  style={styles.observacionesInput}
                />

                {/* BOTÓN 2: CONFIRMAR Y FINALIZAR SALIDA */}
                <TouchableOpacity
                  onPress={confirmarYFinalizarSalida}
                  disabled={procesandoSalidaFinal}
                  style={[styles.generateExitBtn, { marginTop: 14 }]}
                >
                  <LinearGradient
                    colors={['#DC2626', '#B91C1C']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.generateExitGradient}
                  >
                    {procesandoSalidaFinal ? (
                      <>
                        <ActivityIndicator size="small" color="#FFFFFF" />
                        <Text style={styles.generateExitText}>
                          GUARDANDO EN BD Y LIBERANDO BAHÍA...
                        </Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="checkmark-done" size={22} color="#FFFFFF" style={{ marginRight: 8 }} />
                        <Text style={styles.generateExitText}>
                          2. CONFIRMAR Y FINALIZAR SALIDA ({conformidadCliente === 'conforme' ? 'CONFORME' : 'CON RECLAMO'})
                        </Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setAnalisisRealizado(false)}
                  style={{ marginTop: 10, alignSelf: 'center', padding: 8 }}
                >
                  <Text style={{ color: '#64748B', fontSize: 12, fontWeight: '700' }}>
                    ↺ Repetir toma o volver a inspeccionar
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      {/* 3. RESULTADO DE AUDITORÍA Y TRAZABILIDAD EN SUPABASE */}
      {resultadoAuditoria && (
        <View style={styles.card}>
          <View style={styles.resultHeader}>
            <Text style={styles.resultTitle}>Resultado de la Auditoría</Text>
            <View
              style={[
                styles.resultBadge,
                resultadoAuditoria.nuevosDanosDetectados ? styles.badgeDanger : styles.badgeSuccess,
              ]}
            >
              <Text
                style={[
                  styles.resultBadgeText,
                  resultadoAuditoria.nuevosDanosDetectados ? styles.textRed : styles.textGreen,
                ]}
              >
                {resultadoAuditoria.nuevosDanosDetectados
                  ? '🚨 NOVEDAD DETECTADA'
                  : '✓ ENTREGA CONFORME'}
              </Text>
            </View>
          </View>

          {/* ESTADO SALIDA Y LIBERACIÓN DE BAHÍA */}
          <LinearGradient
            colors={['#ECFDF5', '#D1FAE5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.releasedBanner}
          >
            <Ionicons name="checkmark-done-circle" size={26} color="#059669" />
            <View style={styles.releasedTextContainer}>
              <Text style={styles.releasedTitle}>TRAZABILIDAD SUPABASE: ESTADO 'SALIDA'</Text>
              <Text style={styles.releasedDesc}>
                La bahía <Text style={styles.boldYellow}>{resultadoAuditoria.espacioAsignado}</Text> ha
                sido <Text style={styles.boldGreen}>LIBERADA</Text> en la base de datos real y está
                lista para recibir otro vehículo.
              </Text>
            </View>
          </LinearGradient>

          {/* COMPARADOR VISUAL DE ENTRADA VS SALIDA */}
          <View style={styles.compareImagesSection}>
            <Text style={styles.imageLabel}>📸 Inspección Inicial (Video Entrada):</Text>
            <View style={styles.imageFrame}>
              <Image
                source={{ uri: resultadoAuditoria.fotoInspeccionEntradaUrl }}
                style={styles.comparisonImage}
                resizeMode="cover"
              />
              <View style={styles.imageOverlayBar}>
                <Text style={styles.imageOverlayText}>Hora: {resultadoAuditoria.horaIngreso}</Text>
                <Text style={styles.imageOverlayBadgeGreen}>Estado al Entrar</Text>
              </View>
            </View>

            <Text style={styles.imageLabel}>🔍 Evidencia de Salida:</Text>
            <View style={styles.imageFrame}>
              <Image
                source={{ uri: resultadoAuditoria.fotoInspeccionSalidaUrl }}
                style={styles.comparisonImage}
                resizeMode="cover"
              />

              {/* BOUNDING BOX ROJO (CUADRO ROJO) SOBRE EL DAÑO DETECTADO */}
              {(resultadoAuditoria.danosSalida && resultadoAuditoria.danosSalida.length > 0
                ? resultadoAuditoria.danosSalida
                : (resultadoAuditoria.nuevosDanosDetectados ? [{ id: 'SAL-DEF', tipo: 'ALTERACIÓN / RAYÓN', zonaTexto: 'Carrocería', coordenadas: { x: 36, y: 40, width: 28, height: 20 } }] : [])
              ).map((dano, idx) => (
                <View
                  key={dano.id || idx}
                  style={[
                    styles.boundingBox,
                    {
                      left: `${dano.coordenadas?.x || 36}%`,
                      top: `${dano.coordenadas?.y || 40}%`,
                      width: `${dano.coordenadas?.width || 28}%`,
                      height: `${dano.coordenadas?.height || 20}%`,
                    },
                  ]}
                >
                  <View style={styles.boxTag}>
                    <Text style={styles.boxTagText}>
                      ⚠️ {dano.tipo.toUpperCase()}
                    </Text>
                  </View>
                </View>
              ))}

              <View style={styles.imageOverlayBar}>
                <Text style={styles.imageOverlayText}>Hora: {resultadoAuditoria.horaSalida}</Text>
                <Text
                  style={
                    resultadoAuditoria.nuevosDanosDetectados
                      ? styles.imageOverlayBadgeRed
                      : styles.imageOverlayBadgeGreen
                  }
                >
                  {resultadoAuditoria.nuevosDanosDetectados ? '⚠️ Daño Señalado en Recuadro Rojo' : '✓ 100% Intacto'}
                </Text>
              </View>
            </View>
          </View>

          {/* CUADRO ROJO: DETALLES Y CAMBIOS DETECTADOS */}
          {resultadoAuditoria.nuevosDanosDetectados ? (
            <View style={styles.cuadroRojoDetalles}>
              {/* ENCABEZADO DEL CUADRO ROJO */}
              <View style={styles.cuadroRojoHeader}>
                <View style={styles.cuadroRojoBadgeIcon}>
                  <Ionicons name="alert-circle" size={24} color="#DC2626" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cuadroRojoTitle}>
                    CUADRO ROJO DE NOVEDADES Y CAMBIOS DETECTADOS
                  </Text>
                  <Text style={styles.cuadroRojoSubtitle}>
                    La visión artificial identificó {resultadoAuditoria.danosSalida?.length || 1} diferencia(s) física(s) no registradas al momento del ingreso:
                  </Text>
                </View>
              </View>

              <View style={styles.cuadroRojoDivider} />

              {/* LISTA DE CAMBIOS DETECTADOS DENTRO DEL CUADRO ROJO */}
              {(resultadoAuditoria.danosSalida && resultadoAuditoria.danosSalida.length > 0
                ? resultadoAuditoria.danosSalida
                : [{
                    id: 'SAL-GEN',
                    tipo: 'Rayón / Deformación',
                    zonaTexto: 'Carrocería Lateral / Puerta',
                    descripcion: 'Alteración física detectada por análisis comparativo entre video de entrada y salida.',
                    severidad: 'moderada'
                  }]
              ).map((d, index) => (
                <View key={d.id || index} style={styles.cuadroRojoItemCard}>
                  <View style={styles.cuadroRojoItemHeader}>
                    <View style={styles.cuadroRojoPill}>
                      <Text style={styles.cuadroRojoPillText}>
                        CAMBIO #{index + 1}
                      </Text>
                    </View>
                    <Text style={styles.cuadroRojoTipoText}>
                      {d.tipo.toUpperCase()}
                    </Text>
                    <View style={styles.cuadroRojoSeveridadBadge}>
                      <Text style={styles.cuadroRojoSeveridadText}>
                        {(d.severidad || 'MODERADA').toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <View style={{ marginTop: 6, gap: 4 }}>
                    <Text style={styles.cuadroRojoDataText}>
                      <Text style={{ fontWeight: '800', color: '#991B1B' }}>📍 Pieza / Zona Afectada: </Text>
                      {d.zonaTexto}
                    </Text>
                    <Text style={styles.cuadroRojoDataText}>
                      <Text style={{ fontWeight: '800', color: '#991B1B' }}>🔍 Hallazgo Forense: </Text>
                      {d.descripcion}
                    </Text>
                  </View>
                </View>
              ))}

              {/* DICTAMEN OFICIAL IA */}
              <View style={styles.cuadroRojoDictamenBox}>
                <Text style={styles.cuadroRojoDictamenTitle}>📋 Dictamen Oficial de Auditoría:</Text>
                <Text style={styles.cuadroRojoDictamenText}>
                  {resultadoAuditoria.diagnosticoSalidaTexto || 'Se detectaron alteraciones en la carrocería que no estaban presentes al ingreso.'}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.cuadroVerdeConforme}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="checkmark-circle" size={26} color="#059669" />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#065F46', fontSize: 13, fontWeight: '800' }}>
                    ✓ AUDITORÍA CONFORME: SIN NOVEDADES
                  </Text>
                  <Text style={{ color: '#047857', fontSize: 11, marginTop: 2, lineHeight: 16 }}>
                    La comparación automática entre el video de entrada y salida confirma que el vehículo se encuentra en el mismo estado inicial. No se generaron rayones ni abolladuras durante la custodia.
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* ENVIAR REPORTE POR WHATSAPP */}
          <TouchableOpacity
            onPress={() => compartirPorWhatsApp(resultadoAuditoria)}
            style={styles.whatsappBtn}
          >
            <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.whatsappBtnText}>ENVIAR ACTA DE SALIDA POR WHATSAPP</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={limpiarVentanaSalida}
            style={styles.resetBtn}
          >
            <Text style={styles.resetBtnText}>Finalizar y Limpiar Ventana</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ height: 40 }} />

      {/* MODAL DE CÁMARA WEB DIRECTA PARA NAVEGADOR PC */}
      <WebCameraModal
        visible={modalWebCamVisible}
        modo={modoWebCam}
        onCapture={onWebCamCaptureSalida}
        onClose={() => setModalWebCamVisible(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
  },
  cardSubtitle: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 16,
    marginBottom: 12,
  },
  carListRow: {
    flexDirection: 'row',
  },
  carSelectBox: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 12,
    marginRight: 10,
    minWidth: 120,
  },
  carSelectBoxActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  badgePlate: {
    backgroundColor: '#FBBF24',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  badgePlateText: {
    color: '#000000',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  carSelectName: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '700',
  },
  carSelectBay: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 2,
  },
  recordExitBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
  },
  recordExitGradient: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordExitTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 6,
  },
  recordExitSub: {
    color: '#FFFFFF',
    opacity: 0.9,
    fontSize: 10,
    marginTop: 2,
  },
  simCard: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  simLabel: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 8,
  },
  simOptionsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  simTypeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderColor: '#CBD5E1',
    borderWidth: 1,
    alignItems: 'center',
  },
  simTypeBtnActive: {
    backgroundColor: '#FEF2F2',
    borderColor: '#EF4444',
  },
  simTypeText: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '800',
    textAlign: 'center',
  },
  simCleanBtn: {
    backgroundColor: '#FFFFFF',
    borderColor: '#CBD5E1',
    borderWidth: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  simCleanBtnActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  simCleanText: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
  },
  textRed: {
    color: '#DC2626',
  },
  textGreen: {
    color: '#059669',
  },
  generateExitBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  generateExitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  generateExitText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  resultTitle: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
  },
  resultBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  badgeDanger: {
    backgroundColor: '#FEF2F2',
    borderColor: '#EF4444',
  },
  badgeSuccess: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  resultBadgeText: {
    fontSize: 10,
    fontWeight: '900',
  },
  releasedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#86EFAC',
    marginBottom: 12,
  },
  releasedTextContainer: {
    marginLeft: 10,
    flex: 1,
  },
  releasedTitle: {
    color: '#065F46',
    fontSize: 11,
    fontWeight: '900',
  },
  releasedDesc: {
    color: '#1E293B',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  boldYellow: {
    color: '#D97706',
    fontWeight: '900',
  },
  boldGreen: {
    color: '#059669',
    fontWeight: '900',
  },
  compareImagesSection: {
    marginBottom: 12,
  },
  imageLabel: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
  },
  imageFrame: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginBottom: 12,
    position: 'relative',
  },
  comparisonImage: {
    width: '100%',
    height: 180,
  },
  imageOverlayBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  imageOverlayText: {
    color: '#CBD5E1',
    fontSize: 10,
    fontWeight: '600',
  },
  imageOverlayBadgeGreen: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '800',
  },
  imageOverlayBadgeRed: {
    color: '#F87171',
    fontSize: 10,
    fontWeight: '800',
  },
  boundingBox: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: '#DC2626',
    backgroundColor: 'rgba(220, 38, 38, 0.28)',
    borderRadius: 6,
  },
  boxTag: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: -22,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  boxTagText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  cuadroRojoDetalles: {
    backgroundColor: '#FEF2F2',
    borderColor: '#DC2626',
    borderWidth: 2,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  cuadroRojoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cuadroRojoBadgeIcon: {
    backgroundColor: '#FEE2E2',
    padding: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  cuadroRojoTitle: {
    color: '#991B1B',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  cuadroRojoSubtitle: {
    color: '#7F1D1D',
    fontSize: 10.5,
    marginTop: 2,
    lineHeight: 15,
  },
  cuadroRojoDivider: {
    height: 1,
    backgroundColor: '#FECACA',
    marginVertical: 10,
  },
  cuadroRojoItemCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FCA5A5',
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  cuadroRojoItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  cuadroRojoPill: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  cuadroRojoPillText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  cuadroRojoTipoText: {
    color: '#991B1B',
    fontSize: 11,
    fontWeight: '800',
    flex: 1,
  },
  cuadroRojoSeveridadBadge: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#DC2626',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cuadroRojoSeveridadText: {
    color: '#DC2626',
    fontSize: 8.5,
    fontWeight: '800',
  },
  cuadroRojoDataText: {
    color: '#450A0A',
    fontSize: 11,
    lineHeight: 16,
  },
  cuadroRojoDictamenBox: {
    backgroundColor: 'rgba(254, 226, 226, 0.6)',
    borderColor: '#F87171',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginTop: 4,
  },
  cuadroRojoDictamenTitle: {
    color: '#991B1B',
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 2,
  },
  cuadroRojoDictamenText: {
    color: '#7F1D1D',
    fontSize: 10.5,
    lineHeight: 15,
  },
  cuadroVerdeConforme: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  whatsappBtn: {
    backgroundColor: '#16A34A',
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  whatsappBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  resetBtn: {
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  resetBtnText: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
  },
  conformidadContainer: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginTop: 8,
    marginBottom: 8,
  },
  conformidadSectionTitle: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '800',
  },
  conformidadSectionSub: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
    marginBottom: 10,
  },
  conformidadSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  conformidadBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  conformidadBtnActiveConforme: {
    borderColor: '#059669',
    backgroundColor: '#ECFDF5',
  },
  conformidadBtnActiveNoConforme: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  conformidadBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
  },
  conformidadBtnTextActiveConforme: {
    color: '#059669',
  },
  conformidadBtnTextActiveNoConforme: {
    color: '#DC2626',
  },
  observacionesLabel: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 4,
  },
  observacionesInput: {
    backgroundColor: '#FFFFFF',
    borderColor: '#CBD5E1',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    fontSize: 12,
    color: '#0F172A',
    minHeight: 65,
    textAlignVertical: 'top',
  },
});
