import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
  Linking,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  Empresa,
  RegisterStoreInput,
  getEmpresas,
  toggleEmpresaStatus,
  updateEmpresaArriendo,
  registerNewStoreWithAdmin,
  authenticateAdmin,
  getAdminSession,
  clearAdminSession,
  isSuperAdmin,
  User,
  getPlatformGlobalMetrics,
  PLATFORM_INFO,
  updatePassword,
} from '../services/database';

export default function OwnerScreen() {
  const router = useRouter();

  // Estados de Autenticación del Propietario
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [loginEmail, setLoginEmail] = useState('propietario@todaapp.com');
  const [loginPassword, setLoginPassword] = useState('toda2026');
  const [loginError, setLoginError] = useState('');
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);

  // Estados de Datos del Panel Maestro
  const [empresasList, setEmpresasList] = useState<Empresa[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED'>('ALL');

  // Métricas Globales
  const [metrics, setMetrics] = useState({
    totalEmpresas: 0,
    empresasActivas: 0,
    empresasSuspendidas: 0,
    arriendoMensualProyectado: 0,
    totalProductos: 0,
    totalPedidos: 0,
    totalVentas: 0,
    totalRepartidores: 0,
  });

  // Modal Alta de Nueva Tienda
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [newNombre, setNewNombre] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newNit, setNewNit] = useState('');
  const [newCiudad, setNewCiudad] = useState('Riohacha');
  const [newDepto, setNewDepto] = useState('La Guajira');
  const [newTelefono, setNewTelefono] = useState('');
  const [newWhatsapp, setNewWhatsapp] = useState('');
  const [newCostoEnvio, setNewCostoEnvio] = useState('16000');
  const [newValorArriendo, setNewValorArriendo] = useState('150000');
  const [newFechaCorte, setNewFechaCorte] = useState('Día 5 de cada mes');
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('admin123');
  const [registerError, setRegisterError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  // Modal de Entrega de Credenciales
  const [createdData, setCreatedData] = useState<{
    nombre: string;
    slug: string;
    adminEmail: string;
    adminPassword?: string;
    webUrl: string;
    telefono?: string;
  } | null>(null);

  // Modal de Ajuste de Arriendo
  const [editingRentEmpresa, setEditingRentEmpresa] = useState<Empresa | null>(null);
  const [editRentValor, setEditRentValor] = useState('');
  const [editRentFechaCorte, setEditRentFechaCorte] = useState('');
  const [editRentEstado, setEditRentEstado] = useState<'al_dia' | 'pendiente' | 'suspendido'>('al_dia');
  const [editRentNotas, setEditRentNotas] = useState('');
  const [isSavingRent, setIsSavingRent] = useState(false);

  // Modal Cambio de Clave Propietario
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [newOwnerPassword, setNewOwnerPassword] = useState('');
  const [confirmOwnerPassword, setConfirmOwnerPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // 1. Cargar Sesión Inicial
  useEffect(() => {
    checkInitialSession();
  }, []);

  const checkInitialSession = async () => {
    try {
      setIsLoadingAuth(true);
      const session = await getAdminSession();
      if (session && isSuperAdmin(session)) {
        setCurrentUser(session);
        await loadPlatformData();
      } else {
        setCurrentUser(null);
      }
    } catch (_) {
      setCurrentUser(null);
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const loadPlatformData = async () => {
    try {
      setIsLoadingData(true);
      const [allEmpresas, globMetrics] = await Promise.all([
        getEmpresas(),
        getPlatformGlobalMetrics(),
      ]);
      setEmpresasList(allEmpresas);
      setMetrics(globMetrics);
    } catch (err) {
      console.error('Error cargando datos de la plataforma:', err);
    } finally {
      setIsLoadingData(false);
    }
  };

  // Manejo de Inicio de Sesión del Propietario
  const handleOwnerLogin = async () => {
    if (!loginEmail.trim()) {
      setLoginError('Ingresa el correo del propietario.');
      return;
    }
    if (!loginPassword.trim()) {
      setLoginError('Ingresa la contraseña maestra.');
      return;
    }

    try {
      setIsSubmittingLogin(true);
      setLoginError('');

      const res = await authenticateAdmin(loginEmail.trim(), loginPassword.trim());
      if (res.success && res.user) {
        if (!isSuperAdmin(res.user)) {
          setLoginError('Esta cuenta no tiene privilegios de Propietario de TODÁ APP.');
          return;
        }
        setCurrentUser(res.user);
        await loadPlatformData();
      } else {
        setLoginError(res.message || 'Credenciales de Propietario no válidas.');
      }
    } catch (err: any) {
      setLoginError(err?.message || 'Error al iniciar sesión.');
    } finally {
      setIsSubmittingLogin(false);
    }
  };

  const handleLogout = async () => {
    await clearAdminSession();
    setCurrentUser(null);
  };

  // Autogenerar slug
  const handleStoreNameChange = (text: string) => {
    setNewNombre(text);
    const autoSlug = text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_');
    setNewSlug(autoSlug);
  };

  // Registro de Nueva Tienda
  const handleCreateStore = async () => {
    if (!newNombre.trim()) {
      setRegisterError('Ingresa el nombre comercial de la tienda.');
      return;
    }
    if (!newSlug.trim()) {
      setRegisterError('El identificador web (slug) es obligatorio.');
      return;
    }
    if (!newAdminEmail.trim() || !newAdminEmail.includes('@')) {
      setRegisterError('Ingresa un correo válido para el administrador.');
      return;
    }
    if (!newAdminName.trim()) {
      setRegisterError('Ingresa el nombre del administrador de la tienda.');
      return;
    }

    try {
      setIsRegistering(true);
      setRegisterError('');

      const res = await registerNewStoreWithAdmin(
        {
          nombre: newNombre.trim(),
          slug: newSlug.trim().toLowerCase(),
          nit: newNit.trim(),
          ciudad: newCiudad.trim(),
          departamento: newDepto.trim(),
          telefono: newTelefono.trim(),
          whatsapp: newWhatsapp.trim() || newTelefono.trim(),
          costoEnvioBase: parseFloat(newCostoEnvio) || 16000,
          valorArriendo: parseFloat(newValorArriendo) || 150000,
          fechaCorteArriendo: newFechaCorte.trim() || 'Día 5 de cada mes',
          adminFullName: newAdminName.trim(),
          adminEmail: newAdminEmail.trim(),
          adminPassword: newAdminPassword.trim() || 'admin123',
        },
        currentUser || undefined
      );

      if (!res.success) {
        setRegisterError(res.message || 'No se pudo crear la tienda.');
        return;
      }

      setCreatedData({
        nombre: newNombre.trim(),
        slug: newSlug.trim().toLowerCase(),
        adminEmail: newAdminEmail.trim().toLowerCase(),
        adminPassword: newAdminPassword.trim() || 'admin123',
        webUrl: res.webUrl || `/admin?store=${newSlug.trim().toLowerCase()}`,
        telefono: newWhatsapp.trim() || newTelefono.trim(),
      });

      setIsRegisterModalOpen(false);
      setNewNombre('');
      setNewSlug('');
      setNewNit('');
      setNewTelefono('');
      setNewWhatsapp('');
      setNewAdminName('');
      setNewAdminEmail('');
      setNewAdminPassword('admin123');
      await loadPlatformData();
    } catch (err: any) {
      setRegisterError(err?.message || 'Error registrando la nueva tienda.');
    } finally {
      setIsRegistering(false);
    }
  };

  // Toggle Activar / Suspender Tienda por Arriendo
  const handleToggleStoreStatus = async (empresa: Empresa) => {
    const isCurrentlyActive = empresa.isActiva !== false;
    const actionText = isCurrentlyActive ? 'suspender por falta de pago' : 'reactivar';
    const confirmMessage = isCurrentlyActive
      ? `¿Estás seguro de suspender la tienda "${empresa.nombre}"? Sus administradores no podrán acceder a su panel y sus productos no se mostrarán en la app móvil hasta que cancelen el arriendo.`
      : `¿Reactivar la tienda "${empresa.nombre}"? Volverá a estar 100% activa para ventas y acceso de administradores.`;

    const executeToggle = async () => {
      const res = await toggleEmpresaStatus(
        empresa.id,
        !isCurrentlyActive,
        isCurrentlyActive ? 'Mora en pago de arriendo mensual' : 'Pago de arriendo al día verificado',
        currentUser || undefined
      );
      if (res.success) {
        await loadPlatformData();
        Alert.alert(
          isCurrentlyActive ? 'Tienda Suspendida' : 'Tienda Reactivada',
          `La tienda "${empresa.nombre}" fue ${isCurrentlyActive ? 'suspendida temporalmente por mora de arriendo' : 'reactivada con éxito'}.`
        );
      } else {
        Alert.alert('Error', res.message || 'No se pudo cambiar el estado de la tienda.');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(confirmMessage)) {
        await executeToggle();
      }
    } else {
      Alert.alert(
        `Confirmar ${actionText}`,
        confirmMessage,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: isCurrentlyActive ? 'Suspender Tienda' : 'Reactivar Tienda', onPress: executeToggle },
        ]
      );
    }
  };

  // Abrir Modal de Edición de Arriendo
  const openEditRentModal = (empresa: Empresa) => {
    setEditingRentEmpresa(empresa);
    setEditRentValor(String(empresa.valorArriendo || 150000));
    setEditRentFechaCorte(empresa.fechaCorteArriendo || 'Día 5 de cada mes');
    setEditRentEstado(empresa.estadoPago || (empresa.isActiva !== false ? 'al_dia' : 'suspendido'));
    setEditRentNotas(empresa.notasArriendo || '');
  };

  const handleSaveRentData = async () => {
    if (!editingRentEmpresa) return;

    try {
      setIsSavingRent(true);
      const res = await updateEmpresaArriendo(
        editingRentEmpresa.id,
        {
          valorArriendo: parseFloat(editRentValor) || 0,
          fechaCorteArriendo: editRentFechaCorte.trim(),
          estadoPago: editRentEstado,
          notasArriendo: editRentNotas.trim(),
        },
        currentUser || undefined
      );

      if (res.success) {
        setEditingRentEmpresa(null);
        await loadPlatformData();
        Alert.alert('Éxito', 'Datos de arriendo actualizados correctamente.');
      } else {
        Alert.alert('Error', res.message || 'No se pudo guardar la configuración de arriendo.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Error guardando datos de arriendo.');
    } finally {
      setIsSavingRent(false);
    }
  };

  // Cambio de Contraseña de Propietario
  const handleChangeOwnerPassword = async () => {
    if (!newOwnerPassword.trim() || newOwnerPassword.length < 6) {
      setPasswordError('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (newOwnerPassword !== confirmOwnerPassword) {
      setPasswordError('Las contraseñas no coinciden.');
      return;
    }
    if (!currentUser) return;

    try {
      setIsChangingPassword(true);
      setPasswordError('');
      const success = await updatePassword(currentUser.email, newOwnerPassword.trim());
      const res = { success, message: success ? undefined : 'No se pudo actualizar la contraseña.' };

      if (res.success) {
        setIsPasswordModalOpen(false);
        setNewOwnerPassword('');
        setConfirmOwnerPassword('');
        Alert.alert('Clave Actualizada', 'Tu contraseña de Propietario de TODÁ APP ha sido actualizada con éxito.');
      } else {
        setPasswordError(res.message || 'No se pudo actualizar la contraseña.');
      }
    } catch (err: any) {
      setPasswordError(err?.message || 'Error inesperado.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Copiar al portapapeles
  const handleCopyText = (text: string, label: string) => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      Alert.alert('Copiado', `${label} copiado al portapapeles.`);
    } else {
      Alert.alert(label, text);
    }
  };

  // Compartir por WhatsApp
  const handleShareWhatsApp = (phone: string, storeData: { nombre: string; slug: string; adminEmail: string; adminPassword?: string; webUrl: string }) => {
    const origin = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : 'https://toda-app.web.app';
    const fullUrl = `${origin}${storeData.webUrl}`;
    const message = `¡Hola! Tu tienda "${storeData.nombre}" ha sido dada de alta exitosamente en la plataforma TODÁ APP.\n\n🌐 Enlace Web exclusivo de tu panel de administración:\n${fullUrl}\n\n👤 Usuario (Correo):\n${storeData.adminEmail}\n🔑 Contraseña temporal:\n${storeData.adminPassword}\n\nAl ingresar podrás configurar tus medios de pago, código QR, productos y repartidores. ¡Bienvenido a TODÁ APP!`;
    const cleanPhone = (phone || '').replace(/[^0-9]/g, '');
    const waUrl = cleanPhone
      ? `https://wa.me/57${cleanPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    Linking.openURL(waUrl);
  };

  // Filtrado de Tiendas
  const filteredEmpresas = useMemo(() => {
    return empresasList.filter(emp => {
      // Filtro por Estado
      if (filterStatus === 'ACTIVE' && emp.isActiva === false) return false;
      if (filterStatus === 'SUSPENDED' && emp.isActiva !== false) return false;

      // Filtro por Texto
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        emp.nombre.toLowerCase().includes(q) ||
        emp.id.toLowerCase().includes(q) ||
        (emp.ciudad || '').toLowerCase().includes(q) ||
        (emp.nit || '').toLowerCase().includes(q) ||
        (emp.email || '').toLowerCase().includes(q)
      );
    });
  }, [empresasList, filterStatus, searchQuery]);

  // Pantalla de Carga Inicial
  if (isLoadingAuth) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: '#0B132B' }]}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={{ marginTop: 14, color: '#94A3B8', fontSize: 14 }}>Cargando Portal TODÁ APP...</Text>
      </View>
    );
  }

  // =========================================================================
  // VISTA 1: LOGIN DEL PROPIETARIO DE TODÁ APP
  // =========================================================================
  if (!currentUser) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.loginContainer}
      >
        <ScrollView contentContainerStyle={styles.loginScrollContent}>
          <View style={styles.loginCard}>
            {/* Header / Logo de TODÁ APP */}
            <View style={styles.loginHeader}>
              <View style={styles.loginLogoCircle}>
                <Ionicons name="sparkles" size={36} color="#10B981" />
              </View>
              <Text style={styles.platformBadge}>CENTRAL DE OPERACIONES SAAS</Text>
              <Text style={styles.platformTitle}>TODÁ APP</Text>
              <Text style={styles.platformSubtitle}>
                Portal Maestro Exclusivo para el Propietario de la Plataforma
              </Text>
              <View style={styles.ownerNoticeBox}>
                <Ionicons name="shield-checkmark" size={15} color="#10B981" />
                <Text style={styles.ownerNoticeText}>
                  Control Maestro: Alta de Tiendas, Rutas Web y Gestión de Arriendos
                </Text>
              </View>
            </View>

            {/* Error */}
            {loginError ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={18} color="#EF4444" style={{ marginRight: 6 }} />
                <Text style={styles.errorText}>{loginError}</Text>
              </View>
            ) : null}

            {/* Formulario */}
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Usuario / Correo del Propietario</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="person-circle-outline" size={20} color="#64748B" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  value={loginEmail}
                  onChangeText={setLoginEmail}
                  placeholder="propietario@todaapp.com"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Contraseña Maestra</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={20} color="#64748B" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  value={loginPassword}
                  onChangeText={setLoginPassword}
                  placeholder="Contraseña Maestra"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry
                />
              </View>
            </View>

            <TouchableOpacity
              style={styles.loginButton}
              onPress={handleOwnerLogin}
              disabled={isSubmittingLogin}
              activeOpacity={0.85}
            >
              {isSubmittingLogin ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="key" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.loginButtonText}>Ingresar al Panel Maestro</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={{ marginTop: 24, borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 16, alignItems: 'center' }}>
              <Text style={{ color: '#94A3B8', fontSize: 12 }}>¿Eres administrador de una tienda específica?</Text>
              <TouchableOpacity
                style={{ marginTop: 6 }}
                onPress={() => router.push('/admin')}
              >
                <Text style={{ color: '#38BDF8', fontWeight: '700', fontSize: 13 }}>
                  Ir al Acceso de Tiendas Afiliadas (/admin)
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // =========================================================================
  // VISTA 2: PANEL MAESTRO DEL PROPIETARIO (TODÁ APP)
  // =========================================================================
  const originUrl = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : 'https://toda-app.web.app';

  return (
    <View style={styles.dashboardContainer}>
      {/* TOPBAR MAESTRA */}
      <View style={styles.topbar}>
        <View style={styles.brandContainer}>
          <View style={styles.brandIcon}>
            <Ionicons name="sparkles" size={22} color="#10B981" />
          </View>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.topbarTitle}>TODÁ APP</Text>
              <View style={styles.masterBadge}>
                <Text style={styles.masterBadgeText}>SUPERADMIN</Text>
              </View>
            </View>
            <Text style={styles.topbarSubtitle}>Panel Maestro del Propietario de la Plataforma</Text>
          </View>
        </View>

        <View style={styles.topbarActions}>
          <TouchableOpacity
            style={styles.createStoreButton}
            onPress={() => setIsRegisterModalOpen(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="add-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.createStoreButtonText}>Dar de Alta Nueva Tienda</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.keyButton}
            onPress={() => setIsPasswordModalOpen(true)}
            
          >
            <Ionicons name="key-outline" size={18} color="#94A3B8" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={18} color="#EF4444" style={{ marginRight: 6 }} />
            <Text style={styles.logoutText}>Salir</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.mainScroll} contentContainerStyle={styles.scrollContent}>
        {/* BARRA DE MÉTRICAS GLOBALES DE TODÁ APP */}
        <View style={styles.metricsGrid}>
          {/* Card 1: Total Tiendas */}
          <View style={styles.metricCard}>
            <View style={[styles.metricIconWrap, { backgroundColor: '#E0F2FE' }]}>
              <Ionicons name="business" size={22} color="#0284C7" />
            </View>
            <View>
              <Text style={styles.metricLabel}>Tiendas Registradas</Text>
              <Text style={styles.metricValue}>{metrics.totalEmpresas}</Text>
              <Text style={styles.metricSub}>Comercios en la red</Text>
            </View>
          </View>

          {/* Card 2: Tiendas Activas (Al Día) */}
          <View style={styles.metricCard}>
            <View style={[styles.metricIconWrap, { backgroundColor: '#DCFCE7' }]}>
              <Ionicons name="checkmark-circle" size={22} color="#15803D" />
            </View>
            <View>
              <Text style={styles.metricLabel}>Tiendas Activas</Text>
              <Text style={[styles.metricValue, { color: '#15803D' }]}>{metrics.empresasActivas}</Text>
              <Text style={styles.metricSub}>Al día con el arriendo</Text>
            </View>
          </View>

          {/* Card 3: Tiendas Suspendidas */}
          <View style={styles.metricCard}>
            <View style={[styles.metricIconWrap, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="alert-circle" size={22} color="#DC2626" />
            </View>
            <View>
              <Text style={styles.metricLabel}>En Mora / Suspendidas</Text>
              <Text style={[styles.metricValue, { color: '#DC2626' }]}>{metrics.empresasSuspendidas}</Text>
              <Text style={styles.metricSub}>Acceso web bloqueado</Text>
            </View>
          </View>

          {/* Card 4: Recaudo Estimado Arriendos */}
          <View style={styles.metricCard}>
            <View style={[styles.metricIconWrap, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="cash" size={22} color="#B45309" />
            </View>
            <View>
              <Text style={styles.metricLabel}>Arriendos Mensuales</Text>
              <Text style={[styles.metricValue, { color: '#B45309', fontSize: 20 }]}>
                ${metrics.arriendoMensualProyectado.toLocaleString()}
              </Text>
              <Text style={styles.metricSub}>COP proyectado / mes</Text>
            </View>
          </View>

          {/* Card 5: Pedidos Globales */}
          <View style={styles.metricCard}>
            <View style={[styles.metricIconWrap, { backgroundColor: '#F3E8FF' }]}>
              <Ionicons name="cube" size={22} color="#7E22CE" />
            </View>
            <View>
              <Text style={styles.metricLabel}>Pedidos Globales</Text>
              <Text style={styles.metricValue}>{metrics.totalPedidos}</Text>
              <Text style={styles.metricSub}>Ventas: ${metrics.totalVentas.toLocaleString()}</Text>
            </View>
          </View>
        </View>

        {/* SECCIÓN PRINCIPAL: DIRECTORIO & GESTIÓN DE TIENDAS */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Directorio de Tiendas & Control de Arriendos</Text>
            <Text style={styles.sectionSubtitle}>
              Activa, suspende o edita el arriendo de cada comercio. Cada tienda opera de manera 100% independiente en su ruta web.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.refreshButton}
            onPress={loadPlatformData}
          >
            <Ionicons name="refresh" size={16} color="#0284C7" style={{ marginRight: 6 }} />
            <Text style={{ color: '#0284C7', fontWeight: '700', fontSize: 13 }}>Actualizar</Text>
          </TouchableOpacity>
        </View>

        {/* BARRA DE FILTROS Y BÚSQUEDA */}
        <View style={styles.filterRow}>
          <View style={styles.searchWrapper}>
            <Ionicons name="search" size={18} color="#64748B" style={{ marginLeft: 12, marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Buscar tienda por nombre, slug, ciudad o NIT..."
              placeholderTextColor="#94A3B8"
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 8 }}>
                <Ionicons name="close-circle" size={16} color="#94A3B8" />
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.statusFilters}>
            <TouchableOpacity
              style={[styles.filterChip, filterStatus === 'ALL' && styles.filterChipActive]}
              onPress={() => setFilterStatus('ALL')}
            >
              <Text style={[styles.filterChipText, filterStatus === 'ALL' && styles.filterChipTextActive]}>
                Todas ({empresasList.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterChip, filterStatus === 'ACTIVE' && styles.filterChipActive]}
              onPress={() => setFilterStatus('ACTIVE')}
            >
              <Text style={[styles.filterChipText, filterStatus === 'ACTIVE' && styles.filterChipTextActive]}>
                🟢 Activas ({metrics.empresasActivas})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterChip, filterStatus === 'SUSPENDED' && styles.filterChipActive]}
              onPress={() => setFilterStatus('SUSPENDED')}
            >
              <Text style={[styles.filterChipText, filterStatus === 'SUSPENDED' && styles.filterChipTextActive]}>
                🔴 Suspendidas ({metrics.empresasSuspendidas})
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* LISTADO DE TARJETAS DE TIENDAS */}
        {isLoadingData ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#10B981" />
            <Text style={{ marginTop: 12, color: '#64748B' }}>Sincronizando comercios con Supabase...</Text>
          </View>
        ) : filteredEmpresas.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="storefront-outline" size={48} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No se encontraron tiendas</Text>
            <Text style={styles.emptySubtitle}>Intenta cambiando los filtros o da de alta una nueva tienda.</Text>
          </View>
        ) : (
          <View style={styles.storesGrid}>
            {filteredEmpresas.map((emp) => {
              const isActive = emp.isActiva !== false;
              const webPath = `/admin?store=${emp.id}`;
              const fullStoreWebUrl = `${originUrl}${webPath}`;

              return (
                <View
                  key={emp.id}
                  style={[
                    styles.storeCard,
                    !isActive && styles.storeCardSuspended,
                  ]}
                >
                  {/* Encabezado de la Tarjeta */}
                  <View style={styles.storeCardHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                      {emp.logoUrl ? (
                        <Image
                          source={{ uri: emp.logoUrl }}
                          style={styles.storeLogo}
                          resizeMode="contain"
                        />
                      ) : (
                        <View style={styles.storeLogoFallback}>
                          <Text style={styles.storeLogoFallbackText}>
                            {emp.nombre.substring(0, 2).toUpperCase()}
                          </Text>
                        </View>
                      )}

                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <Text style={styles.storeName}>{emp.nombre}</Text>
                          {emp.id === 'einuushi' && (
                            <View style={styles.pioneerBadge}>
                              <Text style={styles.pioneerBadgeText}>FUNDADORA</Text>
                            </View>
                          )}
                        </View>

                        <Text style={styles.storeLocation}>
                          {emp.ciudad || 'Colombia'}, {emp.departamento || ''} • NIT: {emp.nit || 'Sin registrar'}
                        </Text>
                      </View>
                    </View>

                    {/* Badge de Estado Activa / Suspendida */}
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: isActive ? '#DCFCE7' : '#FEE2E2', borderColor: isActive ? '#BBF7D0' : '#FECACA' },
                      ]}
                    >
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: isActive ? '#16A34A' : '#DC2626',
                          marginRight: 6,
                        }}
                      />
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: '800',
                          color: isActive ? '#15803D' : '#DC2626',
                        }}
                      >
                        {isActive ? 'ACTIVA (AL DÍA)' : 'SUSPENDIDA (MORA)'}
                      </Text>
                    </View>
                  </View>

                  {/* Fila de Dirección Web Asignada */}
                  <View style={styles.webUrlBox}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                      <Ionicons name="globe-outline" size={16} color="#0284C7" />
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B' }}>DIRECCIÓN WEB:</Text>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#0284C7' }} numberOfLines={1}>
                        {webPath}
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <TouchableOpacity
                        style={styles.urlActionButton}
                        onPress={() => handleCopyText(fullStoreWebUrl, 'Enlace Web')}
                        
                      >
                        <Ionicons name="copy-outline" size={14} color="#0284C7" style={{ marginRight: 4 }} />
                        <Text style={styles.urlActionText}>Copiar</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.urlActionButton, { backgroundColor: '#1E2B58' }]}
                        onPress={() => router.push(webPath as any)}
                        
                      >
                        <Ionicons name="open-outline" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                        <Text style={[styles.urlActionText, { color: '#FFFFFF' }]}>Abrir Panel</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Fila de Arriendo & Pagos */}
                  <View style={styles.rentInfoBox}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rentLabel}>Arriendo Mensual Acordado:</Text>
                      <Text style={styles.rentValue}>
                        ${(emp.valorArriendo || 150000).toLocaleString()} COP / mes
                      </Text>
                      <Text style={styles.rentCutDate}>
                        Corte: {emp.fechaCorteArriendo || 'Día 5 de cada mes'}
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={styles.editRentButton}
                      onPress={() => openEditRentModal(emp)}
                    >
                      <Ionicons name="create-outline" size={15} color="#475569" style={{ marginRight: 4 }} />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569' }}>Ajustar Arriendo</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Footer con Contacto & Botón de Acción Maestra (Suspender / Activar) */}
                  <View style={styles.storeCardFooter}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, color: '#64748B' }}>
                        Contacto: {emp.email || 'Sin correo'} • Tel: {emp.telefono || emp.whatsapp || 'N/A'}
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {/* Botón WhatsApp */}
                      {(emp.whatsapp || emp.telefono) && (
                        <TouchableOpacity
                          style={styles.waButton}
                          onPress={() => {
                            const clean = (emp.whatsapp || emp.telefono || '').replace(/[^0-9]/g, '');
                            Linking.openURL(`https://wa.me/57${clean}`);
                          }}
                        >
                          <Ionicons name="logo-whatsapp" size={16} color="#15803D" />
                        </TouchableOpacity>
                      )}

                      {/* Botón Maestro: Suspender por Arriendo / Reactivar */}
                      <TouchableOpacity
                        style={[
                          styles.toggleStatusButton,
                          { backgroundColor: isActive ? '#EF4444' : '#10B981' },
                        ]}
                        onPress={() => handleToggleStoreStatus(emp)}
                        activeOpacity={0.85}
                      >
                        <Ionicons
                          name={isActive ? 'pause-circle' : 'play-circle'}
                          size={16}
                          color="#FFFFFF"
                          style={{ marginRight: 6 }}
                        />
                        <Text style={styles.toggleStatusButtonText}>
                          {isActive ? 'Suspender por Mora' : 'Reactivar Tienda'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* ================================================================= */}
      {/* MODAL 1: ALTA DE NUEVA TIENDA / TALLER                            */}
      {/* ================================================================= */}
      <Modal
        visible={isRegisterModalOpen}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsRegisterModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={[styles.brandIcon, { backgroundColor: '#DCFCE7' }]}>
                  <Ionicons name="storefront" size={20} color="#15803D" />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Dar de Alta Nueva Tienda</Text>
                  <Text style={styles.modalSubtitle}>Asigna su dirección web, datos de arriendo y credenciales</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setIsRegisterModalOpen(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            {registerError ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={18} color="#EF4444" style={{ marginRight: 6 }} />
                <Text style={styles.errorText}>{registerError}</Text>
              </View>
            ) : null}

            <ScrollView style={{ marginTop: 12, maxHeight: 460 }} showsVerticalScrollIndicator={false}>
              {/* SECCIÓN 1: DATOS DE LA TIENDA */}
              <Text style={styles.formSectionTitle}>1. Datos Comerciales de la Tienda</Text>

              <View style={{ gap: 10 }}>
                <View>
                  <Text style={styles.settingsLabel}>Nombre Comercial de la Tienda *</Text>
                  <TextInput
                    style={styles.settingsInput}
                    value={newNombre}
                    onChangeText={handleStoreNameChange}
                    placeholder="Ej. Artesanías del Sol Wayuu"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                <View>
                  <Text style={styles.settingsLabel}>Identificador Web (Slug de Acceso) *</Text>
                  <TextInput
                    style={[styles.settingsInput, { backgroundColor: '#F8FAFC' }]}
                    value={newSlug}
                    onChangeText={setNewSlug}
                    autoCapitalize="none"
                    placeholder="ej. artesanias_sol"
                    placeholderTextColor="#94A3B8"
                  />
                  <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                    Su dirección web será:{' '}
                    <Text style={{ fontWeight: '700', color: '#0284C7' }}>
                      /admin?store={newSlug || 'identificador'}
                    </Text>
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingsLabel}>NIT o Cédula:</Text>
                    <TextInput
                      style={styles.settingsInput}
                      value={newNit}
                      onChangeText={setNewNit}
                      placeholder="901.123.456-7"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingsLabel}>Tarifa Base Envío (COP):</Text>
                    <TextInput
                      style={styles.settingsInput}
                      value={newCostoEnvio}
                      onChangeText={setNewCostoEnvio}
                      keyboardType="numeric"
                      placeholder="16000"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingsLabel}>Ciudad:</Text>
                    <TextInput
                      style={styles.settingsInput}
                      value={newCiudad}
                      onChangeText={setNewCiudad}
                      placeholder="Riohacha"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingsLabel}>Departamento:</Text>
                    <TextInput
                      style={styles.settingsInput}
                      value={newDepto}
                      onChangeText={setNewDepto}
                      placeholder="La Guajira"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingsLabel}>Teléfono:</Text>
                    <TextInput
                      style={styles.settingsInput}
                      value={newTelefono}
                      onChangeText={setNewTelefono}
                      keyboardType="phone-pad"
                      placeholder="310 123 4567"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingsLabel}>WhatsApp de Atención:</Text>
                    <TextInput
                      style={styles.settingsInput}
                      value={newWhatsapp}
                      onChangeText={setNewWhatsapp}
                      keyboardType="phone-pad"
                      placeholder="310 123 4567"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </View>
              </View>

              {/* SECCIÓN 2: CONTROL DE ARRIENDO */}
              <Text style={[styles.formSectionTitle, { marginTop: 18 }]}>2. Condiciones de Arriendo Mensual</Text>

              <View style={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingsLabel}>Valor Arriendo Mensual (COP) *</Text>
                    <TextInput
                      style={styles.settingsInput}
                      value={newValorArriendo}
                      onChangeText={setNewValorArriendo}
                      keyboardType="numeric"
                      placeholder="150000"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingsLabel}>Día de Corte de Pago *</Text>
                    <TextInput
                      style={styles.settingsInput}
                      value={newFechaCorte}
                      onChangeText={setNewFechaCorte}
                      placeholder="Día 5 de cada mes"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </View>
              </View>

              {/* SECCIÓN 3: CUENTA DEL ADMINISTRADOR */}
              <Text style={[styles.formSectionTitle, { marginTop: 18 }]}>3. Cuenta de Acceso del Administrador</Text>

              <View style={{ gap: 10 }}>
                <View>
                  <Text style={styles.settingsLabel}>Nombre Completo del Encargado *</Text>
                  <TextInput
                    style={styles.settingsInput}
                    value={newAdminName}
                    onChangeText={setNewAdminName}
                    placeholder="Ej. Carmen Ipuana"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                <View>
                  <Text style={styles.settingsLabel}>Correo de Acceso (Usuario) *</Text>
                  <TextInput
                    style={styles.settingsInput}
                    value={newAdminEmail}
                    onChangeText={setNewAdminEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    placeholder="carmen@artesaniasdesierto.com"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                <View>
                  <Text style={styles.settingsLabel}>Contraseña Temporal Inicial *</Text>
                  <TextInput
                    style={styles.settingsInput}
                    value={newAdminPassword}
                    onChangeText={setNewAdminPassword}
                    placeholder="Mínimo 6 caracteres"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>

              {/* BOTONES */}
              <View style={{ marginTop: 24, flexDirection: 'row', justifyContent: 'flex-end', gap: 10, paddingBottom: 16 }}>
                <TouchableOpacity
                  style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: '#E2E8F0' }}
                  onPress={() => setIsRegisterModalOpen(false)}
                >
                  <Text style={{ fontWeight: '600', color: '#475569' }}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#10B981', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }}
                  onPress={handleCreateStore}
                  disabled={isRegistering}
                >
                  {isRegistering ? (
                    <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                  ) : (
                    <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                  )}
                  <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>
                    {isRegistering ? 'Creando Tienda...' : 'Dar de Alta y Generar Acceso'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ================================================================= */}
      {/* MODAL 2: CONFIRMACIÓN Y ENTREGA DE CREDENCIALES                   */}
      {/* ================================================================= */}
      <Modal
        visible={!!createdData}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setCreatedData(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxWidth: 500, alignItems: 'center' }]}>
            <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#DCFCE7', justifyContent: 'center', alignItems: 'center', marginBottom: 14 }}>
              <Ionicons name="checkmark-circle" size={38} color="#15803D" />
            </View>

            <Text style={{ fontSize: 19, fontWeight: '700', color: '#1E2B58', textAlign: 'center' }}>
              ¡Tienda Registrada en TODÁ APP!
            </Text>
            <Text style={{ fontSize: 13, color: '#64748B', textAlign: 'center', marginTop: 4, marginBottom: 18 }}>
              "{createdData?.nombre}" ya está habilitada en la plataforma con su propia dirección web.
            </Text>

            <View style={{ width: '100%', backgroundColor: '#F8FAFC', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', gap: 10 }}>
              <View>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B' }}>DIRECCIÓN WEB ASIGNADA:</Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#0284C7', marginTop: 2 }}>
                  {originUrl}{createdData?.webUrl}
                </Text>
              </View>

              <View style={{ borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 8 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B' }}>USUARIO (CORREO):</Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#1E2B58', marginTop: 1 }}>{createdData?.adminEmail}</Text>
              </View>

              <View>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B' }}>CONTRASEÑA TEMPORAL:</Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#1E2B58', marginTop: 1 }}>{createdData?.adminPassword}</Text>
              </View>
            </View>

            <View style={{ width: '100%', flexDirection: 'row', gap: 10, marginTop: 20 }}>
              <TouchableOpacity
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1E2B58', paddingVertical: 12, borderRadius: 10 }}
                onPress={() => {
                  const fullUrl = `${originUrl}${createdData?.webUrl}`;
                  handleCopyText(fullUrl, 'Enlace Web');
                }}
              >
                <Ionicons name="copy-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>Copiar Enlace</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#15803D', paddingVertical: 12, borderRadius: 10 }}
                onPress={() => {
                  if (createdData) {
                    handleShareWhatsApp(createdData.telefono || '', createdData);
                  }
                }}
              >
                <Ionicons name="logo-whatsapp" size={17} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>Enviar por WhatsApp</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={{ marginTop: 14 }}
              onPress={() => setCreatedData(null)}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#64748B' }}>Cerrar Ventana</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ================================================================= */}
      {/* MODAL 3: AJUSTE DE ARRIENDO & ESTADO DE PAGO                      */}
      {/* ================================================================= */}
      <Modal
        visible={!!editingRentEmpresa}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setEditingRentEmpresa(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxWidth: 480 }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={[styles.brandIcon, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="cash" size={20} color="#B45309" />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Configuración de Arriendo</Text>
                  <Text style={styles.modalSubtitle}>{editingRentEmpresa?.nombre}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setEditingRentEmpresa(null)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={{ gap: 12, marginTop: 16 }}>
              <View>
                <Text style={styles.settingsLabel}>Valor Mensual de Arriendo (COP):</Text>
                <TextInput
                  style={styles.settingsInput}
                  value={editRentValor}
                  onChangeText={setEditRentValor}
                  keyboardType="numeric"
                  placeholder="150000"
                />
              </View>

              <View>
                <Text style={styles.settingsLabel}>Día de Corte de Cobro:</Text>
                <TextInput
                  style={styles.settingsInput}
                  value={editRentFechaCorte}
                  onChangeText={setEditRentFechaCorte}
                  placeholder="Día 5 de cada mes"
                />
              </View>

              <View>
                <Text style={styles.settingsLabel}>Estado de Pago del Mes:</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(['al_dia', 'pendiente', 'suspendido'] as const).map(st => (
                    <TouchableOpacity
                      key={st}
                      style={{
                        flex: 1,
                        paddingVertical: 8,
                        borderRadius: 8,
                        borderWidth: 1.5,
                        borderColor: editRentEstado === st ? '#10B981' : '#CBD5E1',
                        backgroundColor: editRentEstado === st ? '#ECFDF5' : '#FFFFFF',
                        alignItems: 'center',
                      }}
                      onPress={() => setEditRentEstado(st)}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '700',
                          color: editRentEstado === st ? '#065F46' : '#64748B',
                          textTransform: 'uppercase',
                        }}
                      >
                        {st === 'al_dia' ? 'Al Día' : st === 'pendiente' ? 'Pendiente' : 'En Mora'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View>
                <Text style={styles.settingsLabel}>Notas Internas de Cobro / Arriendo:</Text>
                <TextInput
                  style={[styles.settingsInput, { height: 60, textAlignVertical: 'top' }]}
                  value={editRentNotas}
                  onChangeText={setEditRentNotas}
                  placeholder="Notas sobre transferencias, acuerdos o prórrogas..."
                  multiline
                />
              </View>
            </View>

            <View style={{ marginTop: 22, flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
              <TouchableOpacity
                style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: '#E2E8F0' }}
                onPress={() => setEditingRentEmpresa(null)}
              >
                <Text style={{ fontWeight: '600', color: '#475569' }}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#10B981', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }}
                onPress={handleSaveRentData}
                disabled={isSavingRent}
              >
                {isSavingRent ? (
                  <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 6 }} />
                ) : (
                  <Ionicons name="save" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                )}
                <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Guardar Arriendo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ================================================================= */}
      {/* MODAL 4: CAMBIO DE CONTRASEÑA DEL PROPIETARIO                     */}
      {/* ================================================================= */}
      <Modal
        visible={isPasswordModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsPasswordModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxWidth: 440 }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={[styles.brandIcon, { backgroundColor: '#F1F5F9' }]}>
                  <Ionicons name="key" size={20} color="#1E2B58" />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Seguridad del Propietario</Text>
                  <Text style={styles.modalSubtitle}>Cambiar Contraseña Maestra de TODÁ APP</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setIsPasswordModalOpen(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            {passwordError ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={18} color="#EF4444" style={{ marginRight: 6 }} />
                <Text style={styles.errorText}>{passwordError}</Text>
              </View>
            ) : null}

            <View style={{ gap: 12, marginTop: 14 }}>
              <View>
                <Text style={styles.settingsLabel}>Nueva Contraseña Maestra:</Text>
                <TextInput
                  style={styles.settingsInput}
                  value={newOwnerPassword}
                  onChangeText={setNewOwnerPassword}
                  secureTextEntry
                  placeholder="Mínimo 6 caracteres"
                />
              </View>

              <View>
                <Text style={styles.settingsLabel}>Confirmar Nueva Contraseña:</Text>
                <TextInput
                  style={styles.settingsInput}
                  value={confirmOwnerPassword}
                  onChangeText={setConfirmOwnerPassword}
                  secureTextEntry
                  placeholder="Repite la nueva contraseña"
                />
              </View>
            </View>

            <View style={{ marginTop: 22, flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
              <TouchableOpacity
                style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: '#E2E8F0' }}
                onPress={() => setIsPasswordModalOpen(false)}
              >
                <Text style={{ fontWeight: '600', color: '#475569' }}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E2B58', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }}
                onPress={handleChangeOwnerPassword}
                disabled={isChangingPassword}
              >
                {isChangingPassword ? (
                  <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 6 }} />
                ) : (
                  <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                )}
                <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Actualizar Clave</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// =========================================================================
