import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  Share,
  Linking,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { inspectionService } from '../../src/services/inspectionService';
import { VehiculoTicket } from '../../src/types';

export default function DetalleVehiculoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [ticket, setTicket] = useState<VehiculoTicket | null>(null);

  useEffect(() => {
    if (id) {
      const data = inspectionService.getTicketById(id);
      if (data) setTicket(data);
    }
  }, [id]);

  if (!ticket) {
    return (
      <View className="flex-1 bg-slate-950 items-center justify-center p-4">
        <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
        <Text className="text-white text-base font-bold mt-2">Vehículo no encontrado</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-slate-800 px-4 py-2 rounded-xl mt-4"
        >
          <Text className="text-slate-300 text-xs font-semibold">Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const compartirWhatsApp = async () => {
    const msg = inspectionService.generarReporteWhatsApp(ticket);
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
        return;
      }
      await Share.share({ message: msg, title: 'Acta de Inspección' });
    } catch (e) {
      // Ignorar error
    }
  };

  return (
    <ScrollView className="flex-1 bg-slate-950 px-4 pt-3" showsVerticalScrollIndicator={false}>
      {/* TARJETA PRINCIPAL DEL AUTO */}
      <View className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4">
        <View className="flex-row items-center justify-between mb-3">
          <View className="bg-amber-400 rounded-lg px-3 py-1 shadow-sm">
            <Text className="text-black font-extrabold text-base tracking-widest">{ticket.placa}</Text>
          </View>
          <View
            className={`px-3 py-1 rounded-full ${
              ticket.estado === 'activo' ? 'bg-emerald-950 border border-emerald-700' : 'bg-slate-800 border border-slate-700'
            }`}
          >
            <Text
              className={`text-xs font-extrabold uppercase ${
                ticket.estado === 'activo' ? 'text-emerald-400' : 'text-slate-400'
              }`}
            >
              {ticket.estado === 'activo' ? 'En Parqueadero' : 'Salida Finalizada'}
            </Text>
          </View>
        </View>

        <Text className="text-white font-extrabold text-xl">{ticket.marca}</Text>
        <Text className="text-slate-400 text-sm mb-3">Color: {ticket.color}</Text>

        <View className="bg-slate-950 rounded-xl p-3 border border-slate-800 space-y-1">
          <Text className="text-slate-300 text-xs">
            • Servicio: <Text className="font-bold text-white capitalize">{ticket.tipoServicio}</Text>
          </Text>
          <Text className="text-slate-300 text-xs">
            • Entrada: <Text className="font-bold text-white">{ticket.horaIngreso}</Text>
          </Text>
          {ticket.horaSalida && (
            <Text className="text-slate-300 text-xs">
              • Salida: <Text className="font-bold text-white">{ticket.horaSalida}</Text>
            </Text>
          )}
          {ticket.propietarioNombre ? (
            <Text className="text-slate-300 text-xs">
              • Propietario: <Text className="font-bold text-white">{ticket.propietarioNombre}</Text>
            </Text>
          ) : null}
        </View>
      </View>

      {/* FILTRO DE SUCIEDAD / LAVADERO */}
      <View className="bg-cyan-950/40 border border-cyan-800 rounded-2xl p-4 mb-4 flex-row items-center">
        <Ionicons name="water" size={28} color="#06b6d4" />
        <View className="ml-3 flex-1">
          <Text className="text-cyan-300 text-sm font-bold">Filtro Inteligente de Lavadero</Text>
          <Text className="text-slate-300 text-xs mt-0.5 leading-4">
            Se discriminaron {ticket.suciedadIgnoradaContador || 0} marcas superficiales de polvo/lodo para no
            confundir suciedad con rayones o golpes reales.
          </Text>
        </View>
      </View>

      {/* FOTO EVIDENCIA DE ENTRADA */}
      <View className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4">
        <Text className="text-white font-bold text-sm mb-2">📸 Evidencia de Entrada (Inspección 360°):</Text>
        {ticket.fotoInspeccionEntradaUrl && !ticket.fotoInspeccionEntradaUrl.toLowerCase().endsWith('.mp4') ? (
          <Image
            source={{ uri: ticket.fotoInspeccionEntradaUrl }}
            className="w-full h-48 rounded-xl bg-slate-950 mb-2"
            resizeMode="cover"
          />
        ) : (
          <View className="w-full h-48 rounded-xl bg-slate-950 mb-2 items-center justify-center border border-slate-800">
            <Ionicons name="car-sport" size={48} color="#3b82f6" />
            <Text className="text-slate-400 text-xs mt-2">Evidencia registrada en el sistema</Text>
          </View>
        )}
        {ticket.danosEntrada.length > 0 ? (
          <View className="bg-amber-950/40 border border-amber-800 rounded-lg p-2 mt-1">
            <Text className="text-amber-400 text-xs font-bold">Daños Preexistentes de Entrada:</Text>
            {ticket.danosEntrada.map((d) => (
              <Text key={d.id} className="text-slate-300 text-[11px] mt-0.5">
                • {d.zonaTexto}: {d.descripcion}
              </Text>
            ))}
          </View>
        ) : (
          <Text className="text-emerald-400 text-xs font-medium">✓ Carro ingresó sin daños físicos.</Text>
        )}
      </View>

      {/* FOTO EVIDENCIA DE SALIDA (SI YA FINALIZÓ) */}
      {ticket.fotoInspeccionSalidaUrl && (
        <View className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4">
          <Text className="text-white font-bold text-sm mb-2">🏁 Evidencia de Salida (Inspección Final):</Text>
          <View className="relative">
            <Image
              source={{ uri: ticket.fotoInspeccionSalidaUrl }}
              className="w-full h-48 rounded-xl bg-slate-950 mb-2"
              resizeMode="cover"
            />
            {/* Si hubo daño en salida, dibuja el recuadro rojo */}
            {ticket.danosSalida?.map((d) => (
              <View
                key={d.id}
                style={{
                  position: 'absolute',
                  left: `${d.coordenadas?.x || 45}%`,
                  top: `${d.coordenadas?.y || 48}%`,
                  width: `${d.coordenadas?.width || 20}%`,
                  height: `${d.coordenadas?.height || 18}%`,
                  borderWidth: 2,
                  borderColor: '#ef4444',
                  backgroundColor: 'rgba(239, 68, 68, 0.25)',
                  borderRadius: 4,
                }}
              />
            ))}
          </View>

          {ticket.nuevosDanosDetectados ? (
            <View className="bg-red-950/40 border border-red-800 rounded-lg p-2.5 mt-1">
              <Text className="text-red-400 text-xs font-bold">⚠️ Daño Nuevo Identificado en Salida:</Text>
              {ticket.danosSalida?.map((d) => (
                <Text key={d.id} className="text-slate-200 text-xs mt-1">
                  • {d.zonaTexto}: {d.descripcion}
                </Text>
              ))}
            </View>
          ) : (
            <Text className="text-emerald-400 text-xs font-bold">✓ Entregado en perfecto estado.</Text>
          )}
        </View>
      )}

      {/* BOTÓN ENVIAR POR WHATSAPP */}
      <TouchableOpacity
        onPress={compartirWhatsApp}
        className="bg-emerald-600 rounded-2xl py-3.5 items-center flex-row justify-center mb-8 shadow-lg shadow-emerald-900/50"
      >
        <Ionicons name="logo-whatsapp" size={20} color="#ffffff" style={{ marginRight: 8 }} />
        <Text className="text-white font-extrabold text-sm">ENVIAR ACTA DIGITAL POR WHATSAPP</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
