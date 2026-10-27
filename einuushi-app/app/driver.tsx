import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Modal,
  Platform,
  Alert,
  Linking,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  User,
  Order,
  getOrders,
  getDrivers,
  findUserByEmail,
  updateOrderStatusInDb,
  logAdminActivity,
  saveNotificationToDb,
} from '../services/database';

const DRIVER_SESSION_KEY = '@einuushi_driver_session_v1';

export default function DriverScreen() {
  const router = useRouter();

  // Estados de Sesión de Repartidor
  const [driverUser, setDriverUser] = useState<User | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);

  // Estados de Pedidos
  const [assignedOrders, setAssignedOrders] = useState<Order[]>([]);
  const [filterTab, setFilterTab] = useState<'ALL' | 'PENDING' | 'IN_ROUTE' | 'DELIVERED'>('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modal: Confirmación de Entrega y Cobro
  const [isDeliverModalVisible, setIsDeliverModalVisible] = useState(false);
  const [selectedOrderForDelivery, setSelectedOrderForDelivery] = useState<Order | null>(null);
  const [deliveryTransferRef, setDeliveryTransferRef] = useState('');
  const [deliveryEvidenceNote, setDeliveryEvidenceNote] = useState('');
  const [isSubmittingDelivery, setIsSubmittingDelivery] = useState(false);

  // Modal: Reportar Entrega de Dinero a la Tienda
  const [isHandoverModalVisible, setIsHandoverModalVisible] = useState(false);
  const [selectedOrderForHandover, setSelectedOrderForHandover] = useState<Order | null>(null);
  const [handoverType, setHandoverType] = useState<'EFECTIVO' | 'TRANSFERENCIA'>('EFECTIVO');
  const [handoverTransferRef, setHandoverTransferRef] = useState('');
  const [handoverNotes, setHandoverNotes] = useState('');
  const [isSubmittingHandover, setIsSubmittingHandover] = useState(false);

  const showNotification = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message, [{ text: 'Aceptar' }]);
    }
  };

  // Cargar sesión del repartidor al iniciar
  useEffect(() => {
    async function checkDriverSession() {
      try {
        const stored = await AsyncStorage.getItem(DRIVER_SESSION_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as User;
          if (parsed && parsed.role === 'driver') {
            setDriverUser(parsed);
          }
        }
      } catch (err) {
        console.warn('Error cargando sesión de repartidor:', err);
      } finally {
        setIsLoadingSession(false);
      }
    }
    checkDriverSession();
  }, []);

  // Cargar pedidos asignados al repartidor logueado
  const loadDriverOrders = useCallback(async () => {
    if (!driverUser) return;
    setIsRefreshing(true);
    try {
      const allOrders = await getOrders();
      // Filtrar pedidos asignados a este repartidor por ID, email o nombre
      const driverEmailNorm = driverUser.email.toLowerCase().trim();
      const driverNameNorm = driverUser.fullName.toLowerCase().trim();

      const matched = allOrders.filter(o => {
        const oDriverEmail = (o.driverEmail || '').toLowerCase().trim();
        const oDriverId = o.driverId || '';
        const oDriverName = (o.driverName || '').toLowerCase().trim();

        // Si el pedido tiene asignado explícitamente este repartidor
        if (oDriverEmail === driverEmailNorm || oDriverId === driverUser.id) return true;
        if (oDriverName && driverNameNorm && oDriverName.includes(driverNameNorm)) return true;

        // Si es José Guajiro por defecto y el pedido no tiene asignación específica pero es reparto local
        if (driverEmailNorm.includes('jose') && (!o.driverEmail || o.driverName === 'José Guajiro')) {
          return true;
        }

        return false;
      });

      setAssignedOrders(matched);
    } catch (err) {
      console.warn('Error cargando pedidos asignados:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [driverUser]);

  useEffect(() => {
    if (driverUser) {
      loadDriverOrders();
      const interval = setInterval(loadDriverOrders, 3000);
      return () => clearInterval(interval);
    }
  }, [driverUser, loadDriverOrders]);

  // Iniciar Sesión de Repartidor
  const handleDriverLogin = async () => {
    const normEmail = emailInput.trim().toLowerCase();
    if (!normEmail) {
      setLoginError('Por favor ingresa tu correo de repartidor o transportadora.');
      return;
    }
    if (!passwordInput) {
      setLoginError('Por favor ingresa tu contraseña.');
      return;
    }

    setIsSubmittingLogin(true);
    setLoginError('');

    try {
      const foundUser = await findUserByEmail(normEmail);
      if (!foundUser || foundUser.role !== 'driver') {
        setLoginError('No se encontró una cuenta de repartidor o transportadora con este correo.');
        setIsSubmittingLogin(false);
        return;
      }

      if (foundUser.password !== passwordInput.trim()) {
        setLoginError('Contraseña incorrecta. Por favor verifica tus credenciales.');
        setIsSubmittingLogin(false);
        return;
      }

      setDriverUser(foundUser);
      await AsyncStorage.setItem(DRIVER_SESSION_KEY, JSON.stringify(foundUser));
    } catch (err: any) {
      setLoginError(err?.message || 'Error al iniciar sesión.');
    } finally {
      setIsSubmittingLogin(false);
    }
  };

  // Cerrar Sesión
  const handleDriverLogout = async () => {
    setDriverUser(null);
    await AsyncStorage.removeItem(DRIVER_SESSION_KEY);
  };

  // Iniciar Ruta (Marcar como DESPACHADO / EN CAMINO)
  const handleStartRoute = async (orderId: string) => {
    const target = assignedOrders.find(o => o.id === orderId);
    if (!target) return;

    const driverName = driverUser?.fullName || 'Repartidor Einuushi';
    const isCorp = driverUser?.driverType === 'corporate';

    const statusMsg = isCorp
      ? `¡En camino con ${driverName}! Guía de rastreo: ${target.trackingGuideNumber || 'En tránsito'}.`
      : `🛵 ¡Repartidor ${driverName} va en camino a tu dirección!`;

    await updateOrderStatusInDb(orderId, {
      statusCode: 'DISPATCHED',
      status: statusMsg,
      eta: isCorp ? 'En tránsito nacional (1 a 3 días)' : 'En ruta (aprox. 15-20 min)',
      dispatchedAt: Date.now(),
      driverName: driverName,
      driverPhone: driverUser?.phone,
      driverEmail: driverUser?.email,
    });

    await saveNotificationToDb({
      id: `notif-route-${orderId}-${Date.now()}`,
      orderId: orderId,
      title: isCorp ? '🚚 Pedido en tránsito con transportadora' : '🛵 ¡Tu repartidor va en camino!',
      message: `${driverName} ha iniciado el recorrido hacia tu dirección. ¡Puedes seguir el pedido en tiempo real!`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      read: false,
    });

    await loadDriverOrders();
    showNotification('Ruta Iniciada', `Has iniciado la entrega del pedido #${orderId}. El cliente ha sido notificado en tiempo real.`);
  };

  // Notificar Llegada a Destino
  const handleMarkArrived = async (orderId: string) => {
    const driverName = driverUser?.fullName || 'Repartidor Einuushi';

    await updateOrderStatusInDb(orderId, {
      statusCode: 'ARRIVED',
      status: `🛵 ¡El repartidor ${driverName} ha llegado a tu puerta!`,
      eta: 'Repartidor esperando en la dirección de entrega',
      driverName: driverName,
    });

    await saveNotificationToDb({
      id: `notif-arrived-${orderId}-${Date.now()}`,
      orderId: orderId,
      title: '🛵 ¡Tu repartidor está en la puerta!',
      message: `${driverName} ha llegado a tu dirección con tu pedido #${orderId}. Por favor sal a recibir tu paquete.`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      read: false,
    });

    await loadDriverOrders();
    showNotification('Llegada Notificada', `Se notificó al cliente que estás esperando en su dirección para entregar el pedido #${orderId}.`);
  };

  // Abrir Modal de Confirmación de Entrega
  const openDeliverModal = (order: Order) => {
    setSelectedOrderForDelivery(order);
    setDeliveryTransferRef(order.transferReference || '');
    setDeliveryEvidenceNote('');
    setIsDeliverModalVisible(true);
  };

  // Confirmar Entrega Realizada y Recaudo
  const handleConfirmDelivery = async () => {
    if (!selectedOrderForDelivery) return;

    const isContraentrega = (selectedOrderForDelivery.client.payment || '').toLowerCase().includes('contra') ||
      (selectedOrderForDelivery.client.payment || '').toLowerCase().includes('efectivo');

    const now = new Date();
    const formattedDate = `${now.toLocaleDateString('es-CO')} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const driverName = driverUser?.fullName || 'Repartidor Einuushi';

    setIsSubmittingDelivery(true);

    try {
      const evidence = isContraentrega
        ? `Cobro de $ ${(selectedOrderForDelivery.total || 0).toLocaleString('es-CO')} COP en EFECTIVO recaudado por ${driverName}. ${deliveryEvidenceNote ? `Nota: ${deliveryEvidenceNote}` : ''}`
        : `Entrega completada por ${driverName}. ${deliveryTransferRef ? `Comprobante transfer: #${deliveryTransferRef}.` : ''} ${deliveryEvidenceNote ? `Nota: ${deliveryEvidenceNote}` : ''}`;

      await updateOrderStatusInDb(selectedOrderForDelivery.id, {
        statusCode: 'DELIVERED',
        status: `¡Pedido Entregado a Satisfacción por ${driverName}! ✅`,
        eta: 'Entrega finalizada',
        paymentStatus: 'PAID',
        receivedAt: formattedDate,
        driverCollectionEvidence: evidence,
        transferReference: deliveryTransferRef.trim() || selectedOrderForDelivery.transferReference,
        settlementStatus: isContraentrega ? 'PENDING_SETTLEMENT' : 'SETTLED',
      });

      await logAdminActivity({
        adminEmail: driverUser?.email || 'repartidor@einuushi.com',
        adminName: `${driverName} (Repartidor)`,
        actionType: 'DRIVER_DELIVERED',
        entityType: 'PEDIDO',
        entityId: selectedOrderForDelivery.id,
        details: `${driverName} entregó el pedido #${selectedOrderForDelivery.id} el ${formattedDate}.${isContraentrega ? ` Dinero en efectivo ($ ${(selectedOrderForDelivery.total || 0).toLocaleString('es-CO')} COP) en su poder para liquidar en tienda.` : ' Pago electrónico verificado.'}`,
      });

      await saveNotificationToDb({
        id: `notif-deliv-${selectedOrderForDelivery.id}-${Date.now()}`,
        orderId: selectedOrderForDelivery.id,
        title: '🎉 ¡Pedido Entregado con Éxito!',
        message: `El repartidor ${driverName} confirmó la entrega de tu pedido #${selectedOrderForDelivery.id}. ¡Gracias por apoyar el arte ancestral wayuu!`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        read: false,
      });

      setIsDeliverModalVisible(false);
      await loadDriverOrders();

      const successMsg = isContraentrega
        ? `¡Entrega confirmada! Has recaudado $ ${(selectedOrderForDelivery.total || 0).toLocaleString('es-CO')} COP en efectivo. Recuerda entregar el dinero en la tienda para tu Paz y Salvo.`
        : `¡Entrega confirmada con éxito para el pedido #${selectedOrderForDelivery.id}!`;
      showNotification('Entrega Exitosa', successMsg);
    } catch (err: any) {
      showNotification('Error', 'No se pudo confirmar la entrega del pedido.');
    } finally {
      setIsSubmittingDelivery(false);
    }
  };

  // Abrir Modal de Reporte de Entrega de Dinero a Tienda
  const openHandoverModal = (order: Order) => {
    setSelectedOrderForHandover(order);
    setHandoverType('EFECTIVO');
    setHandoverTransferRef('');
    setHandoverNotes('');
    setIsHandoverModalVisible(true);
  };

  // Registrar Reporte de Entrega de Dinero
  const handleConfirmHandover = async () => {
    if (!selectedOrderForHandover) return;

    if (handoverType === 'TRANSFERENCIA' && !handoverTransferRef.trim()) {
      showNotification('Comprobante requerido', 'Por favor ingresa el número de transferencia bancaria hacia la tienda.');
      return;
    }

    setIsSubmittingHandover(true);
    const driverName = driverUser?.fullName || 'Repartidor Einuushi';
    const now = new Date();
    const formattedDate = `${now.toLocaleDateString('es-CO')} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    try {
      const note = handoverType === 'EFECTIVO'
        ? `El repartidor ${driverName} reportó haber entregado el dinero físicamente en la tienda el ${formattedDate}. ${handoverNotes ? `Nota: ${handoverNotes}` : ''}`
        : `El repartidor ${driverName} transfirió a la cuenta de la tienda con comprobante #${handoverTransferRef}. ${handoverNotes ? `Nota: ${handoverNotes}` : ''}`;

      await updateOrderStatusInDb(selectedOrderForHandover.id, {
        statusCode: 'DELIVERED',
        status: `¡Pedido Entregado! ${handoverType === 'EFECTIVO' ? 'Efectivo reportado entregado en tienda' : `Transferencia reportada #${handoverTransferRef}`}.`,
        eta: 'Liquidación en revisión por administración',
        transferReference: handoverTransferRef.trim() || selectedOrderForHandover.transferReference,
        settlementNotes: note,
      });

      await logAdminActivity({
        adminEmail: driverUser?.email || 'repartidor@einuushi.com',
        adminName: `${driverName} (Repartidor)`,
        actionType: 'DRIVER_HANDOVER_REPORT',
        entityType: 'LIQUIDACION',
        entityId: selectedOrderForHandover.id,
        details: note,
      });

      setIsHandoverModalVisible(false);
      await loadDriverOrders();
      showNotification('Reporte Enviado', 'Tu reporte de liquidación fue enviado al administrador. La tienda revisará y emitirá el Paz y Salvo oficial.');
    } catch (err) {
      showNotification('Error', 'No se pudo enviar el reporte.');
    } finally {
      setIsSubmittingHandover(false);
    }
  };

  // Abrir mapa para navegación
  const openInMaps = (address: string, city: string = 'Riohacha') => {
    const query = encodeURIComponent(`${address}, ${city}, La Guajira, Colombia`);
    const url = Platform.select({
      ios: `maps:0,0?q=${query}`,
      android: `geo:0,0?q=${query}`,
      web: `https://www.google.com/maps/search/?api=1&query=${query}`,
    });
    if (url) {
      Linking.openURL(url).catch(() => {
        Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
      });
    }
  };

  // Llamar al cliente
  const callClient = (phone: string) => {
    Linking.openURL(`tel:${phone}`).catch(() => {
      showNotification('Llamada', `Número de teléfono del cliente: ${phone}`);
    });
  };

  // Abrir rastreo corporativo de transportadora
  const openTrackingUrl = (url?: string, guide?: string) => {
    if (!url) return;
    const finalUrl = guide ? `${url}?guia=${encodeURIComponent(guide)}` : url;
    Linking.openURL(finalUrl).catch(() => {
      showNotification('Rastreo Web', `Portal de rastreo: ${finalUrl}`);
    });
  };

  // Filtrado de pedidos
  const filteredOrders = assignedOrders.filter(o => {
    if (filterTab === 'ALL') return true;
    if (filterTab === 'PENDING') return o.statusCode === 'PENDING';
    if (filterTab === 'IN_ROUTE') return o.statusCode === 'DISPATCHED' || o.statusCode === 'ARRIVED';
    if (filterTab === 'DELIVERED') return o.statusCode === 'DELIVERED';
    return true;
  });

  // Métricas para el repartidor
  const pendingOrdersCount = assignedOrders.filter(o => o.statusCode === 'PENDING' || o.statusCode === 'DISPATCHED' || o.statusCode === 'ARRIVED').length;
  const deliveredOrdersCount = assignedOrders.filter(o => o.statusCode === 'DELIVERED').length;
  // Dinero en efectivo que tiene el repartidor en su poder pendiente por liquidar con la tienda
  const cashInHandToSettle = assignedOrders
    .filter(o => o.statusCode === 'DELIVERED' && o.settlementStatus === 'PENDING_SETTLEMENT' && (o.client.payment.toLowerCase().includes('contra') || o.client.payment.toLowerCase().includes('efectivo')))
    .reduce((sum, o) => sum + (o.total || 0), 0);

  // =========================================================================
  // VISTA 1: PANTALLA DE ACCESO PARA REPARTIDORES & TRANSPORTADORAS
  // =========================================================================
  if (!driverUser) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.loginContainer}
      >
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={styles.loginScrollContainer} showsVerticalScrollIndicator={false}>
          {/* Logo y Encabezado */}
          <View style={styles.loginHeaderBox}>
            <Image
              source={require('../assets/images/logo_einuushi.jpeg')}
              style={styles.loginLogo}
              resizeMode="contain"
            />
            <View style={styles.loginPillBadge}>
              <Ionicons name="bicycle" size={14} color="#C5A880" style={{ marginRight: 5 }} />
              <Text style={styles.loginPillBadgeText}>LOGÍSTICA & DESPACHOS</Text>
            </View>
            <Text style={styles.loginTitle}>Portal de Repartidores</Text>
            <Text style={styles.loginSubtitle}>
              Acceso exclusivo para domiciliarios y empresas transportadoras de Einuushi
            </Text>
          </View>

          {/* Formulario de Login */}
          <View style={styles.loginCard}>
            {loginError ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color="#DC2626" style={{ marginRight: 6 }} />
                <Text style={styles.errorBoxText}>{loginError}</Text>
              </View>
            ) : null}

            <Text style={styles.inputLabel}>Correo Electrónico de Repartidor</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={20} color="#1E2B58" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="repartidor@einuushi.com"
                placeholderTextColor="#94A3B8"
                value={emailInput}
                onChangeText={setEmailInput}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <Text style={styles.inputLabel}>Contraseña</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color="#1E2B58" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#94A3B8"
                value={passwordInput}
                onChangeText={setPasswordInput}
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={styles.loginSubmitButton}
              onPress={handleDriverLogin}
              disabled={isSubmittingLogin}
              activeOpacity={0.8}
            >
              {isSubmittingLogin ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="log-in-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.loginSubmitButtonText}>Ingresar al Panel de Envíos</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Accesos rápidos de prueba */}
            <View style={styles.quickAccessBox}>
              <Text style={styles.quickAccessTitle}>Cuentas demo de prueba rápida:</Text>

              <TouchableOpacity
                style={styles.quickAccessBtn}
                onPress={() => {
                  setEmailInput('jose.guajiro@einuushi.com');
                  setPasswordInput('repartidor2026');
                }}
              >
                <Ionicons name="bicycle-outline" size={16} color="#1E2B58" style={{ marginRight: 6 }} />
                <Text style={styles.quickAccessBtnText}>🛵 José Guajiro (Repartidor Local)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quickAccessBtn, { borderColor: '#3B82F6', marginTop: 6 }]}
                onPress={() => {
                  setEmailInput('envios@servientrega.com');
                  setPasswordInput('servientrega2026');
                }}
              >
                <Ionicons name="business-outline" size={16} color="#2563EB" style={{ marginRight: 6 }} />
                <Text style={[styles.quickAccessBtnText, { color: '#2563EB' }]}>🚚 Servientrega (Transportadora Corporativa)</Text>
              </TouchableOpacity>
            </View>

            {/* Regresar al inicio de sesión principal */}
            <TouchableOpacity
              style={styles.backToStoreBtn}
              onPress={() => router.replace('/')}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={16} color="#64748B" style={{ marginRight: 6 }} />
              <Text style={styles.backToStoreBtnText}>Volver</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // =========================================================================
  // VISTA 2: PANEL DE CONTROL DE REPARTIDOR (AUTENTICADO)
  // =========================================================================
  const isCorporate = driverUser.driverType === 'corporate';

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* TOP HEADER */}
      <View style={styles.topHeader}>
        <View style={styles.driverProfileRow}>
          <View style={styles.driverAvatarBadge}>
            <Ionicons name={isCorporate ? "business" : "bicycle"} size={22} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.driverNameText}>{driverUser.fullName}</Text>
              <View style={[styles.driverTypeTag, isCorporate && { backgroundColor: '#1E40AF' }]}>
                <Text style={styles.driverTypeTagText}>
                  {isCorporate ? 'Transportadora Corporativa' : 'Repartidor Propio'}
                </Text>
              </View>
            </View>
            <Text style={styles.driverSubDetail}>
              {driverUser.vehicleType || (isCorporate ? 'Logística Nacional' : 'Moto')} • {driverUser.plateOrNit || driverUser.phone}
            </Text>
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleDriverLogout}>
            <Ionicons name="log-out-outline" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* METRICS BAR */}
        <View style={styles.metricsBar}>
          <View style={styles.metricItem}>
            <Text style={styles.metricVal}>{assignedOrders.length}</Text>
            <Text style={styles.metricLbl}>Asignados</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={[styles.metricVal, { color: '#F59E0B' }]}>{pendingOrdersCount}</Text>
            <Text style={styles.metricLbl}>Por Entregar</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={[styles.metricVal, { color: '#10B981' }]}>{deliveredOrdersCount}</Text>
            <Text style={styles.metricLbl}>Entregados</Text>
          </View>
        </View>
      </View>

      {/* BANNER DE DINERO EN EFECTIVO EN MANO (ARQUEO REPARTIDOR) */}
      {cashInHandToSettle > 0 && !isCorporate && (
        <View style={styles.cashInHandBanner}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <Ionicons name="wallet" size={22} color="#B45309" style={{ marginRight: 8 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cashInHandTitle}>Dinero en Efectivo para Liquidar en Tienda:</Text>
              <Text style={styles.cashInHandAmount}>$ {cashInHandToSettle.toLocaleString('es-CO')} COP</Text>
              <Text style={styles.cashInHandSub}>
                Entrégalo en el local de Einuushi o transfiérelo para obtener tu Paz y Salvo.
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* FILTER TABS */}
      <View style={styles.filterTabsRow}>
        {[
          { key: 'ALL', label: 'Todos' },
          { key: 'PENDING', label: 'Pendientes' },
          { key: 'IN_ROUTE', label: 'En Ruta' },
          { key: 'DELIVERED', label: 'Entregados' },
        ].map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.filterTabBtn, filterTab === tab.key && styles.filterTabBtnActive]}
            onPress={() => setFilterTab(tab.key as any)}
          >
            <Text style={[styles.filterTabBtnText, filterTab === tab.key && styles.filterTabBtnTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ORDERS LIST */}
      <ScrollView
        contentContainerStyle={styles.scrollList}
        showsVerticalScrollIndicator={false}
      >
        {filteredOrders.length > 0 ? (
          filteredOrders.map(order => {
            const isContra = (order.client.payment || '').toLowerCase().includes('contra') ||
              (order.client.payment || '').toLowerCase().includes('efectivo');

            return (
              <View key={order.id} style={styles.orderCard}>
                {/* Cabecera de la tarjeta */}
                <View style={styles.orderCardHeader}>
                  <View>
                    <Text style={styles.orderIdText}>Pedido #{order.id}</Text>
                    <Text style={styles.orderDateText}>{order.date}</Text>
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      order.statusCode === 'DELIVERED'
                        ? { backgroundColor: '#DCFCE7' }
                        : order.statusCode === 'ARRIVED'
                        ? { backgroundColor: '#E0E7FF' }
                        : order.statusCode === 'DISPATCHED'
                        ? { backgroundColor: '#FEF3C7' }
                        : { backgroundColor: '#FEE2E2' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        order.statusCode === 'DELIVERED'
                          ? { color: '#166534' }
                          : order.statusCode === 'ARRIVED'
                          ? { color: '#3730A3' }
                          : order.statusCode === 'DISPATCHED'
                          ? { color: '#B45309' }
                          : { color: '#991B1B' },
                      ]}
                    >
                      {order.statusCode === 'DELIVERED'
                        ? 'Entregado ✅'
                        : order.statusCode === 'ARRIVED'
                        ? 'En Destino 📍'
                        : order.statusCode === 'DISPATCHED'
                        ? 'En Camino 🛵'
                        : 'Por Iniciar'}
                    </Text>
                  </View>
                </View>

                {/* Datos del Cliente y Ubicación */}
                <View style={styles.clientInfoBlock}>
                  <Text style={styles.clientNameText}>
                    👤 {order.client.name} (CC: {order.client.cedula})
                  </Text>
                  <Text style={styles.clientAddressText}>
                    📍 {order.client.address}, {order.city || 'Riohacha'}
                  </Text>
                  
                  {/* Botones de Contacto y Navegación Directa */}
                  <View style={styles.contactActionsRow}>
                    <TouchableOpacity
                      style={styles.openMapsBtn}
                      onPress={() => openInMaps(order.client.address, order.city)}
                    >
                      <Ionicons name="navigate-outline" size={15} color="#1E2B58" style={{ marginRight: 4 }} />
                      <Text style={styles.openMapsBtnText}>Abrir en Google Maps</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.callClientBtn}
                      onPress={() => callClient(order.client.phone)}
                    >
                      <Ionicons name="call-outline" size={15} color="#166534" style={{ marginRight: 4 }} />
                      <Text style={styles.callClientBtnText}>Llamar Cliente</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Si es transportadora corporativa, mostrar guía de rastreo */}
                {isCorporate && order.trackingGuideNumber && (
                  <View style={styles.guideNumberBox}>
                    <Ionicons name="barcode-outline" size={18} color="#1E2B58" style={{ marginRight: 6 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.guideNumberTitle}>Número de Guía de Transporte:</Text>
                      <Text style={styles.guideNumberValue}>{order.trackingGuideNumber}</Text>
                    </View>
                    {order.carrierTrackingUrl ? (
                      <TouchableOpacity
                        style={styles.carrierWebBtn}
                        onPress={() => openTrackingUrl(order.carrierTrackingUrl, order.trackingGuideNumber)}
                      >
                        <Text style={styles.carrierWebBtnText}>Portal Web</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                )}

                {/* Productos a Entregar */}
                <View style={styles.itemsBlock}>
                  <Text style={styles.itemsBlockTitle}>Artículos a Entregar:</Text>
                  {order.items.map((it, idx) => (
                    <Text key={idx} style={styles.itemLine}>
                      • {it.cartQuantity}x {it.name}
                    </Text>
                  ))}
                </View>

                {/* INSTRUCCIÓN DE COBRO FINANCIERO AL REPARTIDOR */}
                <View
                  style={[
                    styles.paymentInstructionBox,
                    isContra && order.statusCode !== 'DELIVERED'
                      ? styles.paymentInstructionCash
                      : styles.paymentInstructionPaid,
                  ]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons
                      name={isContra && order.statusCode !== 'DELIVERED' ? "cash" : "checkmark-circle"}
                      size={20}
                      color={isContra && order.statusCode !== 'DELIVERED' ? "#B45309" : "#166534"}
                      style={{ marginRight: 8 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.paymentInstructionTitle,
                          isContra && order.statusCode !== 'DELIVERED'
                            ? { color: '#B45309' }
                            : { color: '#166534' },
                        ]}
                      >
                        {isContra && order.statusCode !== 'DELIVERED'
                          ? `DEBES COBRAR: $ ${(order.total || 0).toLocaleString('es-CO')} COP`
                          : `PAGADO PREVIAMENTE: $ ${(order.total || 0).toLocaleString('es-CO')} COP`}
                      </Text>
                      <Text style={styles.paymentInstructionSub}>
                        {isContra && order.statusCode !== 'DELIVERED'
                          ? 'Recaudar el efectivo del cliente antes de entregar el paquete.'
                          : 'El cliente ya pagó. No cobrar dinero adicional.'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* ESTADO DE LIQUIDACIÓN DE DINERO CON TIENDA (CUANDO YA ENTREGÓ) */}
                {order.statusCode === 'DELIVERED' && isContra && order.settlementStatus === 'PENDING_SETTLEMENT' && (
                  <View style={styles.pendingHandoverBanner}>
                    <Text style={styles.pendingHandoverTitle}>
                      💵 Tienes este dinero en efectivo ($ {(order.total || 0).toLocaleString('es-CO')} COP)
                    </Text>
                    <Text style={styles.pendingHandoverSub}>
                      Regístralo al entregarlo en la caja de la tienda para que el administrador te otorgue el Paz y Salvo.
                    </Text>
                    <TouchableOpacity
                      style={styles.handoverActionBtn}
                      onPress={() => openHandoverModal(order)}
                    >
                      <Ionicons name="receipt-outline" size={15} color="#FFFFFF" style={{ marginRight: 4 }} />
                      <Text style={styles.handoverActionBtnText}>Reportar Entrega de Dinero en Tienda</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {order.statusCode === 'DELIVERED' && order.settlementStatus === 'SETTLED' && (
                  <View style={styles.settledBanner}>
                    <Ionicons name="shield-checkmark" size={16} color="#15803D" style={{ marginRight: 6 }} />
                    <Text style={styles.settledBannerText}>
                      ¡Paz y Salvo registrado con la tienda! ✅ ({order.settledAt || order.receivedAt})
                    </Text>
                  </View>
                )}

                {/* ACCIONES DEL REPARTIDOR EN LA RUTA */}
                <View style={styles.driverActionsRow}>
                  {order.statusCode === 'PENDING' && (
                    <TouchableOpacity
                      style={styles.startRouteButton}
                      onPress={() => handleStartRoute(order.id)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="bicycle" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.driverActionBtnText}>Iniciar Ruta / En Camino</Text>
                    </TouchableOpacity>
                  )}

                  {order.statusCode === 'DISPATCHED' && (
                    <>
                      <TouchableOpacity
                        style={styles.arrivedButton}
                        onPress={() => handleMarkArrived(order.id)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="location" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={styles.driverActionBtnText}>Llegué a la Puerta</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.confirmDeliveryButton}
                        onPress={() => openDeliverModal(order)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="checkmark-done" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={styles.driverActionBtnText}>Confirmar Entrega</Text>
                      </TouchableOpacity>
                    </>
                  )}

                  {order.statusCode === 'ARRIVED' && (
                    <TouchableOpacity
                      style={[styles.confirmDeliveryButton, { flex: 1 }]}
                      onPress={() => openDeliverModal(order)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="checkmark-done-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.driverActionBtnText}>Confirmar Entrega y Cobro</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="cube-outline" size={48} color="#94A3B8" />
            <Text style={styles.emptyContainerText}>
              No tienes pedidos en esta pestaña de búsqueda.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* ================================================================= */}
      {/* MODAL: CONFIRMAR ENTREGA Y COBRO                                  */}
      {/* ================================================================= */}
      <Modal
        visible={isDeliverModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsDeliverModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalDialog}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="checkmark-done-circle" size={24} color="#10B981" style={{ marginRight: 8 }} />
                <Text style={styles.modalDialogTitle}>Confirmar Entrega</Text>
              </View>
              <TouchableOpacity onPress={() => setIsDeliverModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              <View style={styles.deliverSummaryCard}>
                <Text style={styles.deliverSummaryTitle}>Pedido #{selectedOrderForDelivery?.id}</Text>
                <Text style={styles.deliverSummarySub}>Cliente: {selectedOrderForDelivery?.client.name}</Text>
                <Text style={styles.deliverSummarySub}>📍 {selectedOrderForDelivery?.client.address}</Text>
                <Text style={styles.deliverSummaryAmount}>
                  Total: $ {(selectedOrderForDelivery?.total || 0).toLocaleString('es-CO')} COP
                </Text>
              </View>

              {/* Si es contraentrega */}
              {(selectedOrderForDelivery?.client.payment || '').toLowerCase().includes('contra') ||
              (selectedOrderForDelivery?.client.payment || '').toLowerCase().includes('efectivo') ? (
                <View style={styles.cashConfirmAlert}>
                  <Ionicons name="cash" size={22} color="#B45309" style={{ marginRight: 8 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cashConfirmAlertTitle}>Confirmación de Recaudo en Efectivo:</Text>
                    <Text style={styles.cashConfirmAlertSub}>
                      ¿Confirmas que recibiste los $ {(selectedOrderForDelivery?.total || 0).toLocaleString('es-CO')} COP en efectivo del cliente?
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={[styles.cashConfirmAlert, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
                  <Ionicons name="checkmark-circle" size={22} color="#16A34A" style={{ marginRight: 8 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cashConfirmAlertTitle, { color: '#166534' }]}>Pago Previamente Aprobado:</Text>
                    <Text style={[styles.cashConfirmAlertSub, { color: '#166534' }]}>
                      El pedido ya fue pagado por adelantado por el cliente. Solo entrega el paquete a satisfacción.
                    </Text>
                  </View>
                </View>
              )}

              {/* Número de comprobante si pagó por transferencia al recibir */}
              <View style={{ marginTop: 12 }}>
                <Text style={styles.modalFieldLabel}>Número de Comprobante / Transferencia (Si aplica)</Text>
                <TextInput
                  style={styles.modalTextInput}
                  placeholder="Ej. Aprobación #984210"
                  placeholderTextColor="#94A3B8"
                  value={deliveryTransferRef}
                  onChangeText={setDeliveryTransferRef}
                />
              </View>

              <View style={{ marginTop: 10 }}>
                <Text style={styles.modalFieldLabel}>Nota o Evidencia de Entrega (Opcional)</Text>
                <TextInput
                  style={[styles.modalTextInput, { height: 60, textAlignVertical: 'top' }]}
                  placeholder="Ej. Entregado en portería / Recibió el titular a satisfacción"
                  placeholderTextColor="#94A3B8"
                  value={deliveryEvidenceNote}
                  onChangeText={setDeliveryEvidenceNote}
                  multiline
                />
              </View>
            </ScrollView>

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsDeliverModalVisible(false)}
                disabled={isSubmittingDelivery}
              >
                <Text style={styles.modalCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalConfirmBtn, { backgroundColor: '#10B981' }]}
                onPress={handleConfirmDelivery}
                disabled={isSubmittingDelivery}
              >
                <Text style={styles.modalConfirmBtnText}>
                  {isSubmittingDelivery ? 'Guardando...' : 'Confirmar Entrega ✅'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ================================================================= */}
      {/* MODAL: REPORTAR ENTREGA DE DINERO A LA TIENDA                     */}
      {/* ================================================================= */}
      <Modal
        visible={isHandoverModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsHandoverModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalDialog}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="wallet-outline" size={24} color="#1E2B58" style={{ marginRight: 8 }} />
                <Text style={styles.modalDialogTitle}>Liquidación con la Tienda</Text>
              </View>
              <TouchableOpacity onPress={() => setIsHandoverModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              <View style={styles.deliverSummaryCard}>
                <Text style={styles.deliverSummaryTitle}>Pedido #{selectedOrderForHandover?.id}</Text>
                <Text style={styles.deliverSummaryAmount}>
                  Monto Recaudado: $ {(selectedOrderForHandover?.total || 0).toLocaleString('es-CO')} COP
                </Text>
              </View>

              <Text style={styles.modalFieldLabel}>¿Cómo entregaste el dinero a la tienda?</Text>

              <TouchableOpacity
                style={[styles.handoverOption, handoverType === 'EFECTIVO' && styles.handoverOptionActive]}
                onPress={() => setHandoverType('EFECTIVO')}
              >
                <Ionicons
                  name={handoverType === 'EFECTIVO' ? "radio-button-on" : "radio-button-off"}
                  size={18}
                  color={handoverType === 'EFECTIVO' ? "#10B981" : "#94A3B8"}
                  style={{ marginRight: 8 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.handoverOptionTitle}>💵 Efectivo Entregado en Tienda</Text>
                  <Text style={styles.handoverOptionSub}>Entregué los billetes físicamente en la caja de la tienda.</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.handoverOption, handoverType === 'TRANSFERENCIA' && styles.handoverOptionActive]}
                onPress={() => setHandoverType('TRANSFERENCIA')}
              >
                <Ionicons
                  name={handoverType === 'TRANSFERENCIA' ? "radio-button-on" : "radio-button-off"}
                  size={18}
                  color={handoverType === 'TRANSFERENCIA' ? "#10B981" : "#94A3B8"}
                  style={{ marginRight: 8 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.handoverOptionTitle}>📲 Transferencia a la Cuenta de la Tienda</Text>
                  <Text style={styles.handoverOptionSub}>Transferí el dinero recaudado a Bancolombia / Nequi de la tienda.</Text>
                </View>
              </TouchableOpacity>

              {handoverType === 'TRANSFERENCIA' && (
                <View style={{ marginTop: 10 }}>
                  <Text style={styles.modalFieldLabel}>Número de Comprobante de Transferencia *</Text>
                  <TextInput
                    style={styles.modalTextInput}
                    placeholder="Ej. Aprobación #881290"
                    placeholderTextColor="#94A3B8"
                    value={handoverTransferRef}
                    onChangeText={setHandoverTransferRef}
                  />
                </View>
              )}

              <View style={{ marginTop: 10 }}>
                <Text style={styles.modalFieldLabel}>Nota de Evidencia (Opcional)</Text>
                <TextInput
                  style={[styles.modalTextInput, { height: 60, textAlignVertical: 'top' }]}
                  placeholder="Ej. Dinero entregado al administrador en mostrador"
                  placeholderTextColor="#94A3B8"
                  value={handoverNotes}
                  onChangeText={setHandoverNotes}
                  multiline
                />
              </View>
            </ScrollView>

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsHandoverModalVisible(false)}
                disabled={isSubmittingHandover}
              >
                <Text style={styles.modalCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalConfirmBtn, { backgroundColor: '#1E2B58' }]}
                onPress={handleConfirmHandover}
                disabled={isSubmittingHandover}
              >
                <Text style={styles.modalConfirmBtnText}>
                  {isSubmittingHandover ? 'Enviando...' : 'Reportar a Tienda'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loginContainer: {
    flex: 1,
    backgroundColor: '#1E2B58',
  },
  loginScrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  loginHeaderBox: {
    alignItems: 'center',
    marginBottom: 24,
  },
  loginLogo: {
    width: 90,
    height: 90,
    borderRadius: 45,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#C5A880',
  },
  loginPillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(197, 168, 128, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#C5A880',
    marginBottom: 8,
  },
  loginPillBadgeText: {
    color: '#C5A880',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  loginTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  loginSubtitle: {
    fontSize: 12,
    color: '#CBD5E1',
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 18,
  },
  loginCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  errorBoxText: {
    color: '#DC2626',
    fontSize: 12,
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1E2B58',
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    marginBottom: 14,
    height: 48,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 13,
    color: '#1E2B58',
  },
  loginSubmitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E2B58',
    borderRadius: 10,
    paddingVertical: 13,
    marginTop: 4,
  },
  loginSubmitButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  quickAccessBox: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  quickAccessTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
  },
  quickAccessBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  quickAccessBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E2B58',
  },
  backToStoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 6,
  },
  backToStoreBtnText: {
    fontSize: 12,
    color: '#64748B',
  },

  // TOP HEADER PANEL
  topHeader: {
    backgroundColor: '#1E2B58',
    paddingTop: Platform.OS === 'ios' ? 48 : 40,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  driverProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  driverAvatarBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#C5A880',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  driverNameText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginRight: 6,
  },
  driverTypeTag: {
    backgroundColor: '#059669',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  driverTypeTagText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  driverSubDetail: {
    fontSize: 11,
    color: '#CBD5E1',
    marginTop: 2,
  },
  logoutBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  metricsBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  metricItem: {
    alignItems: 'center',
  },
  metricVal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  metricLbl: {
    fontSize: 10,
    color: '#CBD5E1',
    marginTop: 2,
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },

  // BANNER DE EFECTIVO EN MANO
  cashInHandBanner: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
  },
  cashInHandTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#92400E',
  },
  cashInHandAmount: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#B45309',
    marginVertical: 2,
  },
  cashInHandSub: {
    fontSize: 10,
    color: '#78350F',
    lineHeight: 14,
  },

  // FILTER TABS
  filterTabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 12,
    marginBottom: 6,
    gap: 8,
  },
  filterTabBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  filterTabBtnActive: {
    backgroundColor: '#1E2B58',
    borderColor: '#1E2B58',
  },
  filterTabBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  filterTabBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },

  // LISTA DE TARJETAS DE PEDIDOS
  scrollList: {
    padding: 16,
    paddingBottom: 40,
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 10,
    marginBottom: 10,
  },
  orderIdText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1E2B58',
  },
  orderDateText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: 'bold',
  },

  // CLIENT INFO
  clientInfoBlock: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  clientNameText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1E2B58',
    marginBottom: 3,
  },
  clientAddressText: {
    fontSize: 11,
    color: '#475569',
    marginBottom: 8,
    lineHeight: 16,
  },
  contactActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  openMapsBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingVertical: 6,
  },
  openMapsBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1E2B58',
  },
  callClientBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 6,
    paddingVertical: 6,
  },
  callClientBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#166534',
  },

  // GUÍA CORPORATIVA
  guideNumberBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  guideNumberTitle: {
    fontSize: 10,
    color: '#1E40AF',
  },
  guideNumberValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1E2B58',
  },
  carrierWebBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  carrierWebBtnText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },

  // ITEMS
  itemsBlock: {
    marginBottom: 10,
  },
  itemsBlockTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#64748B',
    marginBottom: 3,
  },
  itemLine: {
    fontSize: 11,
    color: '#334155',
    lineHeight: 16,
  },

  // PAYMENT INSTRUCTIONS
  paymentInstructionBox: {
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
  },
  paymentInstructionCash: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FCD34D',
  },
  paymentInstructionPaid: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  paymentInstructionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  paymentInstructionSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },

  // BANNERS DE LIQUIDACIÓN
  pendingHandoverBanner: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  pendingHandoverTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#92400E',
  },
  pendingHandoverSub: {
    fontSize: 10,
    color: '#78350F',
    marginVertical: 4,
    lineHeight: 14,
  },
  handoverActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D97706',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  handoverActionBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  settledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
  },
  settledBannerText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#15803D',
  },

  // DRIVER ACTIONS
  driverActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  startRouteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    paddingVertical: 10,
  },
  arrivedButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    borderRadius: 8,
    paddingVertical: 10,
  },
  confirmDeliveryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingVertical: 10,
  },
  driverActionBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },

  // EMPTY
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyContainerText: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 8,
    textAlign: 'center',
  },

  // MODALES
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalDialog: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    width: '100%',
    maxWidth: 480,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
  },
  modalDialogTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E2B58',
  },
  deliverSummaryCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  deliverSummaryTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1E2B58',
  },
  deliverSummarySub: {
    fontSize: 11,
    color: '#475569',
    marginTop: 2,
  },
  deliverSummaryAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#10B981',
    marginTop: 4,
  },
  cashConfirmAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  cashConfirmAlertTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#B45309',
  },
  cashConfirmAlertSub: {
    fontSize: 11,
    color: '#78350F',
    marginTop: 2,
    lineHeight: 15,
  },
  modalFieldLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1E2B58',
    marginBottom: 5,
  },
  modalTextInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    color: '#1E2B58',
  },
  modalActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  modalCancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  modalCancelBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#64748B',
  },
  modalConfirmBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  modalConfirmBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },

  // HANDOVER OPTIONS
  handoverOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  handoverOptionActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#10B981',
    borderWidth: 1.5,
  },
  handoverOptionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1E2B58',
  },
  handoverOptionSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
});

