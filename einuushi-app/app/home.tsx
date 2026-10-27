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
  Linking,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { WebView } from 'react-native-webview';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { 
  getOrders, 
  saveOrder, 
  updateOrderStatusInDb, 
  updateOrderRatingInDb, 
  getNotificationsFromDb, 
  saveNotificationToDb, 
  markNotificationAsReadInDb,
  getCategories,
  getProducts,
  deductStockForOrder,
  getChatMessages,
  sendChatMessage,
  markChatMessagesAsRead,
  toggleProductFavoriteInDb,
  logAdminActivity,
  ChatMessage,
  Category
} from '../services/database';

// Catálogo de imágenes oficiales alojadas 100% en Supabase Storage
const SUPABASE_FALLBACK_IMAGES: Record<string, string> = {
  mochila1: 'https://ismvmlcemxkawdwextzk.supabase.co/storage/v1/object/public/einuushi-media/crafts/mochila1.jpg',
  mochila2: 'https://ismvmlcemxkawdwextzk.supabase.co/storage/v1/object/public/einuushi-media/crafts/mochila2.jpg',
  manta1: 'https://ismvmlcemxkawdwextzk.supabase.co/storage/v1/object/public/einuushi-media/crafts/manta1.jpg',
  chinchorro1: 'https://ismvmlcemxkawdwextzk.supabase.co/storage/v1/object/public/einuushi-media/crafts/chinchorro1.jpg',
  sombrero1: 'https://ismvmlcemxkawdwextzk.supabase.co/storage/v1/object/public/einuushi-media/crafts/sombrero1.jpg',
};

const COUNTRY_OPTIONS = [
  { label: 'Colombia', value: 'Colombia' },
  { label: 'Venezuela', value: 'Venezuela' },
  { label: 'Ecuador', value: 'Ecuador' },
  { label: 'Panamá', value: 'Panamá' },
  { label: 'Estados Unidos', value: 'Estados Unidos' },
];

const DEPARTMENT_OPTIONS = [
  { label: 'La Guajira', value: 'La Guajira' },
  { label: 'Cesar', value: 'Cesar' },
  { label: 'Magdalena', value: 'Magdalena' },
  { label: 'Atlántico', value: 'Atlántico' },
  { label: 'Bolívar', value: 'Bolívar' },
  { label: 'Antioquia', value: 'Antioquia' },
  { label: 'Bogotá D.C.', value: 'Bogotá D.C.' },
];

const CITY_OPTIONS = [
  { label: 'Riohacha ($ 5.000 COP)', value: 'Riohacha' },
  { label: 'Maicao (Otra ciudad - $ 16.000 COP)', value: 'Maicao' },
  { label: 'Uribia (Otra ciudad - $ 16.000 COP)', value: 'Uribia' },
  { label: 'Manaure (Otra ciudad - $ 16.000 COP)', value: 'Manaure' },
  { label: 'Valledupar (Otra ciudad - $ 16.000 COP)', value: 'Valledupar' },
  { label: 'Santa Marta (Otra ciudad - $ 16.000 COP)', value: 'Santa Marta' },
  { label: 'Barranquilla (Otra ciudad - $ 16.000 COP)', value: 'Barranquilla' },
  { label: 'Cartagena (Otra ciudad - $ 16.000 COP)', value: 'Cartagena' },
  { label: 'Medellín (Otra ciudad - $ 16.000 COP)', value: 'Medellín' },
  { label: 'Bogotá (Otra ciudad - $ 16.000 COP)', value: 'Bogotá' },
];

const PAYMENT_METHOD_OPTIONS = [
  { label: 'Efectivo contra entrega', value: 'Efectivo contra entrega' },
  { label: 'Tarjeta débito', value: 'Tarjeta débito' },
  { label: 'PSE', value: 'PSE' },
  { label: 'Tarjeta de crédito', value: 'Tarjeta de crédito' },
  { label: 'Código QR', value: 'Código QR' },
];



