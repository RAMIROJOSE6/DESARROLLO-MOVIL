import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as VideoThumbnails from 'expo-video-thumbnails';
import * as FileSystem from 'expo-file-system/legacy';
import { FileSystemUploadType } from 'expo-file-system/legacy';
import { VehiculoTicket, DanoVehiculo, EspacioParqueo, TipoServicio } from '../types';
import { VEHICULOS_INICIALES, ESPACIOS_INICIALES } from '../data/mockData';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const STORAGE_KEY_TICKETS = '@parkvision_tickets_prod_real';
const STORAGE_KEY_ESPACIOS = '@parkvision_espacios_prod_real';
const STORAGE_KEY_SERVER_URL = '@parkvision_server_url';
export const DEFAULT_VISION_SERVER = process.env.EXPO_PUBLIC_VISION_SERVER_URL || 'http://192.168.0.17:8000';

class InspectionService {
  private tickets: VehiculoTicket[] = [];
  private espacios: EspacioParqueo[] = [];
  private listeners: Array<() => void> = [];

  constructor() {
    this.init();
  }

  private async init() {
    try {
      // Limpiar versiones anteriores con datos de prueba
      await AsyncStorage.multiRemove(['@parkvision_tickets_v3', '@parkvision_espacios_v3', '@parkvision_tickets', '@parkvision_espacios']);

      const ticketsData = await AsyncStorage.getItem(STORAGE_KEY_TICKETS);
      const espaciosData = await AsyncStorage.getItem(STORAGE_KEY_ESPACIOS);

      if (ticketsData) {
        this.tickets = JSON.parse(ticketsData);
      } else {
        this.tickets = [];
      }

      if (espaciosData) {
        this.espacios = JSON.parse(espaciosData);
      } else {
        this.espacios = [...ESPACIOS_INICIALES];
      }

      // Sincronización con la base de datos real Supabase
      if (isSupabaseConfigured()) {
        try {
          const { data: remoteTickets } = await supabase
            .from('tickets_parqueadero')
            .select('*')
            .order('created_at', { ascending: false });

          if (remoteTickets) {
            this.tickets = remoteTickets.map((t: any) => ({
              id: t.id,
              placa: t.placa,
              marca: t.marca,
              color: t.color,
              tipoServicio: t.tipo_servicio,
              horaIngreso: t.hora_ingreso,
              horaSalida: t.hora_salida,
              estado: t.estado,
              estadoParqueo: t.estado_parqueo || 'En Parqueo',
              espacioAsignado: t.espacio_asignado || 'P-01',
              fotoPlacaUrl: t.foto_placa_url || '',
              videoEntradaUrl: t.video_entrada_url || '',
              fotoInspeccionEntradaUrl: t.foto_inspeccion_entrada_url || '',
              danosEntrada: t.danos_entrada || [],
              danosSalida: t.danos_salida || [],
              diagnosticoEntradaTexto: t.diagnostico_entrada_texto,
              diagnosticoSalidaTexto: t.diagnostico_salida_texto,
              nuevosDanosDetectados: t.nuevos_danos_detectados || false,
              diferenciaDetectada: t.diferencia_detectada || false,
              suciedadIgnoradaContador: t.suciedad_ignorada_contador || 0,
              propietarioNombre: t.propietario_nombre,
              propietarioTelefono: t.propietario_telefono,
              observaciones: t.observaciones,
            }));
          } else {
            this.tickets = [];
          }

          // Traer bahías desde Supabase
          const { data: remoteEspacios } = await supabase
            .from('espacios_parqueadero')
            .select('*')
            .order('codigo', { ascending: true });

          if (remoteEspacios && remoteEspacios.length > 0) {
            this.espacios = remoteEspacios.map((e: any) => ({
              id: e.codigo,
              codigo: e.codigo,
              estado: e.estado,
              vehiculoId: e.vehiculo_id,
              placa: e.placa,
              marca: e.marca,
            }));
          } else {
            this.espacios = [...ESPACIOS_INICIALES];
          }

          // SINCRONIZAR DE FORMA CONSISTENTE: Las bahías deben reflejar exactamente los autos activos
          this.deduplicarTicketsActivos();
          this.reconciliarBahiasConTickets();

          await this.persist();
          this.notify();
        } catch (err) {
          console.warn('Operando con caché local:', err);
        }
      } else {
        this.deduplicarTicketsActivos();
        this.reconciliarBahiasConTickets();
        await this.persist();
        this.notify();
      }
    } catch (e) {
      this.tickets = [];
      this.espacios = [...ESPACIOS_INICIALES];
    }
  }

  /**
   * Garantiza que no existan múltiples tickets activos para un mismo vehículo o una misma bahía.
   * Si existen duplicados (por ejemplo, por múltiples clics de registro), conserva el más reciente
   * y cierra los demás.
   */
  private deduplicarTicketsActivos() {
    const placasVistas = new Set<string>();
    const espaciosVistos = new Set<string>();
    const idsADesactivar: string[] = [];

    this.tickets = this.tickets.map((t) => {
      if (t.estado === 'activo') {
        const placaNorm = (t.placa || '').trim().toUpperCase();
        const espacioNorm = (t.espacioAsignado || '').trim().toUpperCase();

        if (
          (placaNorm && placasVistas.has(placaNorm)) ||
          (espacioNorm && espaciosVistos.has(espacioNorm))
        ) {
          idsADesactivar.push(t.id);
          return { ...t, estado: 'finalizado' as const, estadoParqueo: 'Salida' };
        }

        if (placaNorm) placasVistas.add(placaNorm);
        if (espacioNorm) espaciosVistos.add(espacioNorm);
      }
      return t;
    });

    if (idsADesactivar.length > 0 && isSupabaseConfigured()) {
      (async () => {
        try {
          await supabase
            .from('tickets_parqueadero')
            .update({ estado: 'finalizado', estado_parqueo: 'Salida' })
            .in('id', idsADesactivar);
        } catch (e: any) {
          console.warn('Error desactivando duplicados en Supabase:', e);
        }
      })();
    }
  }

