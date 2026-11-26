import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Platform,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface WebCameraModalProps {
  visible: boolean;
  modo: 'foto' | 'video';
  onCapture: (uri: string, esVideo: boolean, base64?: string) => void;
  onClose: () => void;
}

export const WebCameraModal: React.FC<WebCameraModalProps> = ({
  visible,
  modo,
  onCapture,
  onClose,
}) => {
  const [iniciandoCamara, setIniciandoCamara] = useState(false);
  const [errorCamara, setErrorCamara] = useState<string | null>(null);
  const [grabando, setGrabando] = useState(false);
  const [segundosGrabacion, setSegundosGrabacion] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (visible && Platform.OS === 'web') {
      iniciarCamara();
    } else {
      detenerCamara();
    }

    return () => {
      detenerCamara();
    };
  }, [visible, modo]);

  const iniciarCamara = async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setErrorCamara('Tu navegador o dispositivo no soporta acceso directo a la cámara web.');
      return;
    }

    setIniciandoCamara(true);
    setErrorCamara(null);
    setGrabando(false);
    setSegundosGrabacion(0);

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'environment' },
          audio: modo === 'video',
        });
      } catch (errAudio) {
        // Fallback si no tiene micrófono o fue denegado el audio
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'environment' },
          audio: false,
        });
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn('Error al reproducir stream en video:', playErr);
        }
      }
    } catch (err: any) {
      console.error('Error accediendo a la cámara:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorCamara('Permiso de cámara denegado. Por favor autoriza el acceso a la cámara en tu navegador.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setErrorCamara('No se encontró ninguna cámara conectada a este equipo.');
      } else {
        setErrorCamara(`No se pudo conectar a la cámara web (${err.message || 'Error desconocido'}).`);
      }
    } finally {
      setIniciandoCamara(false);
    }
  };

  const detenerCamara = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setGrabando(false);
    setSegundosGrabacion(0);
  };

  const capturarFoto = () => {
    if (!videoRef.current) return;

    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');

      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      const base64 = dataUrl.split(',')[1];

      detenerCamara();
      onCapture(dataUrl, false, base64);
      onClose();
    } catch (e: any) {
      console.error('Error al capturar foto:', e);
      alert('Error capturando foto de la cámara.');
    }
  };

  const iniciarGrabacionVideo = () => {
    if (!streamRef.current) return;

    recordedChunksRef.current = [];

    let mimeType = 'video/webm';
    if (typeof MediaRecorder !== 'undefined') {
      if (MediaRecorder.isTypeSupported('video/mp4')) {
        mimeType = 'video/mp4';
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
        mimeType = 'video/webm;codecs=vp9';
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
        mimeType = 'video/webm;codecs=vp8';
      }
    }

    try {
      const recorder = new MediaRecorder(streamRef.current, { mimeType });

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        const videoUrl = URL.createObjectURL(blob);
        detenerCamara();
        onCapture(videoUrl, true);
        onClose();
      };

      recorder.start(100);
      mediaRecorderRef.current = recorder;
      setGrabando(true);
      setSegundosGrabacion(0);

      timerRef.current = setInterval(() => {
        setSegundosGrabacion((prev) => prev + 1);
      }, 1000);
    } catch (recErr: any) {
      console.error('Error iniciando grabador:', recErr);
      alert(`No se pudo iniciar la grabación: ${recErr.message || 'Error de codec'}`);
    }
  };

  const detenerGrabacionVideo = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const formatearTiempo = (seg: number) => {
    const m = Math.floor(seg / 60)
      .toString()
      .padStart(2, '0');
    const s = (seg % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (!visible || Platform.OS !== 'web') return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* ENCABEZADO */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons
                name={modo === 'video' ? 'videocam' : 'camera'}
                size={22}
                color={modo === 'video' ? '#DC2626' : '#2563EB'}
              />
              <Text style={styles.headerTitle}>
                {modo === 'video' ? 'Cámara Web: Grabar Video' : 'Cámara Web: Tomar Foto'}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => {
                detenerCamara();
                onClose();
              }}
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* ÁREA DE VISUALIZACIÓN DE CÁMARA */}
          <View style={styles.videoContainer}>
            {iniciandoCamara ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#38BDF8" />
                <Text style={styles.loadingText}>Conectando con la cámara web del equipo...</Text>
              </View>
            ) : errorCamara ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={44} color="#EF4444" />
                <Text style={styles.errorTitle}>Cámara no disponible</Text>
                <Text style={styles.errorDesc}>{errorCamara}</Text>
                <TouchableOpacity onPress={iniciarCamara} style={styles.retryBtn}>
                  <Text style={styles.retryBtnText}>Reintentar Conexión</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ width: '100%', height: '100%', position: 'relative' }}>
                {React.createElement('video', {
                  ref: (el: HTMLVideoElement | null) => {
                    videoRef.current = el;
                    if (el && streamRef.current && el.srcObject !== streamRef.current) {
                      el.srcObject = streamRef.current;
                      el.play().catch(() => {});
                    }
                  },
                  autoPlay: true,
                  playsInline: true,
                  muted: true,
                  style: {
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    borderRadius: 14,
                    backgroundColor: '#000000',
                  },
                })}

                {/* INDICADOR EN VIVO / GRABANDO */}
                <View style={styles.liveBadgeOverlay}>
                  {grabando ? (
                    <View style={styles.recordingBadge}>
                      <View style={styles.recordingDot} />
                      <Text style={styles.recordingText}>GRABANDO {formatearTiempo(segundosGrabacion)}</Text>
                    </View>
                  ) : (
                    <View style={styles.liveBadge}>
                      <View style={styles.liveDot} />
                      <Text style={styles.liveText}>EN VIVO</Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          </View>

          {/* CONTROLES INFERIORES */}
          <View style={styles.controlsRow}>
            {modo === 'foto' ? (
              <TouchableOpacity
                onPress={capturarFoto}
                disabled={iniciandoCamara || !!errorCamara}
                style={[styles.actionBtn, (iniciandoCamara || !!errorCamara) && styles.actionBtnDisabled]}
              >
                <LinearGradient
                  colors={['#0284C7', '#0369A1']}
                  style={styles.actionBtnGradient}
                >
                  <Ionicons name="camera" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.actionBtnText}>TOMAR FOTO DEL VEHÍCULO</Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              !grabando ? (
                <TouchableOpacity
                  onPress={iniciarGrabacionVideo}
                  disabled={iniciandoCamara || !!errorCamara}
                  style={[styles.actionBtn, (iniciandoCamara || !!errorCamara) && styles.actionBtnDisabled]}
                >
                  <LinearGradient
                    colors={['#DC2626', '#991B1B']}
                    style={styles.actionBtnGradient}
                  >
                    <Ionicons name="radio-button-on" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.actionBtnText}>INICIAR GRABACIÓN PERIMETRAL</Text>
                  </LinearGradient>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={detenerGrabacionVideo}
                  style={[styles.actionBtn, { borderColor: '#EF4444' }]}
                >
                  <LinearGradient
                    colors={['#991B1B', '#7F1D1D']}
                    style={styles.actionBtnGradient}
                  >
                    <Ionicons name="stop" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.actionBtnText}>
                      DETENER Y PROCESAR VIDEO ({formatearTiempo(segundosGrabacion)})
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              )
            )}
          </View>

          {/* BOTÓN SECUNDARIO CANCELAR */}
          <TouchableOpacity
            onPress={() => {
              detenerCamara();
              onClose();
            }}
            style={styles.cancelBottomBtn}
          >
            <Text style={styles.cancelBottomBtnText}>Cancelar y Volver</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 20,
    width: '100%',
    maxWidth: 680,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerTitle: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '800',
  },
  closeBtn: {
    backgroundColor: '#F1F5F9',
    padding: 6,
    borderRadius: 8,
  },
  videoContainer: {
    width: '100%',
    height: 380,
    backgroundColor: '#000000',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 10,
    fontWeight: '600',
  },
  errorContainer: {
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    color: '#F87171',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 8,
  },
  errorDesc: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    maxWidth: 400,
  },
  retryBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 14,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  liveBadgeOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  liveText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  recordingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(220, 38, 38, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    marginRight: 6,
  },
  recordingText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  controlsRow: {
    marginTop: 14,
  },
  actionBtn: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  actionBtnDisabled: {
    opacity: 0.5,
  },
  actionBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  cancelBottomBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 8,
  },
  cancelBottomBtnText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
});
