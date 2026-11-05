import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView, 
  Image, 
  Alert,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { 
  Empresa, 
  getEmpresas, 
  getEmpresaById, 
  setActiveEmpresa 
} from '../services/database';

export default function IndexScreen() {
  const router = useRouter();
  const { store } = useLocalSearchParams<{ store?: string }>();
  const { login } = useAuth();

  // Estados de Tiendas y Directorio
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [selectedStore, setSelectedStore] = useState<Empresa | null>(null);
  const [isLoadingStores, setIsLoadingStores] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCityFilter, setSelectedCityFilter] = useState('Todas');

  // Estados del Formulario de Acceso a la Tienda
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showNotification = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message, [{ text: 'Aceptar' }]);
    }
  };

  // Cargar lista de tiendas registradas activas y detectar tienda por URL/parámetro
  const loadStores = useCallback(async () => {
    try {
      const all = await getEmpresas();
      const activeList = all.filter(e => e.isActiva !== false && e.estadoPago !== 'suspendido');
      setEmpresas(activeList);

      // Si viene un parámetro ?store=slug en la URL, resolver esa tienda de inmediato
      if (store) {
        const found = await getEmpresaById(store);
        if (found) {
          setSelectedStore(found);
          await setActiveEmpresa(found);
        }
      }
    } catch (err) {
      console.warn('Error cargando empresas:', err);
    } finally {
      setIsLoadingStores(false);
    }
  }, [store]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadStores();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadStores]);

  // Manejar selección de tienda desde el directorio
  const handleSelectStore = async (emp: Empresa) => {
    setSelectedStore(emp);
    await setActiveEmpresa(emp);
  };

  // Manejar retorno al directorio general
  const handleBackToDirectory = () => {
    setSelectedStore(null);
    setEmail('');
    setPassword('');
  };

  // Autenticación en la tienda seleccionada
  const handleLogin = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      showNotification('Campo requerido', 'Por favor ingresa tu correo electrónico.');
      return;
    }
    if (!password) {
      showNotification('Campo requerido', 'Por favor ingresa tu contraseña.');
      return;
    }

    setIsSubmitting(true);
    const res = await login(trimmedEmail, password);
    setIsSubmitting(false);

    if (res.success) {
      const storeSlug = selectedStore ? selectedStore.id : 'einuushi';
      if (res.user?.role === 'driver') {
        router.replace({ pathname: '/driver', params: { store: storeSlug } });
      } else {
        router.replace({ pathname: '/home', params: { store: storeSlug } });
      }
    } else {
      showNotification('Acceso Denegado', res.message || 'Credenciales incorrectas.');
    }
  };

  // Navegar a explorar catálogo sin iniciar sesión
  const handleExploreAsGuest = () => {
    const storeSlug = selectedStore ? selectedStore.id : 'einuushi';
    router.push({ pathname: '/home', params: { store: storeSlug } });
  };

  // Navegar al portal de repartidores de la tienda
  const handleOpenDriverPortal = () => {
    const storeSlug = selectedStore ? selectedStore.id : 'einuushi';
    router.push({ pathname: '/driver', params: { store: storeSlug } });
  };

  // Navegar al registro de cuenta para la tienda
  const handleOpenRegister = () => {
    const storeSlug = selectedStore ? selectedStore.id : 'einuushi';
    router.push({ pathname: '/register', params: { store: storeSlug } });
  };

  // Lista de ciudades únicas para filtros rápidos
  const availableCities = useMemo(() => {
    const cities = new Set<string>();
    empresas.forEach(e => {
      if (e.ciudad) cities.add(e.ciudad);
    });
    return ['Todas', ...Array.from(cities)];
  }, [empresas]);

  // Filtrar tiendas según texto de búsqueda y ciudad
  const filteredStores = useMemo(() => {
    return empresas.filter(emp => {
      const matchCity = selectedCityFilter === 'Todas' || emp.ciudad === selectedCityFilter;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return matchCity;
      const matchQuery = 
        emp.nombre.toLowerCase().includes(q) ||
        (emp.slogan && emp.slogan.toLowerCase().includes(q)) ||
        (emp.descripcion && emp.descripcion.toLowerCase().includes(q)) ||
        (emp.ciudad && emp.ciudad.toLowerCase().includes(q));
      return matchCity && matchQuery;
    });
  }, [empresas, searchQuery, selectedCityFilter]);

  // Renderizar Logo de la Tienda de forma dinámica
  const renderStoreLogo = (emp: Empresa) => {
    if (emp.id === 'einuushi' && (!emp.logoUrl || emp.logoUrl.includes('logo_einuushi'))) {
      return (
        <Image 
          source={require('../assets/images/logo_einuushi.jpeg')} 
          style={styles.logoImage} 
          resizeMode="contain"
        />
      );
    }

    if (emp.logoUrl) {
      return (
        <Image 
          source={{ uri: emp.logoUrl }} 
          style={styles.logoImage} 
          resizeMode="contain"
        />
      );
    }

    return (
      <View style={styles.storeLogoPlaceholder}>
        <Ionicons name="storefront" size={40} color="#1E2B58" />
        <Text style={styles.storeLogoPlaceholderText}>
          {emp.nombre.substring(0, 2).toUpperCase()}
        </Text>
      </View>
    );
  };

  if (isLoadingStores) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#1E2B58" />
        <Text style={{ marginTop: 12, color: '#64748B', fontSize: 14 }}>
          Cargando tiendas afiliadas...
        </Text>
      </View>
    );
  }

  // =========================================================================
  // VISTA A: DIRECTORIO GENERAL DE TIENDAS (Cuando el usuario abre la App)
  // =========================================================================
  if (!selectedStore) {
    return (
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <StatusBar style="light" />
        <ScrollView 
          contentContainerStyle={styles.directoryScrollContainer} 
          showsVerticalScrollIndicator={true}
        >
          {/* Header Banner TODÁ APP */}
          <View style={styles.directoryHeader}>
            <View style={styles.directoryBadge}>
              <Ionicons name="sparkles" size={14} color="#10B981" style={{ marginRight: 6 }} />
              <Text style={styles.directoryBadgeText}>CENTRAL DE COMERCIOS</Text>
            </View>
            <Text style={styles.directoryTitle}>TODÁ APP</Text>
            <Text style={styles.directorySubtitle}>
              Directorio oficial de tiendas locales. Elige una tienda para ver su catálogo, comprar o gestionar envíos.
            </Text>

            {/* Buscador de Tiendas */}
            <View style={styles.directorySearchWrapper}>
              <Ionicons name="search" size={20} color="#64748B" style={{ marginRight: 10 }} />
              <TextInput
                style={[
                  styles.directorySearchInput,
                  Platform.OS === 'web' && ({ outlineStyle: 'none' } as any),
                ]}
                placeholder="Buscar tienda por nombre, ciudad o especialidad..."
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={18} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>

            {/* Filtros de Ciudad */}
            {availableCities.length > 2 && (
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.cityFilterContainer}
              >
                {availableCities.map(city => (
                  <TouchableOpacity
                    key={city}
                    style={[
                      styles.cityChip,
                      selectedCityFilter === city && styles.cityChipActive
                    ]}
                    onPress={() => setSelectedCityFilter(city)}
                  >
                    <Text style={[
                      styles.cityChipText,
                      selectedCityFilter === city && styles.cityChipTextActive
                    ]}>
                      {city}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>

          {/* Directorio de Comercios Registrados */}
          <View style={styles.directoryBody}>
            <View style={styles.directorySectionHeader}>
              <Text style={styles.directorySectionTitle}>
                Tiendas Afiliadas ({filteredStores.length})
              </Text>
              <Text style={styles.directorySectionSubtitle}>
                Toca cualquier tienda para ingresar a su portal
              </Text>
            </View>

            {filteredStores.length === 0 ? (
              <View style={styles.emptyStoresContainer}>
                <Ionicons name="storefront-outline" size={48} color="#94A3B8" />
                <Text style={styles.emptyStoresTitle}>No se encontraron tiendas</Text>
                <Text style={styles.emptyStoresSubtitle}>
                  Prueba cambiando los términos de búsqueda o el filtro de ciudad.
                </Text>
              </View>
            ) : (
              filteredStores.map(storeItem => (
                <TouchableOpacity
                  key={storeItem.id}
                  style={styles.storeCard}
                  onPress={() => handleSelectStore(storeItem)}
                  activeOpacity={0.88}
                >
                  <View style={styles.storeCardLogoWrapper}>
                    {storeItem.id === 'einuushi' && (!storeItem.logoUrl || storeItem.logoUrl.includes('logo_einuushi')) ? (
                      <Image 
                        source={require('../assets/images/logo_einuushi.jpeg')} 
                        style={styles.storeCardLogo} 
                        resizeMode="contain"
                      />
                    ) : storeItem.logoUrl ? (
                      <Image 
                        source={{ uri: storeItem.logoUrl }} 
                        style={styles.storeCardLogo} 
                        resizeMode="contain"
                      />
                    ) : (
                      <View style={styles.storeCardPlaceholder}>
                        <Ionicons name="bag-handle" size={24} color="#1E2B58" />
                      </View>
                    )}
                  </View>

                  <View style={styles.storeCardInfo}>
                    <View style={styles.storeCardTopRow}>
                      <Text style={styles.storeCardName} numberOfLines={1}>
                        {storeItem.nombre}
                      </Text>
                      <View style={styles.activePill}>
                        <View style={styles.activeDot} />
                        <Text style={styles.activePillText}>Abierta</Text>
                      </View>
                    </View>

                    <Text style={styles.storeCardSlogan} numberOfLines={2}>
                      {storeItem.slogan || storeItem.descripcion || 'Comercio local afiliado a la red TODÁ APP'}
                    </Text>

                    <View style={styles.storeCardMeta}>
                      <View style={styles.storeLocationBadge}>
                        <Ionicons name="location-sharp" size={13} color="#059669" />
                        <Text style={styles.storeLocationText}>
                          {storeItem.ciudad || 'Colombia'}
                          {storeItem.departamento ? `, ${storeItem.departamento}` : ''}
                        </Text>
                      </View>

                      <View style={styles.enterStoreBtn}>
                        <Text style={styles.enterStoreBtnText}>Entrar</Text>
                        <Ionicons name="arrow-forward" size={14} color="#1E2B58" />
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>

          {/* Footer de la Plataforma */}
          <View style={styles.platformFooter}>
            <Text style={styles.platformFooterText}>
              TODÁ APP • Plataforma SaaS de Comercio & Envíos
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // =========================================================================
  // VISTA B: ACCESO Y BIENVENIDA A LA TIENDA SELECCIONADA (Estilo Einuushi)
  // =========================================================================
  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <StatusBar style="dark" />
      <ScrollView 
        contentContainerStyle={styles.scrollContainer} 
        showsVerticalScrollIndicator={true}
      >
        {/* Barra superior con botón para regresar al Directorio */}
        <View style={styles.storeHeaderNav}>
          <TouchableOpacity 
            style={styles.backToDirectoryBtn}
            onPress={handleBackToDirectory}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={16} color="#1E2B58" style={{ marginRight: 6 }} />
            <Text style={styles.backToDirectoryText}>Cambiar de Tienda</Text>
          </TouchableOpacity>

          <View style={styles.storeSedeBadge}>
            <Ionicons name="location" size={13} color="#059669" style={{ marginRight: 4 }} />
            <Text style={styles.storeSedeText}>
              {selectedStore.ciudad || 'Colombia'}
            </Text>
          </View>
        </View>
        
        {/* Cabecera con el Logo Oficial de la Tienda */}
        <View style={styles.logoContainer}>
          {renderStoreLogo(selectedStore)}
        </View>

        {/* Título de Bienvenida Dinámico */}
        <View style={styles.welcomeContainer}>
          <Text style={styles.welcomeTitle}>
            ¡Bienvenido/a a {selectedStore.nombre}!
          </Text>
          <Text style={styles.welcomeSubtitle}>
            {selectedStore.slogan || `Catálogo oficial y despachos desde ${selectedStore.ciudad || 'Colombia'}`}
          </Text>
        </View>

        {/* Formulario de Acceso a la Tienda */}
        <View style={styles.formContainer}>
          
          <View style={styles.inputWrapper}>
            <Ionicons name="mail-outline" size={20} color="#1E2B58" style={styles.inputIcon} />
            <TextInput
              style={[
                styles.input,
                Platform.OS === 'web' && ({ outlineStyle: 'none' } as any),
              ]}
              placeholder="Correo Electrónico"
              placeholderTextColor="#94A3B8"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputWrapper}>
            <Ionicons name="lock-closed-outline" size={20} color="#1E2B58" style={styles.inputIcon} />
            <TextInput
              style={[
                styles.input,
                Platform.OS === 'web' && ({ outlineStyle: 'none' } as any),
              ]}
              placeholder="Contraseña"
              placeholderTextColor="#94A3B8"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity 
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeIcon}
            >
              <Ionicons 
                name={showPassword ? 'eye-off-outline' : 'eye-outline'} 
                size={20} 
                color="#64748B" 
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={[styles.loginButton, isSubmitting && { opacity: 0.7 }]} 
            onPress={handleLogin}
            disabled={isSubmitting}
          >
            <Text style={styles.loginButtonText}>
              {isSubmitting ? 'VALIDANDO...' : 'INICIAR SESIÓN'}
            </Text>
          </TouchableOpacity>

          {/* Botón de acceso directo como invitado al catálogo de esta tienda */}
          <TouchableOpacity 
            style={styles.guestButton}
            onPress={handleExploreAsGuest}
            activeOpacity={0.85}
          >
            <Ionicons name="bag-check-outline" size={17} color="#1E2B58" style={{ marginRight: 8 }} />
            <Text style={styles.guestButtonText}>
              Explorar Catálogo sin Iniciar Sesión ➔
            </Text>
          </TouchableOpacity>

          <View style={styles.linksContainer}>
            <TouchableOpacity onPress={() => router.push('/forgot-password')}>
              <Text style={styles.linkText}>¿Olvidaste tu contraseña?</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ marginTop: 14 }} onPress={handleOpenRegister}>
              <Text style={styles.linkTextBold}>Crear cuenta nueva en esta tienda</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.driverPortalBtn}
              onPress={handleOpenDriverPortal}
              activeOpacity={0.8}
            >
              <Ionicons name="bicycle" size={17} color="#1E2B58" style={{ marginRight: 8 }} />
              <Text style={styles.driverPortalBtnText}>
                Portal de Repartidores & Envíos ➔
              </Text>
            </TouchableOpacity>
          </View>

        </View>

        {/* Footer Oficial de la Tienda */}
        <View style={styles.footerContainer}>
          <Text style={styles.footerText}>
            {selectedStore.nombre} • {selectedStore.ciudad || 'Colombia'}
          </Text>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBFBFA',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 36,
  },

  // =========================================================================
  // ESTILOS DIRECTORIO
  // =========================================================================
  directoryScrollContainer: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  directoryHeader: {
    backgroundColor: '#0F172A',
    paddingTop: Platform.OS === 'web' ? 36 : 56,
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  directoryBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 12,
  },
  directoryBadgeText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  directoryTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  directorySubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 6,
    lineHeight: 18,
  },
  directorySearchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    marginTop: 20,
  },
  directorySearchInput: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 13,
  },
  cityFilterContainer: {
    paddingTop: 14,
    gap: 8,
  },
  cityChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  cityChipActive: {
    backgroundColor: '#C5A880',
    borderColor: '#C5A880',
  },
  cityChipText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  cityChipTextActive: {
    color: '#0F172A',
    fontWeight: '800',
  },
  directoryBody: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  directorySectionHeader: {
    marginBottom: 16,
  },
  directorySectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E2B58',
  },
  directorySectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  emptyStoresContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyStoresTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#475569',
    marginTop: 12,
  },
  emptyStoresSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 260,
  },
  storeCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    alignItems: 'center',
  },
  storeCardLogoWrapper: {
    width: 68,
    height: 68,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: 14,
  },
  storeCardLogo: {
    width: '100%',
    height: '100%',
  },
  storeCardPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeCardInfo: {
    flex: 1,
  },
  storeCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  storeCardName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    flex: 1,
    marginRight: 8,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 4,
  },
  activePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  storeCardSlogan: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
    marginBottom: 8,
  },
  storeCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  storeLocationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  storeLocationText: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '600',
    marginLeft: 4,
  },
  enterStoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  enterStoreBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E2B58',
    marginRight: 4,
  },
  platformFooter: {
    alignItems: 'center',
    marginTop: 24,
    paddingHorizontal: 20,
  },
  platformFooterText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },

  // =========================================================================
  // ESTILOS LOGIN DE LA TIENDA
  // =========================================================================
  storeHeaderNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  backToDirectoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  backToDirectoryText: {
    fontSize: 12,
    color: '#1E2B58',
    fontWeight: '700',
  },
  storeSedeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  storeSedeText: {
    fontSize: 11,
    color: '#065F46',
    fontWeight: '700',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoImage: {
    width: 260,  
    height: 110, 
  },
  storeLogoPlaceholder: {
    width: 110,
    height: 110,
    borderRadius: 24,
    backgroundColor: '#F1F5F9',
    borderWidth: 2,
    borderColor: '#C5A880',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeLogoPlaceholderText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1E2B58',
    marginTop: 4,
  },
  welcomeContainer: {
    alignItems: 'center',
    marginBottom: 25,
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E2B58',
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#C5A880',
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
    paddingHorizontal: 16,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#1E293B',
  },
  eyeIcon: {
    padding: 6,
  },
  loginButton: {
    backgroundColor: '#1E2B58',
    borderWidth: 1.5,
    borderColor: '#C5A880',
    borderRadius: 30,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  guestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 30,
    height: 48,
    marginTop: 12,
  },
  guestButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E2B58',
  },
  linksContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  linkText: {
    fontSize: 13,
    color: '#64748B',
  },
  linkTextBold: {
    fontSize: 14,
    color: '#1E2B58',
    fontWeight: '700',
  },
  driverPortalBtn: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  driverPortalBtnText: {
    fontSize: 12,
    color: '#1E2B58',
    fontWeight: 'bold',
  },
  footerContainer: {
    alignItems: 'center',
    marginTop: 36,
  },
  footerText: {
    fontSize: 11,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
});
