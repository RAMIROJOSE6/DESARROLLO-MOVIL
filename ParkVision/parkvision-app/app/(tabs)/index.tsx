import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Image,
  ScrollView,
  StyleSheet,
  StatusBar,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { inspectionService } from '../../src/services/inspectionService';
import { VehiculoTicket, EspacioParqueo } from '../../src/types';

export default function DashboardScreen() {
  const router = useRouter();
  const [tickets, setTickets] = useState<VehiculoTicket[]>([]);
  const [espacios, setEspacios] = useState<EspacioParqueo[]>([]);
  const [vistaActual, setVistaActual] = useState<'mapa' | 'vehiculos'>('mapa'); // Inicia en Mapa por ser interactivo
  const [busqueda, setBusqueda] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Modal para interactuar al presionar una bahía libre u ocupada
  const [espacioModal, setEspacioModal] = useState<EspacioParqueo | null>(null);

  useEffect(() => {
    cargarDatos();
    const unsubscribe = inspectionService.subscribe(cargarDatos);
    return () => unsubscribe();
  }, []);

  const cargarDatos = () => {
    setTickets(inspectionService.getVehiculosActivos());
    setEspacios(inspectionService.getEspacios());
  };

  const onRefresh = () => {
    setRefreshing(true);
    cargarDatos();
    setTimeout(() => setRefreshing(false), 500);
  };

  const vehiculosFiltrados = tickets.filter((t) => {
    const query = busqueda.toLowerCase();
    return (
      t.placa.toLowerCase().includes(query) ||
      t.marca.toLowerCase().includes(query) ||
      t.espacioAsignado.toLowerCase().includes(query)
    );
  });

  const totalOcupados = espacios.filter((e) => e.estado === 'ocupado').length;
  const totalLibres = espacios.filter((e) => e.estado === 'disponible').length;
  const enLavadero = tickets.filter((t) => t.estadoParqueo === 'En Lavado').length;

  // Manejador al presionar una bahía en el mapa
  const handlePressEspacio = (espacio: EspacioParqueo) => {
    setEspacioModal(espacio);
  };

  const irANuevoIngresoConBahia = (codigoBahia: string) => {
    setEspacioModal(null);
    router.push({
      pathname: '/(tabs)/nuevo-ingreso',
      params: { espacioPreseleccionado: codigoBahia },
    });
  };

  const irAGenerarSalida = (ticketId?: string) => {
    setEspacioModal(null);
    router.push({
      pathname: '/(tabs)/auditoria',
      params: ticketId ? { ticketIdPreseleccionado: ticketId } : {},
    });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 100 }}
      showsVerticalScrollIndicator={true}
    >
      <StatusBar barStyle="dark-content" />

      {/* 1. HERO HEADER */}
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ionicons name="car-sport" size={26} color="#2563EB" />
            <View>
              <Text style={styles.heroTitle}>ParkVision</Text>
              <Text style={styles.heroSubtitle}>Control de Estacionamiento y Servicios</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <TouchableOpacity
              onPress={() => {
                const ejecutarLimpieza = async () => {
                  await inspectionService.limpiarTodosLosDatos();
                  cargarDatos();
                };

                if (Platform.OS === 'web') {
                  const ok = typeof window !== 'undefined'
                    ? window.confirm('¿Deseas vaciar todos los vehículos y dejar las 20 bahías libres (0 autos) para empezar desde cero?')
                    : true;
                  if (ok) {
                    ejecutarLimpieza();
                  }
                  return;
                }

                Alert.alert(
                  'Reiniciar y Limpiar',
                  '¿Deseas vaciar todos los vehículos y dejar las 20 bahías libres (0 autos) para empezar desde cero?',
                  [
                    { text: 'Cancelar', style: 'cancel' },
                    {
                      text: 'Vaciar a Cero',
                      style: 'destructive',
                      onPress: ejecutarLimpieza,
                    },
                  ]
                );
              }}
              style={styles.cleanBtn}
            >
              <Ionicons name="trash-outline" size={15} color="#DC2626" />
            </TouchableOpacity>

            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>ACTIVO</Text>
            </View>
          </View>
        </View>

        {/* MÉTRICAS */}
        <View style={styles.metricsRow}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>OCUPADOS</Text>
            <Text style={styles.metricValue}>{totalOcupados}</Text>
            <Text style={styles.metricSub}>{totalLibres} Bahías libres</Text>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>EN LAVADERO</Text>
            <Text style={[styles.metricValue, { color: '#0284C7' }]}>{enLavadero}</Text>
            <Text style={styles.metricSub}>Bahía activa</Text>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>CAPACIDAD</Text>
            <Text style={[styles.metricValue, { color: '#64748B' }]}>{espacios.length}</Text>
            <Text style={styles.metricSub}>Total cupos</Text>
          </View>
        </View>
      </View>

      {/* BOTÓN PRINCIPAL: NUEVO INGRESO DE VEHÍCULO */}
      <TouchableOpacity
        onPress={() => router.push('/(tabs)/nuevo-ingreso')}
        style={styles.btnNuevoIngreso}
      >
        <LinearGradient
          colors={['#1D4ED8', '#1E40AF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.btnNuevoIngresoGradient}
        >
          <Ionicons name="log-in-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.btnNuevoIngresoText}>REGISTRAR INGRESO DE VEHÍCULO</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* SELECTOR DE VISTAS (MAPA INTERACTIVO VS LISTA) */}
      <View style={styles.viewToggleContainer}>
        <TouchableOpacity
          onPress={() => setVistaActual('mapa')}
          style={[styles.toggleBtn, vistaActual === 'mapa' && styles.toggleBtnActive]}
        >
          <Ionicons
            name="grid-outline"
            size={16}
            color={vistaActual === 'mapa' ? '#FFFFFF' : '#94A3B8'}
          />
          <Text
            style={[styles.toggleText, vistaActual === 'mapa' && styles.toggleTextActive]}
          >
            Bahías Disponibles ({totalLibres})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setVistaActual('vehiculos')}
          style={[styles.toggleBtn, vistaActual === 'vehiculos' && styles.toggleBtnActive]}
        >
          <Ionicons
            name="car-sport-outline"
            size={16}
            color={vistaActual === 'vehiculos' ? '#FFFFFF' : '#94A3B8'}
          />
          <Text
            style={[styles.toggleText, vistaActual === 'vehiculos' && styles.toggleTextActive]}
          >
            Vehículos en Parqueo ({tickets.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* VISTA 1: MAPA DINÁMICO DE BAHÍAS */}
      {vistaActual === 'mapa' ? (
        <View style={styles.mapScrollView}>
          <Text style={styles.instructionBanner}>
            Selecciona una bahía disponible para dar ingreso o una ocupada para auditar su salida:
          </Text>

          <View style={styles.gridContainer}>
            {espacios.map((espacio) => {
              const esOcupado = espacio.estado === 'ocupado';
              return (
                <TouchableOpacity
                  key={espacio.id}
                  onPress={() => handlePressEspacio(espacio)}
                  style={[
                    styles.spaceCard,
                    esOcupado ? styles.spaceCardOccupied : styles.spaceCardFree,
                  ]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.spaceCode, esOcupado ? styles.textRed : styles.textEmerald]}>
                    {espacio.codigo}
                  </Text>
                  <View
                    style={[
                      styles.spacePill,
                      esOcupado ? styles.spacePillRed : styles.spacePillGreen,
                    ]}
                  >
                    <Text
                      style={[
                        styles.spacePillText,
                        esOcupado ? styles.textRed : styles.textEmerald,
                      ]}
                      numberOfLines={1}
                    >
                      {esOcupado ? espacio.placa || 'OCUPADO' : 'LIBRE'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : (
        /* VISTA 2: LISTA DE VEHÍCULOS ACTIVOS */
        <View>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color="#64748B" />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por placa, modelo o bahía (ej: P-01)..."
              placeholderTextColor="#64748B"
              value={busqueda}
              onChangeText={setBusqueda}
            />
          </View>

          {vehiculosFiltrados.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <Ionicons name="car-outline" size={44} color="#475569" />
              <Text style={{ color: '#94A3B8', fontSize: 13, marginTop: 8 }}>
                No se encontraron vehículos activos.
              </Text>
            </View>
          ) : (
            vehiculosFiltrados.map((item) => (
              <View key={item.id} style={styles.vehicleCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.plateRow}>
                    <View style={styles.plateContainer}>
                      <Text style={styles.plateText}>{item.placa}</Text>
                      <Text style={styles.plateCountry}>COLOMBIA</Text>
                    </View>
                    <View>
                      <Text style={styles.carModel}>{item.marca}</Text>
                      <Text style={styles.carColor}>Color: {item.color}</Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      item.estadoParqueo === 'En Lavado'
                        ? styles.statusBadgeWash
                        : styles.statusBadgePark,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        {
                          color: item.estadoParqueo === 'En Lavado' ? '#38BDF8' : '#10B981',
                        },
                      ]}
                    >
                      {item.estadoParqueo.toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardBody}>
                  {item.fotoInspeccionEntradaUrl && !item.fotoInspeccionEntradaUrl.toLowerCase().endsWith('.mp4') ? (
                    <Image
                      source={{ uri: item.fotoInspeccionEntradaUrl }}
                      style={styles.carThumb}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.carThumb, styles.carThumbPlaceholder]}>
                      <Ionicons name="car-sport" size={24} color="#60A5FA" />
                      <Text style={styles.carThumbPlaceholderText}>FOTO ENTRADA</Text>
                    </View>
                  )}
                  <View style={styles.cardDetails}>
                    <Text style={styles.detailLocation}>
                      📍 Bahía: <Text style={styles.boldYellow}>{item.espacioAsignado}</Text>
                    </Text>
                    <Text style={styles.detailTime}>
                      🕒 Entrada: <Text style={styles.boldSlate}>{item.horaIngreso}</Text>
                    </Text>
                    {item.danosEntrada.length > 0 ? (
                      <Text style={styles.damageWarning}>
                        ⚠️ {item.danosEntrada.length} daño(s) previo(s) registrado(s)
                      </Text>
                    ) : (
                      <Text style={styles.damageClean}>✓ Carrocería intacta al entrar</Text>
                    )}
                  </View>
                </View>

                <View style={styles.cardActions}>
                  <TouchableOpacity
                    onPress={() => router.push(`/vehiculo/${item.id}`)}
                    style={styles.btnSecondary}
                  >
                    <Text style={styles.btnSecondaryText}>Ver Ficha</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => irAGenerarSalida(item.id)}
                    style={styles.btnPrimary}
                  >
                    <Ionicons name="exit-outline" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                    <Text style={styles.btnPrimaryText}>Generar Salida de Vehículo</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      )}

      {/* ========================================================== */}
      {/* MODAL INTERACTIVO AL TOCAR UNA BAHÍA (LIBRE U OCUPADA)    */}
      {/* ========================================================== */}
      <Modal
        visible={espacioModal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setEspacioModal(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIconBox}>
                <Ionicons
                  name={espacioModal?.estado === 'disponible' ? 'checkmark-circle' : 'car'}
                  size={28}
                  color={espacioModal?.estado === 'disponible' ? '#10B981' : '#EF4444'}
                />
              </View>
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.modalTitle}>Bahía {espacioModal?.codigo}</Text>
                <Text
                  style={[
                    styles.modalStatusSubtitle,
                    espacioModal?.estado === 'disponible' ? styles.textEmerald : styles.textRed,
                  ]}
                >
                  {espacioModal?.estado === 'disponible' ? 'ESTADO: LIBRE / DISPONIBLE' : 'ESTADO: OCUPADO'}
                </Text>
              </View>
            </View>

            {espacioModal?.estado === 'disponible' ? (
              /* OPCIÓN CUANDO LA BAHÍA ESTÁ LIBRE */
              <View style={styles.modalBody}>
                <Text style={styles.modalDesc}>
                  Esta bahía está vacía y lista para asignar. ¿Deseas iniciar la grabación de video y registrar un nuevo ingreso aquí?
                </Text>

                <TouchableOpacity
                  onPress={() => irANuevoIngresoConBahia(espacioModal.codigo)}
                  style={styles.modalBtnAction}
                >
                  <LinearGradient
                    colors={['#2563EB', '#1D4ED8']}
                    style={styles.modalBtnGradient}
                  >
                    <Ionicons name="videocam" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.modalBtnText}>REGISTRAR INGRESO EN {espacioModal.codigo}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ) : (
              /* OPCIÓN CUANDO LA BAHÍA ESTÁ OCUPADA */
              <View style={styles.modalBody}>
                <Text style={styles.modalDesc}>
                  Vehículo actual en la bahía:{'\n'}
                  • Placa: <Text style={styles.boldYellow}>{espacioModal?.placa || 'N/A'}</Text>
                  {espacioModal?.marca ? ` (${espacioModal.marca})` : ''}
                </Text>

                <TouchableOpacity
                  onPress={() => irAGenerarSalida(espacioModal?.vehiculoId)}
                  style={styles.modalBtnActionDanger}
                >
                  <LinearGradient
                    colors={['#DC2626', '#B91C1C']}
                    style={styles.modalBtnGradient}
                  >
                    <Ionicons name="exit-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.modalBtnText}>GENERAR SALIDA DE VEHÍCULO</Text>
                  </LinearGradient>
                </TouchableOpacity>

                {espacioModal?.vehiculoId && (
                  <TouchableOpacity
                    onPress={() => {
                      const id = espacioModal.vehiculoId;
                      setEspacioModal(null);
                      router.push(`/vehiculo/${id}`);
                    }}
                    style={styles.modalBtnSecondary}
                  >
                    <Text style={styles.modalBtnSecondaryText}>Ver Ficha de Inspección</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <TouchableOpacity
              onPress={() => setEspacioModal(null)}
              style={styles.modalCloseBtn}
            >
              <Text style={styles.modalCloseText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  heroTitle: {
    color: '#0F172A',
    fontSize: 20,
    fontWeight: '900',
  },
  heroSubtitle: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600',
  },
  cleanBtn: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 5,
  },
  liveText: {
    color: '#059669',
    fontSize: 9,
    fontWeight: '800',
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
  },
  metricLabel: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '800',
  },
  metricValue: {
    color: '#0F172A',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 1,
  },
  metricSub: {
    color: '#64748B',
    fontSize: 9,
  },
  metricDivider: {
    width: 1,
    height: 26,
    backgroundColor: '#CBD5E1',
  },
  btnNuevoIngreso: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  btnNuevoIngresoGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  btnNuevoIngresoText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  viewToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    padding: 3,
    marginBottom: 12,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 9,
    gap: 6,
  },
  toggleBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  toggleText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
  },
  toggleTextActive: {
    color: '#2563EB',
    fontWeight: '800',
  },
  mapScrollView: {
    flex: 1,
  },
  instructionBanner: {
    color: '#334155',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 12,
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    padding: 10,
    borderRadius: 10,
    fontWeight: '500',
  },
  bold: {
    fontWeight: '800',
    color: '#0F172A',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
    paddingBottom: 20,
  },
  spaceCard: {
    width: '23%',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  spaceCardFree: {
    backgroundColor: '#FFFFFF',
    borderColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  spaceCardOccupied: {
    backgroundColor: '#FFFFFF',
    borderColor: '#EF4444',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  spaceCode: {
    fontSize: 14,
    fontWeight: '900',
  },
  spacePill: {
    marginTop: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 6,
    maxWidth: '100%',
  },
  spacePillGreen: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
  },
  spacePillRed: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
  },
  spacePillText: {
    fontSize: 9,
    fontWeight: '800',
  },
  textEmerald: {
    color: '#059669',
  },
  textRed: {
    color: '#DC2626',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#CBD5E1',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
  },
  searchInput: {
    flex: 1,
    color: '#0F172A',
    fontSize: 13,
    marginLeft: 8,
  },
  vehicleCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  plateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  plateContainer: {
    backgroundColor: '#FBBF24',
    borderWidth: 1.5,
    borderColor: '#000000',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignItems: 'center',
    marginRight: 10,
    minWidth: 78,
  },
  plateText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
  plateCountry: {
    color: '#000000',
    fontSize: 7,
    fontWeight: '900',
  },
  carModel: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '800',
  },
  carColor: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusBadgePark: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  statusBadgeWash: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  statusText: {
    fontSize: 9,
    fontWeight: '900',
  },
  cardBody: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  carThumb: {
    width: 85,
    height: 65,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  carThumbPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
  },
  carThumbPlaceholderText: {
    color: '#64748B',
    fontSize: 8,
    fontWeight: '800',
    marginTop: 2,
    textAlign: 'center',
  },
  cardDetails: {
    flex: 1,
    marginLeft: 10,
    justifyContent: 'center',
  },
  detailLocation: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '600',
  },
  boldYellow: {
    color: '#B45309',
    fontWeight: '900',
  },
  detailTime: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 2,
  },
  boldSlate: {
    color: '#0F172A',
    fontWeight: '700',
  },
  damageWarning: {
    color: '#D97706',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  damageClean: {
    color: '#059669',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  btnSecondary: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
    borderWidth: 1,
    paddingVertical: 9,
    borderRadius: 10,
  },
  btnSecondaryText: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '700',
  },
  btnPrimary: {
    flex: 2,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    paddingVertical: 9,
    borderRadius: 10,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },

  /* MODAL */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 380,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '900',
  },
  modalStatusSubtitle: {
    fontSize: 11,
    fontWeight: '800',
    marginTop: 1,
  },
  modalBody: {
    marginBottom: 14,
  },
  modalDesc: {
    color: '#475569',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 14,
  },
  modalBtnAction: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
  },
  modalBtnActionDanger: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
  },
  modalBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  modalBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  modalBtnSecondary: {
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
    borderWidth: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  modalBtnSecondaryText: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '700',
  },
  modalCloseBtn: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
});
