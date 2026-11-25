import { VehiculoTicket, EspacioParqueo } from '../types';

// Bahías numeradas P-01 a P-20 en estado inicial disponible (sin datos falsos)
export const ESPACIOS_INICIALES: EspacioParqueo[] = Array.from({ length: 20 }, (_, i) => {
  const num = (i + 1).toString().padStart(2, '0');
  const codigo = `P-${num}`;
  return { id: codigo, codigo, estado: 'disponible' };
});

// Arreglo vacío: Cero datos de prueba. Todo será 100% real desde la base de datos Supabase
export const VEHICULOS_INICIALES: VehiculoTicket[] = [];
