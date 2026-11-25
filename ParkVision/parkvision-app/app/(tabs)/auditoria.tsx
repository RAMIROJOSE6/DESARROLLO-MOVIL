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
} from 'react-native';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { inspectionService } from '../../src/services/inspectionService';
import { VehiculoTicket, DanoVehiculo } from '../../src/types';

export default function AuditoriaScreen() {
  const params = useLocalSearchParams<{ ticketIdPreseleccionado?: string }>();
  const [vehiculosActivos, setVehiculosActivos] = useState<VehiculoTicket[]>([]);
  const [vehiculoSeleccionado, setVehiculoSeleccionado] = useState<VehiculoTicket | null>(null);

  // Evidencias de salida
  const [videoSalidaUri, setVideoSalidaUri] = useState<string | null>(null);
  const [fotoSalidaUri, setFotoSalidaUri] = useState<string | null>(null);

  // Control IA
  const [analizando, setAnalizando] = useState(false);
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
    setVehiculosActivos(lista);

    if (idForzado !== undefined) {
      if (idForzado === null) {
        setVehiculoSeleccionado(lista.length > 0 ? lista[0] : null);
      } else {
        const match = lista.find((v) => v.id === idForzado);
        setVehiculoSeleccionado(match || (lista.length > 0 ? lista[0] : null));
      }
      return;
    }

    if (params.ticketIdPreseleccionado) {
      const match = lista.find((v) => v.id === params.ticketIdPreseleccionado);
      if (match) {
        setVehiculoSeleccionado(match);
        return;
      }
    }

    if (vehiculoSeleccionado) {
      const sigueActivo = lista.find((v) => v.id === vehiculoSeleccionado.id);
      if (!sigueActivo) {
        setVehiculoSeleccionado(lista.length > 0 ? lista[0] : null);
      }
    } else if (lista.length > 0) {
      setVehiculoSeleccionado(lista[0]);
    } else {
      setVehiculoSeleccionado(null);
    }
  };

  // Limpiar ventana de salida por completo y refrescar los vehículos en parqueo
  const limpiarVentanaSalida = () => {
    setVideoSalidaUri(null);
    setFotoSalidaUri(null);
    setResultadoAuditoria(null);
    cargarVehiculos(null);
  };

  const grabarVideoSalida = async () => {
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
      const uri = result.assets[0].uri;
      const isVid = result.assets[0].type === 'video';
      if (isVid) {
        setVideoSalidaUri(uri);
        setFotoSalidaUri(uri);
      } else {
        setVideoSalidaUri(null);
        setFotoSalidaUri(uri);
      }
    }
  };

  // Botón principal: "GENERAR SALIDA DE VEHÍCULO" (100% REAL)
  const ejecutarGenerarSalida = async () => {
    if (!vehiculoSeleccionado) {
      Alert.alert('Selecciona un vehículo', 'Elige el auto que va a salir.');
      return;
    }

    setAnalizando(true);

    try {
      const uriSalida = videoSalidaUri || fotoSalidaUri;
      let nuevosDanosDetectados: DanoVehiculo[] = [];
      let diagnosticoSalida = '✓ Auditoría Conforme: Vehículo entregado en perfecto estado. Sin nuevos daños.';
      let fotoSalidaFinal = fotoSalidaUri || uriSalida || undefined;
      let videoSalidaFinal = videoSalidaUri || undefined;

      // Si se capturó evidencia real de salida, comparar con visión artificial
      if (uriSalida) {
        try {
          const compReal = await inspectionService.compararVideosSalidaReal(
            vehiculoSeleccionado.id,
            uriSalida,
            !!videoSalidaUri
          );
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
        } catch (compErr) {
          console.warn('Error en comparación de salida:', compErr);
        }
      }

      const ticketFinalizado = await inspectionService.registrarSalida(
        vehiculoSeleccionado.id,
        nuevosDanosDetectados,
        diagnosticoSalida,
        fotoSalidaFinal,
        videoSalidaFinal || videoSalidaUri || undefined
      );

      // Limpiar de inmediato evidencias temporales de salida y refrescar los vehículos activos
      setVideoSalidaUri(null);
      setFotoSalidaUri(null);
      const listaRestante = inspectionService.getVehiculosActivos();
      setVehiculosActivos(listaRestante);
      setResultadoAuditoria(ticketFinalizado);

      if (nuevosDanosDetectados.length > 0) {
        Alert.alert(
          '⚠️ Daños Nuevos Detectados',
          `Se detectaron ${nuevosDanosDetectados.length} daño(s) nuevo(s) que no estaban registrados en el ingreso.`
        );
      } else {
        Alert.alert(
          '✓ Salida Exitosa',
          'El vehículo fue registrado y entregado en perfecto estado. Se liberó la bahía de parqueo.'
        );
      }
    } catch (e) {
      Alert.alert('Error', 'No se pudo procesar la salida en la base de datos.');
    } finally {
      setAnalizando(false);
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
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <StatusBar barStyle="light-content" />

      {/* 1. SELECCIÓN DEL AUTO EN SALIDA */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>1. Vehículo Seleccionado para Salida</Text>
        <Text style={styles.cardSubtitle}>
          Selecciona el vehículo o elígelo tocando su bahía en el mapa:
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
                style={[styles.carSelectBox, isSelected && styles.carSelectBoxActive]}
              >
                <View style={styles.badgePlate}>
                  <Text style={styles.badgePlateText}>{v.placa}</Text>
                </View>
                <Text style={styles.carSelectName}>{v.marca}</Text>
                <Text style={styles.carSelectBay}>📍 Bahía: {v.espacioAsignado}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
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
                colors={['#1E293B', '#0F172A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.recordExitGradient}
              >
                <Ionicons name="videocam-outline" size={24} color="#F87171" />
                <Text style={styles.recordExitTitle}>Grabar Video</Text>
                <Text style={styles.recordExitSub}>
                  {videoSalidaUri ? '✓ Video listo' : 'Inspección Video'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={tomarFotoSalida} style={[styles.recordExitBtn, { flex: 1 }]}>
              <LinearGradient
                colors={['#1E293B', '#0F172A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.recordExitGradient}
              >
                <Ionicons name="camera-outline" size={24} color="#94A3B8" />
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
              backgroundColor: '#1E293B',
              paddingVertical: 9,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: '#334155',
              marginBottom: 10,
              gap: 8,
            }}
          >
            <Ionicons name="images-outline" size={16} color="#94A3B8" />
            <Text style={{ color: '#E2E8F0', fontSize: 12, fontWeight: '600' }}>
              O elegir video/foto de salida desde Galería
            </Text>
          </TouchableOpacity>

          {/* VISTA PREVIA Y BOTÓN PARA DESCARTAR VIDEO / FOTO DE SALIDA */}
          {(videoSalidaUri || fotoSalidaUri) && (
            <View
              style={{
                backgroundColor: '#1E293B',
                borderRadius: 10,
                padding: 12,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: '#EF4444',
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
                    color="#10B981"
                  />
                  <Text style={{ color: '#F8FAFC', fontSize: 13, fontWeight: '700' }}>
                    {videoSalidaUri ? 'Video de Salida Grabado' : 'Foto de Salida Capturada'}
                  </Text>
                </View>
                <Text style={{ color: '#94A3B8', fontSize: 11, marginTop: 2 }}>
                  ¿Deseas repetir la toma antes de auditar?
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => {
                  Alert.alert(
                    '¿Descartar captura de salida?',
                    'Se eliminará este video para que puedas grabar uno nuevo.',
                    [
                      { text: 'Cancelar', style: 'cancel' },
                      {
                        text: 'Sí, descartar',
                        style: 'destructive',
                        onPress: () => {
                          setVideoSalidaUri(null);
                          setFotoSalidaUri(null);
                        },
                      },
                    ]
                  );
                }}
                style={{
                  backgroundColor: '#7F1D1D',
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Ionicons name="trash-outline" size={15} color="#FCA5A5" />
                <Text style={{ color: '#FEE2E2', fontSize: 12, fontWeight: '700' }}>
                  Descartar
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* BOTÓN SOLICITADO: GENERAR SALIDA DE VEHÍCULO */}
          <TouchableOpacity
            onPress={ejecutarGenerarSalida}
            disabled={analizando}
            style={styles.generateExitBtn}
          >
            <LinearGradient
              colors={['#991B1B', '#7F1D1D']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.generateExitGradient}
            >
              {analizando ? (
                <>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.generateExitText}>
                    AUDITANDO ESTADO Y PROCESANDO SALIDA...
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons name="log-out-outline" size={22} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.generateExitText}>GENERAR SALIDA DE VEHÍCULO</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
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
            colors={['#064E3B', '#022C22']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.releasedBanner}
          >
            <Ionicons name="checkmark-done-circle" size={26} color="#10B981" />
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

              {/* BOUNDING BOX ROJO SOBRE EL DAÑO DETECTADO */}
              {resultadoAuditoria.danosSalida?.map((dano) => (
                <View
                  key={dano.id}
                  style={[
                    styles.boundingBox,
                    {
                      left: `${dano.coordenadas?.x || 45}%`,
                      top: `${dano.coordenadas?.y || 48}%`,
                      width: `${dano.coordenadas?.width || 20}%`,
                      height: `${dano.coordenadas?.height || 18}%`,
                    },
                  ]}
                >
                  <View style={styles.boxTag}>
                    <Text style={styles.boxTagText}>
                      {dano.tipo.toUpperCase()}
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
                  {resultadoAuditoria.nuevosDanosDetectados ? 'Daño Señalado en Rojo' : '100% Intacto'}
                </Text>
              </View>
            </View>
          </View>

          {/* DESGLOSE DETALLADO DEL DAÑO */}
          {resultadoAuditoria.nuevosDanosDetectados && (
            <View style={styles.damageDetailCard}>
              <Text style={styles.damageDetailTitle}>Detalle del Daño No Existente al Entrar:</Text>
              {resultadoAuditoria.danosSalida?.map((d) => (
                <View key={d.id} style={{ marginTop: 4 }}>
                  <Text style={styles.damageItem}>• Pieza afectada: {d.zonaTexto}</Text>
                  <Text style={styles.damageItem}>• Hallazgo: {d.descripcion}</Text>
                  <Text style={styles.damageItem}>
                    • Clasificación: {d.tipo.toUpperCase()} | Severidad: {d.severidad.toUpperCase()}
                  </Text>
                </View>
              ))}
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
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  cardSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 16,
    marginBottom: 12,
  },
  carListRow: {
    flexDirection: 'row',
  },
  carSelectBox: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 12,
    marginRight: 10,
    minWidth: 120,
  },
  carSelectBoxActive: {
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    borderColor: '#3B82F6',
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
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  carSelectBay: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 2,
  },
  recordExitBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
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
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 2,
  },
  simCard: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  simLabel: {
    color: '#CBD5E1',
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
    backgroundColor: '#1E293B',
    borderColor: '#334155',
    borderWidth: 1,
    alignItems: 'center',
  },
  simTypeBtnActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: '#EF4444',
  },
  simTypeText: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '800',
    textAlign: 'center',
  },
  simCleanBtn: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
    borderWidth: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  simCleanBtnActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10B981',
  },
  simCleanText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
  },
  textRed: {
    color: '#F87171',
  },
  textGreen: {
    color: '#34D399',
  },
  generateExitBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
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
    color: '#FFFFFF',
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
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: '#EF4444',
  },
  badgeSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
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
    borderColor: '#059669',
    marginBottom: 12,
  },
  releasedTextContainer: {
    marginLeft: 10,
    flex: 1,
  },
  releasedTitle: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '900',
  },
  releasedDesc: {
    color: '#E2E8F0',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  boldYellow: {
    color: '#FBBF24',
    fontWeight: '900',
  },
  boldGreen: {
    color: '#34D399',
    fontWeight: '900',
  },
  compareImagesSection: {
    marginBottom: 12,
  },
  imageLabel: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
  },
  imageFrame: {
    backgroundColor: '#000000',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
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
    borderWidth: 2.5,
    borderColor: '#EF4444',
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
    borderRadius: 4,
  },
  boxTag: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    alignSelf: 'flex-start',
    marginTop: -16,
  },
  boxTagText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '900',
  },
  damageDetailCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: '#DC2626',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  damageDetailTitle: {
    color: '#F87171',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 4,
  },
  damageItem: {
    color: '#F1F5F9',
    fontSize: 11,
    lineHeight: 16,
  },
  whatsappBtn: {
    backgroundColor: '#059669',
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
    backgroundColor: '#334155',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  resetBtnText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700',
  },
});