// ESTILOS EXECUTIVOS PARA EL PANEL DEL PROPIETARIO DE TODÁ APP
// =========================================================================
const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginContainer: {
    flex: 1,
    backgroundColor: '#0B132B',
  },
  loginScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loginCard: {
    backgroundColor: '#1C2541',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 460,
    borderWidth: 1,
    borderColor: '#3A506B',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
  },
  loginHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  loginLogoCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#0B132B',
    borderWidth: 2,
    borderColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  platformBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#10B981',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  platformTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  platformSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
  },
  ownerNoticeBox: {
    marginTop: 12,
    backgroundColor: '#0B132B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ownerNoticeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
  },
  formGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#CBD5E1',
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0B132B',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3A506B',
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    height: 44,
    color: '#FFFFFF',
    fontSize: 14,
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 13,
    borderRadius: 10,
    marginTop: 8,
    shadowColor: '#10B981',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 3,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: 10,
    borderRadius: 8,
    marginBottom: 14,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  dashboardContainer: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0B132B',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1C2541',
    flexWrap: 'wrap',
    gap: 12,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brandIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#1C2541',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3A506B',
  },
  topbarTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  masterBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  masterBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  topbarSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
  },
  topbarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  createStoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  createStoreButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  keyButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#1C2541',
    borderWidth: 1,
    borderColor: '#3A506B',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
  },
  logoutText: {
    color: '#EF4444',
    fontWeight: '700',
    fontSize: 12,
  },
  mainScroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginBottom: 24,
  },
  metricCard: {
    flex: 1,
    minWidth: 180,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  metricIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    marginVertical: 1,
  },
  metricSub: {
    fontSize: 11,
    color: '#94A3B8',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  searchWrapper: {
    flex: 1,
    minWidth: 260,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 13,
    color: '#1E293B',
  },
  statusFilters: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  filterChipActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  emptyContainer: {
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#475569',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
  },
  storesGrid: {
    gap: 16,
  },
  storeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  storeCardSuspended: {
    borderColor: '#FECACA',
    backgroundColor: '#FFF5F5',
  },
  storeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
    flexWrap: 'wrap',
    gap: 10,
  },
  storeLogo: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  storeLogoFallback: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storeLogoFallbackText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  storeName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  pioneerBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  pioneerBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#B45309',
  },
  storeLocation: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  webUrlBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  urlActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  urlActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
  },
  rentInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDF4',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginTop: 10,
    flexWrap: 'wrap',
    gap: 8,
  },
  rentLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
    textTransform: 'uppercase',
  },
  rentValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#15803D',
    marginTop: 1,
  },
  rentCutDate: {
    fontSize: 11,
    color: '#166534',
    marginTop: 1,
  },
  editRentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  storeCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    flexWrap: 'wrap',
    gap: 8,
  },
  waButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  toggleStatusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  toggleStatusButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 580,
    padding: 22,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 14,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
  },
  formSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0284C7',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  settingsLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
  },
  settingsInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    height: 40,
    fontSize: 13,
    color: '#0F172A',
  },
});
