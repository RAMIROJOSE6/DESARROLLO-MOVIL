export type TipoServicio = 'solo_parquear' | 'lavar_y_parquear' | 'solo_lavar' | 'parqueadero' | 'lavadero' | 'ambos';
export type EstadoParqueo = 'En Parqueo' | 'En Lavado' | 'Salida';
export type TipoDano = 'rayon' | 'pangon' | 'abolladura' | 'partidura_vidrio' | 'rotura' | 'suciedad_filtrada';
export type SeveridadDano = 'leve' | 'moderada' | 'grave';

export type ZonaVehiculo =
  | 'puerta_delantera_izq'
  | 'puerta_delantera_der'
  | 'puerta_trasera_izq'
  | 'puerta_trasera_der'
  | 'bumper_delantero'
  | 'bumper_trasero'
  | 'parabrisas_delantero'
  | 'parabrisas_trasero'
  | 'vidrio_lateral_izq'
  | 'vidrio_lateral_der'
  | 'capo'
  | 'techo'
  | 'guardabarro_izq'
  | 'guardabarro_der';

export interface DanoVehiculo {
  id: string;
  tipo: TipoDano;
  zona: ZonaVehiculo;
  zonaTexto: string;
  descripcion: string;
  severidad: SeveridadDano;
  confianzaIA: number; // 0 a 100%
  coordenadas?: {
    x: number; // porcentaje 0-100
    y: number;
    width: number;
    height: number;
  };
  esSuciedadDescartada?: boolean;
}

export interface EspacioParqueo {
  id: string;
  codigo: string; // Ej: P-01, P-02...
  estado: 'disponible' | 'ocupado';
  vehiculoId?: string;
  placa?: string;
  marca?: string;
}

export interface VehiculoTicket {
  id: string;
  placa: string;
  marca: string;
  color: string;
  tipoServicio: TipoServicio;
  horaIngreso: string;
  horaSalida?: string;
  estado: 'activo' | 'finalizado';
  estadoParqueo: EstadoParqueo;
  espacioAsignado: string;
  
  // Evidencias de entrada
  fotoPlacaUrl: string;
  videoEntradaUrl: string;
  fotoInspeccionEntradaUrl: string;
  danosEntrada: DanoVehiculo[];
  diagnosticoEntradaTexto?: string;
  
  // Evidencias de salida
  videoSalidaUrl?: string;
  fotoInspeccionSalidaUrl?: string;
  danosSalida?: DanoVehiculo[];
  diagnosticoSalidaTexto?: string;
  
  // Auditoría IA
  nuevosDanosDetectados: boolean;
  diferenciaDetectada: boolean;
  suciedadIgnoradaContador?: number;
  
  // Datos del cliente tomados después del video
  propietarioNombre?: string;
  propietarioTelefono?: string;
  observaciones?: string;
}