export default function HomeScreen() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isAdminPreview = mode === 'admin_preview';
  const { currentUser, logout, updateProfile } = useAuth();

  // En modo vista previa de administrador, aislar totalmente la cuenta y datos privados de clientes
  const effectiveUser = isAdminPreview ? null : currentUser;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  
  const [isCartModalVisible, setIsCartModalVisible] = useState(false);
  const [isCheckoutModalVisible, setIsCheckoutModalVisible] = useState(false);
  const [isAlertsModalVisible, setIsAlertsModalVisible] = useState(false);
  const [isQrModalVisible, setIsQrModalVisible] = useState(false);
  const [isTrackingModalVisible, setIsTrackingModalVisible] = useState(false);
  
  // Chat con Administrador
  const [isChatModalVisible, setIsChatModalVisible] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [hasUnreadChat, setHasUnreadChat] = useState(false);

  // Perfil del Usuario
  const [isProfileModalVisible, setIsProfileModalVisible] = useState(false);
  const [profileTab, setProfileTab] = useState<'personal' | 'security'>('personal');
  const [profFullName, setProfFullName] = useState(effectiveUser?.fullName || '');
  const [profCedula, setProfCedula] = useState(effectiveUser?.cedula || '');
  const [profPhone, setProfPhone] = useState(effectiveUser?.phone || '');
  const [profCity, setProfCity] = useState(effectiveUser?.city || '');
  const [profAvatar, setProfAvatar] = useState(effectiveUser?.avatar || '');
  const [profNewPassword, setProfNewPassword] = useState('');
  const [profConfirmPassword, setProfConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  
  const [activeTrackingOrder, setActiveTrackingOrder] = useState<any>(null);
  const [simulationProgress, setSimulationProgress] = useState(10);
  const [deliveryRating, setDeliveryRating] = useState(0);
  const [mapProvider, setMapProvider] = useState<'google' | 'osm'>('google');

  const [clientName, setClientName] = useState(effectiveUser?.fullName || '');
  const [clientCedula, setClientCedula] = useState(effectiveUser?.cedula || '');
  const [clientPhone, setClientPhone] = useState(effectiveUser?.phone || '');
  const [clientCountry, setClientCountry] = useState('Colombia');
  const [clientDepartment, setClientDepartment] = useState('La Guajira');
  const [clientCity, setClientCity] = useState(effectiveUser?.city || 'Riohacha');
  const [clientNeighborhood, setClientNeighborhood] = useState('');
  const [clientStreetAddress, setClientStreetAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Efectivo contra entrega');
  const [nativePickerModal, setNativePickerModal] = useState<{
    title: string;
    options: { label: string; value: string }[];
    selectedValue: string;
    onSelect: (val: string) => void;
  } | null>(null);

  // Sincronizar automáticamente datos del cliente si el usuario cambia
  useEffect(() => {
    if (effectiveUser) {
      if (effectiveUser.fullName) setClientName(effectiveUser.fullName);
      if (effectiveUser.cedula) setClientCedula(effectiveUser.cedula);
      if (effectiveUser.phone) setClientPhone(effectiveUser.phone);
      if (effectiveUser.city) setClientCity(effectiveUser.city);
      setProfFullName(effectiveUser.fullName || '');
      setProfCedula(effectiveUser.cedula || '');
      setProfPhone(effectiveUser.phone || '');
      setProfCity(effectiveUser.city || '');
      setProfAvatar(effectiveUser.avatar || '');
    } else {
      setClientName('');
      setClientCedula('');
      setClientPhone('');
      setClientCity('Riohacha');
      setProfFullName('');
      setProfCedula('');
      setProfPhone('');
      setProfCity('');
      setProfAvatar('');
    }
  }, [effectiveUser]);

  const [orderCounter, setOrderCounter] = useState(1);
  const [orders, setOrders] = useState<any[]>([]);
  const [aiUnreadCount, setAiUnreadCount] = useState(1);
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    orderId: string;
    title: string;
    message: string;
    time: string;
    read: boolean;
  }>>([]);
  const [notificationsUnreadCount, setNotificationsUnreadCount] = useState(0);
  const [inAppToast, setInAppToast] = useState<{
    id: string;
    title: string;
    message: string;
    orderId: string;
  } | null>(null);

  const activeOrdersCount = orders.filter(ord => ord.statusCode !== 'DELIVERED').length;

  const [categories, setCategories] = useState<Category[]>([]);

  // Estado para visualizador de foto a pantalla completa (Lightbox)
  const [previewImage, setPreviewImage] = useState<{
    source: any;
    title: string;
    price?: string;
    description?: string;
    category?: string;
  } | null>(null);

  const handleOpenImagePreview = (
    source: any,
    title: string,
    price?: string,
    description?: string,
    category?: string
  ) => {
    if (!source) return;
    setPreviewImage({ source, title, price, description, category });
  };

  const handleCloseImagePreview = () => {
    setPreviewImage(null);
  };

  // Cargar datos locales sincronizados desde SQLite con Drizzle ORM (Offline-First)
  const loadLocalDbData = useCallback(async () => {
    try {
      // Cargar Categorías sincronizadas
      const dbCategories = await getCategories();
      if (dbCategories && dbCategories.length > 0) {
        setCategories(dbCategories);
      }

      // Cargar Artículos desde SQLite / Servidor compartido
      const dbProducts = await getProducts();
      if (dbProducts && Array.isArray(dbProducts)) {
        setProducts(prevProducts =>
          dbProducts.map(dbp => {
            const prev = prevProducts?.find(p => p.id === dbp.id);
            let localImage = null;
            if (dbp.imagePath) {
              if (
                dbp.imagePath.startsWith('http://') ||
                dbp.imagePath.startsWith('https://') ||
                dbp.imagePath.startsWith('data:') ||
                dbp.imagePath.startsWith('file://')
              ) {
                localImage = { uri: dbp.imagePath };
              } else if (SUPABASE_FALLBACK_IMAGES[dbp.imagePath]) {
                localImage = { uri: SUPABASE_FALLBACK_IMAGES[dbp.imagePath] };
              } else {
                localImage = { uri: `https://ismvmlcemxkawdwextzk.supabase.co/storage/v1/object/public/einuushi-media/crafts/${dbp.imagePath}.jpg` };
              }
            }

            return {
              id: dbp.id,
              name: dbp.name,
              category: dbp.categoryId,
              categoryId: dbp.categoryId,
              priceValue: dbp.priceValue,
              price: dbp.price,
              icon: dbp.icon,
              image: localImage,
              ancestralRef: dbp.ancestralRef,
              stock: dbp.stock,
              cartQuantity: prev ? prev.cartQuantity : 0,
              likes: dbp.likes,
              isLiked: prev ? prev.isLiked : false,
              discountPercent: dbp.discountPercent || 0,
              isDiscountActive: dbp.isDiscountActive || 0,
              isActive: dbp.isActive !== undefined ? dbp.isActive : 1,
            };
          })
        );
      }

      const userEmail = effectiveUser?.email;
      const storedOrders = userEmail ? await getOrders(userEmail) : [];
      if (storedOrders && storedOrders.length > 0) {
        // Detectar si algún pedido fue marcado como ARRIVED o DELIVERED externamente
        setOrders(prevOrders => {
          storedOrders.forEach(so => {
            const prev = prevOrders.find(o => o.id === so.id);
            if (prev && prev.statusCode === 'DISPATCHED' && so.statusCode === 'ARRIVED') {
              notifyOrderArrival(so);
            }
          });
          return storedOrders;
        });

        setOrderCounter(storedOrders.length + 1);
        setActiveTrackingOrder((prev: any) => {
          if (!prev) return null;
          const found = storedOrders.find(o => o.id === prev.id);
          return found || prev;
        });
      } else {
        setOrders([]);
      }

      if (userEmail) {
        const storedNotifs = await getNotificationsFromDb();
        if (storedNotifs && storedNotifs.length > 0) {
          const userOrderIds = new Set(storedOrders.map(o => o.id));
          const relevantNotifs = storedNotifs.filter(n => userOrderIds.has(n.orderId));
          setNotifications(relevantNotifs);
          setNotificationsUnreadCount(relevantNotifs.filter(n => !n.read).length);
        } else {
          setNotifications([]);
          setNotificationsUnreadCount(0);
        }

        const storedMsgs = await getChatMessages(userEmail);
        if (storedMsgs) {
          setChatMessages(storedMsgs);
          const unread = storedMsgs.some(m => m.senderRole === 'admin' && (m.read === 0 || !m.read));
          setHasUnreadChat(unread);
        }
      } else {
        setNotifications([]);
        setNotificationsUnreadCount(0);
        setChatMessages([]);
        setHasUnreadChat(false);
      }
    } catch (err) {
      console.warn('Error sincronizando datos en vista cliente:', err);
    }
  }, [effectiveUser?.email]);

  // Sincronizar al entrar a la pantalla
  useFocusEffect(
    useCallback(() => {
      loadLocalDbData();
    }, [loadLocalDbData])
  );

  // Sincronización continua cada 2.5s para reflejar cambios del Web Admin en Expo Go en tiempo real
  useEffect(() => {
    loadLocalDbData();

    const autoSyncInterval = setInterval(() => {
      loadLocalDbData();
    }, 2500);

    return () => clearInterval(autoSyncInterval);
  }, [loadLocalDbData]);

  const notifyOrderArrival = (order: any) => {
    const notifId = `notif-${order.id}-${Date.now()}`;
    const newNotif = {
      id: notifId,
      orderId: order.id,
      title: `¡Tu pedido ${order.id} ya llegó a tu dirección!`,
      message: `El repartidor José Guajiro está en tu puerta (${order.client?.address || 'tu dirección'}). Recibe tu paquete y califica el servicio.`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      read: false,
    };

    setNotifications(prev => {
      if (prev.some(n => n.orderId === order.id && n.title.includes('ya llegó'))) {
        return prev;
      }
      // Guardar notificación en Base de Datos SQLite Drizzle
      saveNotificationToDb(newNotif).catch(e => console.warn('Error saving notif to db:', e));
      return [newNotif, ...prev];
    });

    setNotificationsUnreadCount(prev => prev + 1);

    setInAppToast({
      id: `toast-${Date.now()}`,
      title: `¡Tu pedido ${order.id} ya llegó a tu dirección! 🛵`,
      message: `El repartidor José Guajiro está esperando en tu puerta. Toca aquí para marcar como recibido y calificar.`,
      orderId: order.id
    });
  };

  useEffect(() => {
    if (inAppToast) {
      const timer = setTimeout(() => {
        setInAppToast(null);
      }, 9000);
      return () => clearTimeout(timer);
    }
  }, [inAppToast]);



  // 🛵 MONITOREO CONTINUO EN TIEMPO REAL: Si un pedido despachado ya cumplió su tiempo estimado de llegada
  useEffect(() => {
    const arrivalInterval = setInterval(() => {
      const now = Date.now();
      setOrders(prevOrders => {
        let hasChanges = false;
        const updated = prevOrders.map(order => {
          if (order.statusCode === 'DISPATCHED' && order.dispatchedAt) {
            const timeSinceDispatch = now - order.dispatchedAt;
            // Si pasaron más de 18 segundos desde que el admin lo despachó, marcar como llegado
            if (timeSinceDispatch >= 18000) {
              hasChanges = true;
              notifyOrderArrival(order);
              updateOrderStatusInDb(order.id, {
                status: '🛵 ¡El repartidor ha llegado a tu dirección!',
                statusCode: 'ARRIVED',
                eta: 'El repartidor está esperando en la puerta',
              }).catch(e => console.warn('DB update order ARRIVED error:', e));

              return {
                ...order,
                status: '🛵 ¡El repartidor ha llegado a tu dirección!',
                statusCode: 'ARRIVED',
                eta: 'El repartidor está esperando en la puerta',
              };
            }
          }
          return order;
        });

        if (hasChanges) {
          setActiveTrackingOrder((prev: any) => {
            if (prev && prev.statusCode === 'DISPATCHED') {
              return {
                ...prev,
                status: '🛵 ¡El repartidor ha llegado a tu dirección!',
                statusCode: 'ARRIVED',
                eta: 'El repartidor está esperando en la puerta',
              };
            }
            return prev;
          });
          setSimulationProgress(100);
        }

        return hasChanges ? updated : prevOrders;
      });
    }, 2000);

    return () => clearInterval(arrivalInterval);
  }, []);

  // Animación suave de la barra de progreso en vivo cuando el modal de seguimiento está abierto
  useEffect(() => {
    let timer: any;
    if (isTrackingModalVisible) {
      if (activeTrackingOrder?.statusCode === 'DELIVERED' || activeTrackingOrder?.statusCode === 'ARRIVED') {
        setSimulationProgress(100);
        setDeliveryRating(activeTrackingOrder.rating || 0);
      } else if (activeTrackingOrder?.statusCode === 'DISPATCHED') {
        const elapsed = Date.now() - (activeTrackingOrder.dispatchedAt || (Date.now() - 3000));
        const calcProgress = Math.min(100, Math.max(10, Math.floor((elapsed / 18000) * 100)));
        setSimulationProgress(calcProgress);
        setDeliveryRating(activeTrackingOrder.rating || 0);

        timer = setInterval(() => {
          setSimulationProgress(prev => {
            if (prev >= 100) {
              clearInterval(timer);
              return 100;
            }
            return Math.min(100, prev + 15);
          });
        }, 1500);
      }
    }
    return () => clearInterval(timer);
  }, [isTrackingModalVisible, activeTrackingOrder?.id, activeTrackingOrder?.statusCode, activeTrackingOrder?.dispatchedAt]);

  useEffect(() => {
    if (simulationProgress === 100 && activeTrackingOrder && activeTrackingOrder.statusCode === 'DISPATCHED') {
      notifyOrderArrival(activeTrackingOrder);

      // Persistir cambio a ARRIVED en SQLite Drizzle ORM
      updateOrderStatusInDb(activeTrackingOrder.id, {
        status: '🛵 ¡El repartidor ha llegado a tu dirección!',
        statusCode: 'ARRIVED',
        eta: 'El repartidor está esperando en la puerta'
      }).catch(e => console.warn('DB update order error:', e));

      setOrders(prevOrders =>
        prevOrders.map(ord => {
          if (ord.id === activeTrackingOrder.id) {
            return {
              ...ord,
              status: '🛵 ¡El repartidor ha llegado a tu dirección!',
              statusCode: 'ARRIVED',
              eta: 'El repartidor está esperando en la puerta'
            };
          }
          return ord;
        })
      );

      setActiveTrackingOrder((prev: any) => prev ? {
        ...prev,
        status: '🛵 ¡El repartidor ha llegado a tu dirección!',
        statusCode: 'ARRIVED',
        eta: 'El repartidor está esperando en la puerta'
      } : null);
    }
  }, [simulationProgress]);

  const handleLogout = async () => {
    if (isAdminPreview) {
      router.replace('/admin');
      return;
    }
    await logout();
    router.replace('/');
  };

  const toggleLike = (id: string) => {
    setProducts(prevProducts =>
      prevProducts.map(product => {
        if (product.id === id) {
          const newIsLiked = !product.isLiked;
          if (currentUser?.id) {
            toggleProductFavoriteInDb(currentUser.id, id, newIsLiked).catch(() => {});
          }
          return {
            ...product,
            isLiked: newIsLiked,
            likes: newIsLiked ? product.likes + 1 : product.likes - 1,
          };
        }
        return product;
      })
    );
  };

  const showAlert = (title: string, message?: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert(message ? `${title}\n\n${message}` : title);
    } else {
      Alert.alert(title, message || '');
    }
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void, onCancel?: () => void) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const res = window.confirm(`${title}\n\n${message}`);
      if (res) onConfirm();
      else if (onCancel) onCancel();
    } else {
      Alert.alert(
        title,
        message,
        [
          { text: 'Cancelar', style: 'cancel', onPress: onCancel },
          { text: 'Aceptar', onPress: onConfirm },
        ],
        { cancelable: true }
      );
    }
  };

  const confirmAddToCart = (product: any) => {
    const currentQty = product.cartQuantity || 0;
    if (currentQty >= product.stock) {
      showAlert('Límite de Stock', `Solo hay ${product.stock} unidades disponibles de este artículo.`);
      return;
    }

    setProducts(prevProducts =>
      prevProducts.map(p => {
        if (p.id === product.id) {
          return { ...p, cartQuantity: (p.cartQuantity || 0) + 1 };
        }
        return p;
      })
    );
  };

  const confirmRemoveFromCart = (product: any) => {
    if (!product.cartQuantity || product.cartQuantity <= 0) return;

    setProducts(prevProducts =>
      prevProducts.map(p => {
        if (p.id === product.id) {
          return { ...p, cartQuantity: Math.max(0, p.cartQuantity - 1) };
        }
        return p;
      })
    );
  };

  // Abrir chat y marcar mensajes de tienda como leídos
  const handleOpenChatModal = async () => {
    if (isAdminPreview) {
      Alert.alert(
        'Chat Privado de Clientes',
        'Estás navegando en Modo Vista Previa de Tienda. Las conversaciones de chat pertenecen de manera privada a cada cliente.\n\nPara responder y gestionar la comunicación con los clientes, utiliza la pestaña "Mensajes de Clientes" en el Panel de Administración.',
        [
          { text: 'Ir al Panel Admin', onPress: () => router.replace('/admin') },
          { text: 'Cerrar', style: 'cancel' }
        ]
      );
      return;
    }
    setIsChatModalVisible(true);
    setHasUnreadChat(false);
    const clientEmail = effectiveUser?.email || 'cliente@einuushi.com';
    await markChatMessagesAsRead(clientEmail, 'client');
  };

  // Enviar mensaje del cliente al Administrador
  const handleSendClientMessage = async () => {
    if (isAdminPreview) return;
    const text = chatInput.trim();
    if (!text || isSendingChat) return;

    setIsSendingChat(true);
    const clientEmail = effectiveUser?.email || 'cliente@einuushi.com';
    const clientName = effectiveUser?.fullName || 'Cliente Einuushi';

    // Inserción optimista para respuesta instantánea
    const tempMsg: ChatMessage = {
      id: `MSG-${Date.now()}`,
      userId: effectiveUser?.id,
      userEmail: clientEmail,
      userName: clientName,
      senderRole: 'client',
      message: text,
      createdAt: new Date().toISOString(),
      read: 0,
    };
    setChatMessages(prev => [...prev, tempMsg]);
    setChatInput('');

    try {
      await sendChatMessage({
        userId: effectiveUser?.id,
        userEmail: clientEmail,
        userName: clientName,
        senderRole: 'client',
        message: text,
      });
    } catch (err) {
      console.warn('Error enviando mensaje de chat:', err);
    } finally {
      setIsSendingChat(false);
    }
  };

  // Abrir modal de perfil
  const handleOpenProfileModal = () => {
    if (isAdminPreview) {
      Alert.alert(
        'Acceso Protegido',
        'Las cuentas de los clientes son privadas. Como administrador estás en la vista previa del catálogo y no tienes acceso a la cuenta de ningún cliente.\n\nPara gestionar el perfil de un cliente, dicho usuario debe iniciar sesión desde la pantalla de clientes con sus propias credenciales.',
        [{ text: 'Entendido' }]
      );
      return;
    }
    setProfFullName(effectiveUser?.fullName || '');
    setProfCedula(effectiveUser?.cedula || '');
    setProfPhone(effectiveUser?.phone || '');
    setProfCity(effectiveUser?.city || '');
    setProfAvatar(effectiveUser?.avatar || '');
    setProfNewPassword('');
    setProfConfirmPassword('');
    setProfileTab('personal');
    setIsProfileModalVisible(true);
  };

  // Seleccionar o cambiar foto de perfil (móvil y web)
  const handlePickAvatar = async () => {
    try {
      if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e: any) => {
          const file = e.target?.files?.[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = (readerEvent: any) => {
              const base64Data = readerEvent.target?.result as string;
              setProfAvatar(base64Data);
            };
            reader.readAsDataURL(file);
          }
        };
        input.click();
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permiso Requerido', 'Se requiere acceso a tu galería para cambiar la foto de perfil.');
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.7,
          base64: true,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
          const asset = result.assets[0];
          const base64Uri = asset.base64 
            ? `data:image/jpeg;base64,${asset.base64}` 
            : asset.uri;
          setProfAvatar(base64Uri);
        }
      }
    } catch (error) {
      console.error('Error al seleccionar foto:', error);
      Alert.alert('Error', 'No se pudo seleccionar la imagen de perfil.');
    }
  };

  // Guardar datos personales y foto
  const handleSavePersonalData = async () => {
    if (!profFullName.trim()) {
      Alert.alert('Campo obligatorio', 'Por favor ingresa tu nombre completo.');
      return;
    }
    setIsSavingProfile(true);
    try {
      const res = await updateProfile({
        fullName: profFullName.trim(),
        cedula: profCedula.trim(),
        phone: profPhone.trim(),
        city: profCity.trim(),
        avatar: profAvatar,
      });
      if (res.success) {
        Alert.alert('¡Perfil Actualizado!', 'Tus datos personales y foto se guardaron con éxito.');
        setIsProfileModalVisible(false);
      } else {
        Alert.alert('Error', res.message || 'No se pudieron guardar los cambios.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Error al actualizar datos personales.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Cambiar contraseña
  const handleUpdatePassword = async () => {
    if (!profNewPassword) {
      Alert.alert('Campo obligatorio', 'Ingresa una nueva contraseña.');
      return;
    }
    if (profNewPassword.length < 6) {
      Alert.alert('Seguridad', 'La nueva contraseña debe tener mínimo 6 caracteres.');
      return;
    }
    if (profNewPassword !== profConfirmPassword) {
      Alert.alert('No coinciden', 'La confirmación de la contraseña no coincide.');
      return;
    }
    setIsSavingProfile(true);
    try {
      const res = await updateProfile({
        password: profNewPassword,
      });
      if (res.success) {
        Alert.alert('¡Contraseña Actualizada!', 'Tu contraseña ha sido cambiada exitosamente.');
        setProfNewPassword('');
        setProfConfirmPassword('');
        setIsProfileModalVisible(false);
      } else {
        Alert.alert('Error', res.message || 'No se pudo actualizar la contraseña.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Error al cambiar la contraseña.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const calculateShippingCost = (country: string, city: string) => {
    if (country !== 'Colombia') return 100000;
    if (city.toLowerCase() === 'riohacha') return 5000;
    return 16000;
  };

  // Helper para calcular precio final con descuento si está activo
  const getProductFinalPrice = (product: any): number => {
    if (product.isDiscountActive === 1 && product.discountPercent && product.discountPercent > 0) {
      return Math.round(product.priceValue * (1 - product.discountPercent / 100));
    }
    return product.priceValue;
  };

  const cartItems = products.filter(product => product.cartQuantity > 0);
  const totalCartItems = cartItems.reduce((sum, product) => sum + product.cartQuantity, 0);
  const subtotalProductsValue = cartItems.reduce((sum, product) => sum + (getProductFinalPrice(product) * product.cartQuantity), 0);
  const shippingCostValue = calculateShippingCost(clientCountry, clientCity);
  const finalTotalValue = subtotalProductsValue + (cartItems.length > 0 ? shippingCostValue : 0);

  const handleProceedToCheckout = () => {
    if (isAdminPreview) {
      Alert.alert(
        'Operación No Permitida',
        'Las cuentas y operaciones de los clientes son privadas. Como administrador solo estás visualizando el catálogo en modo vista previa.\n\nLas compras y pagos solo pueden ser ejecutados por los clientes al iniciar sesión con sus respectivas credenciales.',
        [{ text: 'Entendido' }]
      );
      return;
    }
    showConfirm(
      '¿Proceder al Checkout?',
      '¿Estás seguro de proceder al formulario de envío y pago de tu pedido?',
      () => {
        setIsCartModalVisible(false);
        setIsCheckoutModalVisible(true);
      }
    );
  };

  const handleFinalSubmitOrder = () => {
    let missingFields: string[] = [];

    if (!clientName.trim()) missingFields.push('Nombre Completo');
    if (!clientCedula.trim()) missingFields.push('Cédula / NIT');
    if (!clientPhone.trim()) missingFields.push('Teléfono de Contacto');
    if (!clientNeighborhood.trim()) missingFields.push('Barrio');
    if (!clientStreetAddress.trim()) missingFields.push('Dirección / Nomenclatura');

    if (missingFields.length > 0) {
      showAlert('Datos Incompletos', `Por favor, complete los siguientes datos obligatorios que faltan:\n\n• ${missingFields.join('\n• ')}`);
      return;
    }

    if (paymentMethod === 'Código QR') {
      setIsCheckoutModalVisible(false);
      setIsQrModalVisible(true);
      return;
    }

    processAndSaveOrder('Pendiente de despacho en tienda (En cola)');
  };

  const handleQrPaymentConfirmed = () => {
    showConfirm(
      'Confirmación de Pago QR',
      '¿Confirma que ya realizó el escaneo y pago exitoso a través del código QR de Einuushi?',
      () => {
        setIsQrModalVisible(false);
        processAndSaveOrder('Pagado vía QR - Pendiente de despacho en tienda');
      }
    );
  };

  const processAndSaveOrder = (statusText: string) => {
    const isContraentrega = paymentMethod.toLowerCase().includes('contra');
    const paymentPrompt = isContraentrega 
      ? `¿Confirmar el pedido a nombre de ${clientName} por un total de $ ${finalTotalValue.toLocaleString()} COP (Incluye costo de envío)?\n\n💵 Método: Efectivo contra entrega (Pagarás al repartidor al recibir el paquete).`
      : `¿Confirmar el envío a nombre de ${clientName} por un total de $ ${finalTotalValue.toLocaleString()} COP (Incluye costo de envío)?\n\n💳 Método: ${paymentMethod}`;

    showConfirm(
      'Confirmación de Pedido',
      paymentPrompt,
      () => {
      const fullAddress = `${clientStreetAddress}, Barrio ${clientNeighborhood}, ${clientCity}, ${clientDepartment}, ${clientCountry}`;

      const paddedNumber = String(orderCounter).padStart(10, '0');
      const orderId = `P-${paddedNumber}`;

      const newOrder = {
        id: orderId,
        userId: currentUser?.id,
        userEmail: currentUser?.email,
        date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        client: {
          name: clientName,
          cedula: clientCedula,
          phone: clientPhone,
          address: fullAddress,
          payment: paymentMethod,
        },
        city: clientCity,
        country: clientCountry,
        items: cartItems,
        subtotal: subtotalProductsValue,
        shipping: shippingCostValue,
        total: finalTotalValue,
        status: isContraentrega ? 'Pendiente de despacho (Pago contra entrega)' : 'Pendiente de despacho en tienda',
        statusCode: 'PENDING',
        paymentStatus: isContraentrega ? 'PENDING' : 'PAID',
        settlementStatus: (isContraentrega ? 'PENDING_SETTLEMENT' : 'SETTLED') as 'PENDING_SETTLEMENT' | 'SETTLED',
        driverName: 'José Guajiro',
        eta: 'Esperando despacho por parte del administrador',
        rating: 0
      };

      // Descontar de forma definitiva el stock en SQLite con Drizzle ORM
      deductStockForOrder(cartItems)
        .then(updatedDbProducts => {
          setProducts(prevProducts =>
            prevProducts.map(p => {
              const matched = updatedDbProducts.find(up => up.id === p.id);
              return {
                ...p,
                stock: matched ? matched.stock : p.stock,
                cartQuantity: 0
              };
            })
          );
        })
        .catch(err => {
          console.warn('Error descontando stock en SQLite Drizzle:', err);
          setProducts(prevProducts =>
            prevProducts.map(p => {
              if (p.cartQuantity > 0) {
                return {
                  ...p,
                  stock: Math.max(0, p.stock - p.cartQuantity),
                  cartQuantity: 0
                };
              }
              return p;
            })
          );
        });

      setOrders(prevOrders => [newOrder, ...prevOrders]);
      setOrderCounter(prev => prev + 1);
      setIsCheckoutModalVisible(false);
      setIsQrModalVisible(false);

      // Persistir nuevo pedido en Base de Datos SQLite con Drizzle ORM (Offline-First)
      saveOrder(newOrder).catch(err => console.warn('Error saving order to SQLite Drizzle:', err));
      
      // Guardar notificación inicial de pedido registrado en espera de despacho
      const initialNotif = {
        id: `notif-${orderId}-${Date.now()}`,
        orderId: orderId,
        title: `Pedido ${orderId} registrado con éxito`,
        message: `Tu pedido #${orderId} ha sido registrado y está en estado Pendiente de despacho. El administrador lo despachará en breve para habilitar el seguimiento en vivo.`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        read: false
      };
      saveNotificationToDb(initialNotif).catch(e => console.warn('Error saving notif:', e));
      setNotifications(prev => [initialNotif, ...prev]);
      setNotificationsUnreadCount(prev => prev + 1);

      setClientName('');
      setClientCedula('');
      setClientPhone('');
      setClientNeighborhood('');
      setClientStreetAddress('');

      showAlert(
        '¡Pedido Registrado con Éxito!',
        `¡Pedido ${orderId} registrado!\n\nEstado actual: "Pendiente de despacho".\n\nEl administrador despachará tu pedido desde el panel y en ese momento recibirás la notificación para hacerle seguimiento en vivo.`
      );
      },
      () => {
        if (paymentMethod === 'Código QR') {
          setIsQrModalVisible(true);
        } else {
          setIsCheckoutModalVisible(true);
        }
      }
    );
  };

  const handleMarkOrderAsReceived = (orderId: string) => {
    const now = new Date();
    const formattedReceivedAt = `${now.toLocaleDateString('es-CO')} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    const currentOrder = orders.find(o => o.id === orderId);
    const isContra = (currentOrder?.client?.payment || '').toLowerCase().includes('contra') || (currentOrder?.client?.payment || '').toLowerCase().includes('efectivo');

    const newSettlementStatus = isContra ? 'PENDING_SETTLEMENT' : (currentOrder?.settlementStatus || 'SETTLED');
    const statusMsg = '¡Pedido Recibido y Pagado a Satisfacción! ✅';

    // Persistir estado de recibido y liquidación en base de datos
    updateOrderStatusInDb(orderId, {
      status: statusMsg,
      statusCode: 'DELIVERED',
      paymentStatus: 'PAID',
      settlementStatus: newSettlementStatus,
      eta: 'Entrega finalizada',
      receivedAt: formattedReceivedAt,
    }).catch(err => console.warn('Error updating order status in SQLite Drizzle:', err));

    // Registrar trazabilidad para el administrador
    logAdminActivity({
      adminEmail: effectiveUser?.email || 'cliente@einuushi.com',
      adminName: effectiveUser?.fullName || 'Cliente Einuushi',
      actionType: 'DELIVERY_CONFIRMED',
      entityType: 'PEDIDO',
      entityId: orderId,
      details: `El cliente confirmó la recepción y pago del pedido #${orderId} el ${formattedReceivedAt}.${isContra ? ' Dinero en efectivo en poder del repartidor José Guajiro (Pendiente entrega en tienda y Paz y Salvo).' : ' Venta finalizada.'}`,
    }).catch(e => console.warn('Error logging admin activity:', e));

    setOrders(prevOrders =>
      prevOrders.map(ord => {
        if (ord.id === orderId) {
          return {
            ...ord,
            status: statusMsg,
            statusCode: 'DELIVERED',
            paymentStatus: 'PAID',
            settlementStatus: newSettlementStatus,
            eta: 'Entrega finalizada',
            receivedAt: formattedReceivedAt,
          };
        }
        return ord;
      })
    );

    setActiveTrackingOrder((prev: any) => {
      if (prev && prev.id === orderId) {
        return {
          ...prev,
          status: statusMsg,
          statusCode: 'DELIVERED',
          paymentStatus: 'PAID',
          settlementStatus: newSettlementStatus,
          eta: 'Entrega finalizada',
          receivedAt: formattedReceivedAt,
        };
      }
      return prev;
    });

    showAlert(
      '¡Pedido Recibido a Satisfacción!',
      `Has confirmado la recepción de tu pedido #${orderId}.\n\n📅 Fecha y Hora de Entrega: ${formattedReceivedAt}\n\n¡La venta fue registrada y cargada exitosamente al sistema!`
    );

    setNotifications(prev =>
      prev.map(n => {
        if (n.orderId === orderId) {
          markNotificationAsReadInDb(n.id).catch(e => console.warn('Error marking notif read in db:', e));
          return { ...n, read: true };
        }
        return n;
      })
    );

    showAlert('Pedido Recibido', '¡Excelente! Has marcado tu pedido como recibido a satisfacción.\nPor favor califica tu experiencia de entrega con las 5 estrellas.');
  };

  const handleRatingSubmit = (stars: number, orderId?: string) => {
    const targetId = orderId || activeTrackingOrder?.id;
    setDeliveryRating(stars);

    if (targetId) {
      // Persistir calificación de 5 estrellas en SQLite Drizzle ORM
      updateOrderRatingInDb(targetId, stars).catch(err => 
        console.warn('Error saving rating to SQLite Drizzle:', err)
      );
    }

    setOrders(prevOrders =>
      prevOrders.map(ord => {
        if (ord.id === targetId) {
          const isContra = ord.client?.payment?.toLowerCase().includes('contra');
          return { 
            ...ord, 
            rating: stars,
            statusCode: 'DELIVERED',
            paymentStatus: 'PAID',
            status: '¡Pedido Recibido y Calificado con Éxito! ⭐',
            eta: isContra ? 'Entrega finalizada (Pagado a satisfacción)' : 'Entrega finalizada'
          };
        }
        return ord;
      })
    );
    setActiveTrackingOrder((prev: any) => {
      if (prev && prev.id === targetId) {
        const isContra = prev.client?.payment?.toLowerCase().includes('contra');
        return { 
          ...prev, 
          rating: stars,
          statusCode: 'DELIVERED',
          paymentStatus: 'PAID',
          status: '¡Pedido Recibido y Calificado con Éxito! ⭐',
          eta: isContra ? 'Entrega finalizada (Pagado a satisfacción)' : 'Entrega finalizada'
        };
      }
      return prev;
    });
    showAlert('¡Muchas Gracias!', `¡Muchas gracias! Has calificado la entrega con ${stars} de 5 estrellas ⭐.\nTu calificación fue guardada exitosamente.`);
  };

  const closeTrackingModalAndOpenAlerts = () => {
    setIsTrackingModalVisible(false);
    setIsAlertsModalVisible(true);
  };

  const targetMapAddress = activeTrackingOrder?.client?.address 
    ? `${activeTrackingOrder.client.address}, ${activeTrackingOrder.city || 'Riohacha'}, La Guajira, Colombia`
    : 'Riohacha, La Guajira, Colombia';

  const googleMapEmbedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(targetMapAddress)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
  const osmMapEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=-72.94%2C11.52%2C-72.88%2C11.56&layer=mapnik&marker=11.5444%2C-72.9072`;
  const externalGoogleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(targetMapAddress)}`;

  const handleOpenExternalMap = () => {
    Linking.openURL(externalGoogleMapsUrl).catch(err => {
      console.error('Error al abrir Google Maps:', err);
      showAlert('Error al Abrir Mapa', 'No se pudo abrir la aplicación externa de Google Maps.');
    });
  };

  const filteredProducts = products.filter(product => {
    // La vista cliente SOLO muestra artículos activos
    const isActive = (product as any).isActive !== 0;
    const matchesCategory = selectedCategory ? product.category === selectedCategory : true;
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
    return isActive && matchesCategory && matchesSearch;
  });

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Notificación Toast Flotante cuando el repartidor llega */}
      {inAppToast && (
        <View style={styles.inAppToastContainer}>
          <View style={{flexDirection: 'row', alignItems: 'center', flex: 1}}>
            <View style={styles.inAppToastIconCircle}>
              <Ionicons name="bicycle" size={20} color="#FFFFFF" />
            </View>
            <View style={{marginLeft: 10, flex: 1}}>
              <Text style={styles.inAppToastTitle}>{inAppToast.title}</Text>
              <Text style={styles.inAppToastMessage} numberOfLines={2}>{inAppToast.message}</Text>
            </View>
          </View>
          <TouchableOpacity 
            style={styles.inAppToastActionBtn}
            onPress={() => {
              const matched = orders.find(o => o.id === inAppToast.orderId);
              if (matched) {
                setActiveTrackingOrder(matched);
                setIsTrackingModalVisible(true);
              } else {
                setIsAlertsModalVisible(true);
              }
              setInAppToast(null);
            }}
          >
            <Text style={styles.inAppToastActionText}>Ver</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => setInAppToast(null)} 
            style={{padding: 4, marginLeft: 6}}
          >
            <Ionicons name="close" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}
      
      {/* Banner de Modo Vista Previa Administrador */}
      {isAdminPreview && (
        <View style={styles.adminPreviewBanner}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <Ionicons name="shield-checkmark" size={18} color="#C5A880" style={{ marginRight: 8 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.adminPreviewTitle}>MODO VISTA PREVIA ADMINISTRADOR</Text>
              <Text style={styles.adminPreviewSubtitle}>Navegación de catálogo • Cuentas de clientes privadas y protegidas</Text>
            </View>
          </View>
          <TouchableOpacity 
            style={styles.adminPreviewReturnBtn}
            onPress={() => router.replace('/admin')}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.adminPreviewReturnText}>Volver al Panel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Cabecera */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSubtitle}>Artesanías de Riohacha</Text>
          <Text style={styles.headerTitle}>EINUUSHI</Text>
        </View>
        <View style={styles.headerIconsRow}>
          
          {/* Botón Diseñador IA */}
          <TouchableOpacity 
            style={styles.iconButton} 
            onPress={() => {
              setAiUnreadCount(0);
              router.push('/ai-designer');
            }}
          >
            <Ionicons name="sparkles-outline" size={20} color="#1E2B58" />
            {aiUnreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{aiUnreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          
          {/* Botón de la Campanita */}
          <TouchableOpacity 
            style={styles.iconButton} 
            onPress={() => {
              setNotificationsUnreadCount(0);
              setIsAlertsModalVisible(true);
            }}
          >
            <Ionicons name="notifications-outline" size={20} color="#1E2B58" />
            {(activeOrdersCount > 0 || notificationsUnreadCount > 0) && (
              <View style={[styles.badge, notificationsUnreadCount > 0 && { backgroundColor: '#DC2626' }]}>
                <Text style={styles.badgeText}>
                  {notificationsUnreadCount > 0 ? notificationsUnreadCount : activeOrdersCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          
          {/* Botón del Carrito */}
          <TouchableOpacity 
            style={styles.iconButton} 
            onPress={() => setIsCartModalVisible(true)}
          >
            <Ionicons name="cart-outline" size={20} color="#1E2B58" />
            {totalCartItems > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{totalCartItems}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Botón de Chat con Administrador */}
          <TouchableOpacity 
            style={styles.iconButton} 
            onPress={handleOpenChatModal}
          >
            <Ionicons name="chatbubbles-outline" size={20} color="#1E2B58" />
            {hasUnreadChat && (
              <View style={[styles.badge, { backgroundColor: '#C5A880' }]}>
                <Text style={styles.badgeText}>•</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Botón Salir */}
          <TouchableOpacity 
            style={styles.iconButtonLogout} 
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={20} color="#1E2B58" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={styles.contentContainer} 
        showsVerticalScrollIndicator={true}
      >
        
        {/* Barra del Usuario Conectado (Presiona para editar perfil) */}
        {isAdminPreview ? (
          <View style={[styles.userProfileCard, { borderColor: '#8B5CF6', backgroundColor: '#FAF5FF' }]}>
            <View style={[styles.userAvatar, { backgroundColor: '#8B5CF6' }]}>
              <Ionicons name="shield-checkmark" size={20} color="#FFFFFF" />
            </View>
            <View style={styles.userInfoBox}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.userNameHighlight, { color: '#6D28D9' }]}>
                  Administrador (Modo Vista Previa)
                </Text>
              </View>
              <View style={styles.userSubtitleRow}>
                <Ionicons name="lock-closed" size={11} color="#8B5CF6" style={{ marginRight: 2 }} />
                <Text style={[styles.userCityText, { color: '#7C3AED' }]}>Navegación de Catálogo • Clientes Privados</Text>
              </View>
            </View>
            <TouchableOpacity 
              style={{ backgroundColor: '#1E2B58', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, flexDirection: 'row', alignItems: 'center' }}
              onPress={() => router.replace('/admin')}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-back" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 11 }}>Panel Admin</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity 
            style={styles.userProfileCard}
            onPress={handleOpenProfileModal}
            activeOpacity={0.85}
          >
            <View style={styles.userAvatar}>
              {currentUser?.avatar ? (
                <Image 
                  source={{ uri: currentUser.avatar }} 
                  style={{ width: 38, height: 38, borderRadius: 19 }} 
                />
              ) : (
                <Text style={styles.userAvatarInitials}>
                  {currentUser?.fullName
                    ? currentUser.fullName
                        .split(' ')
                        .map(w => w[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()
                    : 'U'}
                </Text>
              )}
            </View>
            <View style={styles.userInfoBox}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.userGreeting}>Hola, </Text>
                <Text style={styles.userNameHighlight} numberOfLines={1}>
                  {currentUser?.fullName || 'Cliente Einuushi'}
                </Text>
                <Ionicons name="pencil-outline" size={13} color="#C5A880" style={{ marginLeft: 4 }} />
              </View>
              <View style={styles.userSubtitleRow}>
                <Ionicons name="location-sharp" size={11} color="#C5A880" style={{ marginRight: 2 }} />
                <Text style={styles.userCityText}>{currentUser?.city || 'Riohacha, La Guajira'}</Text>
                <Text style={styles.userDivider}>•</Text>
                <Text style={styles.userEmailText} numberOfLines={1}>{currentUser?.email || ''}</Text>
              </View>
            </View>
            {currentUser?.role === 'admin' ? (
              <TouchableOpacity 
                style={{ backgroundColor: '#C5A880', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, flexDirection: 'row', alignItems: 'center' }}
                onPress={() => router.push('/admin')}
              >
                <Ionicons name="shield-checkmark" size={13} color="#1E2B58" style={{ marginRight: 4 }} />
                <Text style={{ color: '#1E2B58', fontWeight: 'bold', fontSize: 11 }}>Panel Admin</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.sessionBadge}>
                <View style={styles.sessionDot} />
                <Text style={styles.sessionBadgeText}>Mi Perfil</Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        {/* Barra de Búsqueda */}
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color="#C5A880" style={styles.searchIcon} />
          <TextInput
            style={[
              styles.searchInput,
              Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)
            ]}
            placeholder="¿Qué pieza wayuu buscas hoy?"
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchButton}>
              <Ionicons name="close-circle" size={18} color="#C5A880" />
            </TouchableOpacity>
          )}
        </View>

        {/* Banner Principal */}
        <View style={styles.bannerCard}>
          <View style={styles.bannerTextContainer}>
            <Text style={styles.bannerTag}>COLECCIÓN EXCLUSIVA</Text>
            <Text style={styles.bannerTitle}>Tejidos Ancestrales</Text>
            <Text style={styles.bannerSubtitle}>Hecho a mano en La Guajira</Text>
          </View>
          <View style={styles.bannerIconBox}>
            <Ionicons name="sparkles" size={32} color="#C5A880" />
          </View>
        </View>

        {/* Título de Categorías */}
        <Text style={styles.sectionTitle}>Categorías</Text>

        {/* Botones de Filtro Dinámicos desde Base de Datos */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bubblesScroll}>
          <TouchableOpacity 
            style={styles.bubbleItem} 
            activeOpacity={0.7}
            onPress={() => setSelectedCategory(null)}
          >
            <View style={[styles.bubbleCircle, selectedCategory === null && styles.bubbleCircleActive]}>
              <Ionicons name="grid-outline" size={24} color={selectedCategory === null ? '#FFFFFF' : '#1E2B58'} />
            </View>
            <Text style={[styles.bubbleText, selectedCategory === null && styles.bubbleTextActive]}>Todos</Text>
          </TouchableOpacity>

          {(categories.length > 0 ? categories : [
            { id: 'Mochilas', name: 'Mochilas', icon: 'bag-handle-outline' },
            { id: 'Mantas', name: 'Mantas', icon: 'shirt-outline' },
            { id: 'Chinchorros', name: 'Chinchorros', icon: 'git-commit-outline' },
            { id: 'Accesorios', name: 'Accesorios', icon: 'color-palette-outline' },
          ]).map(cat => (
            <TouchableOpacity 
              key={cat.id}
              style={styles.bubbleItem} 
              activeOpacity={0.7}
              onPress={() => setSelectedCategory(cat.id)}
            >
              <View style={[styles.bubbleCircle, selectedCategory === cat.id && styles.bubbleCircleActive]}>
                <Ionicons 
                  name={(cat.icon as any) || 'pricetag-outline'} 
                  size={24} 
                  color={selectedCategory === cat.id ? '#FFFFFF' : '#1E2B58'} 
                />
              </View>
              <Text style={[styles.bubbleText, selectedCategory === cat.id && styles.bubbleTextActive]}>{cat.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Sección de Artículos */}
        <Text style={styles.sectionTitle}>
          {selectedCategory ? `Mostrando: ${selectedCategory}` : searchQuery ? `Búsqueda: "${searchQuery}"` : 'Destacados en Riohacha'}
        </Text>

        <View style={styles.gridContainer}>
          {filteredProducts.length > 0 ? (
            filteredProducts.map(product => (
              <View key={product.id} style={styles.productCard}>
                <View style={styles.productImageWrapper}>
                  {/* Etiqueta de Categoría Elegante */}
                  <View style={styles.categoryBadgeOnImage}>
                    <Text style={styles.categoryBadgeText}>{product.category || (product as any).categoryId}</Text>
                  </View>

                  {/* Etiqueta de Descuento si está activo */}
                  {(product as any).isDiscountActive === 1 && (product as any).discountPercent && (product as any).discountPercent > 0 && (
                    <View style={styles.clientDiscountTag}>
                      <Text style={styles.clientDiscountTagText}>-{(product as any).discountPercent}% OFF</Text>
                    </View>
                  )}

                  {product.image ? (
                    <TouchableOpacity
                      activeOpacity={0.9}
                      style={styles.productImageTouch}
                      onPress={() => handleOpenImagePreview(
                        product.image,
                        product.name,
                        product.price,
                        product.ancestralRef,
                        product.category || (product as any).categoryId
                      )}
                    >
                      <Image source={product.image} style={styles.productImage} resizeMode="contain" />
                      <View style={styles.imageZoomBadge}>
                        <Ionicons name="expand-outline" size={12} color="#FFFFFF" />
                        <Text style={styles.imageZoomBadgeText}>Ver foto</Text>
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.placeholderIconContainer}>
                      <Ionicons name={product.icon as any} size={45} color="#1E2B58" />
                    </View>
                  )}
                  
                  <TouchableOpacity 
                    style={styles.favoriteButton}
                    onPress={() => toggleLike(product.id)}
                    activeOpacity={0.8}
                  >
                    <Ionicons 
                      name={product.isLiked ? "heart" : "heart-outline"} 
                      size={18} 
                      color={product.isLiked ? "#C5A880" : "#1E2B58"} 
                    />
                  </TouchableOpacity>
                </View>

                <View style={styles.productInfoContainer}>
                  <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
                  
                  <Text style={styles.ancestralText} numberOfLines={2}>
                    {product.ancestralRef}
                  </Text>

                  <View style={styles.stockRow}>
                    <Ionicons name="cube-outline" size={12} color="#64748B" />
                    <Text style={styles.stockText}>Disponibles: <Text style={styles.stockNumber}>{product.stock}</Text></Text>
                  </View>
                  
                  <View style={styles.priceLikeRow}>
                    {(product as any).isDiscountActive === 1 && (product as any).discountPercent && (product as any).discountPercent > 0 ? (
                      <View>
                        <Text style={styles.clientCrossedPrice}>$ {product.priceValue.toLocaleString('es-CO')}</Text>
                        <Text style={styles.clientDiscountPrice}>
                          $ {Math.round(product.priceValue * (1 - (product as any).discountPercent / 100)).toLocaleString('es-CO')} COP
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.productPrice}>{product.price}</Text>
                    )}
                    <View style={styles.likesContainer}>
                      <Ionicons name="heart" size={12} color="#C5A880" style={{ marginRight: 3 }} />
                      <Text style={styles.likesCountText}>{product.likes}</Text>
                    </View>
                  </View>

                  <View style={styles.cartActionRow}>
                    <TouchableOpacity 
                      style={[styles.cartButton, styles.removeButton]}
                      onPress={() => confirmRemoveFromCart(product)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="remove" size={16} color="#1E2B58" />
                    </TouchableOpacity>

                    <View style={styles.cartQuantityBadge}>
                      <Text style={styles.cartQuantityText}>{product.cartQuantity}</Text>
                    </View>

                    <TouchableOpacity 
                      style={[styles.cartButton, styles.addButton]}
                      onPress={() => confirmAddToCart(product)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="add" size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.noResultsContainer}>
              <Text style={styles.noResultsText}>No hay artículos disponibles para esta selección o búsqueda.</Text>
            </View>
          )}
        </View>

      </ScrollView>

      {/* 1. VENTANA MODAL DEL CARRITO DE COMPRAS */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isCartModalVisible}
        onRequestClose={() => setIsCartModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            
            <View style={styles.modalHeader}>
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <Ionicons name="cart" size={22} color="#1E2B58" style={{marginRight: 8}} />
                <Text style={styles.modalTitle}>Tu Carrito Einuushi</Text>
              </View>
              <TouchableOpacity onPress={() => setIsCartModalVisible(false)}>
                <Ionicons name="close" size={24} color="#1E2B58" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={true}>
              {cartItems.length > 0 ? (
                cartItems.map(item => (
                  <View key={item.id} style={styles.cartItemRow}>
                    <View style={styles.cartItemInfo}>
                      <Text style={styles.cartItemName}>{item.name}</Text>
                      <Text style={styles.cartItemUnitPrice}>{item.price} c/u</Text>
                    </View>
                    <View style={styles.cartItemActionContainer}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <TouchableOpacity
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 6,
                            backgroundColor: '#F1F5F9',
                            justifyContent: 'center',
                            alignItems: 'center',
                          }}
                          onPress={() => confirmRemoveFromCart(item)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="remove" size={14} color="#1E2B58" />
                        </TouchableOpacity>
                        <Text style={styles.cartItemQty}>Cant: {item.cartQuantity}</Text>
                        <TouchableOpacity
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 6,
                            backgroundColor: '#1E2B58',
                            justifyContent: 'center',
                            alignItems: 'center',
                          }}
                          onPress={() => confirmAddToCart(item)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="add" size={14} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.cartItemSubtotal}>
                        $ {(item.priceValue * item.cartQuantity).toLocaleString()} COP
                      </Text>
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.emptyCartContainer}>
                  <Ionicons name="cart-outline" size={50} color="#CBD5E1" />
                  <Text style={styles.emptyCartText}>Tu carrito está vacío.</Text>
                  <Text style={styles.emptyCartSubText}>Explora el catálogo y añade piezas artesanales wayuu.</Text>
                </View>
              )}
            </ScrollView>

            {cartItems.length > 0 && (
              <View style={styles.modalFooter}>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total:</Text>
                  <Text style={styles.totalValue}>$ {subtotalProductsValue.toLocaleString()} + Envío</Text>
                </View>

                <TouchableOpacity 
                  style={styles.checkoutButton}
                  onPress={handleProceedToCheckout}
                >
                  <Text style={styles.checkoutButtonText}>Proceder al Envío y Pago</Text>
                </TouchableOpacity>
              </View>
            )}

          </View>
        </View>
      </Modal>

      {/* 2. VENTANA MODAL DE DATOS DE ENVÍO Y PAGO */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isCheckoutModalVisible}
        onRequestClose={() => setIsCheckoutModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            
            <View style={styles.modalHeader}>
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <Ionicons name="cube" size={22} color="#1E2B58" style={{marginRight: 8}} />
                <Text style={styles.modalTitle}>Datos de Envío y Pago</Text>
              </View>
              <TouchableOpacity onPress={() => setIsCheckoutModalVisible(false)}>
                <Ionicons name="close" size={24} color="#1E2B58" />
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.modalBody} 
              showsVerticalScrollIndicator={true}
              contentContainerStyle={{paddingRight: 6}}
            >
              <Text style={styles.formLabel}>Nombre Completo *</Text>
              <TextInput
                style={[styles.formInput, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]}
                placeholder="Ej. María Cotes"
                placeholderTextColor="#94A3B8"
                value={clientName}
                onChangeText={setClientName}
              />

              <Text style={styles.formLabel}>Cédula / NIT * (Solo Números)</Text>
              <TextInput
                style={[styles.formInput, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]}
                placeholder="Ej. 40123456"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                value={clientCedula}
                onChangeText={(val) => setClientCedula(val.replace(/[^0-9]/g, ''))}
              />

              <Text style={styles.formLabel}>Teléfono de Contacto * (Solo Números)</Text>
              <TextInput
                style={[styles.formInput, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]}
                placeholder="Ej. 3001234567"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
                value={clientPhone}
                onChangeText={(val) => setClientPhone(val.replace(/[^0-9]/g, ''))}
              />

              <Text style={styles.formLabel}>País *</Text>
              <TouchableOpacity 
                style={styles.pickerSelector}
                onPress={() => setNativePickerModal({
                  title: 'Seleccionar País',
                  options: COUNTRY_OPTIONS,
                  selectedValue: clientCountry,
                  onSelect: (val) => setClientCountry(val),
                })}
              >
                <Text style={styles.pickerSelectorText}>{clientCountry}</Text>
                <Ionicons name="chevron-down" size={18} color="#64748B" />
              </TouchableOpacity>

              <Text style={styles.formLabel}>Departamento / Estado *</Text>
              <TouchableOpacity 
                style={styles.pickerSelector}
                onPress={() => setNativePickerModal({
                  title: 'Seleccionar Departamento / Estado',
                  options: DEPARTMENT_OPTIONS,
                  selectedValue: clientDepartment,
                  onSelect: (val) => setClientDepartment(val),
                })}
              >
                <Text style={styles.pickerSelectorText}>{clientDepartment}</Text>
                <Ionicons name="chevron-down" size={18} color="#64748B" />
              </TouchableOpacity>

              <Text style={styles.formLabel}>Ciudad *</Text>
              <TouchableOpacity 
                style={styles.pickerSelector}
                onPress={() => setNativePickerModal({
                  title: 'Seleccionar Ciudad',
                  options: CITY_OPTIONS,
                  selectedValue: clientCity,
                  onSelect: (val) => setClientCity(val),
                })}
              >
                <Text style={styles.pickerSelectorText}>
                  {CITY_OPTIONS.find(c => c.value === clientCity)?.label || clientCity}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#64748B" />
              </TouchableOpacity>

              <Text style={styles.formLabel}>Barrio *</Text>
              <TextInput
                style={[styles.formInput, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]}
                placeholder="Ej. Centro, Coquivacoa, Arriba"
                placeholderTextColor="#94A3B8"
                value={clientNeighborhood}
                onChangeText={setClientNeighborhood}
              />

              <Text style={styles.formLabel}>Dirección / Nomenclatura *</Text>
              <TextInput
                style={[styles.formInput, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]}
                placeholder="Ej. Calle 15 # 8-20"
                placeholderTextColor="#94A3B8"
                value={clientStreetAddress}
                onChangeText={setClientStreetAddress}
              />

              <Text style={styles.formLabel}>Medio de Pago *</Text>
              <TouchableOpacity 
                style={styles.pickerSelector}
                onPress={() => setNativePickerModal({
                  title: 'Seleccionar Medio de Pago',
                  options: PAYMENT_METHOD_OPTIONS,
                  selectedValue: paymentMethod,
                  onSelect: (val) => setPaymentMethod(val),
                })}
              >
                <Text style={styles.pickerSelectorText}>{paymentMethod}</Text>
                <Ionicons name="chevron-down" size={18} color="#64748B" />
              </TouchableOpacity>

              <View style={styles.shippingSummaryBox}>
                <Text style={styles.shippingSummaryText}>📦 Tarifa de envío aplicada:</Text>
                <Text style={styles.shippingSummaryPrice}>$ {shippingCostValue.toLocaleString()} COP</Text>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total a Pagar (Con envío):</Text>
                <Text style={styles.totalValue}>$ {finalTotalValue.toLocaleString()} COP</Text>
              </View>

              <TouchableOpacity 
                style={styles.checkoutButton}
                onPress={handleFinalSubmitOrder}
              >
                <Text style={styles.checkoutButtonText}>Confirmar Pedido Definitivo</Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>

      {/* Selector modal nativo cross-platform para reemplazar selects HTML */}
      <Modal
        visible={!!nativePickerModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setNativePickerModal(null)}
      >
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerDialog}>
            <View style={styles.pickerHeaderRow}>
              <Text style={styles.pickerDialogTitle}>{nativePickerModal?.title}</Text>
              <TouchableOpacity onPress={() => setNativePickerModal(null)} style={{ padding: 4 }}>
                <Ionicons name="close" size={22} color="#1E2B58" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {nativePickerModal?.options.map((opt) => {
                const isSelected = opt.value === nativePickerModal.selectedValue;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.pickerOptionItem,
                      isSelected && styles.pickerOptionItemSelected,
                    ]}
                    onPress={() => {
                      nativePickerModal.onSelect(opt.value);
                      setNativePickerModal(null);
                    }}
                  >
                    <Text
                      style={[
                        styles.pickerOptionText,
                        isSelected && styles.pickerOptionTextSelected,
                      ]}
                    >
                      {opt.label}
                    </Text>
                    {isSelected && <Ionicons name="checkmark-circle" size={20} color="#1E2B58" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 3. VENTANA MODAL PARA EL PAGO POR CÓDIGO QR */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isQrModalVisible}
        onRequestClose={() => setIsQrModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, {alignItems: 'center'}]}>
            
            <View style={[styles.modalHeader, {width: '100%'}]}>
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <Ionicons name="qr-code" size={22} color="#1E2B58" style={{marginRight: 8}} />
                <Text style={styles.modalTitle}>Pago con Código QR Einuushi</Text>
              </View>
              <TouchableOpacity onPress={() => setIsQrModalVisible(false)}>
                <Ionicons name="close" size={24} color="#1E2B58" />
              </TouchableOpacity>
            </View>

            <View style={styles.qrContainerBox}>
              <Text style={styles.qrInstructions}>Escanee este código QR desde su aplicación bancaria para cancelar su pedido por valor de:</Text>
              <Text style={styles.qrTotalAmount}>$ {finalTotalValue.toLocaleString()} COP</Text>
              
              <View style={styles.qrPlaceholderBox}>
                <Ionicons name="qr-code-outline" size={130} color="#1E2B58" />
                <Text style={styles.qrStoreText}>EINUUSHI ARTESANÍAS</Text>
              </View>

              <Text style={styles.qrSubNote}>Una vez realizado el pago, presione el botón de confirmación inferior.</Text>
            </View>

            <View style={[styles.modalFooter, {width: '100%'}]}>
              <TouchableOpacity 
                style={styles.checkoutButton}
                onPress={handleQrPaymentConfirmed}
              >
                <Text style={styles.checkoutButtonText}>Confirmar Pago y Registrar Pedido</Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>

      {/* 4. VENTANA MODAL DE LA CAMPANITA (ESTADO DE PEDIDOS) */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isAlertsModalVisible}
        onRequestClose={() => setIsAlertsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            
            <View style={styles.modalHeader}>
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <Ionicons name="receipt-outline" size={22} color="#1E2B58" style={{marginRight: 8}} />
                <View>
                  <Text style={styles.modalTitle}>Historial de Pedidos y Alertas</Text>
                  {currentUser && (
                    <Text style={{fontSize: 11, color: '#C5A880', fontWeight: '600'}}>
                      Cliente: {currentUser.fullName} ({orders.length} pedidos)
                    </Text>
                  )}
                </View>
              </View>
              <TouchableOpacity onPress={() => setIsAlertsModalVisible(false)}>
                <Ionicons name="close" size={24} color="#1E2B58" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={true}>
              {/* Sección de Notificaciones y Avisos de Llegada */}
              {notifications.length > 0 && (
                <View style={styles.notificationsSectionBox}>
                  <View style={styles.notificationsSectionHeader}>
                    <Ionicons name="notifications" size={16} color="#DC2626" style={{marginRight: 6}} />
                    <Text style={styles.notificationsSectionTitle}>Avisos de Entrega ({notifications.length})</Text>
                  </View>
                  {notifications.map(notif => (
                    <TouchableOpacity 
                      key={notif.id} 
                      style={[styles.notifItemCard, !notif.read && styles.notifItemCardUnread]}
                      onPress={() => {
                        const matched = orders.find(o => o.id === notif.orderId);
                        if (matched) {
                          setActiveTrackingOrder(matched);
                          setIsAlertsModalVisible(false);
                          setIsTrackingModalVisible(true);
                        }
                      }}
                    >
                      <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 2}}>
                        <Ionicons name="bicycle-outline" size={14} color="#166534" style={{marginRight: 4}} />
                        <Text style={styles.notifItemTitle}>{notif.title}</Text>
                      </View>
                      <Text style={styles.notifItemMessage}>{notif.message}</Text>
                      <Text style={styles.notifItemTime}>⏰ {notif.time} • Toca para abrir mapa y calificar</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {orders.length > 0 ? (
                orders.map(order => (
                  <View key={order.id} style={styles.orderCard}>
                    <View style={styles.orderHeaderRow}>
                      <Text style={styles.orderIdText}>{order.id}</Text>
                      <Text style={styles.orderDateText}>{order.date}</Text>
                    </View>

                    <View style={[
                      styles.orderStatusContainer, 
                      order.statusCode === 'DISPATCHED' && { backgroundColor: '#DCFCE7' },
                      order.statusCode === 'ARRIVED' && { backgroundColor: '#FEF3C7' },
                      order.statusCode === 'DELIVERED' && { backgroundColor: '#E0E7FF' }
                    ]}>
                      <Ionicons 
                        name={order.statusCode === 'DELIVERED' ? "checkmark-circle-outline" : order.statusCode === 'ARRIVED' ? "bicycle" : order.statusCode === 'DISPATCHED' ? "bicycle-outline" : "time-outline"} 
                        size={14} 
                        color={order.statusCode === 'DELIVERED' ? "#3730A3" : order.statusCode === 'ARRIVED' ? "#92400E" : order.statusCode === 'DISPATCHED' ? "#166534" : "#B45309"} 
                        style={{marginRight: 4}} 
                      />
                      <Text style={[
                        styles.orderStatusText,
                        order.statusCode === 'DISPATCHED' && { color: '#166534' },
                        order.statusCode === 'ARRIVED' && { color: '#92400E' },
                        order.statusCode === 'DELIVERED' && { color: '#3730A3' }
                      ]}>
                        {order.status}
                      </Text>
                    </View>

                    <Text style={styles.etaText}>⏱️ {order.eta}</Text>

                    {/* Aviso cuando el repartidor llega a la dirección o si va en ruta */}
                    {(order.statusCode === 'ARRIVED' || order.statusCode === 'DISPATCHED') && (
                      <View style={[styles.orderArrivedNoticeBox, order.statusCode === 'DISPATCHED' && { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                        <Ionicons name="bicycle" size={20} color={order.statusCode === 'ARRIVED' ? "#166534" : "#1D4ED8"} style={{marginRight: 8}} />
                        <View style={{flex: 1}}>
                          <Text style={[styles.orderArrivedNoticeTitle, order.statusCode === 'DISPATCHED' && { color: '#1E40AF' }]}>
                            {order.statusCode === 'ARRIVED' ? '¡El repartidor ha llegado a tu dirección! 🛵' : '🛵 Repartidor en camino a tu domicilio'}
                          </Text>
                          <Text style={[styles.orderArrivedNoticeText, order.statusCode === 'DISPATCHED' && { color: '#1E3A8A' }]}>
                            {order.statusCode === 'ARRIVED' 
                              ? 'José Guajiro está en tu puerta esperando la entrega. Por favor confirma la recepción y pago:'
                              : 'José Guajiro está en tu zona. Si ya recibiste tu paquete, confirma la entrega y pago:'}
                          </Text>
                        </View>
                      </View>
                    )}

                    {/* Botón para Marcar el Pedido como Recibido */}
                    {(order.statusCode === 'ARRIVED' || order.statusCode === 'DISPATCHED') && (
                      <TouchableOpacity 
                        style={styles.markReceivedMainButton}
                        onPress={() => handleMarkOrderAsReceived(order.id)}
                      >
                        <Ionicons name="checkmark-done-circle" size={18} color="#FFFFFF" style={{marginRight: 6}} />
                        <Text style={styles.markReceivedMainButtonText}>Marcar Pedido como Recibido a Satisfacción ✅</Text>
                      </TouchableOpacity>
                    )}

                    <View style={styles.clientDetailsBox}>
                      <Text style={styles.clientDetailsTitle}>Datos de Envío:</Text>
                      <Text style={styles.clientDetailsText}>👤 {order.client.name} (CC: {order.client.cedula})</Text>
                      <Text style={styles.clientDetailsText}>📞 {order.client.phone}</Text>
                      <Text style={styles.clientDetailsText}>📍 {order.client.address}</Text>
                      <Text style={styles.clientDetailsText}>💳 Pago: {order.client.payment}</Text>
                    </View>

                    <View style={styles.orderItemsList}>
                      {order.items.map((it: any) => (
                        <Text key={it.id} style={styles.orderItemDetail}>
                          • {it.name} (x{it.cartQuantity}) - $ {(it.priceValue * it.cartQuantity).toLocaleString()} COP
                        </Text>
                      ))}
                      <Text style={styles.orderItemDetail}>
                        • 📦 Envío: $ {order.shipping.toLocaleString()} COP
                      </Text>
                    </View>

                    <View style={styles.orderTotalRow}>
                      <Text style={styles.orderTotalLabel}>
                        {order.client?.payment?.toLowerCase().includes('contra') && order.statusCode !== 'DELIVERED'
                          ? 'Total a Pagar (al recibir):'
                          : 'Total Pagado:'}
                      </Text>
                      <Text style={[
                        styles.orderTotalValue,
                        order.client?.payment?.toLowerCase().includes('contra') && order.statusCode !== 'DELIVERED' && { color: '#B45309' }
                      ]}>
                        $ {order.total.toLocaleString()} COP
                      </Text>
                    </View>

                    <View style={[
                      styles.paymentStatusBadge,
                      order.client?.payment?.toLowerCase().includes('contra') && order.statusCode !== 'DELIVERED'
                        ? styles.paymentBadgePending
                        : styles.paymentBadgePaid
                    ]}>
                      <Ionicons 
                        name={order.client?.payment?.toLowerCase().includes('contra') && order.statusCode !== 'DELIVERED' ? "time-outline" : "checkmark-circle"} 
                        size={13} 
                        color={order.client?.payment?.toLowerCase().includes('contra') && order.statusCode !== 'DELIVERED' ? "#B45309" : "#166534"} 
                        style={{marginRight: 4}} 
                      />
                      <Text style={[
                        styles.paymentBadgeText,
                        order.client?.payment?.toLowerCase().includes('contra') && order.statusCode !== 'DELIVERED'
                          ? { color: '#B45309' }
                          : { color: '#166534' }
                      ]}>
                        {order.client?.payment?.toLowerCase().includes('contra')
                          ? (order.statusCode === 'DELIVERED' ? 'Estado: Pagado al recibir a satisfacción ✅' : 'Estado: Pendiente por pagar al repartidor al recibir')
                          : 'Estado: Pagado con éxito ✅'}
                      </Text>
                    </View>

                    {/* Sistema de Calificación de 5 Estrellas en la Tarjeta */}
                    {(order.statusCode === 'DELIVERED' || order.statusCode === 'ARRIVED') && (
                      <View style={styles.orderRatingCardInline}>
                        <Text style={styles.orderRatingCardTitle}>
                          {order.rating > 0 ? '⭐ Tu Calificación del Envío:' : '⭐ Califica la Entrega (Toca una estrella):'}
                        </Text>
                        <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 2}}>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <TouchableOpacity key={star} onPress={() => handleRatingSubmit(star, order.id)} style={{padding: 4}}>
                              <Ionicons 
                                name={star <= (order.rating || 0) ? "star" : "star-outline"} 
                                size={26} 
                                color="#C5A880" 
                              />
                            </TouchableOpacity>
                          ))}
                        </View>
                        <Text style={styles.orderRatingCardSub}>
                          {order.rating > 0 
                            ? `Calificado con ${order.rating} de 5 estrellas. (Toca para cambiar)` 
                            : 'Toca una estrella para calificar el servicio'}
                        </Text>
                      </View>
                    )}

                    {order.statusCode === 'PENDING' && (
                      <View style={styles.orderPendingDispatchNotice}>
                        <Ionicons name="time-outline" size={16} color="#B45309" style={{ marginRight: 6 }} />
                        <Text style={styles.orderPendingDispatchNoticeText}>
                          ⏳ Pendiente de despacho: Tu pedido está en preparación en tienda. La administración lo despachará para habilitar el mapa y seguimiento en vivo.
                        </Text>
                      </View>
                    )}

                    {order.statusCode === 'DELIVERED' && order.receivedAt && (
                      <View style={styles.orderDeliveredNotice}>
                        <Ionicons name="checkmark-done-circle" size={16} color="#166534" style={{ marginRight: 6 }} />
                        <Text style={styles.orderDeliveredNoticeText}>
                          Venta confirmada • Entregado el: {order.receivedAt}
                        </Text>
                      </View>
                    )}

                    {(order.statusCode === 'DISPATCHED' || order.statusCode === 'ARRIVED' || order.statusCode === 'DELIVERED') && (
                      <TouchableOpacity 
                        style={[
                          styles.trackingLiveButton,
                          order.statusCode === 'DELIVERED' && { backgroundColor: '#1E2B58' },
                          order.statusCode === 'ARRIVED' && { backgroundColor: '#166534' }
                        ]}
                        onPress={() => {
                          setActiveTrackingOrder(order);
                          setIsAlertsModalVisible(false);
                          setIsTrackingModalVisible(true);
                        }}
                      >
                        <Ionicons name="map-outline" size={16} color="#FFFFFF" style={{marginRight: 6}} />
                        <Text style={styles.trackingLiveButtonText}>
                          {order.statusCode === 'DELIVERED' 
                            ? 'Ver Mapa, Detalle y Calificación 📍' 
                            : order.statusCode === 'ARRIVED'
                            ? 'Ver Mapa y Confirmar Llegada 🛵'
                            : 'Ver Mapa y Seguimiento en Vivo 📍'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))
              ) : (
                <View style={styles.emptyCartContainer}>
                  <Ionicons name="notifications-outline" size={50} color="#CBD5E1" />
                  <Text style={styles.emptyCartText}>No tienes pedidos recientes.</Text>
                  <Text style={styles.emptyCartSubText}>Los pedidos que confirmes aparecerán aquí para seguimiento.</Text>
                </View>
              )}
            </ScrollView>

          </View>
        </View>
      </Modal>

      {/* 5. VENTANA MODAL DE MAPA EN VIVO Y CALIFICACIÓN */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isTrackingModalVisible}
        onRequestClose={closeTrackingModalAndOpenAlerts}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, {height: '92%', paddingBottom: 10}]}>
            
            <View style={styles.modalHeader}>
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <Ionicons name="navigate-circle" size={24} color="#1E2B58" style={{marginRight: 8}} />
                <View>
                  <Text style={styles.modalTitle}>Seguimiento en Vivo</Text>
                  <Text style={{fontSize: 11, color: '#64748B'}}>Pedido: {activeTrackingOrder?.id}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={closeTrackingModalAndOpenAlerts} style={{padding: 4}}>
                <Ionicons name="close" size={24} color="#1E2B58" />
              </TouchableOpacity>
            </View>

            <ScrollView 
              showsVerticalScrollIndicator={true} 
              persistentScrollbar={true}
              style={styles.trackingModalScrollView} 
              contentContainerStyle={styles.trackingModalScrollContent}
            >
              {/* Selector de Proveedor de Mapa y Botón Externo */}
              <View style={styles.mapControlBar}>
                <View style={styles.mapSelectorGroup}>
                  <TouchableOpacity 
                    style={[styles.mapSelectorBtn, mapProvider === 'google' && styles.mapSelectorBtnActive]}
                    onPress={() => setMapProvider('google')}
                  >
                    <Ionicons 
                      name="map" 
                      size={13} 
                      color={mapProvider === 'google' ? '#FFFFFF' : '#1E2B58'} 
                      style={{marginRight: 4}} 
                    />
                    <Text style={[styles.mapSelectorBtnText, mapProvider === 'google' && styles.mapSelectorBtnTextActive]}>
                      Google Maps
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.mapSelectorBtn, mapProvider === 'osm' && styles.mapSelectorBtnActive]}
                    onPress={() => setMapProvider('osm')}
                  >
                    <Ionicons 
                      name="globe-outline" 
                      size={13} 
                      color={mapProvider === 'osm' ? '#FFFFFF' : '#1E2B58'} 
                      style={{marginRight: 4}} 
                    />
                    <Text style={[styles.mapSelectorBtnText, mapProvider === 'osm' && styles.mapSelectorBtnTextActive]}>
                      OpenStreetMap
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity 
                  style={styles.openExternalMapBtn}
                  onPress={handleOpenExternalMap}
                >
                  <Ionicons name="open-outline" size={13} color="#FFFFFF" style={{marginRight: 4}} />
                  <Text style={styles.openExternalMapBtnText}>Abrir App</Text>
                </TouchableOpacity>
              </View>

              {/* Contenedor del Mapa en Vivo */}
              <View style={styles.mapViewerContainer}>
                {Platform.OS === 'web' ? (
                  <iframe
                    src={mapProvider === 'google' ? googleMapEmbedUrl : osmMapEmbedUrl}
                    style={{ width: '100%', height: '100%', border: 'none', borderRadius: 12 }}
                    title="Mapa de seguimiento de entrega Einuushi"
                    loading="lazy"
                  />
                ) : (
                  <WebView
                    source={{ uri: mapProvider === 'google' ? googleMapEmbedUrl : osmMapEmbedUrl }}
                    style={{ flex: 1, borderRadius: 12 }}
                    startInLoadingState={true}
                  />
                )}

                {/* Badge flotante con la dirección de destino */}
                <View style={styles.mapFloatingAddressBadge}>
                  <Ionicons name="location" size={13} color="#C5A880" style={{marginRight: 4}} />
                  <Text style={styles.mapFloatingAddressText} numberOfLines={1}>
                    {activeTrackingOrder?.client?.address || 'Riohacha, La Guajira'}
                  </Text>
                </View>
              </View>

              {/* Banner Informativo de Pago Contra Entrega vs Pagado Previo */}
              {activeTrackingOrder?.client?.payment?.toLowerCase().includes('contra') ? (
                <View style={[
                  styles.trackingPaymentBox,
                  activeTrackingOrder.statusCode === 'DELIVERED' ? styles.trackingPaymentDeliveredBox : styles.trackingPaymentPendingBox
                ]}>
                  <Ionicons 
                    name={activeTrackingOrder.statusCode === 'DELIVERED' ? "checkmark-circle" : "cash-outline"} 
                    size={22} 
                    color={activeTrackingOrder.statusCode === 'DELIVERED' ? "#166534" : "#B45309"} 
                    style={{marginRight: 10}}
                  />
                  <View style={{flex: 1}}>
                    <Text style={[
                      styles.trackingPaymentHeader,
                      activeTrackingOrder.statusCode === 'DELIVERED' ? { color: '#166534' } : { color: '#92400E' }
                    ]}>
                      {activeTrackingOrder.statusCode === 'DELIVERED' ? 'TOTAL PAGADO AL RECIBIR:' : 'TOTAL A PAGAR EN EFECTIVO:'}
                    </Text>
                    <Text style={[
                      styles.trackingPaymentValue,
                      activeTrackingOrder.statusCode === 'DELIVERED' ? { color: '#166534' } : { color: '#B45309' }
                    ]}>
                      $ {activeTrackingOrder.total.toLocaleString()} COP
                    </Text>
                    <Text style={styles.trackingPaymentNote}>
                      {activeTrackingOrder.statusCode === 'DELIVERED' 
                        ? '✅ Pago recibido a satisfacción por el repartidor.' 
                        : '💵 Pago contra entrega: Recuerda pagar este monto en efectivo al repartidor al recibir tu pedido.'}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={[styles.trackingPaymentBox, styles.trackingPaymentDeliveredBox]}>
                  <Ionicons name="checkmark-done-circle" size={22} color="#166534" style={{marginRight: 10}} />
                  <View style={{flex: 1}}>
                    <Text style={[styles.trackingPaymentHeader, { color: '#166534' }]}>TOTAL PAGADO (PREVIO):</Text>
                    <Text style={[styles.trackingPaymentValue, { color: '#166534' }]}>
                      $ {activeTrackingOrder?.total.toLocaleString()} COP
                    </Text>
                    <Text style={styles.trackingPaymentNote}>
                      Pago ya liquidado exitosamente vía {activeTrackingOrder?.client?.payment}. No debes realizar ningún pago al repartidor.
                    </Text>
                  </View>
                </View>
              )}

              {/* Tarjeta de Datos del Repartidor */}
              <View style={styles.deliveryInfoCard}>
                <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 8}}>
                  <View style={styles.deliveryAvatarBox}>
                    <Ionicons name={activeTrackingOrder?.driverType === 'corporate' ? "business" : "person"} size={18} color="#1E2B58" />
                  </View>
                  <View style={{marginLeft: 10, flex: 1}}>
                    <Text style={styles.deliveryDriverName}>
                      {activeTrackingOrder?.driverType === 'corporate' ? '🚚 Empresa de Envíos: ' : '🛵 Repartidor: '}
                      {activeTrackingOrder?.driverName || 'José Guajiro'}
                    </Text>
                    <Text style={styles.deliveryDriverVehicle}>
                      {activeTrackingOrder?.driverType === 'corporate'
                        ? (activeTrackingOrder?.trackingGuideNumber ? `Guía Oficial: #${activeTrackingOrder.trackingGuideNumber}` : 'Despacho Nacional Aliado')
                        : 'Reparto Express Local'}
                    </Text>
                  </View>
                  {simulationProgress < 100 && (
                    <TouchableOpacity 
                      style={styles.callDriverButton} 
                      onPress={() => {
                        if (activeTrackingOrder?.driverType === 'corporate' && activeTrackingOrder?.carrierTrackingUrl) {
                          Linking.openURL(activeTrackingOrder.carrierTrackingUrl).catch(() => showAlert('Rastreo Web', `Guía: ${activeTrackingOrder.trackingGuideNumber}`));
                        } else {
                          showAlert('Contacto Logístico', `Contactando a ${activeTrackingOrder?.driverName || 'José Guajiro'} (${activeTrackingOrder?.driverPhone || '+57 300 000 0000'})...`);
                        }
                      }}
                    >
                      <Ionicons name={activeTrackingOrder?.driverType === 'corporate' ? "globe-outline" : "call"} size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.progressBarContainer}>
                  <View style={[styles.progressBarFill, { width: `${simulationProgress}%` }]} />
                </View>
                
                <Text style={styles.progressStatusText}>
                  {simulationProgress < 40 
                    ? '📦 Despachado: En camino hacia tu destino en Riohacha' 
                    : simulationProgress < 100 
                    ? '🛵 Repartidor en tu zona: Está a pocas cuadras de tu dirección' 
                    : activeTrackingOrder?.statusCode === 'ARRIVED'
                    ? '🛵 ¡El repartidor ha llegado a tu dirección! Confirma tu entrega abajo.'
                    : '🎉 ¡Pedido Entregado con Éxito y Recibido a Satisfacción!'}
                </Text>
              </View>

              {/* Botón de Confirmación cuando el repartidor llega a la dirección */}
              {(activeTrackingOrder?.statusCode === 'ARRIVED' || simulationProgress >= 100) && activeTrackingOrder?.statusCode !== 'DELIVERED' && (
                <View style={styles.orderArrivedActionCard}>
                  <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 6}}>
                    <Ionicons name="bicycle" size={24} color="#166534" style={{marginRight: 8}} />
                    <View style={{flex: 1}}>
                      <Text style={styles.orderArrivedActionTitle}>¡El repartidor ha llegado a tu puerta!</Text>
                      <Text style={styles.orderArrivedActionSub}>José Guajiro está en tu dirección con tu pedido.</Text>
                    </View>
                  </View>
                  <TouchableOpacity 
                    style={styles.markReceivedMainButton}
                    onPress={() => handleMarkOrderAsReceived(activeTrackingOrder.id)}
                  >
                    <Ionicons name="checkmark-done-circle" size={18} color="#FFFFFF" style={{marginRight: 6}} />
                    <Text style={styles.markReceivedMainButtonText}>Marcar Pedido como Recibido y Pagado a Satisfacción 🎉</Text>
                  </TouchableOpacity>
                </View>
              )}

              {activeTrackingOrder?.statusCode === 'DISPATCHED' && simulationProgress < 100 && (
                <TouchableOpacity 
                  style={[styles.markReceivedMainButton, { backgroundColor: '#1E2B58', marginTop: 10 }]}
                  onPress={() => handleMarkOrderAsReceived(activeTrackingOrder.id)}
                >
                  <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" style={{marginRight: 6}} />
                  <Text style={styles.markReceivedMainButtonText}>¿Ya llegó el repartidor? Marcar Recibido y Pagado ✅</Text>
                </TouchableOpacity>
              )}

              {/* Sistema de Calificación de 5 Estrellas (SIEMPRE VISIBLE) */}
              <View style={styles.ratingCardBox}>
                <Text style={styles.ratingTitle}>
                  {activeTrackingOrder?.statusCode === 'DELIVERED' 
                    ? '⭐ Calificación de tu experiencia de entrega:' 
                    : activeTrackingOrder?.statusCode === 'ARRIVED'
                    ? '⭐ ¡Tu pedido llegó! Califica el servicio (1 a 5 estrellas):'
                    : '⭐ Sistema de Calificación de Entrega (5 Estrellas):'}
                </Text>
                
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity 
                      key={star} 
                      onPress={() => handleRatingSubmit(star, activeTrackingOrder?.id)}
                      style={{paddingHorizontal: 6, paddingVertical: 4}}
                    >
                      <Ionicons 
                        name={star <= (activeTrackingOrder?.rating || deliveryRating) ? "star" : "star-outline"} 
                        size={32} 
                        color="#C5A880" 
                      />
                    </TouchableOpacity>
                  ))}
                </View>
                
                <Text style={styles.ratingSubText}>
                  {(activeTrackingOrder?.rating || deliveryRating) > 0 
                    ? `¡Gracias! Calificaste con ${activeTrackingOrder?.rating || deliveryRating} de 5 estrellas. (Toca para cambiar)` 
                    : activeTrackingOrder?.statusCode === 'ARRIVED'
                    ? 'Toca una estrella para registrar tu calificación'
                    : 'Toca las estrellas para calificar cuando recibas tu pedido'}
                </Text>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.checkoutButton}
                onPress={closeTrackingModalAndOpenAlerts}
              >
                <Text style={styles.checkoutButtonText}>Volver a Mis Pedidos (Campanita)</Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>

      {/* ================================================================= */}
      {/* MODAL: CHAT EN VIVO CON LA ADMINISTRACIÓN                         */}
      {/* ================================================================= */}
      <Modal
        visible={isChatModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsChatModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '85%', maxWidth: 520, padding: 0, overflow: 'hidden' }]}>
            
            {/* Header del Chat */}
            <View style={{
              backgroundColor: '#1E2B58',
              paddingHorizontal: 16,
              paddingVertical: 14,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  backgroundColor: '#C5A880',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: 10,
                }}>
                  <Ionicons name="storefront" size={20} color="#1E2B58" />
                </View>
                <View>
                  <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#FFFFFF' }}>
                    Taller & Tienda Einuushi
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981', marginRight: 5 }} />
                    <Text style={{ fontSize: 11, color: '#CBD5E1' }}>Administrador en línea</Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity onPress={() => setIsChatModalVisible(false)}>
                <Ionicons name="close-circle" size={26} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Mensajes del Chat */}
            <ScrollView
              style={{ flex: 1, backgroundColor: '#F8FAFC', padding: 14 }}
              contentContainerStyle={{ paddingBottom: 16 }}
              showsVerticalScrollIndicator={true}
            >
              {chatMessages.length === 0 ? (
                <View style={{ alignItems: 'center', marginTop: 40, paddingHorizontal: 20 }}>
                  <View style={{
                    width: 60,
                    height: 60,
                    borderRadius: 30,
                    backgroundColor: '#EFF6FF',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginBottom: 12,
                  }}>
                    <Ionicons name="chatbubbles-outline" size={30} color="#1E2B58" />
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#1E2B58', textAlign: 'center' }}>
                    ¡Comunícate con nuestro Taller Wayuu!
                  </Text>
                  <Text style={{ fontSize: 12, color: '#64748B', textAlign: 'center', marginTop: 6, lineHeight: 18 }}>
                    Escribe tus dudas sobre pedidos, disponibilidad de piezas o personalización de mochilas y mantas.
                  </Text>
                </View>
              ) : (
                chatMessages.map(msg => {
                  const isClient = msg.senderRole === 'client';
                  const time = msg.createdAt
                    ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '';
                  return (
                    <View
                      key={msg.id}
                      style={{
                        alignSelf: isClient ? 'flex-end' : 'flex-start',
                        maxWidth: '82%',
                        marginVertical: 4,
                      }}
                    >
                      <View
                        style={{
                          backgroundColor: isClient ? '#1E2B58' : '#FFFFFF',
                          borderRadius: 14,
                          borderBottomRightRadius: isClient ? 2 : 14,
                          borderBottomLeftRadius: isClient ? 14 : 2,
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                          borderWidth: isClient ? 0 : 1,
                          borderColor: '#E2E8F0',
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: 0.05,
                          shadowRadius: 2,
                          elevation: 1,
                        }}
                      >
                        {!isClient && (
                          <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#C5A880', marginBottom: 2 }}>
                            {msg.userName || 'Administrador Einuushi'}
                          </Text>
                        )}
                        <Text style={{ fontSize: 13, color: isClient ? '#FFFFFF' : '#1E293B', lineHeight: 18 }}>
                          {msg.message}
                        </Text>
                        <Text style={{
                          fontSize: 9,
                          color: isClient ? '#94A3B8' : '#94A3B8',
                          marginTop: 4,
                          textAlign: 'right',
                        }}>
                          {time}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>

            {/* Barra de entrada de texto */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#FFFFFF',
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderTopWidth: 1,
              borderTopColor: '#E2E8F0',
            }}>
              <TextInput
                style={{
                  flex: 1,
                  backgroundColor: '#F1F5F9',
                  borderRadius: 20,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  fontSize: 13,
                  color: '#1E2B58',
                  maxHeight: 90,
                }}
                placeholder="Escribe tu mensaje al administrador..."
                placeholderTextColor="#94A3B8"
                value={chatInput}
                onChangeText={setChatInput}
                multiline
              />
              <TouchableOpacity
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: chatInput.trim() ? '#1E2B58' : '#CBD5E1',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginLeft: 8,
                }}
                onPress={handleSendClientMessage}
                disabled={!chatInput.trim() || isSendingChat}
                activeOpacity={0.8}
              >
                <Ionicons name="send" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>

      {/* Modal de Perfil de Usuario (Datos personales, Clave y Foto) */}
      <Modal
        visible={isProfileModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsProfileModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            
            {/* Header del Modal */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="person-circle-sharp" size={24} color="#1E2B58" style={{ marginRight: 8 }} />
                <View>
                  <Text style={styles.modalTitle}>Mi Perfil</Text>
                  <Text style={{ fontSize: 11, color: '#64748B' }}>Gestiona tus datos personales y seguridad</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setIsProfileModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              
              {/* Sección de Foto de Perfil */}
              <View style={{ alignItems: 'center', marginVertical: 12 }}>
                <View style={{ position: 'relative' }}>
                  {profAvatar ? (
                    <Image 
                      source={{ uri: profAvatar }} 
                      style={{ width: 88, height: 88, borderRadius: 44, borderWidth: 2.5, borderColor: '#C5A880' }} 
                    />
                  ) : (
                    <View style={{
                      width: 88,
                      height: 88,
                      borderRadius: 44,
                      backgroundColor: '#1E2B58',
                      justifyContent: 'center',
                      alignItems: 'center',
                      borderWidth: 2.5,
                      borderColor: '#C5A880'
                    }}>
                      <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#FFFFFF' }}>
                        {profFullName ? profFullName.charAt(0).toUpperCase() : 'U'}
                      </Text>
                    </View>
                  )}
                  <TouchableOpacity
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      backgroundColor: '#C5A880',
                      borderRadius: 16,
                      width: 30,
                      height: 30,
                      justifyContent: 'center',
                      alignItems: 'center',
                      borderWidth: 2,
                      borderColor: '#FFFFFF',
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.2,
                      shadowRadius: 3,
                      elevation: 3,
                    }}
                    onPress={handlePickAvatar}
                  >
                    <Ionicons name="camera" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: '#F1F5F9',
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: '#CBD5E1',
                    }}
                    onPress={handlePickAvatar}
                  >
                    <Ionicons name="image-outline" size={15} color="#1E2B58" style={{ marginRight: 5 }} />
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#1E2B58' }}>
                      {profAvatar ? 'Cambiar Foto' : 'Subir Foto'}
                    </Text>
                  </TouchableOpacity>

                  {profAvatar ? (
                    <TouchableOpacity
                      style={{
                        marginLeft: 8,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 14,
                        backgroundColor: '#FEE2E2',
                      }}
                      onPress={() => setProfAvatar('')}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '600', color: '#DC2626' }}>Quitar</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>

              {/* Selector de Pestañas: Datos Personales / Seguridad */}
              <View style={{
                flexDirection: 'row',
                backgroundColor: '#F1F5F9',
                borderRadius: 12,
                padding: 4,
                marginBottom: 16,
              }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    borderRadius: 9,
                    backgroundColor: profileTab === 'personal' ? '#FFFFFF' : 'transparent',
                    alignItems: 'center',
                    shadowColor: profileTab === 'personal' ? '#000' : 'transparent',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.1,
                    shadowRadius: 2,
                    elevation: profileTab === 'personal' ? 2 : 0,
                  }}
                  onPress={() => setProfileTab('personal')}
                >
                  <Text style={{
                    fontSize: 12,
                    fontWeight: profileTab === 'personal' ? 'bold' : '500',
                    color: profileTab === 'personal' ? '#1E2B58' : '#64748B',
                  }}>
                    👤 Datos Personales
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    borderRadius: 9,
                    backgroundColor: profileTab === 'security' ? '#FFFFFF' : 'transparent',
                    alignItems: 'center',
                    shadowColor: profileTab === 'security' ? '#000' : 'transparent',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.1,
                    shadowRadius: 2,
                    elevation: profileTab === 'security' ? 2 : 0,
                  }}
                  onPress={() => setProfileTab('security')}
                >
                  <Text style={{
                    fontSize: 12,
                    fontWeight: profileTab === 'security' ? 'bold' : '500',
                    color: profileTab === 'security' ? '#1E2B58' : '#64748B',
                  }}>
                    🔒 Cambiar Clave
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Pestaña: Datos Personales */}
              {profileTab === 'personal' && (
                <View>
                  <Text style={styles.formLabel}>Nombre Completo *</Text>
                  <TextInput
                    style={[styles.formInput, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]}
                    placeholder="Tu nombre completo"
                    placeholderTextColor="#94A3B8"
                    value={profFullName}
                    onChangeText={setProfFullName}
                  />

                  <Text style={styles.formLabel}>Cédula o Documento de Identidad</Text>
                  <TextInput
                    style={[styles.formInput, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]}
                    placeholder="Número de cédula"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    value={profCedula}
                    onChangeText={setProfCedula}
                  />

                  <Text style={styles.formLabel}>Teléfono / WhatsApp</Text>
                  <TextInput
                    style={[styles.formInput, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]}
                    placeholder="Número de teléfono móvil"
                    placeholderTextColor="#94A3B8"
                    keyboardType="phone-pad"
                    value={profPhone}
                    onChangeText={setProfPhone}
                  />

                  <Text style={styles.formLabel}>Ciudad / Municipio</Text>
                  <TextInput
                    style={[styles.formInput, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]}
                    placeholder="Ej. Riohacha, Manaure, Maicao"
                    placeholderTextColor="#94A3B8"
                    value={profCity}
                    onChangeText={setProfCity}
                  />

                  <Text style={styles.formLabel}>Correo Electrónico (Identificador de cuenta)</Text>
                  <View style={[styles.formInput, { backgroundColor: '#F1F5F9', justifyContent: 'center' }]}>
                    <Text style={{ fontSize: 13, color: '#64748B' }}>{currentUser?.email || ''}</Text>
                  </View>

                  <TouchableOpacity
                    style={[styles.checkoutButton, { marginTop: 20 }, isSavingProfile && { opacity: 0.7 }]}
                    onPress={handleSavePersonalData}
                    disabled={isSavingProfile}
                  >
                    <Text style={styles.checkoutButtonText}>
                      {isSavingProfile ? 'Guardando...' : 'Guardar Datos Personales'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Pestaña: Seguridad & Clave */}
              {profileTab === 'security' && (
                <View>
                  <View style={{
                    backgroundColor: '#F8FAFC',
                    borderRadius: 10,
                    padding: 12,
                    marginBottom: 12,
                    borderLeftWidth: 3,
                    borderLeftColor: '#C5A880',
                  }}>
                    <Text style={{ fontSize: 12, color: '#475569', lineHeight: 17 }}>
                      Ingresa tu nueva contraseña para actualizar el acceso seguro a tu cuenta Einuushi.
                    </Text>
                  </View>

                  <Text style={styles.formLabel}>Nueva Contraseña *</Text>
                  <View style={{
                    position: 'relative',
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}>
                    <TextInput
                      style={[
                        styles.formInput,
                        { flex: 1, paddingRight: 40 },
                        Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)
                      ]}
                      placeholder="Mínimo 6 caracteres"
                      placeholderTextColor="#94A3B8"
                      secureTextEntry={!showNewPassword}
                      value={profNewPassword}
                      onChangeText={setProfNewPassword}
                    />
                    <TouchableOpacity
                      style={{ position: 'absolute', right: 12 }}
                      onPress={() => setShowNewPassword(!showNewPassword)}
                    >
                      <Ionicons
                        name={showNewPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color="#64748B"
                      />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.formLabel}>Confirmar Nueva Contraseña *</Text>
                  <View style={{
                    position: 'relative',
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}>
                    <TextInput
                      style={[
                        styles.formInput,
                        { flex: 1, paddingRight: 40 },
                        Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)
                      ]}
                      placeholder="Repite la nueva contraseña"
                      placeholderTextColor="#94A3B8"
                      secureTextEntry={!showConfirmPassword}
                      value={profConfirmPassword}
                      onChangeText={setProfConfirmPassword}
                    />
                    <TouchableOpacity
                      style={{ position: 'absolute', right: 12 }}
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      <Ionicons
                        name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color="#64748B"
                      />
                    </TouchableOpacity>
                  </View>

                  <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="information-circle-outline" size={14} color="#64748B" style={{ marginRight: 4 }} />
                    <Text style={{ fontSize: 11, color: '#64748B' }}>
                      La contraseña debe tener un mínimo de 6 caracteres.
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[styles.checkoutButton, { marginTop: 22 }, isSavingProfile && { opacity: 0.7 }]}
                    onPress={handleUpdatePassword}
                    disabled={isSavingProfile}
                  >
                    <Text style={styles.checkoutButtonText}>
                      {isSavingProfile ? 'Actualizando...' : 'Actualizar Contraseña'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

            </ScrollView>

          </View>
        </View>
      </Modal>

      {/* Visualizador de Foto a Pantalla Completa (Lightbox Profesional) */}
      <Modal
        visible={!!previewImage}
        transparent={true}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={handleCloseImagePreview}
      >
        <View style={styles.fullImageModalOverlay}>
          {/* Header Superior */}
          <SafeAreaView style={styles.fullImageHeaderSafeArea}>
            <View style={styles.fullImageHeader}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                {previewImage?.category ? (
                  <View style={styles.fullImageCategoryBadge}>
                    <Text style={styles.fullImageCategoryText}>{previewImage.category}</Text>
                  </View>
                ) : null}
                <Text style={styles.fullImageTitle} numberOfLines={1}>
                  {previewImage?.title}
                </Text>
              </View>

              <TouchableOpacity
                onPress={handleCloseImagePreview}
                style={styles.fullImageCloseBtn}
                activeOpacity={0.8}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </SafeAreaView>

          {/* Cuerpo Central con la Imagen */}
          <TouchableOpacity
            style={styles.fullImageBody}
            activeOpacity={1}
            onPress={handleCloseImagePreview}
          >
            {previewImage?.source && (
              <Image
                source={previewImage.source}
                style={styles.fullImageLarge}
                resizeMode="contain"
              />
            )}
          </TouchableOpacity>

          {/* Footer Inferior con Detalles y Precio */}
          {(previewImage?.price || previewImage?.description) ? (
            <SafeAreaView style={styles.fullImageFooterSafeArea}>
              <View style={styles.fullImageFooter}>
                {previewImage.price ? (
                  <View style={styles.fullImagePriceRow}>
                    <Text style={styles.fullImagePriceLabel}>Precio artesanal:</Text>
                    <Text style={styles.fullImagePrice}>{previewImage.price}</Text>
                  </View>
                ) : null}
                {previewImage.description ? (
                  <Text style={styles.fullImageDescription} numberOfLines={3}>
                    {previewImage.description}
                  </Text>
                ) : null}
                <Text style={styles.fullImageHint}>
                  Toca en cualquier parte para cerrar
                </Text>
              </View>
            </SafeAreaView>
          ) : null}
        </View>
      </Modal>

      {/* Botón Flotante de Chat en Pantalla Principal */}
      <TouchableOpacity
        style={styles.floatingChatBtn}
        onPress={handleOpenChatModal}
        activeOpacity={0.85}
      >
        <Ionicons name="chatbubbles" size={24} color="#FFFFFF" />
        {hasUnreadChat && (
          <View style={styles.floatingChatBadge}>
            <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: 'bold' }}>•</Text>
          </View>
        )}
      </TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBFBFA',
    paddingTop: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1.5,
    borderBottomColor: '#C5A880',
    backgroundColor: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 10,
    color: '#64748B',
    letterSpacing: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E2B58',
    letterSpacing: 1.5,
  },
  headerIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#C5A880',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  iconButtonLogout: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#C5A880',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#1E2B58',
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C5A880',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  userProfileCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#C5A880',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E2B58',
    borderWidth: 1.5,
    borderColor: '#C5A880',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  userAvatarInitials: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  userInfoBox: {
    flex: 1,
  },
  userGreeting: {
    fontSize: 12,
    color: '#64748B',
  },
  userNameHighlight: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1E2B58',
    flexShrink: 1,
  },
  userSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  userCityText: {
    fontSize: 10,
    color: '#64748B',
  },
  userDivider: {
    fontSize: 10,
    color: '#CBD5E1',
    marginHorizontal: 4,
  },
  userEmailText: {
    fontSize: 10,
    color: '#94A3B8',
  },
  sessionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 6,
  },
  sessionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#166534',
    marginRight: 4,
  },
  sessionBadgeText: {
    fontSize: 9,
    color: '#166534',
    fontWeight: 'bold',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#C5A880',
    borderRadius: 30,
    paddingHorizontal: 16,
    height: 48,
    marginBottom: 20,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#1E293B',
    borderWidth: 0,
  },
  clearSearchButton: {
    padding: 4,
  },
  bannerCard: {
    backgroundColor: '#1E2B58',
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1.5,
    borderColor: '#C5A880',
  },
  bannerTextContainer: {
    flex: 1,
  },
  bannerTag: {
    fontSize: 9,
    color: '#C5A880',
    fontWeight: 'bold',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  bannerSubtitle: {
    fontSize: 12,
    color: '#E2E8F0',
  },
  bannerIconBox: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C5A880',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E2B58',
    marginBottom: 12,
  },
  bubblesScroll: {
    marginBottom: 24,
  },
  bubbleItem: {
    alignItems: 'center',
    marginRight: 16,
  },
  bubbleCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#C5A880',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  bubbleCircleActive: {
    backgroundColor: '#1E2B58',
  },
  bubbleText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1E2B58',
  },
  bubbleTextActive: {
    fontWeight: 'bold',
    color: '#C5A880',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  productCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  productImageWrapper: {
    width: '100%',
    height: 190,
    backgroundColor: '#F8FAFC',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  productImage: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  categoryBadgeOnImage: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(30, 43, 88, 0.88)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    zIndex: 2,
  },
  categoryBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  clientDiscountTag: {
    position: 'absolute',
    top: 8,
    right: 44,
    backgroundColor: '#DC2626',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    zIndex: 2,
  },
  clientDiscountTagText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  clientCrossedPrice: {
    fontSize: 10,
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },
  clientDiscountPrice: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#DC2626',
  },
  placeholderIconContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  favoriteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
    zIndex: 2,
  },
  productInfoContainer: {
    padding: 12,
    flex: 1,
    justifyContent: 'space-between',
  },
  productName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1E2B58',
    marginBottom: 4,
  },
  ancestralText: {
    fontSize: 10,
    color: '#64748B',
    fontStyle: 'italic',
    marginBottom: 8,
    lineHeight: 14,
    minHeight: 28,
  },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  stockText: {
    fontSize: 10,
    color: '#64748B',
    marginLeft: 4,
  },
  stockNumber: {
    fontWeight: 'bold',
    color: '#1E2B58',
  },
  priceLikeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  productPrice: {
    fontSize: 12.5,
    fontWeight: 'bold',
    color: '#C5A880',
  },
  likesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  likesCountText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  cartActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cartButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C5A880',
  },
  removeButton: {
    backgroundColor: '#FFFFFF',
  },
  addButton: {
    backgroundColor: '#1E2B58',
  },
  cartQuantityBadge: {
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartQuantityText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1E2B58',
  },
  noResultsContainer: {
    width: '100%',
    padding: 30,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(30, 43, 88, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    maxHeight: '88%',
    borderTopWidth: 2,
    borderTopColor: '#C5A880',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 14,
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E2B58',
    letterSpacing: 1,
  },
  modalBody: {
    maxHeight: 320,
  },
  cartItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  cartItemInfo: {
    flex: 1,
  },
  cartItemName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E2B58',
  },
  cartItemUnitPrice: {
    fontSize: 11,
    color: '#64748B',
  },
  cartItemActionContainer: {
    alignItems: 'flex-end',
  },
  cartItemQty: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  cartItemSubtotal: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#C5A880',
  },
  emptyCartContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCartText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1E2B58',
    marginTop: 10,
  },
  emptyCartSubText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
  },
  modalFooter: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 16,
    marginTop: 10,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E2B58',
  },
  totalValue: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#C5A880',
  },
  checkoutButton: {
    backgroundColor: '#1E2B58',
    borderRadius: 14,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C5A880',
  },
  checkoutButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E2B58',
    marginBottom: 4,
    marginTop: 8,
  },
  formInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    fontSize: 13,
    color: '#1E293B',
  },
  pickerSelector: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    height: 44,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  pickerSelectorText: {
    fontSize: 13,
    color: '#1E293B',
    fontWeight: '500',
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pickerDialog: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 10,
  },
  pickerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 8,
  },
  pickerDialogTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E2B58',
  },
  pickerOptionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginVertical: 3,
  },
  pickerOptionItemSelected: {
    backgroundColor: '#EFF6FF',
  },
  pickerOptionText: {
    fontSize: 14,
    color: '#334155',
  },
  pickerOptionTextSelected: {
    fontWeight: 'bold',
    color: '#1E2B58',
  },
  pickerContainer: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    height: 42,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  htmlSelect: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingHorizontal: 10,
    fontSize: 13,
    color: '#1E293B',
    outlineStyle: 'none',
  } as any,
  shippingSummaryBox: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  shippingSummaryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E2B58',
  },
  shippingSummaryPrice: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#C5A880',
  },
  qrContainerBox: {
    paddingVertical: 10,
    alignItems: 'center',
    width: '100%',
  },
  qrInstructions: {
    fontSize: 12,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 10,
  },
  qrTotalAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#C5A880',
    marginBottom: 14,
  },
  qrPlaceholderBox: {
    width: 180,
    height: 180,
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: '#1E2B58',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  qrStoreText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1E2B58',
    letterSpacing: 1,
    marginTop: -10,
  },
  qrSubNote: {
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  orderCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginBottom: 14,
  },
  orderHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  orderIdText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1E2B58',
  },
  orderDateText: {
    fontSize: 10,
    color: '#64748B',
  },
  orderStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  orderStatusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#B45309',
  },
  etaText: {
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  clientDetailsBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  clientDetailsTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1E2B58',
    marginBottom: 2,
  },
  clientDetailsText: {
    fontSize: 10,
    color: '#475569',
    marginBottom: 1,
  },
  orderItemsList: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 6,
    marginBottom: 6,
  },
  orderItemDetail: {
    fontSize: 11,
    color: '#475569',
    marginBottom: 2,
  },
  orderTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 6,
    marginBottom: 8,
  },
  orderTotalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E2B58',
  },
  orderTotalValue: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#C5A880',
  },
  ratingSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FEF9C3',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FEF08A',
  },
  ratingSummaryText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#854D0E',
  },
  orderPendingDispatchNotice: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderPendingDispatchNoticeText: {
    fontSize: 11,
    color: '#92400E',
    fontWeight: '500',
    flex: 1,
  },
  orderDeliveredNotice: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 8,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderDeliveredNoticeText: {
    fontSize: 11,
    color: '#166534',
    fontWeight: '600',
    flex: 1,
  },
  trackingLiveButton: {
    backgroundColor: '#166534',
    borderRadius: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  trackingLiveButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  paymentStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  paymentBadgePending: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  paymentBadgePaid: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  paymentBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  mapControlBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 4,
  },
  mapSelectorGroup: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 8,
    padding: 3,
  },
  mapSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  mapSelectorBtnActive: {
    backgroundColor: '#1E2B58',
  },
  mapSelectorBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1E2B58',
  },
  mapSelectorBtnTextActive: {
    color: '#FFFFFF',
  },
  openExternalMapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#C5A880',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  openExternalMapBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  mapViewerContainer: {
    height: 250,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginBottom: 10,
    position: 'relative',
  },
  mapFloatingAddressBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: 'rgba(30, 43, 88, 0.92)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  mapFloatingAddressText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  trackingPaymentBox: {
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
  },
  trackingPaymentPendingBox: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  trackingPaymentDeliveredBox: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  trackingPaymentHeader: {
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  trackingPaymentValue: {
    fontSize: 15,
    fontWeight: 'bold',
    marginVertical: 2,
  },
  trackingPaymentNote: {
    fontSize: 11,
    color: '#475569',
  },
  deliveryInfoCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  deliveryAvatarBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C5A880',
  },
  deliveryDriverName: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1E2B58',
  },
  deliveryDriverVehicle: {
    fontSize: 9,
    color: '#64748B',
  },
  callDriverButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#166534',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 6,
    marginBottom: 4,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#166534',
  },
  progressStatusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1E2B58',
    textAlign: 'center',
  },
  ratingCardBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
    alignItems: 'center',
    marginBottom: 8,
  },
  ratingTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#92400E',
    marginBottom: 6,
  },
  starsRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  ratingSubText: {
    fontSize: 10,
    color: '#B45309',
    fontStyle: 'italic',
  },
  inAppToastContainer: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 20 : 50,
    left: 16,
    right: 16,
    zIndex: 9999,
    backgroundColor: '#1E2B58',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#C5A880',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  inAppToastIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#166534',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inAppToastTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  inAppToastMessage: {
    color: '#E2E8F0',
    fontSize: 11,
    marginTop: 2,
  },
  inAppToastActionBtn: {
    backgroundColor: '#C5A880',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 8,
  },
  inAppToastActionText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  notificationsSectionBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  notificationsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  notificationsSectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#991B1B',
  },
  notifItemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 8,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#166534',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  notifItemCardUnread: {
    backgroundColor: '#FFFBEB',
    borderLeftColor: '#DC2626',
  },
  notifItemTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1E2B58',
  },
  notifItemMessage: {
    fontSize: 10,
    color: '#475569',
    marginTop: 2,
  },
  notifItemTime: {
    fontSize: 9,
    color: '#94A3B8',
    marginTop: 3,
  },
  orderArrivedNoticeBox: {
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  orderArrivedNoticeTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#065F46',
  },
  orderArrivedNoticeText: {
    fontSize: 10,
    color: '#047857',
  },
  orderArrivedActionCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#86EFAC',
  },
  orderArrivedActionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#166534',
  },
  orderArrivedActionSub: {
    fontSize: 10,
    color: '#15803D',
  },
  markReceivedMainButton: {
    backgroundColor: '#166534',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#C5A880',
  },
  markReceivedMainButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  orderRatingCardInline: {
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
    alignItems: 'center',
  },
  orderRatingCardTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#92400E',
  },
  orderRatingCardSub: {
    fontSize: 9,
    color: '#B45309',
    marginTop: 2,
  },
  trackingModalScrollView: {
    flex: 1,
    width: '100%',
    ...(Platform.OS === 'web' ? {
      overflowY: 'auto' as any,
    } : {}),
  },
  trackingModalScrollContent: {
    paddingBottom: 25,
  },
  floatingChatBtn: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1E2B58',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 999,
  },
  floatingChatBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#C5A880',
    width: 14,
    height: 14,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  adminPreviewBanner: {
    backgroundColor: '#1E2B58',
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1.5,
    borderBottomColor: '#C5A880',
  },
  adminPreviewTitle: {
    color: '#C5A880',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.8,
  },
  adminPreviewSubtitle: {
    color: '#E2E8F0',
    fontSize: 10,
    marginTop: 1,
  },
  adminPreviewReturnBtn: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  adminPreviewReturnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },

  // ESTILOS PARA VISUALIZADOR DE FOTO A PANTALLA COMPLETA (LIGHTBOX)
  productImageTouch: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  imageZoomBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  imageZoomBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  fullImageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 15, 30, 0.96)',
    justifyContent: 'space-between',
  },
  fullImageHeaderSafeArea: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  fullImageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  fullImageCategoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(197, 168, 128, 0.2)',
    borderColor: '#C5A880',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 4,
  },
  fullImageCategoryText: {
    color: '#C5A880',
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fullImageTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  fullImageCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  fullImageBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  fullImageLarge: {
    width: '100%',
    height: '100%',
    maxHeight: 520,
  },
  fullImageFooterSafeArea: {
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  fullImageFooter: {
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  fullImagePriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  fullImagePriceLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500',
  },
  fullImagePrice: {
    color: '#C5A880',
    fontSize: 18,
    fontWeight: '800',
  },
  fullImageDescription: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 17,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  fullImageHint: {
    color: '#64748B',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 2,
  },
});