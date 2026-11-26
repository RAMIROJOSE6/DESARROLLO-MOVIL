import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
  RefreshControl,
  Share,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { inspectionService } from '../../src/services/inspectionService';
import { VehiculoTicket } from '../../src/types';

export default function HistorialScreen() {
  const router = useRouter();
  const [tickets, setTickets] = useState<VehiculoTicket[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    cargarDatos();
    const unsubscribe = inspectionService.subscribe(cargarDatos);
    return () => unsubscribe();
  }, []);

  const cargarDatos = () => {
    const todos = inspectionService.getTickets();
    setTickets(todos.filter((t) => t.estado === 'finalizado'));
  };

  const onRefresh = () => {
    setRefreshing(true);
    cargarDatos();
    setTimeout(() => setRefreshing(false), 500);
  };

  const filtrados = tickets.filter(
    (t) =>
      t.placa.toLowerCase().includes(busqueda.toLowerCase()) ||
      t.marca.toLowerCase().includes(busqueda.toLowerCase())
  );

  const compartirWhatsApp = async (t: VehiculoTicket) => {
    const msg = inspectionService.generarReporteWhatsApp(t);
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
        return;
      }
      await Share.share({ message: msg, title: 'Acta de Salida' });
    } catch (e) {
      // Ignorar error de cancelación
    }
  };

  return (
    <View className="flex-1 bg-slate-50 px-4 pt-3">
      {/* BUSCADOR */}
      <View className="bg-white border border-slate-200 shadow-sm rounded-xl px-3 py-2 flex-row items-center mb-3">
        <Ionicons name="search" size={18} color="#64748B" />
        <TextInput
          className="flex-1 text-slate-900 ml-2 text-sm"
          placeholder="Buscar vehículo en el historial..."
          placeholderTextColor="#94A3B8"
          value={busqueda}
          onChangeText={setBusqueda}
        />
        {busqueda ? (
          <TouchableOpacity onPress={() => setBusqueda('')}>
            <Ionicons name="close-circle" size={18} color="#64748B" />
          </TouchableOpacity>
        ) : null}
      </View>

      <FlatList
        data={filtrados}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563EB" />}
        showsVerticalScrollIndicator={true}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={
          <View className="items-center justify-center py-16">
            <Ionicons name="document-text-outline" size={48} color="#94A3B8" />
            <Text className="text-slate-500 text-sm mt-3">Aún no hay actas de salida finalizadas</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View className="bg-white border border-slate-200 rounded-2xl p-4 mb-3 shadow-sm">
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center">
                <View className="bg-amber-400 border border-amber-500 rounded px-2 py-0.5 mr-2.5">
                  <Text className="text-black font-extrabold text-xs">{item.placa}</Text>
                </View>
                <Text className="text-slate-900 font-bold text-sm">{item.marca}</Text>
              </View>

              <View
                className={`px-2 py-0.5 rounded-full ${
                  item.nuevosDanosDetectados ? 'bg-red-50 border border-red-300' : 'bg-emerald-50 border border-emerald-300'
                }`}
              >
                <Text
                  className={`text-[10px] font-bold ${
                    item.nuevosDanosDetectados ? 'text-red-700' : 'text-emerald-700'
                  }`}
                >
                  {item.nuevosDanosDetectados ? '⚠️ CON DAÑO' : '✓ SIN DAÑOS'}
                </Text>
              </View>
            </View>

            <View className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 mb-3 flex-row items-center">
              <Image source={{ uri: item.fotoInspeccionEntradaUrl }} className="w-14 h-12 rounded-lg bg-slate-200" />
              <View className="flex-1 ml-3">
                <Text className="text-slate-500 text-[11px]">Entrada: {item.horaIngreso}</Text>
                <Text className="text-slate-800 text-[11px] font-semibold">Salida: {item.horaSalida}</Text>
                <Text className="text-slate-500 text-[10px]">
                  Bahía: {item.espacioAsignado || 'General'} • {item.tipoServicio?.replace('_', ' ').toUpperCase() || 'ESTACIONAMIENTO'}
                </Text>
              </View>
            </View>

            <View className="flex-row justify-between gap-2">
              <TouchableOpacity
                onPress={() => router.push(`/vehiculo/${item.id}`)}
                className="flex-1 bg-slate-100 border border-slate-300 py-2 rounded-xl items-center"
              >
                <Text className="text-slate-700 font-bold text-xs">Ver Evidencias</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => compartirWhatsApp(item)}
                className="flex-1 bg-emerald-600 py-2 rounded-xl items-center flex-row justify-center shadow-sm"
              >
                <Ionicons name="logo-whatsapp" size={14} color="#ffffff" style={{ marginRight: 4 }} />
                <Text className="text-white font-bold text-xs">Reenviar Acta</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </View>
  );
}