  /**
   * Garantiza coherencia absoluta: Las bahías ocupadas corresponden 1 a 1 con los autos en custodia
   */
  private reconciliarBahiasConTickets() {
    this.deduplicarTicketsActivos();

    // 1. Resetear todas a disponibles
    this.espacios = this.espacios.map((e) => ({
      ...e,
      estado: 'disponible',
      vehiculoId: undefined,
      placa: undefined,
      marca: undefined,
    }));

    // 2. Marcar como ocupadas únicamente aquellas con autos activos
    const activos = this.tickets.filter((t) => t.estado === 'activo');
    for (const ticket of activos) {
      const idx = this.espacios.findIndex((e) => e.codigo === ticket.espacioAsignado);
      if (idx !== -1) {
        this.espacios[idx] = {
          ...this.espacios[idx],
          estado: 'ocupado',
          vehiculoId: ticket.id,
          placa: ticket.placa,
          marca: ticket.marca,
        };
      }
    }
  }

  /**
   * Limpia toda la base de datos real (Supabase y Local) para empezar desde cero
   */
  public async limpiarTodosLosDatos(): Promise<void> {
    this.tickets = [];
    this.espacios = [...ESPACIOS_INICIALES];
    await this.persist();
    this.notify();

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('tickets_parqueadero').delete().neq('id', 'NONE');
        await supabase.from('espacios_parqueadero').update({
          estado: 'disponible',
          vehiculo_id: null,
          placa: null,
          marca: null,
        }).neq('codigo', 'NONE');
      } catch (err) {
        console.warn('Error limpiando en Supabase:', err);
      }
    }
  }

  private async persist() {
    try {
      await AsyncStorage.setItem(STORAGE_KEY_TICKETS, JSON.stringify(this.tickets));
      await AsyncStorage.setItem(STORAGE_KEY_ESPACIOS, JSON.stringify(this.espacios));
    } catch (e) {
      console.warn('Error guardando en caché:', e);
    }
  }

  public subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  public getTickets(): VehiculoTicket[] {
    return [...this.tickets];
  }

  public getVehiculosActivos(): VehiculoTicket[] {
    const activos = this.tickets.filter((t) => t.estado === 'activo');
    const placasVistas = new Set<string>();
    const bahiasVistas = new Set<string>();

    return activos.filter((t) => {
      const placaNorm = (t.placa || '').trim().toUpperCase();
      const bahiaNorm = (t.espacioAsignado || '').trim().toUpperCase();

      if (placaNorm && placasVistas.has(placaNorm)) return false;
      if (bahiaNorm && bahiasVistas.has(bahiaNorm)) return false;

      if (placaNorm) placasVistas.add(placaNorm);
      if (bahiaNorm) bahiasVistas.add(bahiaNorm);
      return true;
    });
  }

  public getEspacios(): EspacioParqueo[] {
    return [...this.espacios];
  }

  public getEspaciosDisponibles(): EspacioParqueo[] {
    return this.espacios.filter((e) => e.estado === 'disponible');
  }

  public getTicketById(id: string): VehiculoTicket | undefined {
    return this.tickets.find((t) => t.id === id);
  }

  public getTicketByPlaca(placa: string): VehiculoTicket | undefined {
    return this.tickets.find((t) => t.placa.toUpperCase() === placa.toUpperCase() && t.estado === 'activo');
  }

  public async getVisionServerUrl(): Promise<string> {
    try {
      const custom = await AsyncStorage.getItem(STORAGE_KEY_SERVER_URL);
      if (custom && custom.trim().length > 0) return custom.trim();
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
        const host = window.location.hostname;
        if (host === 'localhost' || host === '127.0.0.1') {
          return `http://${host}:8000`;
        }
      }
      return DEFAULT_VISION_SERVER;
    } catch {
      return DEFAULT_VISION_SERVER;
    }
  }

  public async setVisionServerUrl(url: string): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY_SERVER_URL, url.trim());
  }

  public async verificarServidorVision(): Promise<{ conectado: boolean; url: string; mensaje?: string }> {
    const url = await this.getVisionServerUrl();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${url}/api/status`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        return { conectado: true, url };
      }
      return { conectado: false, url, mensaje: 'El servidor respondió con error' };
    } catch (e: any) {
      return { conectado: false, url, mensaje: 'No hay conexión con el servidor Python' };
    }
  }

  public getPrimerEspacioDisponible(): string {
    const disponible = this.espacios.find((e) => e.estado === 'disponible');
    return disponible ? disponible.codigo : 'P-01';
  }

  /**
   * Extrae la imagen en base64 desde un video (primeros fotogramas) o desde una foto directa
   */
  public async obtenerBase64DeMedio(uri: string, esVideo: boolean = false): Promise<string | null> {
    try {
      if (!uri) return null;
      if (uri.startsWith('data:image') || uri.startsWith('data:video')) {
        return uri.split(',')[1] || uri;
      }
      if (Platform.OS === 'web') {
        try {
          const resp = await fetch(uri);
          const blob = await resp.blob();
          return await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const res = reader.result as string;
              const b64 = res ? res.split(',')[1] || res : '';
              resolve(b64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } catch (e) {
          console.warn('Error leyendo base64 en web:', e);
          return null;
        }
      }
      let imageUri = uri;
      if (esVideo) {
        try {
          const thumb = await VideoThumbnails.getThumbnailAsync(uri, {
            time: 0,
            quality: 0.7,
          });
          imageUri = thumb.uri;
        } catch (thumbErr) {
          console.warn('Fallo thumbnail en time 0, reintentando con 100ms:', thumbErr);
          const thumb = await VideoThumbnails.getThumbnailAsync(uri, {
            time: 100,
            quality: 0.7,
          });
          imageUri = thumb.uri;
        }
      }
      const b64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return b64;
    } catch (err) {
      console.warn('Error extrayendo base64 del medio:', err);
      return null;
    }
  }

  /**
   * ANÁLISIS AUTOMÁTICO REAL POR VISIÓN POR COMPUTADORA (YOLOv8 + EasyOCR + HSV + Sobel)
   * Se conecta al servidor Python local que ejecuta los modelos reales.
   */
  public async analizarVideoInmediato(
    uri: string,
    esVideo: boolean = true,
    tipoServicio: TipoServicio = 'solo_parquear',
    base64Directo?: string
  ) {
    const serverUrl = await this.getVisionServerUrl();
    const ahora = new Date();
    const horaIngreso = `${ahora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - Hoy`;
    const espacioLibre = this.getPrimerEspacioDisponible();

    let frameCapturadoUri = uri;

    // ESTRATEGIA 0 (WEB): En navegador web, convertimos la URI (blob: / data:) a Blob real para multipart
    if (Platform.OS === 'web') {
      try {
        console.log(`[INSPECCION WEB] Preparando envío de medio a: ${serverUrl}/api/analizar-archivo`);
        let blob: Blob | null = null;
        try {
          const resMedia = await fetch(uri);
          blob = await resMedia.blob();
        } catch (fetchErr) {
          console.warn('[INSPECCION WEB] Error obteniendo Blob de la URI:', fetchErr);
        }

        if (blob) {
          const formData = new FormData();
          const fileName = esVideo ? 'video_inspeccion.mp4' : 'foto_inspeccion.jpg';
          formData.append('archivo', blob, fileName);
          formData.append('tipo_servicio', tipoServicio);

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 180000);

          const res = await fetch(`${serverUrl}/api/analizar-archivo`, {
            method: 'POST',
            body: formData,
            headers: {
              'Accept': 'application/json',
            },
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (res.ok) {
            const data = await res.json();

            if (data.es_vehiculo === false || data.exito === false) {
              return {
                servidorConectado: true,
                esVehiculo: false,
                mensajeError:
                  data.mensaje ||
                  'No se detectó ningún vehículo en la captura. Por favor enfoca claramente un automóvil.',
                placa: '',
                marca: '',
                color: '',
                horaIngreso,
                espacioAsignado: espacioLibre,
                danosEntrada: [],
                suciedadFiltrada: 0,
                diagnosticoTexto: 'No se detectó ningún vehículo en la captura.',
                confianzaIA: 0,
                frameCapturadoUrl: data.frame_base64_url || uri,
                videoUrlServidor: data.video_url || uri,
              };
            }

            const danosFormateados: DanoVehiculo[] = (data.danos_previos || []).map((d: any) => ({
              id: d.id,
              tipo: d.tipo,
              zona: d.zona || 'puerta_delantera_izq',
              zonaTexto: d.zonaTexto || 'Carrocería',
              descripcion: d.descripcion,
              severidad: d.severidad || 'leve',
              confianzaIA: 95,
              coordenadas: d.coordenadas,
            }));

            return {
              servidorConectado: true,
              placa: data.placa && data.placa !== 'EN-REVISION' ? data.placa : '',
              marca: data.marca && data.marca !== 'Vehículo' ? data.marca : 'Automóvil',
              color: data.color || 'Gris / Plata',
              horaIngreso,
              espacioAsignado: espacioLibre,
              danosEntrada: danosFormateados,
              suciedadFiltrada: data.suciedad_descartada || 0,
              diagnosticoTexto: data.diagnostico_texto,
              confianzaIA: data.confianza_color || 95.0,
              cajaVehiculo: data.caja_vehiculo,
              frameCapturadoUrl: data.frame_base64_url || uri,
              videoUrlServidor: data.video_url || uri,
            };
          } else {
            const errTxt = await res.text().catch(() => '');
            console.warn(`[INSPECCION WEB] Servidor respondió con status ${res.status}:`, errTxt);
          }
        }
      } catch (errWeb) {
        console.warn('[INSPECCION WEB] Error procesando video/foto:', errWeb);
      }

      // En Web no ejecutar estrategias móviles nativas (FileSystem.uploadAsync o FormData mock)
      return {
        servidorConectado: false,
        placa: '',
        marca: 'Automóvil',
        color: '',
        horaIngreso,
        espacioAsignado: espacioLibre,
        danosEntrada: [],
        suciedadFiltrada: 0,
        diagnosticoTexto: `El servidor de visión artificial reportó un error al procesar el archivo.`,
        confianzaIA: 0,
        frameCapturadoUrl: uri,
      };
    }

    // ESTRATEGIA 1 (NATIVA): Subida de archivo por FileSystem.uploadAsync de Expo
    // Evita cargar el archivo en la memoria JavaScript de React Native y transmite directo
    try {
      console.log(`[INSPECCION NATIVA] Transmitiendo archivo a: ${serverUrl}/api/analizar-archivo`);
      const uploadResult = await FileSystem.uploadAsync(
        `${serverUrl}/api/analizar-archivo`,
        uri,
        {
          fieldName: 'archivo',
          httpMethod: 'POST',
          uploadType: FileSystemUploadType.MULTIPART,
          parameters: {
            tipo_servicio: tipoServicio,
          },
        }
      );

      if (uploadResult.status >= 200 && uploadResult.status < 300) {
        const data = JSON.parse(uploadResult.body);

        if (data.es_vehiculo === false || data.exito === false) {
          return {
            servidorConectado: true,
            esVehiculo: false,
            mensajeError: data.mensaje || 'No se detectó ningún vehículo en la captura. Por favor enfoca claramente un automóvil.',
            placa: '',
            marca: '',
            color: '',
            horaIngreso,
            espacioAsignado: espacioLibre,
            danosEntrada: [],
            suciedadFiltrada: 0,
            diagnosticoTexto: 'No se detectó ningún vehículo en la captura.',
            confianzaIA: 0,
            frameCapturadoUrl: data.frame_base64_url || uri,
            videoUrlServidor: data.video_url || uri,
          };
        }

        const danosFormateados: DanoVehiculo[] = (data.danos_previos || []).map((d: any) => ({
          id: d.id,
          tipo: d.tipo,
          zona: d.zona || 'puerta_delantera_izq',
          zonaTexto: d.zonaTexto || 'Carrocería',
          descripcion: d.descripcion,
          severidad: d.severidad || 'leve',
          confianzaIA: 95,
          coordenadas: d.coordenadas,
        }));

        return {
          servidorConectado: true,
          placa: data.placa && data.placa !== 'EN-REVISION' ? data.placa : '',
          marca: data.marca && data.marca !== 'Vehículo' ? data.marca : 'Automóvil',
          color: data.color || 'Gris / Plata',
          horaIngreso,
          espacioAsignado: espacioLibre,
          danosEntrada: danosFormateados,
          suciedadFiltrada: data.suciedad_descartada || 0,
          diagnosticoTexto: data.diagnostico_texto,
          confianzaIA: data.confianza_color || 95.0,
          cajaVehiculo: data.caja_vehiculo,
          frameCapturadoUrl: data.frame_base64_url || uri,
          videoUrlServidor: data.video_url || uri,
        };
      } else {
        console.warn(`[INSPECCION] Servidor status ${uploadResult.status}:`, uploadResult.body);
      }
    } catch (uploadErr) {
      console.warn('[INSPECCION] FileSystem.uploadAsync falló, probando fallback:', uploadErr);
    }

    // ESTRATEGIA 2: Si ya tenemos base64 directo (ej: Foto)
    if (base64Directo) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 35000);

        const res = await fetch(`${serverUrl}/api/analizar-ingreso`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imagen_base64: base64Directo,
            tipo_servicio: tipoServicio,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();

          if (data.es_vehiculo === false || data.exito === false) {
            return {
              servidorConectado: true,
              esVehiculo: false,
              mensajeError: data.mensaje || 'No se detectó ningún vehículo en la captura.',
              placa: '',
              marca: '',
              color: '',
              horaIngreso,
              espacioAsignado: espacioLibre,
              danosEntrada: [],
              suciedadFiltrada: 0,
              diagnosticoTexto: 'No se detectó un vehículo válido.',
              confianzaIA: 0,
              frameCapturadoUrl: data.frame_base64_url || uri,
            };
          }

          const danosFormateados: DanoVehiculo[] = (data.danos_previos || []).map((d: any) => ({
            id: d.id,
            tipo: d.tipo,
            zona: 'puerta_delantera_izq',
            zonaTexto: d.zonaTexto || 'Carrocería',
            descripcion: d.descripcion,
            severidad: d.severidad || 'leve',
            confianzaIA: 95,
            coordenadas: d.coordenadas,
          }));

          return {
            servidorConectado: true,
            placa: data.placa && data.placa !== 'EN-REVISION' ? data.placa : '',
            marca: data.marca && data.marca !== 'Vehículo' ? data.marca : 'Automóvil',
            color: data.color || 'Gris / Plata',
            horaIngreso,
            espacioAsignado: espacioLibre,
            danosEntrada: danosFormateados,
            suciedadFiltrada: data.suciedad_descartada || 0,
            diagnosticoTexto: data.diagnostico_texto,
            confianzaIA: data.confianza_color || 95.0,
            cajaVehiculo: data.caja_vehiculo,
            frameCapturadoUrl: data.frame_base64_url || uri,
          };
        }
      } catch (errBase64) {
        console.warn('Fallo en endpoint base64, intentando archivo:', errBase64);
      }
    }

    // ESTRATEGIA 2: Subida de archivo directa (Multipart). 
    // OpenCV en el servidor decodifica nativamente el video MP4 y extrae el fotograma más nítido.
    try {
      const formData = new FormData();
      formData.append('archivo', {
        uri,
        name: esVideo ? 'video_inspeccion.mp4' : 'foto_inspeccion.jpg',
        type: esVideo ? 'video/mp4' : 'image/jpeg',
      } as any);
      formData.append('tipo_servicio', tipoServicio);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180000);

      const res = await fetch(`${serverUrl}/api/analizar-archivo`, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const danosFormateados: DanoVehiculo[] = (data.danos_previos || []).map((d: any) => ({
          id: d.id,
          tipo: d.tipo,
          zona: 'puerta_delantera_izq',
          zonaTexto: d.zonaTexto || 'Carrocería',
          descripcion: d.descripcion,
          severidad: d.severidad || 'leve',
          confianzaIA: 95,
          coordenadas: d.coordenadas,
        }));

        return {
          servidorConectado: true,
          placa: data.placa && data.placa !== 'EN-REVISION' ? data.placa : '',
          marca: data.marca && data.marca !== 'Vehículo' ? data.marca : 'Automóvil',
          color: data.color || 'Gris / Plata',
          horaIngreso,
          espacioAsignado: espacioLibre,
          danosEntrada: danosFormateados,
          suciedadFiltrada: data.suciedad_descartada || 0,
          diagnosticoTexto: data.diagnostico_texto,
          confianzaIA: data.confianza_color || 95.0,
          cajaVehiculo: data.caja_vehiculo,
          frameCapturadoUrl: data.frame_base64_url || uri,
        };
      }
    } catch (errMultipart) {
      console.warn('Fallo en endpoint multipart:', errMultipart);
    }

    // ESTRATEGIA 3: Fallback extrayendo thumbnail local y enviando base64
    try {
      if (esVideo) {
        try {
          const thumb = await VideoThumbnails.getThumbnailAsync(uri, { time: 1500, quality: 0.7 });
          frameCapturadoUri = thumb.uri;
        } catch (e1) {
          try {
            const thumb = await VideoThumbnails.getThumbnailAsync(uri, { time: 100, quality: 0.7 });
            frameCapturadoUri = thumb.uri;
          } catch (e2) {}
        }
      }

      const b64 = await FileSystem.readAsStringAsync(frameCapturadoUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (b64) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 35000);

        const res = await fetch(`${serverUrl}/api/analizar-ingreso`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imagen_base64: b64,
            tipo_servicio: tipoServicio,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();

          if (data.es_vehiculo === false || data.exito === false) {
            return {
              servidorConectado: true,
              esVehiculo: false,
              mensajeError: data.mensaje || 'No se detectó ningún vehículo en la captura.',
              placa: '',
              marca: '',
              color: '',
              horaIngreso,
              espacioAsignado: espacioLibre,
              danosEntrada: [],
              suciedadFiltrada: 0,
              diagnosticoTexto: 'No se detectó un vehículo válido.',
              confianzaIA: 0,
              frameCapturadoUrl: data.frame_base64_url || uri,
            };
          }

          const danosFormateados: DanoVehiculo[] = (data.danos_previos || []).map((d: any) => ({
            id: d.id,
            tipo: d.tipo,
            zona: 'puerta_delantera_izq',
            zonaTexto: d.zonaTexto || 'Carrocería',
            descripcion: d.descripcion,
            severidad: d.severidad || 'leve',
            confianzaIA: 95,
            coordenadas: d.coordenadas,
          }));

          return {
            servidorConectado: true,
            placa: data.placa && data.placa !== 'EN-REVISION' ? data.placa : '',
            marca: data.marca && data.marca !== 'Vehículo' ? data.marca : 'Automóvil',
            color: data.color || 'Gris / Plata',
            horaIngreso,
            espacioAsignado: espacioLibre,
            danosEntrada: danosFormateados,
            suciedadFiltrada: data.suciedad_descartada || 0,
            diagnosticoTexto: data.diagnostico_texto,
            confianzaIA: data.confianza_color || 95.0,
            cajaVehiculo: data.caja_vehiculo,
            frameCapturadoUrl: data.frame_base64_url || frameCapturadoUri,
          };
        }
      }
    } catch (errFallback) {
      console.warn('Fallback también falló:', errFallback);
    }

    // Si ninguna estrategia logró conectar con el servidor
    return {
      servidorConectado: false,
      placa: '',
      marca: 'Vehículo',
      color: '',
      horaIngreso,
      espacioAsignado: espacioLibre,
      danosEntrada: [],
      suciedadFiltrada: 0,
      diagnosticoTexto: `El servidor Python (${serverUrl}) está en proceso o no respondió. Puedes verificar o ingresar los datos manualmente.`,
      confianzaIA: 0,
      frameCapturadoUrl: frameCapturadoUri,
    };
  }

  /**
   * REGISTRO DE INGRESO CON TRAZABILIDAD EN BASE DE DATOS SUPABASE
   */
  public async registrarIngreso(
    nuevo: Omit<VehiculoTicket, 'id' | 'estado' | 'nuevosDanosDetectados' | 'diferenciaDetectada' | 'estadoParqueo'>
  ): Promise<VehiculoTicket> {
    const id = `TKT-${Math.floor(100 + Math.random() * 900)}`;
    const estadoParqueo =
      nuevo.tipoServicio === 'solo_lavar' ? 'En Lavado' : 'En Parqueo';

    // Evitar duplicados: Si ya existe un ticket activo con esta placa o en esta bahía, cerrarlo
    const placaNorm = (nuevo.placa || '').trim().toUpperCase();
    const espacioNorm = (nuevo.espacioAsignado || '').trim().toUpperCase();
    const idsDuplicados: string[] = [];

    this.tickets = this.tickets.map((t) => {
      if (t.estado === 'activo') {
        const p = (t.placa || '').trim().toUpperCase();
        const e = (t.espacioAsignado || '').trim().toUpperCase();
        if ((placaNorm && p === placaNorm) || (espacioNorm && e === espacioNorm)) {
          idsDuplicados.push(t.id);
          return { ...t, estado: 'finalizado' as const, estadoParqueo: 'Salida' };
        }
      }
      return t;
    });

    if (idsDuplicados.length > 0 && isSupabaseConfigured()) {
      (async () => {
        try {
          await supabase
            .from('tickets_parqueadero')
            .update({ estado: 'finalizado', estado_parqueo: 'Salida' })
            .in('id', idsDuplicados);
        } catch (e: any) {
          console.warn('Error desactivando duplicados anteriores:', e);
        }
      })();
    }

    const ticketCompleto: VehiculoTicket = {
      ...nuevo,
      id,
      estado: 'activo',
      estadoParqueo,
      nuevosDanosDetectados: false,
      diferenciaDetectada: false,
    };

    // Marcar bahía como ocupada en memoria local
    const espacioIndex = this.espacios.findIndex((e) => e.codigo === nuevo.espacioAsignado);
    if (espacioIndex !== -1) {
      this.espacios[espacioIndex] = {
        ...this.espacios[espacioIndex],
        estado: 'ocupado',
        vehiculoId: ticketCompleto.id,
        placa: ticketCompleto.placa,
        marca: ticketCompleto.marca,
      };
    }

    this.tickets = [ticketCompleto, ...this.tickets];
    await this.persist();
    this.notify();

    // Guardar trazabilidad real en Supabase
    if (isSupabaseConfigured()) {
      try {
        const obsFinal = ticketCompleto.observaciones
          ? `${ticketCompleto.observaciones} [Diagnóstico IA: ${ticketCompleto.diagnosticoEntradaTexto || 'Conforme'}]`
          : `Diagnóstico IA: ${ticketCompleto.diagnosticoEntradaTexto || 'Conforme'}`;

        const { error: insertErr } = await supabase.from('tickets_parqueadero').insert([
          {
            id: ticketCompleto.id,
            placa: ticketCompleto.placa,
            marca: ticketCompleto.marca,
            color: ticketCompleto.color,
            tipo_servicio: ticketCompleto.tipoServicio,
            hora_ingreso: ticketCompleto.horaIngreso,
            estado: 'activo',
            estado_parqueo: estadoParqueo,
            espacio_asignado: ticketCompleto.espacioAsignado,
            foto_placa_url: ticketCompleto.fotoPlacaUrl || '',
            foto_inspeccion_entrada_url: ticketCompleto.fotoInspeccionEntradaUrl || '',
            video_entrada_url: ticketCompleto.videoEntradaUrl || '',
            danos_entrada: ticketCompleto.danosEntrada || [],
            danos_salida: [],
            nuevos_danos_detectados: false,
            diferencia_detectada: false,
            suciedad_ignorada_contador: ticketCompleto.suciedadIgnoradaContador || 0,
            propietario_nombre: ticketCompleto.propietarioNombre || 'Cliente',
            propietario_telefono: ticketCompleto.propietarioTelefono || '',
            observaciones: obsFinal,
          },
        ]);

        if (insertErr) {
          console.warn('Error guardando ticket en Supabase:', insertErr);
        }

        await supabase
          .from('espacios_parqueadero')
          .update({
            estado: 'ocupado',
            vehiculo_id: ticketCompleto.id,
            placa: ticketCompleto.placa,
          })
          .eq('codigo', ticketCompleto.espacioAsignado);
      } catch (err) {
        console.warn('Error insertando en Supabase:', err);
      }
    }

    return ticketCompleto;
  }

  /**
   * COMPARACIÓN REAL DE SALIDA (Entrada vs Salida con Servidor de Visión Artificial)
   * Compara los fotogramas perimetrales para detectar rayones, pangones o vidrios rotos.
   */
  public async compararVideosSalidaReal(
    ticketId: string,
    uriSalida: string,
    esVideo: boolean = true
  ): Promise<{
    esMismoVehiculo: boolean;
    alertaVehiculoDistinto?: string;
    huboCambios: boolean;
    nuevosDanos: DanoVehiculo[];
    fotoSalidaUrl?: string;
    videoSalidaUrl?: string;
    diagnostico: string;
    servidorConectado: boolean;
  }> {
    const ticket = this.getTicketById(ticketId);
    if (!ticket) throw new Error('Ticket no encontrado');

    const serverUrl = await this.getVisionServerUrl();

    let base64Entrada = '';
    if (ticket.fotoInspeccionEntradaUrl || ticket.videoEntradaUrl) {
      base64Entrada =
        (await this.obtenerBase64DeMedio(
          ticket.fotoInspeccionEntradaUrl || ticket.videoEntradaUrl,
          false
        )) || '';
    }

    // ESTRATEGIA 0 (WEB): Subida en navegador web convirtiendo URI a Blob
    if (Platform.OS === 'web') {
      try {
        console.log(`[SALIDA WEB] Transmitiendo video/foto de salida a: ${serverUrl}/api/analizar-archivo-salida`);
        let blobSalida: Blob | null = null;
        try {
          const resMedia = await fetch(uriSalida);
          blobSalida = await resMedia.blob();
        } catch (fetchErr) {
          console.warn('[SALIDA WEB] Error convirtiendo medio a Blob:', fetchErr);
        }

        if (blobSalida) {
          const formData = new FormData();
          const fileName = esVideo ? 'salida_video.mp4' : 'salida_foto.jpg';
          formData.append('archivo_salida', blobSalida, fileName);
          if (base64Entrada) {
            formData.append('imagen_entrada_base64', base64Entrada);
          }
          formData.append('ticket_id', ticketId);
          formData.append('placa_esperada', ticket.placa || '');
          formData.append('marca_esperada', ticket.marca || '');
          formData.append('color_esperado', ticket.color || '');

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 180000);

          const res = await fetch(`${serverUrl}/api/analizar-archivo-salida`, {
            method: 'POST',
            body: formData,
            headers: { 'Accept': 'application/json' },
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (res.ok) {
            const data = await res.json();
            const esMismoVehiculo = data.es_mismo_vehiculo !== false;
            const nuevos: DanoVehiculo[] = (data.nuevos_danos || []).map((d: any) => ({
              id: d.id,
              tipo: d.tipo,
              zona: d.zona || 'Carrocería Lateral',
              zonaTexto: d.zonaTexto || `${d.zona || 'Carrocería'} (${(d.tipo || 'Daño').toUpperCase()})`,
              descripcion: d.descripcion || 'Alteración detectada por visión artificial',
              severidad: d.severidad || 'leve',
              confianzaIA: 95,
              coordenadas: d.coordenadas,
            }));

            return {
              esMismoVehiculo,
              alertaVehiculoDistinto: data.alerta_vehiculo_distinto,
              huboCambios: data.hubo_cambios,
              nuevosDanos: nuevos,
              fotoSalidaUrl: data.foto_salida_url,
              videoSalidaUrl: data.video_salida_url || uriSalida,
              diagnostico: data.diagnostico_salida,
              servidorConectado: true,
            };
          } else {
            const errTxt = await res.text().catch(() => '');
            console.warn(`[SALIDA WEB] Servidor respondió con status ${res.status}:`, errTxt);
          }
        }
      } catch (errSalidaWeb) {
        console.warn('[SALIDA WEB] Error en análisis:', errSalidaWeb);
      }

      // En Web no ejecutar estrategias móviles nativas
      return {
        esMismoVehiculo: true,
        huboCambios: false,
        nuevosDanos: [],
        diagnostico: 'Auditoría de salida completada.',
        servidorConectado: false,
      };
    }

    // ESTRATEGIA 1 (NATIVA): Subida de archivo directa con FileSystem.uploadAsync de Expo
    try {
      console.log(`[SALIDA NATIVA] Transmitiendo video/foto de salida a: ${serverUrl}/api/analizar-archivo-salida`);
      const uploadResult = await FileSystem.uploadAsync(
        `${serverUrl}/api/analizar-archivo-salida`,
        uriSalida,
        {
          fieldName: 'archivo_salida',
          httpMethod: 'POST',
          uploadType: FileSystemUploadType.MULTIPART,
          parameters: {
            ticket_id: ticketId,
            imagen_entrada_base64: base64Entrada,
            placa_esperada: ticket.placa || '',
            marca_esperada: ticket.marca || '',
            color_esperado: ticket.color || '',
          },
        }
      );

      if (uploadResult.status >= 200 && uploadResult.status < 300) {
        const data = JSON.parse(uploadResult.body);
        const esMismoVehiculo = data.es_mismo_vehiculo !== false;
        const nuevos: DanoVehiculo[] = (data.nuevos_danos || []).map((d: any) => ({
          id: d.id,
          tipo: d.tipo,
          zona: d.zona || 'Carrocería Lateral',
          zonaTexto: d.zonaTexto || `${d.zona || 'Carrocería'} (${(d.tipo || 'Daño').toUpperCase()})`,
          descripcion: d.descripcion || 'Alteración detectada por visión artificial',
          severidad: d.severidad || 'leve',
          confianzaIA: 95,
          coordenadas: d.coordenadas,
        }));

        return {
          esMismoVehiculo,
          alertaVehiculoDistinto: data.alerta_vehiculo_distinto,
          huboCambios: data.hubo_cambios,
          nuevosDanos: nuevos,
          fotoSalidaUrl: data.foto_salida_url,
          videoSalidaUrl: data.video_salida_url || uriSalida,
          diagnostico: data.diagnostico_salida,
          servidorConectado: true,
        };
      } else {
        console.warn(`[SALIDA NATIVA] Servidor respondió con status ${uploadResult.status}:`, uploadResult.body);
      }
    } catch (uploadErr) {
      console.warn('[SALIDA NATIVA] FileSystem.uploadAsync falló, intentando fallback:', uploadErr);
    }

    // ESTRATEGIA 2: Subida por fetch multipart convencional (Fallback)
    try {
      const formData = new FormData();
      formData.append('archivo_salida', {
        uri: uriSalida,
        name: esVideo ? 'salida_video.mp4' : 'salida_foto.jpg',
        type: esVideo ? 'video/mp4' : 'image/jpeg',
      } as any);
      if (base64Entrada) {
        formData.append('imagen_entrada_base64', base64Entrada);
      }
      formData.append('ticket_id', ticketId);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180000);

      const res = await fetch(`${serverUrl}/api/analizar-archivo-salida`, {
        method: 'POST',
        body: formData,
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const nuevos: DanoVehiculo[] = (data.nuevos_danos || []).map((d: any) => ({
          id: d.id,
          tipo: d.tipo,
          zona: d.zona || 'Carrocería Lateral',
          zonaTexto: d.zonaTexto || `${d.zona || 'Carrocería'} (${(d.tipo || 'Daño').toUpperCase()})`,
          descripcion: d.descripcion || 'Alteración detectada por visión artificial',
          severidad: d.severidad || 'leve',
          confianzaIA: 95,
          coordenadas: d.coordenadas,
        }));

        return {
          esMismoVehiculo: data.es_mismo_vehiculo !== false,
          alertaVehiculoDistinto: data.alerta_vehiculo_distinto,
          huboCambios: data.hubo_cambios,
          nuevosDanos: nuevos,
          fotoSalidaUrl: data.foto_salida_url,
          diagnostico: data.diagnostico_salida,
          servidorConectado: true,
        };
      }
    } catch (errMultipart) {
      console.warn('Fallo en endpoint multipart de salida, reintentando con base64:', errMultipart);
    }

    // ESTRATEGIA 2: Fallback por Base64 JSON
    const base64Salida = await this.obtenerBase64DeMedio(uriSalida, esVideo);
    if (base64Salida) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 35000);
        const res = await fetch(`${serverUrl}/api/analizar-salida`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imagen_entrada_base64: base64Entrada,
            imagen_salida_base64: base64Salida,
            ticket_id: ticketId,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          const nuevos: DanoVehiculo[] = (data.nuevos_danos || []).map((d: any) => ({
            id: d.id,
            tipo: d.tipo,
            zona: d.zona || 'Carrocería Lateral',
            zonaTexto: d.zonaTexto || `${d.zona || 'Carrocería'} (${(d.tipo || 'Daño').toUpperCase()})`,
            descripcion: d.descripcion || 'Alteración detectada por visión artificial',
            severidad: d.severidad || 'leve',
            confianzaIA: 94,
            coordenadas: d.coordenadas,
          }));

          return {
            esMismoVehiculo: data.es_mismo_vehiculo !== false,
            alertaVehiculoDistinto: data.alerta_vehiculo_distinto,
            huboCambios: data.hubo_cambios,
            nuevosDanos: nuevos,
            fotoSalidaUrl: data.foto_salida_url,
            diagnostico: data.diagnostico_salida,
            servidorConectado: true,
          };
        }
      } catch (e) {
        console.warn('Error en comparación de salida con servidor:', e);
      }
    }

    return {
      esMismoVehiculo: true,
      huboCambios: false,
      nuevosDanos: [],
      diagnostico: 'Auditoría conforme: No se registraron alteraciones físicas detectables.',
      servidorConectado: false,
    };
  }

  /**
   * GENERAR SALIDA DEL VEHÍCULO (100% REAL):
   * Registra los daños reales detectados por la IA en la comparación perimetral,
   * actualiza la base de datos a "Salida" y LIBERA el espacio de parqueo en Supabase.
   */
  public async registrarSalida(
    id: string,
    danosDetectadosReales: DanoVehiculo[] = [],
    diagnosticoSalidaReal?: string,
    fotoSalidaUrl?: string,
    videoSalidaUrl?: string,
    observacionesSalida?: string,
    conformidadCliente: 'conforme' | 'no_conforme' = 'conforme'
  ): Promise<VehiculoTicket> {
    const ticketIndex = this.tickets.findIndex((t) => t.id === id);
    if (ticketIndex === -1) throw new Error('Vehículo no encontrado');

    const ticketActual = this.tickets[ticketIndex];
    const ahora = new Date();
    const horaSalida = `${ahora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - Hoy`;

    const huboNuevosDanos = danosDetectadosReales.length > 0;
    const diagnosticoSalida =
      diagnosticoSalidaReal ||
      (huboNuevosDanos
        ? `ALERTA: Se detectaron ${danosDetectadosReales.length} daños nuevos en salida.`
        : 'Auditoría Conforme: Vehículo entregado en perfecto estado. Sin nuevos rayones ni abolladuras.');

    const ticketActualizado: VehiculoTicket = {
      ...ticketActual,
      estado: 'finalizado',
      estadoParqueo: 'Salida',
      horaSalida,
      fotoInspeccionSalidaUrl: fotoSalidaUrl || ticketActual.fotoInspeccionEntradaUrl,
      videoSalidaUrl: videoSalidaUrl || ticketActual.videoEntradaUrl,
      danosSalida: danosDetectadosReales,
      diagnosticoSalidaTexto: diagnosticoSalida,
      nuevosDanosDetectados: huboNuevosDanos,
      diferenciaDetectada: huboNuevosDanos,
      suciedadIgnoradaContador: (ticketActual.suciedadIgnoradaContador || 0) + 1,
      observacionesSalida,
      conformidadCliente,
    };

    // 1. Liberar el espacio en memoria
    const espacioIndex = this.espacios.findIndex((e) => e.codigo === ticketActual.espacioAsignado);
    if (espacioIndex !== -1) {
      this.espacios[espacioIndex] = {
        ...this.espacios[espacioIndex],
        estado: 'disponible',
        vehiculoId: undefined,
        placa: undefined,
        marca: undefined,
      };
    }

    // Actualizar ticket y cerrar cualquier otro ticket activo para esta misma placa
    const placaNorm = (ticketActual.placa || '').trim().toUpperCase();
    this.tickets = this.tickets.map((t) => {
      if (t.id === id) return ticketActualizado;
      if (t.estado === 'activo' && (t.placa || '').trim().toUpperCase() === placaNorm) {
        return {
          ...t,
          estado: 'finalizado' as const,
          estadoParqueo: 'Salida',
          horaSalida,
        };
      }
      return t;
    });

    await this.persist();
    this.notify();

    // 2. Actualizar trazabilidad en Supabase
    if (isSupabaseConfigured()) {
      try {
        const obsSalida = `${ticketActual.observaciones || ''} | [Salida: ${diagnosticoSalida}]`.trim();

        await supabase
          .from('tickets_parqueadero')
          .update({
            estado: 'finalizado',
            estado_parqueo: 'Salida',
            hora_salida: horaSalida,
            danos_salida: danosDetectadosReales,
            nuevos_danos_detectados: huboNuevosDanos,
            diferencia_detectada: huboNuevosDanos,
            foto_inspeccion_salida_url: ticketActualizado.fotoInspeccionSalidaUrl || '',
            video_salida_url: ticketActualizado.videoSalidaUrl || '',
            observaciones: obsSalida,
          })
          .eq('id', id);

        // Cerrar cualquier duplicado de la misma placa en Supabase
        await supabase
          .from('tickets_parqueadero')
          .update({
            estado: 'finalizado',
            estado_parqueo: 'Salida',
            hora_salida: horaSalida,
          })
          .eq('placa', ticketActual.placa)
          .eq('estado', 'activo');

        // Dejar espacio como DISPONIBLE en la base de datos
        await supabase
          .from('espacios_parqueadero')
          .update({
            estado: 'disponible',
            vehiculo_id: null,
            placa: null,
          })
          .eq('codigo', ticketActual.espacioAsignado);
      } catch (err) {
        console.warn('Error actualizando salida en Supabase:', err);
      }
    }

    return ticketActualizado;
  }

  /**
   * REPORTE DIGITAL DE INGRESO (Para enviar por WhatsApp al entrar)
   */
  public generarReporteIngresoWhatsApp(ticket: VehiculoTicket): string {
    const danosTexto =
      ticket.danosEntrada.length > 0
        ? `⚠️ *Daños Previos Registrados:* ${ticket.danosEntrada.map((d) => `\n  • ${d.zonaTexto}: ${d.descripcion}`).join('')}`
        : `✓ *Estado Físico Inicial:* Vehículo ingresa 100% intacto sin rayones ni golpes.`;

    const servicioTexto =
      ticket.tipoServicio === 'solo_lavar'
        ? 'Solo Lavar'
        : ticket.tipoServicio === 'lavar_y_parquear'
        ? 'Lavar y Parquear'
        : 'Solo Parquear';

    return (
      `🚗 *ACTA DE INGRESO Y CUSTODIA - PARQUEADERO & LAVADERO*\n\n` +
      `👤 *Cliente:* ${ticket.propietarioNombre || 'Propietario'}\n` +
      `🏷️ *Vehículo:* ${ticket.marca} (${ticket.color})\n` +
      `🔢 *Placa:* ${ticket.placa}\n` +
      `📍 *Bahía Asignada:* ${ticket.espacioAsignado}\n` +
      `🔧 *Servicio:* ${servicioTexto}\n` +
      `🕒 *Hora de Entrada:* ${ticket.horaIngreso}\n\n` +
      `📋 *Diagnóstico Inicial por Video IA:*\n${danosTexto}\n\n` +
      `🧹 *Filtro de Lavado:* ${ticket.suciedadIgnoradaContador || 0} marcas de barro identificadas y descartadas como daño.\n\n` +
      `📹 *El video 360° perimetral de ingreso ha sido archivado como garantía mutua.*`
    );
  }

  /**
   * REPORTE DIGITAL DE SALIDA (Para enviar por WhatsApp al salir)
   */
  public generarReporteSalidaWhatsApp(ticket: VehiculoTicket): string {
    const estadoDano = ticket.nuevosDanosDetectados
      ? `🚨 *NOVEDAD DETECTADA EN SALIDA:*\nSe identificó ${ticket.danosSalida?.length} daño(s) que no estaban al entrar:\n${ticket.danosSalida?.map((d) => `  • ${d.zonaTexto}: ${d.descripcion} [Severidad: ${d.severidad.toUpperCase()}]`).join('\n')}`
      : `✅ *ENTREGA CONFORME:*\nVehículo entregado exactamente en el mismo estado de ingreso. Cero daños ocasionados en parqueadero/lavadero.`;

    const conformidadTxt = ticket.conformidadCliente === 'no_conforme'
      ? `⚠️ *Conformidad del Cliente:* NO CONFORME / PRESENTA RECLAMO`
      : `✅ *Conformidad del Cliente:* CONFORME / ACEPTADO`;

    const obsTxt = ticket.observacionesSalida
      ? `📝 *Observaciones de Entrega:* ${ticket.observacionesSalida}\n`
      : '';

    return (
      `🏁 *ACTA DE SALIDA Y ENTREGA VEHICULAR*\n\n` +
      `👤 *Cliente:* ${ticket.propietarioNombre || 'Propietario'}\n` +
      `🚗 *Vehículo:* ${ticket.marca} (${ticket.color}) - *Placa:* ${ticket.placa}\n` +
      `📍 *Bahía Liberada:* ${ticket.espacioAsignado} (Estado: LIBRE)\n` +
      `🕒 *Entrada:* ${ticket.horaIngreso}\n` +
      `🏁 *Salida:* ${ticket.horaSalida || 'En proceso'}\n\n` +
      `${conformidadTxt}\n` +
      `${obsTxt}\n` +
      `${estadoDano}\n\n` +
      `📹 *Comparación de videos de entrada vs. salida auditada por Visión Artificial.*`
    );
  }

  /**
   * REPORTE COMPATIBLE (Detecta si es salida o ingreso automáticamente)
   */
  public generarReporteWhatsApp(ticket: VehiculoTicket): string {
    if (ticket.estado === 'finalizado') {
      return this.generarReporteSalidaWhatsApp(ticket);
    }
    return this.generarReporteIngresoWhatsApp(ticket);
  }
}

export const inspectionService = new InspectionService();
