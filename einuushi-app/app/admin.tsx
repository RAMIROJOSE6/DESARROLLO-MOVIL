import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
  useWindowDimensions,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import { LiveDeliveryMap } from '../components/LiveDeliveryMap';
import * as ImagePicker from 'expo-image-picker';
import { useAdmin } from '../hooks/useAdmin';
import { Order, Product, Category, CustomQuote, User, isSuperAdmin, parseOrderDate } from '../services/database';

const SUPABASE_FALLBACK_IMAGES: Record<string, string> = {
  mochila1: 'https://ismvmlcemxkawdwextzk.supabase.co/storage/v1/object/public/einuushi-media/crafts/mochila1.jpg',
  mochila2: 'https://ismvmlcemxkawdwextzk.supabase.co/storage/v1/object/public/einuushi-media/crafts/mochila2.jpg',
  manta1: 'https://ismvmlcemxkawdwextzk.supabase.co/storage/v1/object/public/einuushi-media/crafts/manta1.jpg',
  chinchorro1: 'https://ismvmlcemxkawdwextzk.supabase.co/storage/v1/object/public/einuushi-media/crafts/chinchorro1.jpg',
  sombrero1: 'https://ismvmlcemxkawdwextzk.supabase.co/storage/v1/object/public/einuushi-media/crafts/sombrero1.jpg',
};

type AdminTab = 'analytics' | 'orders' | 'inventory' | 'quotes' | 'chat' | 'settings';

export const isPureClientUser = (u: User) => {
  if (u.role && (u.role as string) !== 'client') return false;
  if (u.id?.startsWith('USR-DRIVER') || u.id?.startsWith('USR-ADMIN') || u.id === 'USR-ADMIN-01') return false;
  if (u.email?.toLowerCase() === 'admin@einuushi.com') return false;
  return true;
};

// Constantes y generador para el Calendario Visual Interactivo
const CALENDAR_MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];
const CALENDAR_WEEK_DAYS = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];

function getCalendarGridDays(year: number, month: number) {
  const date = new Date(year, month, 1);
  const days = [];
  const firstDayIndex = date.getDay();
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    days.push({
      day: prevMonthLastDay - i,
      month: month === 0 ? 11 : month - 1,
      year: month === 0 ? year - 1 : year,
      isCurrentMonth: false,
    });
  }
  const lastDay = new Date(year, month + 1, 0).getDate();
  for (let i = 1; i <= lastDay; i++) {
    days.push({
      day: i,
      month: month,
      year: year,
      isCurrentMonth: true,
    });
  }
  const remaining = (7 - (days.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    days.push({
      day: i,
      month: month === 11 ? 0 : month + 1,
      year: month === 11 ? year + 1 : year,
      isCurrentMonth: false,
    });
  }
  return days;
}

export default function AdminScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const {
    adminUser,
    isAuthenticated,
    isSuperAdmin: isSuperAdminUser,
    isLoading,
    isRefreshing,
    orders,
    products,
    categories,
    quotes,
    messages,
    users,
    adminUsers,
    drivers,
    activityLogs,
    analytics,
    activeTrackingOrder,
    setActiveTrackingOrder,
    login,
    logout,
    refreshAll,
    confirmPayment,
    dispatchOrder,
    markOrderArrived,
    markOrderDelivered,
    settleOrderPazYSalvo,
    createDriver,
    updateDriver,
    updateStock,
    toggleDiscount,
    addProduct,
    addCategory,
    editCategory,
    removeCategory,
    removeProduct,
    toggleProductActive,
    updateProductPhoto,
    editProduct,
    respondQuote,
    sendMessage,
    markChatRead,
    updateAdminProfile,
    createAdminUser,
    changeAdminPassword,
    requestAdminPasswordRecovery,
    verifyAndResetAdminPassword,
  } = useAdmin();

  // Estados de Login Administrativo
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);

  // Tab activo persistente en sesión y almacenamiento local
  const [activeTab, setActiveTabState] = useState<AdminTab>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const saved = window.localStorage.getItem('einuushi_admin_active_tab') as AdminTab;
        if (saved && ['analytics', 'orders', 'inventory', 'quotes', 'chat', 'settings'].includes(saved)) {
          return saved;
        }
      } catch (_) {}
    }
    return 'analytics';
  });

  const setActiveTab = (tab: AdminTab) => {
    setActiveTabState(tab);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem('einuushi_admin_active_tab', tab);
      } catch (_) {}
    }
  };

  // Sub-pestaña activa dentro de la pestaña Configuración & Trazabilidad
  const [settingsSubTab, setSettingsSubTab] = useState<'profile' | 'admins' | 'logistics' | 'audit'>('profile');

  // Filtro de Artículos en Inventario (Solo Admin)
  const [inventoryFilter, setInventoryFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  // Modal de Edición de Artículo
  const [isEditProductModalVisible, setIsEditProductModalVisible] = useState(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [productToManageGallery, setProductToManageGallery] = useState<Product | null>(null);
  const [isGalleryModalVisible, setIsGalleryModalVisible] = useState(false);
  const [isAddingGalleryPhoto, setIsAddingGalleryPhoto] = useState(false);
  const [editProdName, setEditProdName] = useState('');
  const [editProdCategory, setEditProdCategory] = useState('');
  const [editProdPrice, setEditProdPrice] = useState('');
  const [editProdStock, setEditProdStock] = useState('1');
  const [editProdAncestral, setEditProdAncestral] = useState('');
  const [editProdDiscount, setEditProdDiscount] = useState('0');
  const [editProdIsDiscount, setEditProdIsDiscount] = useState(false);

  // Filtro de Pedidos (Estado y Fecha)
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('ALL');
  const [orderDatePreset, setOrderDatePreset] = useState<'ALL' | 'TODAY' | 'LAST_7_DAYS' | 'THIS_MONTH' | 'CUSTOM'>('ALL');
  const [orderStartDate, setOrderStartDate] = useState<string>(''); // YYYY-MM-DD
  const [orderEndDate, setOrderEndDate] = useState<string>(''); // YYYY-MM-DD

  // Estados del Calendario Visual Interactivo
  const [isCalendarModalVisible, setIsCalendarModalVisible] = useState(false);
  const [calendarViewDate, setCalendarViewDate] = useState(() => new Date());
  const [calendarActiveTarget, setCalendarActiveTarget] = useState<'start' | 'end'>('start');

  // Modales
  const [isSettlementModalVisible, setIsSettlementModalVisible] = useState(false);
  const [selectedOrderForSettlement, setSelectedOrderForSettlement] = useState<Order | null>(null);
  const [settlementType, setSettlementType] = useState<'EFECTIVO_EN_TIENDA' | 'TRANSFERENCIA_TIENDA'>('EFECTIVO_EN_TIENDA');
  const [settlementTransferRef, setSettlementTransferRef] = useState('');
  const [settlementNotes, setSettlementNotes] = useState('');
  const [isSubmittingSettlement, setIsSubmittingSettlement] = useState(false);

  // Modal de Despacho y Asignación de Repartidor / Transportadora
  const [isDispatchModalVisible, setIsDispatchModalVisible] = useState(false);
  const [selectedOrderToDispatch, setSelectedOrderToDispatch] = useState<Order | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [customGuideNumber, setCustomGuideNumber] = useState<string>('');
  const [dispatchDriverFilter, setDispatchDriverFilter] = useState<'all' | 'local' | 'corporate'>('all');

  // Modal de Registro de Nuevo Repartidor o Transportadora
  const [isNewDriverModalVisible, setIsNewDriverModalVisible] = useState(false);
  const [newDriverName, setNewDriverName] = useState('');
  const [newDriverEmail, setNewDriverEmail] = useState('');
  const [newDriverPassword, setNewDriverPassword] = useState('');
  const [newDriverPhone, setNewDriverPhone] = useState('');
  const [newDriverCedulaOrNit, setNewDriverCedulaOrNit] = useState('');
  const [newDriverType, setNewDriverType] = useState<'individual' | 'corporate'>('individual');
  const [newDriverCompany, setNewDriverCompany] = useState('');
  const [newDriverVehicle, setNewDriverVehicle] = useState<'Moto' | 'Carro' | 'Otro' | string>('Moto');
  const [newDriverVehicleOther, setNewDriverVehicleOther] = useState('');
  const [isVehicleDropdownOpen, setIsVehicleDropdownOpen] = useState(false);
  const [newDriverPlate, setNewDriverPlate] = useState('');
  const [newDriverTrackingUrl, setNewDriverTrackingUrl] = useState('');
  const [isSubmittingNewDriver, setIsSubmittingNewDriver] = useState(false);

  const [isNewProductModalVisible, setIsNewProductModalVisible] = useState(false);
  const [isNewCategoryModalVisible, setIsNewCategoryModalVisible] = useState(false);
  const [isCategoryManagerModalVisible, setIsCategoryManagerModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatIcon, setEditCatIcon] = useState('sparkles-outline');
  const [editCatDescription, setEditCatDescription] = useState('');
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [isQuoteModalVisible, setIsQuoteModalVisible] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<CustomQuote | null>(null);
  const [isMapModalVisible, setIsMapModalVisible] = useState(false);
  const [isUsersModalVisible, setIsUsersModalVisible] = useState(false);
  const [usersSearchQuery, setUsersSearchQuery] = useState('');
  const [usersRoleFilter, setUsersRoleFilter] = useState<'all' | 'client' | 'admin'>('all');

  // Formulario Mi Perfil Administrador
  const [adminEditName, setAdminEditName] = useState('');
  const [adminEditEmail, setAdminEditEmail] = useState('');
  const [adminEditPhone, setAdminEditPhone] = useState('');
  const [adminEditPassword, setAdminEditPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [isSavingAdminProfile, setIsSavingAdminProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Formulario Nuevo Administrador
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPhone, setNewAdminPhone] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newAdminCedula, setNewAdminCedula] = useState('');
  const [showNewAdminPassword, setShowNewAdminPassword] = useState(false);
  const [isCreatingAdmin, setIsCreatingAdmin] = useState(false);
  const [createAdminMsg, setCreateAdminMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filtros de Auditoría
  const [auditFilterType, setAuditFilterType] = useState<'ALL' | 'PEDIDO' | 'PRODUCTO' | 'COTIZACION' | 'SEGURIDAD'>('ALL');
  const [auditSearchQuery, setAuditSearchQuery] = useState('');

  // Sincronizar datos del perfil admin actual
  React.useEffect(() => {
    if (adminUser) {
      setAdminEditName(adminUser.fullName || '');
      setAdminEditEmail(adminUser.email || '');
      setAdminEditPhone(adminUser.phone || '');
    }
  }, [adminUser]);

  const handleSaveAdminProfile = async () => {
    setProfileMsg(null);
    if (!adminEditName.trim()) {
      setProfileMsg({ type: 'error', text: 'El nombre del administrador es obligatorio.' });
      return;
    }
    if (!adminEditEmail.trim() || !adminEditEmail.includes('@')) {
      setProfileMsg({ type: 'error', text: 'Ingresa un correo electrónico válido.' });
      return;
    }
    if (adminEditPassword.trim() && adminEditPassword.trim().length < 6) {
      setProfileMsg({ type: 'error', text: 'La nueva contraseña debe tener mínimo 6 caracteres.' });
      return;
    }

    setIsSavingAdminProfile(true);
    const res = await updateAdminProfile({
      fullName: adminEditName.trim(),
      email: adminEditEmail.trim(),
      phone: adminEditPhone.trim(),
      ...(adminEditPassword.trim() ? { password: adminEditPassword.trim() } : {}),
    });
    setIsSavingAdminProfile(false);

    if (res.success) {
      setProfileMsg({ type: 'success', text: '¡Datos y credenciales de administrador actualizados con éxito!' });
      setAdminEditPassword('');
    } else {
      setProfileMsg({ type: 'error', text: res.message || 'Error al actualizar datos.' });
    }
  };

  const handleCreateNewAdmin = async () => {
    setCreateAdminMsg(null);
    if (!newAdminName.trim()) {
      setCreateAdminMsg({ type: 'error', text: 'El nombre del nuevo administrador es obligatorio.' });
      return;
    }
    if (!newAdminEmail.trim() || !newAdminEmail.includes('@')) {
      setCreateAdminMsg({ type: 'error', text: 'Ingresa un correo electrónico válido.' });
      return;
    }
    if (!newAdminPassword.trim() || newAdminPassword.trim().length < 6) {
      setCreateAdminMsg({ type: 'error', text: 'La contraseña inicial debe tener mínimo 6 caracteres.' });
      return;
    }

    setIsCreatingAdmin(true);
    const res = await createAdminUser({
      fullName: newAdminName.trim(),
      email: newAdminEmail.trim(),
      phone: newAdminPhone.trim() || '3000000000',
      cedula: newAdminCedula.trim() || '1124000000',
      password: newAdminPassword.trim(),
    });
    setIsCreatingAdmin(false);

    if (res.success) {
      setCreateAdminMsg({ type: 'success', text: `¡Administrador ${newAdminName} creado exitosamente con plenos privilegios!` });
      setNewAdminName('');
      setNewAdminEmail('');
      setNewAdminPhone('');
      setNewAdminPassword('');
      setNewAdminCedula('');
    } else {
      setCreateAdminMsg({ type: 'error', text: res.message || 'Error al crear el nuevo administrador.' });
    }
  };

  // Modal Superadministrador: Cambiar contraseña de otro administrador
  const [selectedAdminForPasswordModal, setSelectedAdminForPasswordModal] = useState<User | null>(null);
  const [newPasswordForSelectedAdmin, setNewPasswordForSelectedAdmin] = useState('');
  const [isChangingOtherAdminPassword, setIsChangingOtherAdminPassword] = useState(false);
  const [changeOtherAdminPasswordMsg, setChangeOtherAdminPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal Recuperación de Contraseña Administrativa (con código por correo EmailJS)
  const [isRecoveryModalVisible, setIsRecoveryModalVisible] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState<1 | 2 | 3>(1);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoveryGeneratedCode, setRecoveryGeneratedCode] = useState('');
  const [recoveryNewPassword, setRecoveryNewPassword] = useState('');
  const [recoveryConfirmPassword, setRecoveryConfirmPassword] = useState('');
  const [recoveryTimeLeft, setRecoveryTimeLeft] = useState(60);
  const [recoveryIsCodeExpired, setRecoveryIsCodeExpired] = useState(false);
  const [isRecoveryLoading, setIsRecoveryLoading] = useState(false);
  const [recoveryMsg, setRecoveryMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showRecoveryPassword, setShowRecoveryPassword] = useState(false);

  // Temporizador regresivo de 60 segundos para la recuperación
  React.useEffect(() => {
    let timer: any = null;
    if (isRecoveryModalVisible && recoveryStep === 2 && recoveryTimeLeft > 0) {
      timer = setInterval(() => {
        setRecoveryTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            setRecoveryIsCodeExpired(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isRecoveryModalVisible, recoveryStep, recoveryTimeLeft]);

  const handleOpenRecoveryModal = () => {
    setRecoveryStep(1);
    setRecoveryEmail('');
    setRecoveryCode('');
    setRecoveryGeneratedCode('');
    setRecoveryNewPassword('');
    setRecoveryConfirmPassword('');
    setRecoveryTimeLeft(60);
    setRecoveryIsCodeExpired(false);
    setRecoveryMsg(null);
    setIsRecoveryModalVisible(true);
  };

  const handleSendRecoveryCode = async () => {
    setRecoveryMsg(null);
    if (!recoveryEmail.trim() || !recoveryEmail.includes('@')) {
      setRecoveryMsg({ type: 'error', text: 'Por favor ingresa un correo electrónico administrativo válido.' });
      return;
    }
    setIsRecoveryLoading(true);
    const res = await requestAdminPasswordRecovery(recoveryEmail.trim());
    setIsRecoveryLoading(false);

    if (res.success && res.code) {
      setRecoveryGeneratedCode(res.code);
      setRecoveryTimeLeft(60);
      setRecoveryIsCodeExpired(false);
      setRecoveryStep(2);
      setRecoveryMsg({ type: 'success', text: res.message || 'Código enviado con éxito.' });
    } else {
      setRecoveryMsg({ type: 'error', text: res.message || 'Error al enviar código.' });
    }
  };

  const handleResendRecoveryCode = async () => {
    if (!recoveryEmail.trim()) return;
    setIsRecoveryLoading(true);
    const res = await requestAdminPasswordRecovery(recoveryEmail.trim());
    setIsRecoveryLoading(false);

    if (res.success && res.code) {
      setRecoveryGeneratedCode(res.code);
      setRecoveryCode('');
      setRecoveryTimeLeft(60);
      setRecoveryIsCodeExpired(false);
      setRecoveryMsg({ type: 'success', text: 'Se ha enviado un nuevo código a tu correo.' });
    } else {
      setRecoveryMsg({ type: 'error', text: res.message || 'Error al reenviar código.' });
    }
  };

  const handleConfirmResetAdminPassword = async () => {
    setRecoveryMsg(null);
    if (recoveryIsCodeExpired || recoveryTimeLeft <= 0) {
      setRecoveryMsg({ type: 'error', text: 'El código ha expirado. Pulsa "Reenviar código" para recibir uno nuevo.' });
      return;
    }
    if (!recoveryCode.trim()) {
      setRecoveryMsg({ type: 'error', text: 'Ingresa el código de 6 dígitos recibido en tu correo.' });
      return;
    }
    if (recoveryCode.trim() !== recoveryGeneratedCode) {
      setRecoveryMsg({ type: 'error', text: 'El código ingresado no coincide con el enviado a tu correo.' });
      return;
    }
    if (!recoveryNewPassword.trim() || recoveryNewPassword.trim().length < 6) {
      setRecoveryMsg({ type: 'error', text: 'La nueva contraseña debe tener mínimo 6 caracteres.' });
      return;
    }
    if (recoveryNewPassword !== recoveryConfirmPassword) {
      setRecoveryMsg({ type: 'error', text: 'La confirmación no coincide con la nueva contraseña.' });
      return;
    }

    setIsRecoveryLoading(true);
    const res = await verifyAndResetAdminPassword(recoveryEmail.trim(), recoveryNewPassword.trim());
    setIsRecoveryLoading(false);

    if (res.success) {
      setRecoveryStep(3);
    } else {
      setRecoveryMsg({ type: 'error', text: res.message || 'Error al restablecer contraseña.' });
    }
  };

  const handleConfirmChangeOtherAdminPassword = async () => {
    if (!selectedAdminForPasswordModal) return;
    setChangeOtherAdminPasswordMsg(null);
    if (!newPasswordForSelectedAdmin.trim() || newPasswordForSelectedAdmin.trim().length < 6) {
      setChangeOtherAdminPasswordMsg({ type: 'error', text: 'La nueva contraseña debe tener mínimo 6 caracteres.' });
      return;
    }

    setIsChangingOtherAdminPassword(true);
    const res = await changeAdminPassword(
      selectedAdminForPasswordModal.id,
      selectedAdminForPasswordModal.email,
      newPasswordForSelectedAdmin.trim()
    );
    setIsChangingOtherAdminPassword(false);

    if (res.success) {
      setChangeOtherAdminPasswordMsg({ type: 'success', text: `¡Contraseña actualizada con éxito para ${selectedAdminForPasswordModal.fullName}!` });
      setTimeout(() => {
        setSelectedAdminForPasswordModal(null);
        setNewPasswordForSelectedAdmin('');
        setChangeOtherAdminPasswordMsg(null);
      }, 1500);
    } else {
      setChangeOtherAdminPasswordMsg({ type: 'error', text: res.message || 'Error al actualizar contraseña.' });
    }
  };

  // Estado para visualizador de foto a pantalla completa (Lightbox con soporte multi-foto)
  const [previewImage, setPreviewImage] = useState<{
    source: any;
    title: string;
    price?: string;
    description?: string;
    category?: string;
    gallery?: any[];
    currentIndex?: number;
  } | null>(null);

  const handleOpenImagePreview = (
    source: any,
    title: string,
    price?: string,
    description?: string,
    category?: string,
    gallery?: any[],
    initialIndex?: number
  ) => {
    if (!source && (!gallery || gallery.length === 0)) return;
    const initialGallery = gallery && gallery.length > 0 ? gallery : (source ? [source] : []);
    const startIndex = initialIndex !== undefined && initialIndex >= 0 && initialIndex < initialGallery.length
      ? initialIndex
      : 0;
    const initialSource = initialGallery[startIndex] || source;
    setPreviewImage({
      source: initialSource,
      title,
      price,
      description,
      category,
      gallery: initialGallery,
      currentIndex: startIndex,
    });
  };

  const handleNextPreviewImage = () => {
    if (!previewImage || !previewImage.gallery || previewImage.gallery.length <= 1) return;
    const nextIdx = ((previewImage.currentIndex || 0) + 1) % previewImage.gallery.length;
    setPreviewImage({
      ...previewImage,
      currentIndex: nextIdx,
      source: previewImage.gallery[nextIdx],
    });
  };

  const handlePrevPreviewImage = () => {
    if (!previewImage || !previewImage.gallery || previewImage.gallery.length <= 1) return;
    const prevIdx = ((previewImage.currentIndex || 0) - 1 + previewImage.gallery.length) % previewImage.gallery.length;
    setPreviewImage({
      ...previewImage,
      currentIndex: prevIdx,
      source: previewImage.gallery[prevIdx],
    });
  };

  const handleCloseImagePreview = () => {
    setPreviewImage(null);
  };

  // Formulario Nuevo Producto
  const [newProdName, setNewProdName] = useState('');
  const [newProdCategory, setNewProdCategory] = useState(categories[0]?.id || 'Mochilas');
  const [newProdPrice, setNewProdPrice] = useState('');
  const [newProdStock, setNewProdStock] = useState('5');
  const [newProdImageName, setNewProdImageName] = useState('');
  const [newProdImagePath, setNewProdImagePath] = useState('');
  const [newProdImages, setNewProdImages] = useState<string[]>([]);
  const [isPickingImage, setIsPickingImage] = useState(false);
  const [newProdAncestral, setNewProdAncestral] = useState('');
  const [newProdDiscount, setNewProdDiscount] = useState('0');
  const [newProdIsDiscount, setNewProdIsDiscount] = useState(false);

  // Formulario Nueva Categoría
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('sparkles-outline');
  const [newCatDescription, setNewCatDescription] = useState('');

  // Formulario Responder Cotización
  const [quotePriceInput, setQuotePriceInput] = useState('');
  const [quoteDaysInput, setQuoteDaysInput] = useState('7');
  const [quoteNotesInput, setQuoteNotesInput] = useState('');

  // Estado del Chat
  const [selectedChatUserEmail, setSelectedChatUserEmail] = useState<string | null>(null);
  const [replyMessageText, setReplyMessageText] = useState('');

  // Manejador de Login
  const handleAdminLogin = async () => {
    setLoginError('');
    if (!adminEmail.trim() || !adminPassword.trim()) {
      setLoginError('Por favor ingresa tu correo y contraseña maestra.');
      return;
    }
    setIsSubmittingLogin(true);
    const res = await login(adminEmail.trim(), adminPassword);
    setIsSubmittingLogin(false);
    if (!res.success) {
      setLoginError(res.message || 'Error al autenticar administrador.');
    }
  };

  // Helper para convertir URI o Blob a Base64 permanente en Web
  const ensureBase64DataUrl = async (uri: string, rawBase64?: string | null): Promise<string> => {
    if (rawBase64) return `data:image/jpeg;base64,${rawBase64}`;
    if (uri.startsWith('data:')) return uri;
    try {
      if (Platform.OS === 'web') {
        const res = await fetch(uri);
        const blob = await res.blob();
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => resolve(uri);
          reader.readAsDataURL(blob);
        });
      }
    } catch (e) {
      console.warn('Error convirtiendo imagen:', e);
    }
    return uri;
  };

  // Adjuntar una o varias fotos desde la galería o archivos
  const handlePickProductImage = async () => {
    try {
      setIsPickingImage(true);

      // En Web: Selector nativo de archivos HTML5 con soporte de selección múltiple
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.multiple = true;
        input.onchange = async (e: any) => {
          const files = Array.from(e.target?.files || []) as File[];
          if (files.length > 0) {
            const newUris: string[] = [];
            for (const file of files) {
              const base64Uri = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = (ev) => resolve(ev.target?.result as string);
                reader.readAsDataURL(file);
              });
              newUris.push(base64Uri);
            }
            setNewProdImages(prev => [...prev, ...newUris]);
            setNewProdImagePath(prev => prev || newUris[0]);
            if (!newProdImageName && files[0]) {
              const cleanName = files[0].name.replace(/\.[^/.]+$/, '').replace(/\s+/g, '_').toLowerCase();
              setNewProdImageName(cleanName);
            }
          }
          setIsPickingImage(false);
        };
        input.oncancel = () => setIsPickingImage(false);
        input.click();
        return;
      }

      // En Móvil (Android / iOS):
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso Requerido', 'Se necesita autorización para acceder a tus fotos.');
        setIsPickingImage(false);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newUris: string[] = [];
        for (const asset of result.assets) {
          const persistentUri = await ensureBase64DataUrl(asset.uri, asset.base64);
          newUris.push(persistentUri);
        }
        setNewProdImages(prev => [...prev, ...newUris]);
        setNewProdImagePath(prev => prev || newUris[0]);

        const firstAsset = result.assets[0];
        if (firstAsset.fileName && !newProdImageName) {
          const cleanName = firstAsset.fileName.replace(/\.[^/.]+$/, '').replace(/\s+/g, '_').toLowerCase();
          setNewProdImageName(cleanName);
        } else if (!newProdImageName && newProdName) {
          setNewProdImageName(newProdName.trim().toLowerCase().replace(/\s+/g, '_'));
        }
      }
    } catch (err) {
      console.warn('Error al seleccionar imagen:', err);
      Alert.alert('Error', 'No se pudo cargar la imagen seleccionada.');
    } finally {
      setIsPickingImage(false);
    }
  };

  // Tomar foto con la cámara y sumarla a las fotos del artículo
  const handleTakePhoto = async () => {
    try {
      setIsPickingImage(true);
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permiso Requerido', 'Se necesita autorización para usar la cámara.');
          setIsPickingImage(false);
          return;
        }
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const persistentUri = await ensureBase64DataUrl(asset.uri, asset.base64);
        setNewProdImages(prev => [...prev, persistentUri]);
        setNewProdImagePath(prev => prev || persistentUri);
        if (!newProdImageName) {
          setNewProdImageName(`foto_${Date.now()}`);
        }
      }
    } catch (err) {
      console.warn('Error al tomar foto:', err);
      Alert.alert('Error', 'No se pudo capturar la foto.');
    } finally {
      setIsPickingImage(false);
    }
  };
  // Confirmar eliminación permanente de un producto
  const handleConfirmDelete = async () => {
    if (productToDelete) {
      const id = productToDelete.id;
      setIsDeleteModalVisible(false);
      setProductToDelete(null);
      await removeProduct(id);
    }
  };

  // Abrir modal de edición con los datos actuales del artículo
  const handleOpenEditProduct = (prod: Product) => {
    setProductToEdit(prod);
    setEditProdName(prod.name);
    setEditProdCategory(prod.categoryId || (categories[0]?.id || 'Mochilas'));
    setEditProdPrice(String(prod.priceValue || ''));
    setEditProdStock(String(prod.stock !== undefined ? prod.stock : '1'));
    setEditProdAncestral(prod.ancestralRef || '');
    setEditProdDiscount(String(prod.discountPercent || '0'));
    setEditProdIsDiscount(Boolean(prod.isDiscountActive));
    setIsEditProductModalVisible(true);
  };

  // Guardar cambios del artículo editado
  const handleSaveEditedProduct = async () => {
    if (!productToEdit) return;
    if (!editProdName.trim() || !editProdPrice.trim()) {
      Alert.alert('Campos requeridos', 'Por favor ingresa el nombre y el precio del artículo.');
      return;
    }

    const priceNum = parseInt(editProdPrice.replace(/[^0-9]/g, ''), 10) || productToEdit.priceValue;
    const stockNum = parseInt(editProdStock, 10);
    const validStock = isNaN(stockNum) ? productToEdit.stock : Math.max(0, stockNum);
    const discNum = parseInt(editProdDiscount, 10) || 0;

    await editProduct(productToEdit.id, {
      name: editProdName.trim(),
      categoryId: editProdCategory,
      priceValue: priceNum,
      price: `$ ${priceNum.toLocaleString('es-CO')} COP`,
      stock: validStock,
      ancestralRef: editProdAncestral.trim(),
      discountPercent: discNum,
      isDiscountActive: editProdIsDiscount ? 1 : 0,
    });

    setIsEditProductModalVisible(false);
    setProductToEdit(null);
    Alert.alert('¡Artículo Actualizado!', 'El artículo y su categoría han sido modificados exitosamente en la base de datos.');
  };

  // Abrir modal de gestión de fotos y ángulos del artículo
  const handleOpenGalleryModal = (prod: Product) => {
    setProductToManageGallery(prod);
    setIsGalleryModalVisible(true);
  };

  // Agregar nueva foto a la galería de un producto existente
  const handleAddPhotoToProduct = async (prod: Product) => {
    try {
      setIsAddingGalleryPhoto(true);

      let currentImages: string[] = [];
      if (prod.images && Array.isArray(prod.images) && prod.images.length > 0) {
        currentImages = [...prod.images];
      } else if (prod.imagePath) {
        currentImages = prod.imagePath.split('|').filter(Boolean);
      }

      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.multiple = true;
        input.onchange = async (e: any) => {
          const files = Array.from(e.target?.files || []) as File[];
          if (files.length > 0) {
            const newUris: string[] = [];
            for (const file of files) {
              const base64Uri = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = (ev) => resolve(ev.target?.result as string);
                reader.readAsDataURL(file);
              });
              newUris.push(base64Uri);
            }
            const updatedGallery = [...currentImages, ...newUris];
            await editProduct(prod.id, {
              images: updatedGallery,
              imagePath: updatedGallery[0],
            });
            setProductToManageGallery(prev => prev ? { ...prev, images: updatedGallery, imagePath: updatedGallery[0] } : null);
          }
          setIsAddingGalleryPhoto(false);
        };
        input.oncancel = () => setIsAddingGalleryPhoto(false);
        input.click();
        return;
      }

      // En Móvil (Android / iOS):
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso Requerido', 'Se necesita autorización para acceder a tus fotos.');
        setIsAddingGalleryPhoto(false);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newUris: string[] = [];
        for (const asset of result.assets) {
          const persistentUri = await ensureBase64DataUrl(asset.uri, asset.base64);
          newUris.push(persistentUri);
        }
        const updatedGallery = [...currentImages, ...newUris];
        await editProduct(prod.id, {
          images: updatedGallery,
          imagePath: updatedGallery[0],
        });
        setProductToManageGallery(prev => prev ? { ...prev, images: updatedGallery, imagePath: updatedGallery[0] } : null);
      }
    } catch (err) {
      console.warn('Error al agregar foto a la galería:', err);
      Alert.alert('Error', 'No se pudo adjuntar la foto al artículo.');
    } finally {
      setIsAddingGalleryPhoto(false);
    }
  };

  // Eliminar una foto específica de la galería del producto
  const handleRemovePhotoFromProduct = async (prod: Product, indexToRemove: number) => {
    let currentImages: string[] = [];
    if (prod.images && Array.isArray(prod.images) && prod.images.length > 0) {
      currentImages = [...prod.images];
    } else if (prod.imagePath) {
      currentImages = prod.imagePath.split('|').filter(Boolean);
    }

    if (currentImages.length <= 1) {
      Alert.alert('Aviso', 'El artículo debe tener al menos una foto principal de referencia.');
      return;
    }

    const updated = currentImages.filter((_, idx) => idx !== indexToRemove);
    await editProduct(prod.id, {
      images: updated,
      imagePath: updated[0],
    });
    setProductToManageGallery(prev => prev ? { ...prev, images: updated, imagePath: updated[0] } : null);
  };
  // Helper para resolver imagen de producto (100% URLs de Supabase)
  const resolveProductImage = (path?: string | null) => {
    if (!path) return null;
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
      return { uri: path };
    }
    if (SUPABASE_FALLBACK_IMAGES[path]) {
      return { uri: SUPABASE_FALLBACK_IMAGES[path] };
    }
    return { uri: SUPABASE_FALLBACK_IMAGES.mochila1 };
  };

  // Abrir modal de nuevo producto completamente limpio y refrescado
  const handleOpenNewProductModal = () => {
    setNewProdName('');
    setNewProdCategory(categories[0]?.id || 'Mochilas');
    setNewProdPrice('');
    setNewProdStock('5');
    setNewProdImageName('');
    setNewProdImagePath('');
    setNewProdImages([]);
    setNewProdAncestral('');
    setNewProdDiscount('0');
    setNewProdIsDiscount(false);
    setIsNewProductModalVisible(true);
  };

  // Guardar nuevo producto y limpiar/refrescar la ventana modal
  const handleSaveProduct = async () => {
    if (!newProdName.trim() || !newProdPrice.trim()) {
      Alert.alert('Campos incompletos', 'Ingresa el nombre y precio del artículo.');
      return;
    }
    const priceNum = parseInt(newProdPrice.replace(/[^0-9]/g, ''), 10) || 100000;
    const stockNum = parseInt(newProdStock, 10) || 1;
    const discNum = parseInt(newProdDiscount, 10) || 0;

    await addProduct({
      name: newProdName.trim(),
      categoryId: newProdCategory,
      priceValue: priceNum,
      price: `$ ${priceNum.toLocaleString('es-CO')} COP`,
      icon: 'sparkles-outline',
      imagePath: (newProdImages.length > 0 ? newProdImages[0] : newProdImagePath.trim()) || 'mochila1',
      images: newProdImages.length > 0 ? newProdImages : (newProdImagePath.trim() ? [newProdImagePath.trim()] : undefined),
      imageName: newProdImageName.trim() || newProdName.trim(),
      ancestralRef: newProdAncestral.trim() || 'Pieza sagrada elaborada a mano con técnicas tradicionales wayuu.',
      stock: stockNum,
      discountPercent: discNum,
      isDiscountActive: newProdIsDiscount ? 1 : 0,
    });

    // Limpiar y refrescar la ventana modal de nuevo artículo por completo
    setIsNewProductModalVisible(false);
    setNewProdName('');
    setNewProdCategory(categories[0]?.id || 'Mochilas');
    setNewProdPrice('');
    setNewProdStock('5');
    setNewProdImageName('');
    setNewProdImagePath('');
    setNewProdImages([]);
    setNewProdAncestral('');
    setNewProdDiscount('0');
    setNewProdIsDiscount(false);
    Alert.alert('¡Éxito!', 'Artículo agregado exitosamente al catálogo.');
  };

  const PRESET_CATEGORY_ICONS = [
    { icon: 'briefcase-outline', label: 'Mochilas' },
    { icon: 'shirt-outline', label: 'Mantas' },
    { icon: 'bed-outline', label: 'Chinchorros' },
    { icon: 'umbrella-outline', label: 'Sombreros' },
    { icon: 'sparkles-outline', label: 'Accesorios' },
    { icon: 'color-palette-outline', label: 'Artesanías' },
    { icon: 'diamond-outline', label: 'Joyería' },
    { icon: 'ribbon-outline', label: 'Fajones' },
    { icon: 'basket-outline', label: 'Canastos' },
    { icon: 'gift-outline', label: 'Especiales' },
  ];

  // Iniciar edición de categoría
  const handleStartEditCategory = (cat: Category) => {
    setEditingCategory(cat);
    setEditCatName(cat.name);
    setEditCatIcon(cat.icon || 'sparkles-outline');
    setEditCatDescription(cat.description || '');
  };

  // Guardar edición de categoría
  const handleSaveEditCategory = async () => {
    if (!editingCategory) return;
    if (!editCatName.trim()) {
      Alert.alert('Campo requerido', 'El nombre de la categoría no puede estar vacío.');
      return;
    }
    setIsSavingCategory(true);
    try {
      await editCategory(editingCategory.id, {
        name: editCatName.trim(),
        icon: editCatIcon.trim() || 'sparkles-outline',
        description: editCatDescription.trim(),
      });
      setEditingCategory(null);
      Alert.alert('¡Categoría Actualizada!', `La categoría "${editCatName.trim()}" fue actualizada exitosamente.`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo actualizar la categoría.');
    } finally {
      setIsSavingCategory(false);
    }
  };

  // Eliminar categoría
  const handleDeleteCategory = (cat: Category) => {
    const associatedProducts = products.filter(
      p => p.categoryId === cat.id || p.categoryId === cat.name
    );
    if (associatedProducts.length > 0) {
      Alert.alert(
        'No se puede eliminar',
        `La categoría "${cat.name}" tiene ${associatedProducts.length} artículo(s) asociados en el inventario. Debes reasignar o eliminar esos productos antes de borrar la categoría.`
      );
      return;
    }

    Alert.alert(
      'Confirmar Eliminación',
      `¿Estás seguro de que deseas eliminar permanentemente la categoría "${cat.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeCategory(cat.id);
              Alert.alert('Eliminada', `La categoría "${cat.name}" ha sido eliminada del catálogo.`);
            } catch (err: any) {
              Alert.alert('Error', err.message || 'No se pudo eliminar la categoría.');
            }
          }
        }
      ]
    );
  };

  // Guardar nueva categoría
  const handleSaveCategory = async () => {
    if (!newCatName.trim()) {
      Alert.alert('Campo requerido', 'Ingresa el nombre de la nueva categoría.');
      return;
    }
    await addCategory({
      name: newCatName.trim(),
      icon: newCatIcon.trim() || 'sparkles-outline',
      description: newCatDescription.trim(),
    });
    setIsNewCategoryModalVisible(false);
    setNewCatName('');
    setNewCatDescription('');
    Alert.alert('¡Categoría Creada!', 'La categoría ahora está disponible para clasificar productos.');
  };

  // Enviar cotización
  const handleSendQuoteResponse = async () => {
    if (!selectedQuote) return;
    const priceNum = parseInt(quotePriceInput.replace(/[^0-9]/g, ''), 10) || 150000;
    const daysNum = parseInt(quoteDaysInput, 10) || 7;

    await respondQuote(
      selectedQuote.id,
      priceNum,
      daysNum,
      quoteNotesInput.trim() || 'Tejido en hilos de algodón con acabados de alta calidad.'
    );

    setIsQuoteModalVisible(false);
    setSelectedQuote(null);
    setQuotePriceInput('');
    setQuoteNotesInput('');
    Alert.alert('¡Cotización Enviada!', 'El cliente ha recibido la cotización formal en su chat.');
  };

  // Enviar mensaje en chat
  const handleSendAdminReply = async () => {
    if (!selectedChatUserEmail || !replyMessageText.trim()) return;
    await sendMessage(
      selectedChatUserEmail,
      'Cliente Einuushi',
      replyMessageText.trim()
    );
    setReplyMessageText('');
  };

  // Helper para verificar si un pedido está dentro del rango de fecha seleccionado
  const isOrderInDateRange = (order: Order) => {
    if (orderDatePreset === 'ALL') return true;

    const orderDate = parseOrderDate(order);
    if (!orderDate) return true; // Si no tiene fecha parseable, se mantiene visible

    const now = new Date();

    if (orderDatePreset === 'TODAY') {
      return (
        orderDate.getFullYear() === now.getFullYear() &&
        orderDate.getMonth() === now.getMonth() &&
        orderDate.getDate() === now.getDate()
      );
    }

    if (orderDatePreset === 'LAST_7_DAYS') {
      const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 0, 0, 0);
      return orderDate >= sevenDaysAgo;
    }

    if (orderDatePreset === 'THIS_MONTH') {
      return (
        orderDate.getFullYear() === now.getFullYear() &&
        orderDate.getMonth() === now.getMonth()
      );
    }

    if (orderDatePreset === 'CUSTOM') {
      if (orderStartDate) {
        const startParts = orderStartDate.split('-');
        if (startParts.length === 3) {
          const start = new Date(parseInt(startParts[0], 10), parseInt(startParts[1], 10) - 1, parseInt(startParts[2], 10), 0, 0, 0);
          if (!isNaN(start.getTime()) && orderDate < start) return false;
        }
      }
      if (orderEndDate) {
        const endParts = orderEndDate.split('-');
        if (endParts.length === 3) {
          const end = new Date(parseInt(endParts[0], 10), parseInt(endParts[1], 10) - 1, parseInt(endParts[2], 10), 23, 59, 59);
          if (!isNaN(end.getTime()) && orderDate > end) return false;
        }
      }
      return true;
    }

    return true;
  };

  // Pedidos filtrados por Estado Y por Rango de Fecha
  const filteredOrders = orders.filter(o => {
    let matchStatus = true;
    if (orderStatusFilter === 'ALL') matchStatus = true;
    else if (orderStatusFilter === 'PENDING_SETTLEMENT') matchStatus = o.settlementStatus === 'PENDING_SETTLEMENT';
    else if (orderStatusFilter === 'SETTLED') matchStatus = o.settlementStatus === 'SETTLED';
    else matchStatus = o.statusCode === orderStatusFilter;

    if (!matchStatus) return false;
    return isOrderInDateRange(o);
  });

  // Abrir modal de liquidación y Paz y Salvo
  const openSettlementModal = (order: Order) => {
    setSelectedOrderForSettlement(order);
    const isTransfer = (order.client.payment || '').toLowerCase().includes('transfer') || (order.client.payment || '').toLowerCase().includes('qr');
    setSettlementType(isTransfer ? 'TRANSFERENCIA_TIENDA' : 'EFECTIVO_EN_TIENDA');
    setSettlementTransferRef(order.transferReference || '');
    setSettlementNotes(order.settlementNotes || '');
    setIsSettlementModalVisible(true);
  };

  // Confirmar liquidación y otorgar Paz y Salvo
  const handleConfirmSettlement = async () => {
    if (!selectedOrderForSettlement) return;
    if (settlementType === 'TRANSFERENCIA_TIENDA' && !settlementTransferRef.trim()) {
      if (Platform.OS === 'web') {
        window.alert('Por favor ingrese el número de comprobante o referencia de la transferencia bancaria.');
      } else {
        Alert.alert('Comprobante requerido', 'Por favor ingrese el número de comprobante o referencia de la transferencia bancaria.');
      }
      return;
    }

    setIsSubmittingSettlement(true);
    try {
      await settleOrderPazYSalvo(
        selectedOrderForSettlement.id,
        settlementType,
        settlementTransferRef,
        settlementNotes
      );
      setIsSettlementModalVisible(false);
      const successMsg = settlementType === 'EFECTIVO_EN_TIENDA'
        ? `¡Pedido #${selectedOrderForSettlement.id} en Paz y Salvo! Se registró la recepción de dinero en efectivo en la tienda por el repartidor ${selectedOrderForSettlement.driverName || 'asignado'}.`
        : `¡Pedido #${selectedOrderForSettlement.id} en Paz y Salvo! Se registró la transferencia #${settlementTransferRef} a la cuenta de la tienda.`;
      if (Platform.OS === 'web') {
        window.alert(successMsg);
      } else {
        Alert.alert('Paz y Salvo Registrado ✅', successMsg);
      }
    } catch (err: any) {
      console.error('Error settling order:', err);
      Alert.alert('Error', 'No se pudo registrar la liquidación del pedido.');
    } finally {
      setIsSubmittingSettlement(false);
    }
  };

  // Abrir modal de asignación y despacho a repartidor o transportadora registrada
  const openDispatchModal = (order: Order) => {
    setSelectedOrderToDispatch(order);
    setSelectedDriverId(drivers[0]?.id || '');
    setCustomGuideNumber(order.trackingGuideNumber || '');
    setDispatchDriverFilter('all');
    setIsDispatchModalVisible(true);
  };

  // Confirmar despacho y asignación
  const handleConfirmDispatchWithDriver = async () => {
    if (!selectedOrderToDispatch) return;

    const matchedDriver = drivers.find(d => d.id === selectedDriverId) || drivers[0];
    if (!matchedDriver) {
      if (Platform.OS === 'web') {
        window.alert('No hay repartidores disponibles. Por favor registra uno primero.');
      } else {
        Alert.alert('Sin repartidores', 'No hay repartidores disponibles. Por favor registra uno primero.');
      }
      return;
    }

    const isCorporate = matchedDriver.driverType === 'corporate';
    const finalGuide = isCorporate ? (customGuideNumber.trim() || `GUIA-${Date.now().toString().slice(-6)}`) : undefined;

    const driverInfo = {
      driverId: matchedDriver.id,
      driverName: matchedDriver.fullName,
      driverEmail: matchedDriver.email,
      driverPhone: matchedDriver.phone,
      driverType: (matchedDriver.driverType || 'individual') as 'individual' | 'corporate',
      vehicleType: matchedDriver.vehicleType,
      plateOrNit: matchedDriver.plateOrNit,
      trackingGuideNumber: finalGuide,
      carrierTrackingUrl: isCorporate ? (matchedDriver.carrierTrackingUrl || 'https://www.servientrega.com') : undefined,
    };

    try {
      await dispatchOrder(selectedOrderToDispatch.id, driverInfo);
      setIsDispatchModalVisible(false);
      const msg = isCorporate
        ? `¡Pedido #${selectedOrderToDispatch.id} despachado a través de ${matchedDriver.fullName}! Guía: ${finalGuide}`
        : `¡Pedido #${selectedOrderToDispatch.id} despachado y asignado al repartidor ${matchedDriver.fullName}!`;
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Despacho Exitoso 🚀', msg);
      }
    } catch (err) {
      Alert.alert('Error', 'No se pudo despachar el pedido.');
    }
  };

  // Guardar nuevo repartidor o transportadora
  const handleSaveNewDriver = async () => {
    if (!newDriverName.trim() || !newDriverEmail.trim() || !newDriverPhone.trim() || !newDriverCedulaOrNit.trim()) {
      if (Platform.OS === 'web') {
        window.alert('Por favor complete todos los campos obligatorios (*).');
      } else {
        Alert.alert('Datos incompletos', 'Por favor complete todos los campos obligatorios (*).');
      }
      return;
    }

    setIsSubmittingNewDriver(true);
    try {
      const finalVehicle = newDriverType === 'corporate'
        ? (newDriverVehicle.trim() || 'Logística Nacional / Terrestre')
        : (newDriverVehicle === 'Otro' ? (newDriverVehicleOther.trim() || 'Otro') : (newDriverVehicle || 'Moto'));

      const res = await createDriver({
        fullName: newDriverName.trim(),
        email: newDriverEmail.trim(),
        password: newDriverPassword.trim() || 'repartidor2026',
        phone: newDriverPhone.trim(),
        cedulaOrNit: newDriverCedulaOrNit.trim(),
        driverType: newDriverType,
        companyName: newDriverType === 'corporate' ? (newDriverCompany.trim() || newDriverName.trim()) : undefined,
        vehicleType: finalVehicle,
        plateOrNit: newDriverPlate.trim() || newDriverCedulaOrNit.trim(),
        carrierTrackingUrl: newDriverType === 'corporate' ? newDriverTrackingUrl.trim() : undefined,
      });

      if (res.success) {
        setIsNewDriverModalVisible(false);
        setNewDriverName('');
        setNewDriverEmail('');
        setNewDriverPassword('');
        setNewDriverPhone('');
        setNewDriverCedulaOrNit('');
        setNewDriverCompany('');
        setNewDriverVehicle('Moto');
        setNewDriverVehicleOther('');
        setNewDriverPlate('');
        setNewDriverTrackingUrl('');
        setIsVehicleDropdownOpen(false);
        const successMsg = `¡${newDriverType === 'corporate' ? 'Empresa transportadora' : 'Repartidor'} registrado exitosamente! Ya puede iniciar sesión en la app móvil.`;
        if (Platform.OS === 'web') {
          window.alert(successMsg);
        } else {
          Alert.alert('Registro Exitoso ✅', successMsg);
        }
      } else {
        Alert.alert('Error al registrar', res.message || 'No se pudo completar el registro.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Error inesperado al registrar.');
    } finally {
      setIsSubmittingNewDriver(false);
    }
  };

  // Agrupar mensajes de chat por usuario
  const chatUsersMap = new Map<string, { email: string; name: string; lastMessage: string; unreadCount: number }>();
  messages.forEach(m => {
    const existing = chatUsersMap.get(m.userEmail) || {
      email: m.userEmail,
      name: m.userName || m.userEmail,
      lastMessage: m.message,
      unreadCount: 0,
    };
    existing.lastMessage = m.message;
    if (m.senderRole === 'client' && m.read === 0) {
      existing.unreadCount += 1;
    }
    chatUsersMap.set(m.userEmail, existing);
  });
  const chatConversations = Array.from(chatUsersMap.values());

  const activeConversationMessages = selectedChatUserEmail
    ? messages.filter(m => m.userEmail.toLowerCase() === selectedChatUserEmail.toLowerCase())
    : [];

  // =========================================================================
  // RENDER: PANTALLA DE ACCESO ADMINISTRATIVO (LOGIN PRIVADO)
  // =========================================================================
  if (!isAuthenticated) {
    return (
      <View style={styles.authContainer}>
        <View style={styles.authCard}>
          <View style={styles.authHeader}>
            <View style={styles.authIconCircle}>
              <Ionicons name="shield-checkmark" size={36} color="#C5A880" />
            </View>
            <Text style={styles.authBadgeText}>PORTAL INTERNO EXCLUSIVO</Text>
            <Text style={styles.authTitle}>Backoffice Einuushi</Text>
            <Text style={styles.authSubtitle}>
              Panel de Administración, Despacho y Gestión Comercial
            </Text>
          </View>

          {loginError ? (
            <View style={styles.authErrorBox}>
              <Ionicons name="alert-circle" size={18} color="#DC2626" style={{ marginRight: 6 }} />
              <Text style={styles.authErrorText}>{loginError}</Text>
            </View>
          ) : null}

          <View style={styles.authInputGroup}>
            <Text style={styles.authInputLabel}>Correo del Administrador</Text>
            <View style={styles.authInputWrapper}>
              <Ionicons name="mail-outline" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.authTextInput}
                placeholder="correo@ejemplo.com"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                keyboardType="email-address"
                value={adminEmail}
                onChangeText={setAdminEmail}
              />
            </View>
          </View>

          <View style={styles.authInputGroup}>
            <Text style={styles.authInputLabel}>Contraseña</Text>
            <View style={styles.authInputWrapper}>
              <Ionicons name="lock-closed-outline" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.authTextInput}
                placeholder="••••••••"
                placeholderTextColor="#94A3B8"
                secureTextEntry
                value={adminPassword}
                onChangeText={setAdminPassword}
              />
            </View>
          </View>

          <TouchableOpacity
            style={styles.authSubmitButton}
            onPress={handleAdminLogin}
            disabled={isSubmittingLogin}
            activeOpacity={0.8}
          >
            {isSubmittingLogin ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Text style={styles.authSubmitButtonText}>Iniciar Sesión en Panel</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
              </>
            )}
          </TouchableOpacity>

          {/* Enlace de recuperación de contraseña para administradores */}
          <TouchableOpacity
            style={styles.forgotAdminPasswordBtn}
            onPress={handleOpenRecoveryModal}
            activeOpacity={0.7}
          >
            <Ionicons name="help-circle-outline" size={14} color="#C5A880" style={{ marginRight: 5 }} />
            <Text style={styles.forgotAdminPasswordText}>¿Olvidaste tu contraseña? Recupérala con tu correo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backToStoreButton}
            onPress={() => router.push({ pathname: '/home', params: { mode: 'admin_preview' } })}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={16} color="#64748B" style={{ marginRight: 6 }} />
            <Text style={styles.backToStoreText}>Ver Catálogo de la Tienda</Text>
          </TouchableOpacity>
        </View>

        {/* MODAL: RECUPERACIÓN DE CONTRASEÑA ADMINISTRATIVA (EMAILJS) */}
        <Modal
          visible={isRecoveryModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setIsRecoveryModalVisible(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalOverlay}
          >
            <View style={[styles.modalDialog, { maxWidth: 460, padding: 24 }]}>
              {/* Header del Modal */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={[styles.settingsIconCircle, { backgroundColor: '#EFF6FF', width: 38, height: 38, borderRadius: 19 }]}>
                    <Ionicons name="shield-checkmark" size={20} color="#1D4ED8" />
                  </View>
                  <View>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1E2B58' }}>
                      Recuperación de Contraseña
                    </Text>
                    <Text style={{ fontSize: 11, color: '#64748B' }}>
                      {recoveryStep === 1 ? 'Paso 1: Verificación de Correo' : recoveryStep === 2 ? 'Paso 2: Código y Nueva Clave' : '¡Contraseña Actualizada!'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => setIsRecoveryModalVisible(false)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={24} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              {recoveryMsg && (
                <View style={[styles.feedbackMsgBox, recoveryMsg.type === 'success' ? styles.feedbackSuccess : styles.feedbackError]}>
                  <Ionicons
                    name={recoveryMsg.type === 'success' ? 'checkmark-circle' : 'alert-circle'}
                    size={18}
                    color={recoveryMsg.type === 'success' ? '#166534' : '#DC2626'}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[styles.feedbackText, recoveryMsg.type === 'success' ? { color: '#166534' } : { color: '#DC2626' }]}>
                    {recoveryMsg.text}
                  </Text>
                </View>
              )}

              {/* PASO 1: INGRESAR CORREO ADMINISTRATIVO */}
              {recoveryStep === 1 && (
                <View>
                  <Text style={{ fontSize: 13, color: '#334155', marginBottom: 14, lineHeight: 18 }}>
                    Ingresa el correo electrónico con el que está creada tu cuenta de administrador o superadministrador. Te enviaremos un código de seguridad de 6 dígitos con vigencia de 1 minuto.
                  </Text>

                  <View style={{ marginBottom: 16 }}>
                    <Text style={styles.settingsLabel}>Correo Administrativo:</Text>
                    <TextInput
                      style={styles.settingsInput}
                      value={recoveryEmail}
                      onChangeText={setRecoveryEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      placeholder="admin@einuushi.com"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.settingsPrimaryBtn, isRecoveryLoading && { opacity: 0.7 }]}
                    onPress={handleSendRecoveryCode}
                    disabled={isRecoveryLoading}
                    activeOpacity={0.8}
                  >
                    {isRecoveryLoading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="mail-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={styles.settingsPrimaryBtnText}>Enviar Código al Correo</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {/* PASO 2: CÓDIGO + NUEVA CLAVE */}
              {recoveryStep === 2 && (
                <View>
                  {/* Temporizador de 1 minuto */}
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: recoveryIsCodeExpired ? '#FEE2E2' : '#FEF3C7',
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 8,
                    marginBottom: 14,
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="time-outline" size={16} color={recoveryIsCodeExpired ? '#DC2626' : '#B45309'} />
                      <Text style={{ fontSize: 12, fontWeight: 'bold', color: recoveryIsCodeExpired ? '#DC2626' : '#B45309' }}>
                        {recoveryIsCodeExpired ? 'Código Expirado' : `Vigencia: ${recoveryTimeLeft}s`}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={handleResendRecoveryCode}
                      disabled={isRecoveryLoading}
                      style={{ opacity: isRecoveryLoading ? 0.6 : 1 }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#1E2B58', textDecorationLine: 'underline' }}>
                        Reenviar código
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={{ marginBottom: 12 }}>
                    <Text style={styles.settingsLabel}>Código de 6 dígitos recibido:</Text>
                    <TextInput
                      style={[styles.settingsInput, { letterSpacing: 4, fontWeight: 'bold', fontSize: 16, textAlign: 'center' }]}
                      value={recoveryCode}
                      onChangeText={setRecoveryCode}
                      keyboardType="numeric"
                      maxLength={6}
                      placeholder="123456"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  <View style={{ marginBottom: 12 }}>
                    <Text style={styles.settingsLabel}>Nueva Contraseña:</Text>
                    <View style={styles.passwordInputWrapper}>
                      <TextInput
                        style={styles.passwordTextInput}
                        value={recoveryNewPassword}
                        onChangeText={setRecoveryNewPassword}
                        secureTextEntry={!showRecoveryPassword}
                        placeholder="Mínimo 6 caracteres"
                        placeholderTextColor="#94A3B8"
                      />
                      <TouchableOpacity onPress={() => setShowRecoveryPassword(!showRecoveryPassword)} style={styles.eyeBtn}>
                        <Ionicons name={showRecoveryPassword ? 'eye-off' : 'eye'} size={18} color="#64748B" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={{ marginBottom: 16 }}>
                    <Text style={styles.settingsLabel}>Confirmar Nueva Contraseña:</Text>
                    <View style={styles.passwordInputWrapper}>
                      <TextInput
                        style={styles.passwordTextInput}
                        value={recoveryConfirmPassword}
                        onChangeText={setRecoveryConfirmPassword}
                        secureTextEntry={!showRecoveryPassword}
                        placeholder="Repite la contraseña"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[styles.settingsPrimaryBtn, isRecoveryLoading && { opacity: 0.7 }]}
                    onPress={handleConfirmResetAdminPassword}
                    disabled={isRecoveryLoading}
                    activeOpacity={0.8}
                  >
                    {isRecoveryLoading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-done" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={styles.settingsPrimaryBtnText}>Restablecer Contraseña</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {/* PASO 3: CONFIRMACIÓN EXITOSA */}
              {recoveryStep === 3 && (
                <View style={{ alignItems: 'center', paddingVertical: 12 }}>
                  <View style={{
                    width: 60,
                    height: 60,
                    borderRadius: 30,
                    backgroundColor: '#DCFCE7',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginBottom: 14,
                  }}>
                    <Ionicons name="checkmark-circle" size={42} color="#166534" />
                  </View>
                  <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1E2B58', marginBottom: 6 }}>
                    ¡Contraseña Restablecida!
                  </Text>
                  <Text style={{ fontSize: 13, color: '#64748B', textAlign: 'center', marginBottom: 20, lineHeight: 18 }}>
                    Tu contraseña administrativa ha sido actualizada exitosamente. Ya puedes iniciar sesión en el panel con tu nueva clave.
                  </Text>

                  <TouchableOpacity
                    style={[styles.settingsPrimaryBtn, { width: '100%' }]}
                    onPress={() => {
                      setAdminEmail(recoveryEmail.trim());
                      setAdminPassword(recoveryNewPassword.trim());
                      setIsRecoveryModalVisible(false);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.settingsPrimaryBtnText}>Iniciar Sesión Ahora</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    );
  }

  // =========================================================================
  // RENDER: DASHBOARD DE ADMINISTRACIÓN
  // =========================================================================
  return (
    <View style={styles.dashboardContainer}>
      {/* HEADER SUPERIOR */}
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <View style={styles.logoBadge}>
            <Ionicons name="shield-checkmark" size={18} color="#C5A880" />
          </View>
          <View>
            <Text style={styles.brandTitle}>EINUUSHI BACKOFFICE</Text>
            <Text style={styles.adminStatusText}>
              ● Sesión Activa: <Text style={{ fontWeight: 'bold' }}>{adminUser?.fullName}</Text>
            </Text>
          </View>
        </View>

        <View style={styles.topActionsRow}>
          <TouchableOpacity
            style={styles.refreshIconButton}
            onPress={refreshAll}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isRefreshing ? 'sync' : 'refresh-outline'}
              size={18}
              color="#1E2B58"
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.viewStoreButton}
            onPress={() => router.push({ pathname: '/home', params: { mode: 'admin_preview' } })}
            activeOpacity={0.7}
          >
            <Ionicons name="storefront-outline" size={16} color="#1E2B58" style={{ marginRight: 4 }} />
            <Text style={styles.viewStoreText}>Ver Tienda</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.logoutIconButton}
            onPress={logout}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={18} color="#DC2626" />
          </TouchableOpacity>
        </View>
      </View>

      {/* BARRA DE PESTAÑAS (TABS) */}
      <View style={styles.tabsNavContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsNavScroll}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'analytics' && styles.tabButtonActive]}
            onPress={() => setActiveTab('analytics')}
          >
            <Ionicons
              name="stats-chart"
              size={16}
              color={activeTab === 'analytics' ? '#FFFFFF' : '#64748B'}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.tabButtonText, activeTab === 'analytics' && styles.tabButtonTextActive]}>
              Consultas & Métricas
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'orders' && styles.tabButtonActive]}
            onPress={() => setActiveTab('orders')}
          >
            <Ionicons
              name="cube"
              size={16}
              color={activeTab === 'orders' ? '#FFFFFF' : '#64748B'}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.tabButtonText, activeTab === 'orders' && styles.tabButtonTextActive]}>
              Pedidos ({orders.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'inventory' && styles.tabButtonActive]}
            onPress={() => setActiveTab('inventory')}
          >
            <Ionicons
              name="pricetags"
              size={16}
              color={activeTab === 'inventory' ? '#FFFFFF' : '#64748B'}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.tabButtonText, activeTab === 'inventory' && styles.tabButtonTextActive]}>
              Catálogo & Descuentos ({products.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'quotes' && styles.tabButtonActive]}
            onPress={() => setActiveTab('quotes')}
          >
            <Ionicons
              name="sparkles"
              size={16}
              color={activeTab === 'quotes' ? '#FFFFFF' : '#64748B'}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.tabButtonText, activeTab === 'quotes' && styles.tabButtonTextActive]}>
              Diseños & Cotizaciones ({quotes.filter(q => q.status === 'PENDING_QUOTE').length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'chat' && styles.tabButtonActive]}
            onPress={() => setActiveTab('chat')}
          >
            <Ionicons
              name="chatbubbles"
              size={16}
              color={activeTab === 'chat' ? '#FFFFFF' : '#64748B'}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.tabButtonText, activeTab === 'chat' && styles.tabButtonTextActive]}>
              Mensajes & Soporte
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'settings' && styles.tabButtonActive]}
            onPress={() => setActiveTab('settings')}
          >
            <Ionicons
              name="shield-checkmark"
              size={16}
              color={activeTab === 'settings' ? '#FFFFFF' : '#64748B'}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.tabButtonText, activeTab === 'settings' && styles.tabButtonTextActive]}>
              Configuración & Trazabilidad
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* CONTENIDO PRINCIPAL SEGÚN TAB ACTIVO */}
      <ScrollView contentContainerStyle={styles.mainScrollContent}>
        {/* ================================================================= */}
        {/* TAB 1: CONSULTAS Y ANALÍTICA COMERCIAL                           */}
        {/* ================================================================= */}
        {activeTab === 'analytics' && (
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionHeaderTitle}>Panel de Consultas y Rendimiento</Text>
            <Text style={styles.sectionHeaderSubtitle}>
              Datos agregados en tiempo real desde la base de datos SQLite con Drizzle ORM
            </Text>

            {/* KPIs CARDS */}
            <View style={styles.kpiGrid}>
              <View style={[styles.kpiCard, { borderColor: '#10B981' }]}>
                <View style={styles.kpiIconWrapper}>
                  <Ionicons name="cash-outline" size={24} color="#10B981" />
                </View>
                <Text style={styles.kpiValue}>
                  $ {(analytics?.totalRevenue || 0).toLocaleString('es-CO')}
                </Text>
                <Text style={styles.kpiLabel}>Ventas Totales (COP)</Text>
              </View>

              <View style={[styles.kpiCard, { borderColor: '#3B82F6' }]}>
                <View style={styles.kpiIconWrapper}>
                  <Ionicons name="bag-check-outline" size={24} color="#3B82F6" />
                </View>
                <Text style={styles.kpiValue}>{analytics?.totalOrders || 0}</Text>
                <Text style={styles.kpiLabel}>Total de Pedidos</Text>
              </View>

              <View style={[styles.kpiCard, { borderColor: '#F59E0B' }]}>
                <View style={styles.kpiIconWrapper}>
                  <Ionicons name="hourglass-outline" size={24} color="#F59E0B" />
                </View>
                <Text style={styles.kpiValue}>{analytics?.pendingOrders || 0}</Text>
                <Text style={styles.kpiLabel}>Pendientes de Despacho</Text>
              </View>

              <TouchableOpacity 
                style={[
                  styles.kpiCard, 
                  { 
                    borderColor: '#8B5CF6', 
                    backgroundColor: '#FAF5FF',
                    cursor: Platform.OS === 'web' ? 'pointer' : undefined,
                  } as any
                ]}
                onPress={() => {
                  if (isSuperAdminUser) {
                    setIsUsersModalVisible(true);
                  } else {
                    Alert.alert(
                      'Acceso Restringido',
                      'Por políticas de privacidad y protección de datos, los administradores operativos no tienen acceso a visualizar datos de otros usuarios. Únicamente tienes acceso a tus propios datos de cuenta.'
                    );
                  }
                }}
                activeOpacity={0.8}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <View style={styles.kpiIconWrapper}>
                    <Ionicons name="people-outline" size={24} color="#8B5CF6" />
                  </View>
                  <View style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    backgroundColor: isSuperAdminUser ? '#8B5CF6' : '#94A3B8', 
                    paddingHorizontal: 7, 
                    paddingVertical: 2, 
                    borderRadius: 10 
                  }}>
                    <Ionicons name={isSuperAdminUser ? "eye-outline" : "lock-closed-outline"} size={11} color="#FFFFFF" style={{ marginRight: 3 }} />
                    <Text style={{ fontSize: 10, color: '#FFFFFF', fontWeight: 'bold' }}>{isSuperAdminUser ? 'Ver' : 'Privado'}</Text>
                  </View>
                </View>
                <Text style={styles.kpiValue}>{analytics?.totalClients || (users?.filter(isPureClientUser).length || 0)}</Text>
                <Text style={styles.kpiLabel}>Clientes Registrados</Text>
                <Text style={{ fontSize: 10, color: isSuperAdminUser ? '#7C3AED' : '#64748B', marginTop: 4, fontWeight: '600' }}>
                  {isSuperAdminUser ? 'Toca para ver lista ➔' : 'Solo Superadministrador'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* ARQUEO DE CAJA Y LIQUIDACIÓN CON REPARTIDORES (PAZ Y SALVO) */}
            <View style={styles.settlementArqueoCard}>
              <View style={styles.cardHeaderRow}>
                <Ionicons name="wallet-outline" size={22} color="#1E2B58" style={{ marginRight: 8 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardHeaderTitle, { color: '#1E2B58' }]}>Arqueo de Caja & Liquidación de Repartidores</Text>
                  <Text style={{ fontSize: 11, color: '#64748B' }}>
                    Control de dinero recaudado por domiciliarios vs ventas en Paz y Salvo en tienda
                  </Text>
                </View>
              </View>

              <View style={styles.settlementStatsRow}>
                <View style={[styles.settlementStatBox, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <Ionicons name="checkmark-circle" size={16} color="#16A34A" style={{ marginRight: 5 }} />
                    <Text style={[styles.settlementStatLabel, { color: '#166534' }]}>En Paz y Salvo (Tienda)</Text>
                  </View>
                  <Text style={[styles.settlementStatValue, { color: '#15803D' }]}>
                    $ {(analytics?.settledRevenue || 0).toLocaleString('es-CO')}
                  </Text>
                  <Text style={[styles.settlementStatSub, { color: '#166534' }]}>
                    Dinero en caja física o transferencias verificadas
                  </Text>
                </View>

                <View style={[styles.settlementStatBox, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <Ionicons name="bicycle" size={16} color="#D97706" style={{ marginRight: 5 }} />
                    <Text style={[styles.settlementStatLabel, { color: '#92400E' }]}>Con Repartidores (Por Liquidar)</Text>
                  </View>
                  <Text style={[styles.settlementStatValue, { color: '#B45309' }]}>
                    $ {(analytics?.pendingSettlementRevenue || 0).toLocaleString('es-CO')}
                  </Text>
                  <Text style={[styles.settlementStatSub, { color: '#92400E' }]}>
                    {analytics?.pendingSettlementCount || 0} pedido(s) pendientes de entrega de dinero en tienda
                  </Text>
                </View>
              </View>
            </View>

            {/* PRODUCTOS MÁS PEDIDOS */}
            <View style={styles.analyticsCard}>
              <View style={styles.cardHeaderRow}>
                <Ionicons name="trophy-outline" size={20} color="#C5A880" style={{ marginRight: 6 }} />
                <Text style={styles.cardHeaderTitle}>Productos Más Pedidos (Top Ventas)</Text>
              </View>
              {analytics?.topSellingProducts && analytics.topSellingProducts.length > 0 ? (
                analytics.topSellingProducts.map((p, idx) => (
                  <View key={idx} style={styles.rankRow}>
                    <View style={styles.rankBadge}>
                      <Text style={styles.rankBadgeText}>#{idx + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rankNameText}>{p.name}</Text>
                      <Text style={styles.rankSubText}>Categoría: {p.categoryId}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.rankSoldNumber}>{p.totalSold} unid. vendidas</Text>
                      <Text style={styles.rankRevenueNumber}>$ {p.revenue.toLocaleString('es-CO')}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>Aún no se han completado compras de productos.</Text>
              )}
            </View>

            {/* CLIENTES QUE MÁS COMPRAN */}
            <View style={styles.analyticsCard}>
              <View style={styles.cardHeaderRow}>
                <Ionicons name="star-outline" size={20} color="#C5A880" style={{ marginRight: 6 }} />
                <Text style={styles.cardHeaderTitle}>Clientes Estrella (Mayor Volumen de Compra)</Text>
              </View>
              {analytics?.topSpendingClients && analytics.topSpendingClients.length > 0 ? (
                analytics.topSpendingClients.map((c, idx) => (
                  <View key={idx} style={styles.rankRow}>
                    <View style={[styles.rankBadge, { backgroundColor: '#1E2B58' }]}>
                      <Text style={[styles.rankBadgeText, { color: '#FFFFFF' }]}>#{idx + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rankNameText}>{c.name}</Text>
                      <Text style={styles.rankSubText}>
                        {c.city} • {c.email} • Tel: {c.phone}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.rankSoldNumber}>{c.totalOrders} pedido(s)</Text>
                      <Text style={styles.rankRevenueNumber}>$ {c.totalSpent.toLocaleString('es-CO')}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No hay registros de clientes frecuentes aún.</Text>
              )}
            </View>

            {/* PEDIDOS MEJOR CALIFICADOS Y PRODUCTOS CON LIKES */}
            <View style={styles.twoColumnGrid}>
              <View style={[styles.analyticsCard, { flex: 1 }]}>
                <View style={styles.cardHeaderRow}>
                  <Ionicons name="heart-outline" size={18} color="#C5A880" style={{ marginRight: 6 }} />
                  <Text style={styles.cardHeaderTitle}>Productos Más Gustados</Text>
                </View>
                {analytics?.topRatedProducts.map((p, idx) => (
                  <View key={idx} style={styles.miniRankRow}>
                    <Text style={styles.miniRankName} numberOfLines={1}>{p.name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="heart" size={14} color="#C5A880" style={{ marginRight: 3 }} />
                      <Text style={styles.miniRankValue}>{p.likes}</Text>
                    </View>
                  </View>
                ))}
              </View>

              <View style={[styles.analyticsCard, { flex: 1 }]}>
                <View style={styles.cardHeaderRow}>
                  <Ionicons name="star" size={18} color="#F59E0B" style={{ marginRight: 6 }} />
                  <Text style={styles.cardHeaderTitle}>Pedidos Mejor Calificados</Text>
                </View>
                {analytics?.topRatedOrders && analytics.topRatedOrders.length > 0 ? (
                  analytics.topRatedOrders.map((o, idx) => (
                    <View key={idx} style={styles.miniRankRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.miniRankName}>{o.clientName}</Text>
                        <Text style={styles.miniRankDate}>{o.id} • {o.date}</Text>
                      </View>
                      <Text style={styles.starText}>{'⭐'.repeat(Math.min(5, o.rating))}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>Aún no hay calificaciones registradas.</Text>
                )}
              </View>
            </View>

            {/* ARTÍCULOS EN DESCUENTO */}
            <View style={styles.analyticsCard}>
              <View style={styles.cardHeaderRow}>
                <Ionicons name="pricetag-outline" size={20} color="#C5A880" style={{ marginRight: 6 }} />
                <Text style={styles.cardHeaderTitle}>Promociones y Descuentos Activos</Text>
              </View>
              {analytics?.discountedProducts && analytics.discountedProducts.length > 0 ? (
                analytics.discountedProducts.map((d, idx) => (
                  <View key={idx} style={styles.rankRow}>
                    <View style={styles.discountBadgeTag}>
                      <Text style={styles.discountBadgeTagText}>-{d.discountPercent}% OFF</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rankNameText}>{d.name}</Text>
                      <Text style={styles.rankSubText}>Precio original: $ {d.priceValue.toLocaleString('es-CO')}</Text>
                    </View>
                    <Text style={styles.finalDiscountPriceText}>
                      $ {d.discountedPrice.toLocaleString('es-CO')} COP
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No hay artículos con descuento activo en este momento.</Text>
              )}
            </View>
          </View>
        )}

        {/* ================================================================= */}
        {/* TAB 2: PEDIDOS Y DESPACHO                                        */}
        {/* ================================================================= */}
        {activeTab === 'orders' && (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionHeaderTitle}>Despacho y Control de Pedidos</Text>
                <Text style={styles.sectionHeaderSubtitle}>
                  Confirma pagos, asigna repartidores y rastrea rutas de entrega en vivo
                </Text>
              </View>
            </View>

            {/* FILTROS DE PERÍODO DE FECHA */}
            <View style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#E2E8F0',
              padding: 12,
              marginBottom: 12,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.03,
              shadowRadius: 3,
              elevation: 1,
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="calendar-outline" size={15} color="#1E2B58" style={{ marginRight: 6 }} />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#1E2B58' }}>
                    Filtrar por Período de Fecha
                  </Text>
                </View>

                {orderDatePreset !== 'ALL' && (
                  <TouchableOpacity
                    onPress={() => {
                      setOrderDatePreset('ALL');
                      setOrderStartDate('');
                      setOrderEndDate('');
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center' }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="close-circle-outline" size={13} color="#DC2626" style={{ marginRight: 3 }} />
                    <Text style={{ fontSize: 11, color: '#DC2626', fontWeight: 'bold' }}>Limpiar Fecha</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Chips Rápidos de Selección de Fecha */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
                {[
                  { key: 'ALL', label: 'Todas las fechas' },
                  { key: 'TODAY', label: 'Hoy' },
                  { key: 'LAST_7_DAYS', label: 'Últimos 7 días' },
                  { key: 'THIS_MONTH', label: 'Este mes' },
                  { key: 'CUSTOM', label: '📅 Rango personalizado' },
                ].map(p => (
                  <TouchableOpacity
                    key={p.key}
                    style={[
                      styles.dateFilterChip,
                      orderDatePreset === p.key && styles.dateFilterChipActive
                    ]}
                    onPress={() => {
                      setOrderDatePreset(p.key as any);
                      if (p.key === 'CUSTOM' && !orderStartDate) {
                        const todayStr = new Date().toISOString().split('T')[0];
                        setOrderStartDate(todayStr);
                        setOrderEndDate(todayStr);
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={[
                      styles.dateFilterChipText,
                      orderDatePreset === p.key && styles.dateFilterChipTextActive
                    ]}>
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Selector de Rango Personalizado (Desde / Hasta con Botones de Calendario Visual) */}
              {orderDatePreset === 'CUSTOM' && (
                <View style={{
                  marginTop: 10,
                  paddingTop: 10,
                  borderTopWidth: 1,
                  borderColor: '#F1F5F9',
                }}>
                  <View style={{
                    flexDirection: isDesktop ? 'row' : 'column',
                    gap: 10,
                    alignItems: isDesktop ? 'center' : 'stretch'
                  }}>
                    {/* Campo Desde */}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: '#475569', marginBottom: 4 }}>
                        Desde (Fecha inicial):
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <TextInput
                          style={{
                            flex: 1,
                            backgroundColor: '#F8FAFC',
                            borderWidth: 1,
                            borderColor: '#CBD5E1',
                            borderRadius: 8,
                            paddingHorizontal: 10,
                            paddingVertical: 7,
                            fontSize: 12,
                            color: '#1E2B58',
                          }}
                          placeholder="AAAA-MM-DD"
                          value={orderStartDate}
                          onChangeText={setOrderStartDate}
                        />
                        <TouchableOpacity
                          style={{
                            backgroundColor: '#1E2B58',
                            paddingHorizontal: 11,
                            paddingVertical: 8,
                            borderRadius: 8,
                            justifyContent: 'center',
                            alignItems: 'center',
                          }}
                          onPress={() => {
                            setCalendarActiveTarget('start');
                            if (orderStartDate) {
                              const p = orderStartDate.split('-');
                              if (p.length === 3) setCalendarViewDate(new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, 1));
                            }
                            setIsCalendarModalVisible(true);
                          }}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="calendar" size={16} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Campo Hasta */}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: '#475569', marginBottom: 4 }}>
                        Hasta (Fecha final):
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <TextInput
                          style={{
                            flex: 1,
                            backgroundColor: '#F8FAFC',
                            borderWidth: 1,
                            borderColor: '#CBD5E1',
                            borderRadius: 8,
                            paddingHorizontal: 10,
                            paddingVertical: 7,
                            fontSize: 12,
                            color: '#1E2B58',
                          }}
                          placeholder="AAAA-MM-DD"
                          value={orderEndDate}
                          onChangeText={setOrderEndDate}
                        />
                        <TouchableOpacity
                          style={{
                            backgroundColor: '#1E2B58',
                            paddingHorizontal: 11,
                            paddingVertical: 8,
                            borderRadius: 8,
                            justifyContent: 'center',
                            alignItems: 'center',
                          }}
                          onPress={() => {
                            setCalendarActiveTarget('end');
                            if (orderEndDate) {
                              const p = orderEndDate.split('-');
                              if (p.length === 3) setCalendarViewDate(new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, 1));
                            }
                            setIsCalendarModalVisible(true);
                          }}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="calendar" size={16} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  {/* Botón directo para abrir calendario visual */}
                  <View style={{ marginTop: 10, flexDirection: 'row', justifyContent: 'flex-start' }}>
                    <TouchableOpacity
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: '#EFF6FF',
                        borderWidth: 1.5,
                        borderColor: '#93C5FD',
                        borderRadius: 8,
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                      }}
                      onPress={() => {
                        setCalendarActiveTarget('start');
                        setIsCalendarModalVisible(true);
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="calendar-outline" size={15} color="#2563EB" style={{ marginRight: 6 }} />
                      <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#2563EB' }}>
                        📅 Abrir Calendario Visual
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Resumen de Resultados Filtrados */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderColor: '#F8FAFC' }}>
                <Text style={{ fontSize: 11, color: '#64748B' }}>
                  Mostrando <Text style={{ fontWeight: 'bold', color: '#1E2B58' }}>{filteredOrders.length}</Text> de {orders.length} pedidos
                </Text>
                {filteredOrders.length > 0 && (
                  <Text style={{ fontSize: 11, color: '#059669', fontWeight: 'bold' }}>
                    Total: $ {filteredOrders.reduce((sum, o) => sum + (o.total || 0), 0).toLocaleString('es-CO')} COP
                  </Text>
                )}
              </View>
            </View>

            {/* FILTROS DE ESTADO */}
            <View style={styles.filterPillsRow}>
              {[
                { key: 'ALL', label: 'Todos' },
                { key: 'PENDING', label: 'Pendientes' },
                { key: 'DISPATCHED', label: 'En Ruta' },
                { key: 'ARRIVED', label: 'En Destino' },
                { key: 'DELIVERED', label: 'Entregados' },
                { key: 'PENDING_SETTLEMENT', label: '🛵 Dinero con Repartidor' },
                { key: 'SETTLED', label: '✅ Paz y Salvo' },
              ].map(f => (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.filterPill, orderStatusFilter === f.key && styles.filterPillActive]}
                  onPress={() => setOrderStatusFilter(f.key)}
                >
                  <Text style={[styles.filterPillText, orderStatusFilter === f.key && styles.filterPillTextActive]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* LISTA DE PEDIDOS */}
            {filteredOrders.length > 0 ? (
              filteredOrders.map(order => (
                <View key={order.id} style={styles.orderAdminCard}>
                  <View style={styles.orderCardTop}>
                    <View>
                      <Text style={styles.orderIdBadge}>{order.id}</Text>
                      <Text style={styles.orderDateText}>{order.date}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <View
                        style={[
                          styles.statusBadgeBox,
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
                            styles.statusBadgeBoxText,
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
                            ? 'Entregado'
                            : order.statusCode === 'ARRIVED'
                            ? 'En Destino 🛵'
                            : order.statusCode === 'DISPATCHED'
                            ? 'En Reparto'
                            : 'Pendiente Despacho'}
                        </Text>
                      </View>
                      <Text style={styles.paymentStatusText}>
                        Pago: <Text style={{ fontWeight: 'bold' }}>{order.paymentStatus === 'PAID' ? 'PAGADO ✅' : 'PENDIENTE ⏳'}</Text>
                      </Text>
                    </View>
                  </View>

                  {/* DATOS DEL CLIENTE Y DIRECCIÓN */}
                  <View style={styles.orderClientInfoBox}>
                    <Text style={styles.clientInfoName}>
                      Cliente: <Text style={{ fontWeight: 'bold' }}>{order.client.name}</Text> (C.C. {order.client.cedula})
                    </Text>
                    <Text style={styles.clientInfoDetail}>
                      📍 {order.client.address}, {order.city || 'Riohacha'} • Tel: {order.client.phone}
                    </Text>
                    <Text style={styles.clientInfoDetail}>
                      💳 Método de pago: {order.client.payment}
                    </Text>
                    {/* TRAZABILIDAD DEL ADMINISTRADOR RESPONSABLE */}
                    <View style={styles.orderTraceabilityBanner}>
                      <Ionicons name="shield-checkmark" size={13} color="#1E2B58" style={{ marginRight: 5 }} />
                      <Text style={styles.orderTraceabilityText}>
                        {order.adminResponsible ? (
                          <>Responsable del movimiento: <Text style={{ fontWeight: 'bold', color: '#1E2B58' }}>{order.adminResponsible}</Text></>
                        ) : (
                          <Text style={{ fontStyle: 'italic', color: '#64748B' }}>Pendiente de gestión administrativa</Text>
                        )}
                      </Text>
                    </View>

                    {/* LOGÍSTICA: ESTADO DE REPARTIDOR / ASIGNACIÓN */}
                    {order.statusCode === 'PENDING' ? (
                      <View style={{ backgroundColor: '#FEF3C7', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginTop: 6, borderWidth: 1, borderColor: '#FDE68A', flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="hourglass-outline" size={16} color="#B45309" style={{ marginRight: 8 }} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, color: '#92400E', fontWeight: 'bold' }}>
                            ⏳ Pendiente de Despacho y Asignación de Repartidor
                          </Text>
                          <Text style={{ fontSize: 11, color: '#B45309', marginTop: 1 }}>
                            Pulsa "Asignar y Despachar" para elegir el repartidor local o transportadora según el destino.
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <View style={{ backgroundColor: '#F8FAFC', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginTop: 6, borderWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name={order.driverType === 'corporate' ? "business" : "bicycle"} size={16} color="#1E2B58" style={{ marginRight: 8 }} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, color: '#1E2B58' }}>
                            {order.driverType === 'corporate' ? '🚚 Empresa Transportadora: ' : '🛵 Repartidor Asignado: '}
                            <Text style={{ fontWeight: 'bold' }}>{order.driverName || 'Sin asignar'}</Text>
                          </Text>
                          {order.trackingGuideNumber ? (
                            <Text style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                              Nº de Guía: <Text style={{ fontWeight: 'bold', color: '#1E2B58' }}>#{order.trackingGuideNumber}</Text>
                            </Text>
                          ) : null}
                          {order.driverPhone ? (
                            <Text style={{ fontSize: 11, color: '#64748B' }}>
                              Contacto directo: <Text style={{ fontWeight: 'bold' }}>{order.driverPhone}</Text>
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    )}

                    {/* CONFIRMACIÓN DE ENTREGA Y CARGA DE VENTA */}
                    {order.statusCode === 'DELIVERED' && (
                      <View style={styles.orderDeliveredSuccessBanner}>
                        <Ionicons name="checkmark-done-circle" size={15} color="#166534" style={{ marginRight: 6 }} />
                        <Text style={styles.orderDeliveredSuccessText}>
                          Venta Finalizada y Cargada al Sistema • Fecha y Hora: <Text style={{ fontWeight: 'bold' }}>{order.receivedAt || order.date}</Text>
                        </Text>
                      </View>
                    )}

                    {/* ESTADO FINANCIERO: PAZ Y SALVO EN TIENDA VS DINERO EN PODER DEL REPARTIDOR (SÓLO TRAS ENTREGA) */}
                    {order.statusCode === 'DELIVERED' && order.settlementStatus === 'PENDING_SETTLEMENT' && (
                      <View style={styles.orderSettlementPendingBanner}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                          <Ionicons name="warning" size={16} color="#B45309" style={{ marginRight: 6 }} />
                          <Text style={styles.orderSettlementPendingTitle}>DINERO EN PODER DEL REPARTIDOR (Pendiente Paz y Salvo)</Text>
                        </View>
                        <Text style={styles.orderSettlementPendingDesc}>
                          🛵 Repartidor: <Text style={{ fontWeight: 'bold' }}>{order.driverName || 'asignado'}</Text> tiene el dinero ($ {(order.total || 0).toLocaleString('es-CO')} COP).
                          {' '}El pedido quedará en Paz y Salvo cuando entregue el efectivo en tienda o registre la transferencia con comprobante.
                        </Text>
                        <TouchableOpacity
                          style={styles.settleActionButton}
                          onPress={() => openSettlementModal(order)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="shield-checkmark" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                          <Text style={styles.settleActionButtonText}>Liquidar y Otorgar Paz y Salvo en Tienda</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {order.settlementStatus === 'SETTLED' && (
                      <View style={styles.orderSettledSuccessBanner}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                          <Ionicons name="checkmark-done-circle" size={16} color="#15803D" style={{ marginRight: 6 }} />
                          <Text style={styles.orderSettledSuccessTitle}>PAZ Y SALVO EN TIENDA REGISTRADO ✅</Text>
                        </View>
                        <Text style={styles.orderSettledSuccessDetail}>
                          • Medio: <Text style={{ fontWeight: 'bold' }}>{order.settlementMethod === 'EFECTIVO_EN_TIENDA' ? 'Efectivo recibido en caja física de la tienda' : 'Transferencia bancaria a cuenta de la tienda'}</Text>
                        </Text>
                        {order.transferReference ? (
                          <Text style={styles.orderSettledSuccessDetail}>
                            • Nº Comprobante / Transferencia: <Text style={{ fontWeight: 'bold', color: '#1E2B58' }}>{order.transferReference}</Text>
                          </Text>
                        ) : null}
                        <Text style={styles.orderSettledSuccessDetail}>
                          • Liquidado por: <Text style={{ fontWeight: 'bold' }}>{order.settledBy || order.adminResponsible || 'Administración'}</Text> ({order.settledAt || order.receivedAt || order.date})
                        </Text>
                        {order.settlementNotes ? (
                          <Text style={styles.orderSettledSuccessDetail}>
                            • Evidencia: <Text style={{ fontStyle: 'italic' }}>{order.settlementNotes}</Text>
                          </Text>
                        ) : null}
                      </View>
                    )}
                  </View>

                  {/* DESGLOSE DE ARTÍCULOS */}
                  <View style={styles.orderItemsList}>
                    {order.items.map((it, i) => (
                      <View key={i} style={styles.orderItemLine}>
                        <Text style={styles.orderItemNameText}>
                          • {it.cartQuantity}x {it.name}
                        </Text>
                        <Text style={styles.orderItemPriceText}>
                          $ {(it.priceValue * it.cartQuantity).toLocaleString('es-CO')}
                        </Text>
                      </View>
                    ))}
                    <View style={styles.orderTotalLine}>
                      <Text style={styles.orderTotalLabel}>Total a Cobrar:</Text>
                      <Text style={styles.orderTotalValue}>$ {order.total.toLocaleString('es-CO')} COP</Text>
                    </View>
                  </View>

                  {/* BOTONES DE ACCIÓN PARA EL ADMIN */}
                  <View style={styles.adminOrderActionsRow}>
                    {order.paymentStatus !== 'PAID' && (
                      <TouchableOpacity
                        style={styles.confirmPayButton}
                        onPress={() => confirmPayment(order.id)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="checkmark-done" size={15} color="#FFFFFF" style={{ marginRight: 4 }} />
                        <Text style={styles.actionBtnText}>Confirmar Pago</Text>
                      </TouchableOpacity>
                    )}

                    {order.statusCode === 'PENDING' && (
                      <TouchableOpacity
                        style={styles.dispatchButton}
                        onPress={() => openDispatchModal(order)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="bicycle" size={15} color="#FFFFFF" style={{ marginRight: 4 }} />
                        <Text style={styles.actionBtnText}>Asignar y Despachar</Text>
                      </TouchableOpacity>
                    )}

                    {order.statusCode === 'DISPATCHED' && (
                      <TouchableOpacity
                        style={[styles.dispatchButton, { backgroundColor: '#334155' }]}
                        onPress={() => openDispatchModal(order)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="swap-horizontal" size={15} color="#FFFFFF" style={{ marginRight: 4 }} />
                        <Text style={styles.actionBtnText}>Reasignar Repartidor</Text>
                      </TouchableOpacity>
                    )}

                    {order.statusCode === 'ARRIVED' && (
                      <TouchableOpacity
                        style={[styles.deliverButton, { backgroundColor: '#10B981' }]}
                        onPress={() => markOrderDelivered(order.id)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="checkmark-done" size={15} color="#FFFFFF" style={{ marginRight: 4 }} />
                        <Text style={styles.actionBtnText}>Confirmar Entrega</Text>
                      </TouchableOpacity>
                    )}

                    {/* BOTÓN DE LIQUIDACIÓN Y PAZ Y SALVO (SÓLO TRAS ENTREGA EFECTUADA) */}
                    {order.statusCode === 'DELIVERED' && order.settlementStatus === 'PENDING_SETTLEMENT' && (
                      <TouchableOpacity
                        style={styles.settleCompactButton}
                        onPress={() => openSettlementModal(order)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="cash" size={15} color="#FFFFFF" style={{ marginRight: 4 }} />
                        <Text style={styles.actionBtnText}>Dar Paz y Salvo</Text>
                      </TouchableOpacity>
                    )}

                    {order.settlementStatus === 'SETTLED' && (
                      <TouchableOpacity
                        style={[styles.settleCompactButton, { backgroundColor: '#059669' }]}
                        onPress={() => openSettlementModal(order)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="shield-checkmark" size={15} color="#FFFFFF" style={{ marginRight: 4 }} />
                        <Text style={styles.actionBtnText}>Ver Paz y Salvo</Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={styles.mapRouteButton}
                      onPress={() => {
                        setActiveTrackingOrder(order);
                        setIsMapModalVisible(true);
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="map-outline" size={15} color="#1E2B58" style={{ marginRight: 4 }} />
                      <Text style={[styles.actionBtnText, { color: '#1E2B58' }]}>Ver Mapa Ruta</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="cube-outline" size={48} color="#94A3B8" />
                <Text style={styles.emptyContainerText}>No hay pedidos bajo este filtro de búsqueda.</Text>
              </View>
            )}
          </View>
        )}

        {/* ================================================================= */}
        {/* TAB 3: CATÁLOGO, INVENTARIO Y DESCUENTOS                          */}
        {/* ================================================================= */}
        {activeTab === 'inventory' && (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionHeaderTitle}>Catálogo & Gestión de Descuentos</Text>
                <Text style={styles.sectionHeaderSubtitle}>
                  Carga nuevos artículos con fotos, crea categorías y activa promociones en tiempo real
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={[styles.createCategoryBtn, { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1' }]}
                  onPress={() => setIsCategoryManagerModalVisible(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="folder-open-outline" size={16} color="#1E2B58" style={{ marginRight: 4 }} />
                  <Text style={styles.createCategoryBtnText}>📂 Categorías ({categories.length})</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.createCategoryBtn}
                  onPress={() => setIsNewCategoryModalVisible(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add-circle-outline" size={16} color="#1E2B58" style={{ marginRight: 4 }} />
                  <Text style={styles.createCategoryBtnText}>+ Nueva Categoría</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.addProductMainBtn}
                  onPress={handleOpenNewProductModal}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add" size={18} color="#FFFFFF" style={{ marginRight: 4 }} />
                  <Text style={styles.addProductMainBtnText}>+ Nuevo Artículo</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* BARRA HORIZONTAL DE CATEGORÍAS REGISTRADAS CON ACCESO DIRECTO A EDICIÓN */}
            <View style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="grid-outline" size={14} color="#C5A880" style={{ marginRight: 6 }} />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#1E2B58' }}>
                    Categorías Registradas ({categories.length})
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setIsCategoryManagerModalVisible(true)}
                  style={{ flexDirection: 'row', alignItems: 'center' }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="settings-outline" size={13} color="#2563EB" style={{ marginRight: 4 }} />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#2563EB' }}>Administrar y Editar</Text>
                </TouchableOpacity>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
                {categories.map(cat => {
                  const count = products.filter(p => p.categoryId === cat.id || p.categoryId === cat.name).length;
                  return (
                    <View
                      key={cat.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: '#FFFFFF',
                        borderWidth: 1,
                        borderColor: '#E2E8F0',
                        borderRadius: 20,
                        paddingVertical: 6,
                        paddingHorizontal: 12,
                        gap: 6,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.04,
                        shadowRadius: 2,
                        elevation: 1,
                      }}
                    >
                      <Ionicons name={(cat.icon as any) || 'sparkles-outline'} size={15} color="#C5A880" />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#1E2B58' }}>{cat.name}</Text>
                      <View style={{ backgroundColor: '#F1F5F9', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 }}>
                        <Text style={{ fontSize: 10, fontWeight: '600', color: '#64748B' }}>{count}</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleStartEditCategory(cat)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        activeOpacity={0.7}
                        style={{ marginLeft: 2, padding: 2 }}
                      >
                        <Ionicons name="pencil" size={12} color="#2563EB" />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </ScrollView>
            </View>

            {/* FILTROS DE ARTÍCULOS EXCLUSIVOS DE ADMINISTRADOR */}
            <View style={styles.inventoryFilterBar}>
              <TouchableOpacity
                style={[styles.invFilterChip, inventoryFilter === 'ALL' && styles.invFilterChipActive]}
                onPress={() => setInventoryFilter('ALL')}
                activeOpacity={0.8}
              >
                <Text style={[styles.invFilterChipText, inventoryFilter === 'ALL' && styles.invFilterChipTextActive]}>
                  Todos ({products.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.invFilterChip, inventoryFilter === 'ACTIVE' && styles.invFilterChipActive]}
                onPress={() => setInventoryFilter('ACTIVE')}
                activeOpacity={0.8}
              >
                <View style={[styles.statusDotSmall, { backgroundColor: '#10B981' }]} />
                <Text style={[styles.invFilterChipText, inventoryFilter === 'ACTIVE' && styles.invFilterChipTextActive]}>
                  Activos ({products.filter(p => p.isActive !== 0).length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.invFilterChip, inventoryFilter === 'INACTIVE' && styles.invFilterChipActive]}
                onPress={() => setInventoryFilter('INACTIVE')}
                activeOpacity={0.8}
              >
                <View style={[styles.statusDotSmall, { backgroundColor: '#F59E0B' }]} />
                <Text style={[styles.invFilterChipText, inventoryFilter === 'INACTIVE' && styles.invFilterChipTextActive]}>
                  Inactivos ({products.filter(p => p.isActive === 0).length})
                </Text>
              </TouchableOpacity>
            </View>

            {/* LISTA DE ARTÍCULOS EN INVENTARIO */}
            <View style={styles.inventoryGrid}>
              {products
                .filter(p => {
                  if (inventoryFilter === 'ACTIVE') return p.isActive !== 0;
                  if (inventoryFilter === 'INACTIVE') return p.isActive === 0;
                  return true;
                })
                .map(prod => {
                  const imgSource = resolveProductImage(prod.imagePath);
                  const hasDiscount = Boolean(prod.isDiscountActive === 1 && prod.discountPercent && prod.discountPercent > 0);
                  const isItemInactive = prod.isActive === 0;
                  const discountedPrice = hasDiscount
                    ? Math.round(prod.priceValue * (1 - prod.discountPercent! / 100))
                    : prod.priceValue;

                  // Construir la galería completa de fotos para este producto
                  const prodGallery: any[] = [];
                  if (prod.images && Array.isArray(prod.images) && prod.images.length > 0) {
                    prod.images.forEach(uri => {
                      const s = resolveProductImage(uri);
                      if (s) prodGallery.push(s);
                    });
                  } else if (prod.imagePath) {
                    prod.imagePath.split('||').forEach(uri => {
                      const s = resolveProductImage(uri.trim());
                      if (s) prodGallery.push(s);
                    });
                  }
                  if (prodGallery.length === 0 && imgSource) {
                    prodGallery.push(imgSource);
                  }

                  return (
                    <View
                      key={prod.id}
                      style={[
                        styles.inventoryCard,
                        isItemInactive && { opacity: 0.82, borderColor: '#FDE68A', backgroundColor: '#FFFEFA' }
                      ]}
                    >
                      <View style={styles.inventoryImgWrapper}>
                        {/* Indicador de fotos múltiples si tiene más de 1 */}
                        {Boolean(prodGallery.length > 1) && (
                          <View style={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            backgroundColor: 'rgba(30, 43, 88, 0.85)',
                            paddingHorizontal: 7,
                            paddingVertical: 3,
                            borderRadius: 10,
                            flexDirection: 'row',
                            alignItems: 'center',
                            borderWidth: 1,
                            borderColor: '#C5A880',
                            zIndex: 10
                          }}>
                            <Ionicons name="images" size={11} color="#C5A880" style={{ marginRight: 3 }} />
                            <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: 'bold' }}>
                              {prodGallery.length} fotos
                            </Text>
                          </View>
                        )}
                        {imgSource ? (
                          <TouchableOpacity
                            activeOpacity={0.9}
                            style={styles.adminImgTouchWrapper}
                            onPress={() => handleOpenImagePreview(
                              imgSource || (prodGallery[0] ?? null),
                              prod.name,
                              `$ ${prod.priceValue.toLocaleString('es-CO')} COP`,
                              prod.ancestralRef,
                              (prod as any).category || prod.categoryId,
                              prodGallery
                            )}
                          >
                            <Image source={imgSource} style={styles.inventoryImg} resizeMode="contain" />
                            <View style={styles.imageZoomBadge}>
                              <Ionicons name="expand-outline" size={11} color="#FFFFFF" />
                              <Text style={styles.imageZoomBadgeText}>
                                {prodGallery.length > 1 ? 'Ver fotos' : 'Ampliar'}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        ) : (
                          <Ionicons name={prod.icon as any || 'sparkles'} size={40} color="#1E2B58" />
                        )}
                        {hasDiscount && (
                          <View style={styles.discountFloatingTag}>
                            <Text style={styles.discountFloatingTagText}>-{prod.discountPercent}% OFF</Text>
                          </View>
                        )}
                        {/* Botón para cambiar foto de este artículo */}
                        <TouchableOpacity
                          style={styles.changePhotoBtn}
                          onPress={() => handleOpenGalleryModal(prod)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="camera" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                          <Text style={styles.changePhotoBtnText}>
                            Fotos / Galería {Boolean(prod.images && prod.images.length > 1) ? `(${prod.images?.length})` : ''}
                          </Text>
                        </TouchableOpacity>
                      </View>


                      <View style={styles.inventoryDetailsBox}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <Text style={styles.inventoryCategoryBadge}>{prod.categoryId}</Text>
                          {isItemInactive ? (
                            <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, flexDirection: 'row', alignItems: 'center' }}>
                              <Ionicons name="pause-circle" size={12} color="#D97706" style={{ marginRight: 3 }} />
                              <Text style={{ fontSize: 10, color: '#D97706', fontWeight: 'bold' }}>Inactivo</Text>
                            </View>
                          ) : (
                            <View style={{ backgroundColor: '#D1FAE5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, flexDirection: 'row', alignItems: 'center' }}>
                              <Ionicons name="checkmark-circle" size={12} color="#059669" style={{ marginRight: 3 }} />
                              <Text style={{ fontSize: 10, color: '#059669', fontWeight: 'bold' }}>Activo</Text>
                            </View>
                          )}
                        </View>

                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => handleOpenImagePreview(
                            imgSource || (prodGallery[0] ?? null),
                            prod.name,
                            `$ ${prod.priceValue.toLocaleString('es-CO')} COP`,
                            prod.ancestralRef,
                            (prod as any).category || prod.categoryId,
                            prodGallery
                          )}
                        >
                          <Text style={styles.inventoryItemName} numberOfLines={1}>{prod.name}</Text>
                        </TouchableOpacity>
                        {prod.imageName && (
                          <Text style={styles.inventoryImageNameTag}>📷 {prod.imageName}</Text>
                        )}

                        <View style={styles.priceRowAdmin}>
                          {hasDiscount ? (
                            <View>
                              <Text style={styles.crossedPrice}>$ {prod.priceValue.toLocaleString('es-CO')}</Text>
                              <Text style={styles.discountPriceHighlight}>
                                $ {discountedPrice.toLocaleString('es-CO')} COP
                              </Text>
                            </View>
                          ) : (
                            <Text style={styles.regularPriceText}>{prod.price}</Text>
                          )}
                        </View>

                        {/* CONTROL DE STOCK */}
                        <View style={styles.stockControlRow}>
                          <Text style={styles.stockControlLabel}>Stock:</Text>
                          <TouchableOpacity
                            style={styles.stockAdjustBtn}
                            onPress={() => updateStock(prod.id, Math.max(0, prod.stock - 1))}
                          >
                            <Ionicons name="remove" size={14} color="#1E2B58" />
                          </TouchableOpacity>
                          <Text style={styles.stockDisplayNumber}>{prod.stock}</Text>
                          <TouchableOpacity
                            style={styles.stockAdjustBtn}
                            onPress={() => updateStock(prod.id, prod.stock + 1)}
                          >
                            <Ionicons name="add" size={14} color="#1E2B58" />
                          </TouchableOpacity>
                        </View>

                        {/* CONFIGURACIÓN RÁPIDA DE DESCUENTO */}
                        <View style={styles.discountConfigRow}>
                          <Text style={styles.discountRowLabel}>Descuento:</Text>
                          <TouchableOpacity
                            style={[
                              styles.discountQuickPill,
                              hasDiscount && prod.discountPercent === 10 && styles.discountQuickPillActive,
                            ]}
                            onPress={() => toggleDiscount(prod.id, 10, !hasDiscount || prod.discountPercent !== 10)}
                          >
                            <Text style={styles.discountQuickPillText}>10%</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[
                              styles.discountQuickPill,
                              hasDiscount && prod.discountPercent === 15 && styles.discountQuickPillActive,
                            ]}
                            onPress={() => toggleDiscount(prod.id, 15, !hasDiscount || prod.discountPercent !== 15)}
                          >
                            <Text style={styles.discountQuickPillText}>15%</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[
                              styles.discountQuickPill,
                              hasDiscount && prod.discountPercent === 20 && styles.discountQuickPillActive,
                            ]}
                            onPress={() => toggleDiscount(prod.id, 20, !hasDiscount || prod.discountPercent !== 20)}
                          >
                            <Text style={styles.discountQuickPillText}>20%</Text>
                          </TouchableOpacity>

                          {hasDiscount && (
                            <TouchableOpacity
                              style={styles.removeDiscountBtn}
                              onPress={() => toggleDiscount(prod.id, 0, false)}
                            >
                              <Ionicons name="close-circle" size={18} color="#EF4444" />
                            </TouchableOpacity>
                          )}
                        </View>

                        {/* ACCIONES: EDITAR, INACTIVAR / ACTIVAR Y ELIMINAR */}
                        <View style={styles.cardActionsFooter}>
                          <TouchableOpacity
                            style={styles.editProdBtn}
                            onPress={() => handleOpenEditProduct(prod)}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="create-outline" size={13} color="#1E2B58" style={{ marginRight: 4 }} />
                            <Text style={styles.editProdBtnText}>Editar</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[
                              styles.toggleActiveBtn,
                              isItemInactive ? styles.toggleActiveBtnActivate : styles.toggleActiveBtnPause,
                            ]}
                            onPress={() => toggleProductActive(prod.id, isItemInactive ? 1 : 0)}
                            activeOpacity={0.8}
                          >
                            <Ionicons
                              name={isItemInactive ? "play" : "pause"}
                              size={13}
                              color={isItemInactive ? "#059669" : "#D97706"}
                              style={{ marginRight: 4 }}
                            />
                            <Text style={[
                              styles.toggleActiveBtnText,
                              { color: isItemInactive ? "#059669" : "#D97706" }
                            ]}>
                              {isItemInactive ? "Reactivar" : "Inactivar"}
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.deleteProdBtn}
                            onPress={() => {
                              setProductToDelete(prod);
                              setIsDeleteModalVisible(true);
                            }}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="trash-outline" size={14} color="#DC2626" style={{ marginRight: 4 }} />
                            <Text style={styles.deleteProdBtnText}>Eliminar</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  );
                })}
            </View>
          </View>
        )}

        {/* ================================================================= */}
        {/* TAB 4: DISEÑOS SUGERIDOS Y COTIZACIONES                          */}
        {/* ================================================================= */}
        {activeTab === 'quotes' && (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionHeaderTitle}>Diseños Sugeridos por Clientes</Text>
                <Text style={styles.sectionHeaderSubtitle}>
                  Revisa las propuestas generadas por IA, establece el valor en COP y envía cotizaciones
                </Text>
              </View>
            </View>

            {quotes.length > 0 ? (
              quotes.map(quote => (
                <View key={quote.id} style={styles.quoteAdminCard}>
                  <View style={styles.quoteCardHeader}>
                    <View>
                      <Text style={styles.quoteIdText}>{quote.id} • {quote.designType}</Text>
                      <Text style={styles.quoteClientText}>
                        Cliente: <Text style={{ fontWeight: 'bold' }}>{quote.userName}</Text> ({quote.userEmail})
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.quoteStatusBadge,
                        quote.status === 'QUOTED' ? { backgroundColor: '#DCFCE7' } : { backgroundColor: '#FEF3C7' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.quoteStatusBadgeText,
                          quote.status === 'QUOTED' ? { color: '#166534' } : { color: '#B45309' },
                        ]}
                      >
                        {quote.status === 'QUOTED' ? 'Cotizado' : 'Pendiente Cotizar'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.quoteBodyRow}>
                    {quote.imageUrl ? (
                      <TouchableOpacity
                        activeOpacity={0.88}
                        style={styles.quoteThumbnailTouch}
                        onPress={() => handleOpenImagePreview(
                          { uri: quote.imageUrl },
                          `Diseño Kanaas: ${quote.pattern || 'Personalizado'}`,
                          quote.quotedPrice ? `$ ${(quote.quotedPrice || 0).toLocaleString('es-CO')} COP` : undefined,
                          quote.prompt,
                          'Cotización de Cliente'
                        )}
                      >
                        <Image source={{ uri: quote.imageUrl }} style={styles.quoteThumbnail} resizeMode="contain" />
                        <View style={styles.imageZoomBadgeSmall}>
                          <Ionicons name="expand-outline" size={10} color="#FFFFFF" />
                        </View>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.quoteNoThumbnail}>
                        <Ionicons name="image-outline" size={32} color="#94A3B8" />
                      </View>
                    )}

                    <View style={{ flex: 1, paddingLeft: 12 }}>
                      <Text style={styles.quotePromptTitle}>Requerimiento del Cliente:</Text>
                      <Text style={styles.quotePromptText}>"{quote.prompt}"</Text>
                      {quote.pattern && <Text style={styles.quotePatternText}>Patrón Kanaas: {quote.pattern}</Text>}
                      <Text style={styles.quoteDateText}>Recibido: {new Date(quote.createdAt).toLocaleDateString()}</Text>

                      {quote.status === 'QUOTED' ? (
                        <View style={styles.quoteAnswerBox}>
                          <Text style={styles.quoteAnswerPrice}>
                            Valor Cotizado: $ {(quote.quotedPrice || 0).toLocaleString('es-CO')} COP
                          </Text>
                          <Text style={styles.quoteAnswerDays}>
                            Tiempo de tejido: {quote.quotedDeliveryDays} días
                          </Text>
                          {quote.adminNotes && (
                            <Text style={styles.quoteAnswerNotes}>Nota: "{quote.adminNotes}"</Text>
                          )}
                        </View>
                      ) : null}
                    </View>
                  </View>

                  <View style={styles.quoteCardFooter}>
                    <TouchableOpacity
                      style={styles.openQuoteActionBtn}
                      onPress={() => {
                        setSelectedQuote(quote);
                        setQuotePriceInput(quote.quotedPrice ? String(quote.quotedPrice) : '220000');
                        setQuoteDaysInput(quote.quotedDeliveryDays ? String(quote.quotedDeliveryDays) : '8');
                        setQuoteNotesInput(quote.adminNotes || '');
                        setIsQuoteModalVisible(true);
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="calculator-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.openQuoteActionBtnText}>
                        {quote.status === 'QUOTED' ? 'Modificar Cotización' : 'Cotizar Este Diseño'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.quoteChatShortcutBtn}
                      onPress={() => {
                        setSelectedChatUserEmail(quote.userEmail);
                        setActiveTab('chat');
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="chatbubble-ellipses-outline" size={16} color="#1E2B58" style={{ marginRight: 6 }} />
                      <Text style={styles.quoteChatShortcutBtnText}>Chatear con Cliente</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="sparkles-outline" size={48} color="#94A3B8" />
                <Text style={styles.emptyContainerText}>No hay solicitudes de cotización pendientes de revisión.</Text>
              </View>
            )}
          </View>
        )}

        {/* ================================================================= */}
        {/* TAB 5: MENSAJES Y SUGERENCIAS DIRECTAS                           */}
        {/* ================================================================= */}
        {activeTab === 'chat' && (
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionHeaderTitle}>Bandeja de Mensajes y Asesoría</Text>
            <Text style={styles.sectionHeaderSubtitle}>
              Interactúa con los clientes, responde dudas de tejido y brinda acompañamiento en vivo
            </Text>

            <View style={styles.chatModuleContainer}>
              {/* LISTA DE CONVERSACIONES */}
              <View style={styles.chatConversationsList}>
                <Text style={styles.chatListHeader}>Conversaciones Activas</Text>
                {chatConversations.length > 0 ? (
                  chatConversations.map(conv => (
                    <TouchableOpacity
                      key={conv.email}
                      style={[
                        styles.convItem,
                        selectedChatUserEmail?.toLowerCase() === conv.email?.toLowerCase() && styles.convItemActive,
                      ]}
                      onPress={() => {
                        setSelectedChatUserEmail(conv.email);
                        markChatRead(conv.email);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.convAvatar}>
                        <Ionicons name="person" size={16} color="#1E2B58" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.convNameText} numberOfLines={1}>{conv.name}</Text>
                        <Text style={styles.convLastMsgText} numberOfLines={1}>{conv.lastMessage}</Text>
                      </View>
                      {conv.unreadCount > 0 && (
                        <View style={styles.convBadge}>
                          <Text style={styles.convBadgeText}>{conv.unreadCount}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={styles.emptyText}>No hay mensajes registrados aún.</Text>
                )}
              </View>

              {/* VENTANA DE CONVERSACIÓN */}
              <View style={styles.chatWindow}>
                {selectedChatUserEmail ? (
                  <>
                    <View style={styles.chatWindowHeader}>
                      <Ionicons name="chatbubble-ellipses" size={18} color="#C5A880" style={{ marginRight: 6 }} />
                      <Text style={styles.chatWindowHeaderText}>Chat con {selectedChatUserEmail}</Text>
                    </View>

                    <ScrollView style={styles.chatMessagesArea} contentContainerStyle={{ padding: 12 }}>
                      {activeConversationMessages.map(msg => {
                        const isAdmin = msg.senderRole === 'admin';
                        return (
                          <View
                            key={msg.id}
                            style={[
                              styles.chatBubble,
                              isAdmin ? styles.chatBubbleAdmin : styles.chatBubbleClient,
                            ]}
                          >
                            <Text style={[styles.chatSenderName, isAdmin && { color: '#C5A880' }]}>
                              {isAdmin ? 'Taller Einuushi' : msg.userName}
                            </Text>
                            <Text style={[styles.chatBubbleText, isAdmin && { color: '#FFFFFF' }]}>
                              {msg.message}
                            </Text>
                            <Text style={styles.chatBubbleTime}>
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                          </View>
                        );
                      })}
                    </ScrollView>

                    <View style={styles.chatInputBar}>
                      <TextInput
                        style={styles.chatTextInput}
                        placeholder="Escribe una respuesta para el cliente..."
                        placeholderTextColor="#94A3B8"
                        value={replyMessageText}
                        onChangeText={setReplyMessageText}
                      />
                      <TouchableOpacity
                        style={styles.chatSendBtn}
                        onPress={handleSendAdminReply}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="send" size={18} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <View style={styles.chatPlaceholderBox}>
                    <Ionicons name="chatbubbles-outline" size={48} color="#94A3B8" />
                    <Text style={styles.chatPlaceholderText}>
                      Selecciona una conversación a la izquierda para ver los mensajes y responder.
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}

        {/* ================================================================= */}
        {/* TAB 6: CONFIGURACIÓN, PERFILES Y TRAZABILIDAD (AUDITORÍA)         */}
        {/* ================================================================= */}
        {activeTab === 'settings' && (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionHeaderTitle}>Configuración, Seguridad y Trazabilidad</Text>
                <Text style={styles.sectionHeaderSubtitle}>
                  Administra credenciales, autoriza nuevos administradores, gestiona transportistas y audita movimientos
                </Text>
              </View>
            </View>

            {/* BARRA DE SUB-PESTAÑAS DE CONFIGURACIÓN */}
            <View style={styles.settingsSubTabsContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.settingsSubTabsScroll}>
                <TouchableOpacity
                  style={[styles.settingsSubTabBtn, settingsSubTab === 'profile' && styles.settingsSubTabBtnActive]}
                  onPress={() => setSettingsSubTab('profile')}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="person-circle"
                    size={18}
                    color={settingsSubTab === 'profile' ? '#FFFFFF' : '#1E2B58'}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[styles.settingsSubTabBtnText, settingsSubTab === 'profile' && styles.settingsSubTabBtnTextActive]}>
                    Mi Perfil
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.settingsSubTabBtn, settingsSubTab === 'admins' && styles.settingsSubTabBtnActive]}
                  onPress={() => setSettingsSubTab('admins')}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="shield-checkmark"
                    size={17}
                    color={settingsSubTab === 'admins' ? '#FFFFFF' : '#1E2B58'}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[styles.settingsSubTabBtnText, settingsSubTab === 'admins' && styles.settingsSubTabBtnTextActive]}>
                    Equipo Administrador
                  </Text>
                  <View style={[styles.settingsSubTabBadge, settingsSubTab === 'admins' && { backgroundColor: '#C5A880' }]}>
                    <Text style={[styles.settingsSubTabBadgeText, settingsSubTab === 'admins' && { color: '#1E2B58' }]}>
                      {adminUsers.length}
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.settingsSubTabBtn, settingsSubTab === 'logistics' && styles.settingsSubTabBtnActive]}
                  onPress={() => setSettingsSubTab('logistics')}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="bicycle"
                    size={17}
                    color={settingsSubTab === 'logistics' ? '#FFFFFF' : '#1E2B58'}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[styles.settingsSubTabBtnText, settingsSubTab === 'logistics' && styles.settingsSubTabBtnTextActive]}>
                    Repartidores & Transportadoras
                  </Text>
                  <View style={[styles.settingsSubTabBadge, settingsSubTab === 'logistics' && { backgroundColor: '#C5A880' }]}>
                    <Text style={[styles.settingsSubTabBadgeText, settingsSubTab === 'logistics' && { color: '#1E2B58' }]}>
                      {(drivers || []).length}
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.settingsSubTabBtn, settingsSubTab === 'audit' && styles.settingsSubTabBtnActive]}
                  onPress={() => setSettingsSubTab('audit')}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="finger-print"
                    size={17}
                    color={settingsSubTab === 'audit' ? '#FFFFFF' : '#1E2B58'}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[styles.settingsSubTabBtnText, settingsSubTab === 'audit' && styles.settingsSubTabBtnTextActive]}>
                    Bitácora & Trazabilidad
                  </Text>
                  <View style={[styles.settingsSubTabBadge, settingsSubTab === 'audit' && { backgroundColor: '#C5A880' }]}>
                    <Text style={[styles.settingsSubTabBadgeText, settingsSubTab === 'audit' && { color: '#1E2B58' }]}>
                      {(activityLogs || []).length}
                    </Text>
                  </View>
                </TouchableOpacity>
              </ScrollView>
            </View>

            {/* SUB-PESTAÑA 1: MI PERFIL Y CREDENCIALES */}
            {settingsSubTab === 'profile' && (
            <View style={styles.settingsCard}>
              <View style={styles.settingsCardHeader}>
                <View style={styles.settingsIconCircle}>
                  <Ionicons name="person-circle" size={24} color="#1E2B58" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingsCardTitle}>Mi Perfil Administrativo</Text>
                  <Text style={styles.settingsCardSubtitle}>
                    Edita tu nombre, teléfono, usuario de acceso (correo) y clave de administrador
                  </Text>
                </View>
              </View>

              {profileMsg && (
                <View style={[styles.feedbackMsgBox, profileMsg.type === 'success' ? styles.feedbackSuccess : styles.feedbackError]}>
                  <Ionicons
                    name={profileMsg.type === 'success' ? 'checkmark-circle' : 'alert-circle'}
                    size={18}
                    color={profileMsg.type === 'success' ? '#166534' : '#DC2626'}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[styles.feedbackText, profileMsg.type === 'success' ? { color: '#166534' } : { color: '#DC2626' }]}>
                    {profileMsg.text}
                  </Text>
                </View>
              )}

              <View style={styles.settingsFormGrid}>
                <View style={styles.settingsFormGroup}>
                  <Text style={styles.settingsLabel}>Nombre Completo:</Text>
                  <TextInput
                    style={styles.settingsInput}
                    value={adminEditName}
                    onChangeText={setAdminEditName}
                    placeholder="Ej. Ramiro Gómez"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                <View style={styles.settingsFormGroup}>
                  <Text style={styles.settingsLabel}>Correo / Usuario de Acceso:</Text>
                  <TextInput
                    style={styles.settingsInput}
                    value={adminEditEmail}
                    onChangeText={setAdminEditEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    placeholder="admin@einuushi.com"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                <View style={styles.settingsFormGroup}>
                  <Text style={styles.settingsLabel}>Teléfono de Contacto:</Text>
                  <TextInput
                    style={styles.settingsInput}
                    value={adminEditPhone}
                    onChangeText={setAdminEditPhone}
                    keyboardType="phone-pad"
                    placeholder="300 123 4567"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                <View style={styles.settingsFormGroup}>
                  <Text style={styles.settingsLabel}>Nueva Contraseña (dejar en blanco para no cambiarla):</Text>
                  <View style={styles.passwordInputWrapper}>
                    <TextInput
                      style={styles.passwordTextInput}
                      value={adminEditPassword}
                      onChangeText={setAdminEditPassword}
                      secureTextEntry={!showAdminPassword}
                      placeholder="Mínimo 6 caracteres"
                      placeholderTextColor="#94A3B8"
                    />
                    <TouchableOpacity
                      onPress={() => setShowAdminPassword(!showAdminPassword)}
                      style={styles.eyeBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name={showAdminPassword ? 'eye-off' : 'eye'} size={18} color="#64748B" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.settingsPrimaryBtn, isSavingAdminProfile && { opacity: 0.7 }]}
                onPress={handleSaveAdminProfile}
                disabled={isSavingAdminProfile}
                activeOpacity={0.8}
              >
                <Ionicons name="save-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.settingsPrimaryBtnText}>
                  {isSavingAdminProfile ? 'Guardando Cambios...' : 'Guardar Mis Datos y Clave'}
                </Text>
              </TouchableOpacity>
            </View>
            )}

            {/* SUB-PESTAÑA 2: GESTIÓN DEL EQUIPO DE ADMINISTRADORES */}
            {settingsSubTab === 'admins' && (
              <>
                {/* SECCIÓN 2: CREAR NUEVO USUARIO ADMINISTRADOR (EXCLUSIVO SUPERADMIN) */}
                <View style={styles.settingsCard}>
              <View style={styles.settingsCardHeader}>
                <View style={[styles.settingsIconCircle, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="person-add" size={22} color="#B45309" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingsCardTitle}>Crear Nuevo Administrador</Text>
                  <Text style={styles.settingsCardSubtitle}>
                    {isSuperAdminUser
                      ? 'Otorga acceso y privilegios de administración a otro colaborador del equipo'
                      : 'Privilegio reservado exclusivamente para la cuenta Superadministrador'}
                  </Text>
                </View>
                <View style={isSuperAdminUser ? styles.superRoleBadge : styles.roleBadge}>
                  <Text style={isSuperAdminUser ? styles.superRoleBadgeText : styles.roleBadgeText}>
                    {isSuperAdminUser ? 'SUPERADMIN' : 'RESTRINGIDO'}
                  </Text>
                </View>
              </View>

              {!isSuperAdminUser ? (
                <View style={{
                  backgroundColor: '#FFFBEB',
                  borderColor: '#FDE68A',
                  borderWidth: 1,
                  borderRadius: 12,
                  padding: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                }}>
                  <Ionicons name="lock-closed" size={26} color="#D97706" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#92400E', marginBottom: 4 }}>
                      Nivel de Acceso: Administrador Operativo
                    </Text>
                    <Text style={{ fontSize: 12, color: '#B45309', lineHeight: 18 }}>
                      Por políticas de seguridad, únicamente el <Text style={{ fontWeight: 'bold' }}>Superadministrador Principal</Text> tiene autorización para crear y registrar nuevos administradores o reasignar contraseñas. Puedes modificar tus propios datos de acceso en la sección superior.
                    </Text>
                  </View>
                </View>
              ) : (
                <>
                  {createAdminMsg && (
                    <View style={[styles.feedbackMsgBox, createAdminMsg.type === 'success' ? styles.feedbackSuccess : styles.feedbackError]}>
                      <Ionicons
                        name={createAdminMsg.type === 'success' ? 'checkmark-circle' : 'alert-circle'}
                        size={18}
                        color={createAdminMsg.type === 'success' ? '#166534' : '#DC2626'}
                        style={{ marginRight: 6 }}
                      />
                      <Text style={[styles.feedbackText, createAdminMsg.type === 'success' ? { color: '#166534' } : { color: '#DC2626' }]}>
                        {createAdminMsg.text}
                      </Text>
                    </View>
                  )}

                  <View style={styles.settingsFormGrid}>
                    <View style={styles.settingsFormGroup}>
                      <Text style={styles.settingsLabel}>Nombre del Nuevo Administrador:</Text>
                      <TextInput
                        style={styles.settingsInput}
                        value={newAdminName}
                        onChangeText={setNewAdminName}
                        placeholder="Ej. María Pérez"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>

                    <View style={styles.settingsFormGroup}>
                      <Text style={styles.settingsLabel}>Documento / Cédula:</Text>
                      <TextInput
                        style={styles.settingsInput}
                        value={newAdminCedula}
                        onChangeText={setNewAdminCedula}
                        keyboardType="numeric"
                        placeholder="1124..."
                        placeholderTextColor="#94A3B8"
                      />
                    </View>

                    <View style={styles.settingsFormGroup}>
                      <Text style={styles.settingsLabel}>Correo Electrónico (será su usuario de acceso):</Text>
                      <TextInput
                        style={styles.settingsInput}
                        value={newAdminEmail}
                        onChangeText={setNewAdminEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        placeholder="maria@einuushi.com"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>

                    <View style={styles.settingsFormGroup}>
                      <Text style={styles.settingsLabel}>Teléfono Celular:</Text>
                      <TextInput
                        style={styles.settingsInput}
                        value={newAdminPhone}
                        onChangeText={setNewAdminPhone}
                        keyboardType="phone-pad"
                        placeholder="300 987 6543"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>

                    <View style={styles.settingsFormGroup}>
                      <Text style={styles.settingsLabel}>Contraseña de Acceso:</Text>
                      <View style={styles.passwordInputWrapper}>
                        <TextInput
                          style={styles.passwordTextInput}
                          value={newAdminPassword}
                          onChangeText={setNewAdminPassword}
                          secureTextEntry={!showNewAdminPassword}
                          placeholder="Mínimo 6 caracteres"
                          placeholderTextColor="#94A3B8"
                        />
                        <TouchableOpacity
                          onPress={() => setShowNewAdminPassword(!showNewAdminPassword)}
                          style={styles.eyeBtn}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name={showNewAdminPassword ? 'eye-off' : 'eye'} size={18} color="#64748B" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[styles.settingsAccentBtn, isCreatingAdmin && { opacity: 0.7 }]}
                    onPress={handleCreateNewAdmin}
                    disabled={isCreatingAdmin}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="shield-checkmark-outline" size={18} color="#1E2B58" style={{ marginRight: 6 }} />
                    <Text style={styles.settingsAccentBtnText}>
                      {isCreatingAdmin ? 'Registrando en Supabase...' : 'Registrar Nuevo Administrador'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* SECCIÓN 3: ADMINISTRADORES ACTIVOS EN SUPABASE */}
            <View style={styles.settingsCard}>
              <View style={styles.settingsCardHeader}>
                <View style={[styles.settingsIconCircle, { backgroundColor: '#EFF6FF' }]}>
                  <Ionicons name="people" size={22} color="#1D4ED8" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingsCardTitle}>
                    {isSuperAdminUser ? 'Equipo de Administradores Registrados' : 'Datos de Mi Cuenta de Administrador'}
                  </Text>
                  <Text style={styles.settingsCardSubtitle}>
                    {isSuperAdminUser
                      ? `${adminUsers.length} administradores autorizados en el sistema (gestión exclusiva de Superadministrador)`
                      : 'Por políticas de privacidad, solo tienes acceso a visualizar tus propios datos de cuenta'}
                  </Text>
                </View>
              </View>

              <View style={styles.adminListContainer}>
                {(isSuperAdminUser
                  ? adminUsers
                  : adminUsers.filter(adm => adminUser && (adm.id === adminUser.id || adm.email?.toLowerCase() === adminUser.email?.toLowerCase()) && !isSuperAdmin(adm))
                ).map(adm => {
                  const isCurrent = adminUser && (adm.email?.toLowerCase() === adminUser.email?.toLowerCase());
                  const isAdmSuper = isSuperAdmin(adm);
                  return (
                    <View key={`${adm.id || 'adm'}_${adm.email}`} style={[styles.adminUserCard, isCurrent && styles.adminUserCardCurrent]}>
                      <View style={[styles.adminAvatarBox, isAdmSuper && { backgroundColor: '#FEF3C7' }]}>
                        <Ionicons name={isAdmSuper ? "shield" : "shield-half"} size={20} color={isAdmSuper ? "#D97706" : "#1E2B58"} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <Text style={styles.adminCardName}>{adm.fullName}</Text>
                          {isCurrent && (
                            <View style={styles.currentAdminPill}>
                              <Text style={styles.currentAdminPillText}>Tú (Sesión Actual)</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.adminCardEmail}>{adm.email} • Tel: {adm.phone || 'N/A'}</Text>
                        <Text style={styles.adminCardDate}>
                          Registrado: {new Date(adm.createdAt).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <View style={isAdmSuper ? styles.superRoleBadge : styles.roleBadge}>
                          <Text style={isAdmSuper ? styles.superRoleBadgeText : styles.roleBadgeText}>
                            {isAdmSuper ? 'SUPERADMIN' : 'ADMIN'}
                          </Text>
                        </View>
                        {isSuperAdminUser && !isAdmSuper && (
                          <TouchableOpacity
                            style={styles.assignPasswordBtn}
                            onPress={() => {
                              setSelectedAdminForPasswordModal(adm);
                              setNewPasswordForSelectedAdmin('');
                              setChangeOtherAdminPasswordMsg(null);
                            }}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="key-outline" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                            <Text style={styles.assignPasswordBtnText}>Asignar Clave</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
            </>
            )}

            {/* SUB-PESTAÑA 3: GESTIÓN DE REPARTIDORES Y TRANSPORTADORAS */}
            {settingsSubTab === 'logistics' && (
            <View style={styles.settingsCard}>
              <View style={styles.settingsCardHeader}>
                <View style={[styles.settingsIconCircle, { backgroundColor: '#EFF6FF' }]}>
                  <Ionicons name="bicycle" size={22} color="#1E2B58" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingsCardTitle}>Equipo de Repartidores & Transportadoras</Text>
                  <Text style={styles.settingsCardSubtitle}>
                    Repartidores locales y empresas transportadoras aliadas para entregas locales y nacionales
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.saveProfileBtn, { backgroundColor: '#1E2B58', paddingVertical: 8, paddingHorizontal: 12, marginTop: 0 }]}
                  onPress={() => setIsNewDriverModalVisible(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add-circle-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={[styles.saveProfileBtnText, { fontSize: 12 }]}>Nuevo Repartidor</Text>
                </TouchableOpacity>
              </View>

              <View style={{ marginTop: 14, gap: 10 }}>
                {(!drivers || drivers.length === 0) ? (
                  <Text style={{ fontStyle: 'italic', color: '#64748B', fontSize: 13, textAlign: 'center', paddingVertical: 12 }}>
                    No hay repartidores o transportadoras registrados aún.
                  </Text>
                ) : (
                  drivers.map((drv: any) => {
                    const isCorp = drv.driverType === 'corporate';
                    return (
                      <View
                        key={drv.id}
                        style={{
                          backgroundColor: '#F8FAFC',
                          borderRadius: 10,
                          padding: 12,
                          borderWidth: 1,
                          borderColor: '#E2E8F0',
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: 10,
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 240 }}>
                          <View
                            style={{
                              width: 42,
                              height: 42,
                              borderRadius: 21,
                              backgroundColor: isCorp ? '#EEF2FF' : '#FEF3C7',
                              justifyContent: 'center',
                              alignItems: 'center',
                              marginRight: 12,
                            }}
                          >
                            <Ionicons
                              name={isCorp ? 'business' : 'bicycle'}
                              size={22}
                              color={isCorp ? '#4338CA' : '#D97706'}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#1E2B58' }}>
                                {drv.fullName}
                              </Text>
                              <View
                                style={{
                                  backgroundColor: isCorp ? '#E0E7FF' : '#FEF9C3',
                                  paddingHorizontal: 7,
                                  paddingVertical: 2,
                                  borderRadius: 4,
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 'bold',
                                    color: isCorp ? '#3730A3' : '#854D0E',
                                  }}
                                >
                                  {isCorp ? 'TRANSPORTADORA CORPORATIVA' : 'REPARTIDOR LOCAL'}
                                </Text>
                              </View>
                            </View>
                            <Text style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                              ✉️ {drv.email} • 📞 {drv.phone || 'Sin teléfono'}
                            </Text>
                            <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                              🆔 {isCorp ? 'NIT: ' : 'C.C: '}{drv.cedulaOrNit || drv.cedula || 'N/A'} • 🚗 {drv.vehicleType || (isCorp ? 'Flota Terrestre' : 'Moto')} {drv.plateOrNit ? `(${drv.plateOrNit})` : ''}
                            </Text>
                            {drv.carrierTrackingUrl ? (
                              <Text style={{ fontSize: 11, color: '#2563EB', marginTop: 2 }}>
                                🔗 Rastreo: {drv.carrierTrackingUrl}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <View
                            style={{
                              backgroundColor: '#DCFCE7',
                              paddingHorizontal: 8,
                              paddingVertical: 3,
                              borderRadius: 6,
                              flexDirection: 'row',
                              alignItems: 'center',
                            }}
                          >
                            <Ionicons name="checkmark-circle" size={13} color="#15803D" style={{ marginRight: 4 }} />
                            <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#15803D' }}>Activo</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            </View>
            )}

            {/* SUB-PESTAÑA 4: BITÁCORA DE TRAZABILIDAD Y AUDITORÍA EN VIVO */}
            {settingsSubTab === 'audit' && (
            <View style={styles.settingsCard}>
              <View style={styles.settingsCardHeader}>
                <View style={[styles.settingsIconCircle, { backgroundColor: '#F0FDF4' }]}>
                  <Ionicons name="finger-print" size={22} color="#15803D" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingsCardTitle}>Trazabilidad y Bitácora de Auditoría</Text>
                  <Text style={styles.settingsCardSubtitle}>
                    Registro cronológico inmutable de todos los movimientos y del administrador responsable de cada acción
                  </Text>
                </View>
              </View>

              {/* FILTROS DE AUDITORÍA */}
              <View style={styles.auditFiltersRow}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                  {(['ALL', 'PEDIDO', 'PRODUCTO', 'COTIZACION', 'SEGURIDAD'] as const).map(filterCat => (
                    <TouchableOpacity
                      key={filterCat}
                      style={[styles.auditFilterChip, auditFilterType === filterCat && styles.auditFilterChipActive]}
                      onPress={() => setAuditFilterType(filterCat)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.auditFilterChipText, auditFilterType === filterCat && styles.auditFilterChipTextActive]}>
                        {filterCat === 'ALL' ? 'Todos los Movimientos' : filterCat === 'PEDIDO' ? 'Pedidos' : filterCat === 'PRODUCTO' ? 'Inventario' : filterCat === 'COTIZACION' ? 'Cotizaciones' : 'Seguridad'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* BUSCADOR DE AUDITORÍA */}
              <View style={styles.auditSearchBar}>
                <Ionicons name="search" size={16} color="#64748B" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.auditSearchInput}
                  value={auditSearchQuery}
                  onChangeText={setAuditSearchQuery}
                  placeholder="Buscar por nombre de administrador, detalle o ID..."
                  placeholderTextColor="#94A3B8"
                />
                {auditSearchQuery ? (
                  <TouchableOpacity onPress={() => setAuditSearchQuery('')}>
                    <Ionicons name="close-circle" size={16} color="#94A3B8" />
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* LISTA DE REGISTROS DE TRAZABILIDAD */}
              {(() => {
                const filteredLogs = activityLogs.filter(item => {
                  // Si no es Superadministrador, no puede ver registros ni movimientos del Superadministrador
                  if (!isSuperAdminUser) {
                    const isMyOwnLog = adminUser && (item.adminId === adminUser.id || item.adminEmail?.toLowerCase() === adminUser.email?.toLowerCase());
                    if (!isMyOwnLog) return false;
                  }
                  const matchCat = auditFilterType === 'ALL' || item.entityType === auditFilterType;
                  const query = auditSearchQuery.toLowerCase().trim();
                  const matchQuery = !query ||
                    item.adminName.toLowerCase().includes(query) ||
                    item.adminEmail.toLowerCase().includes(query) ||
                    item.details.toLowerCase().includes(query) ||
                    (item.entityId && item.entityId.toLowerCase().includes(query));
                  return matchCat && matchQuery;
                });

                if (filteredLogs.length === 0) {
                  return (
                    <View style={styles.emptyAuditBox}>
                      <Ionicons name="document-text-outline" size={36} color="#94A3B8" />
                      <Text style={styles.emptyAuditText}>No se encontraron movimientos registrados con este criterio.</Text>
                    </View>
                  );
                }

                return (
                  <View style={styles.auditTimeline}>
                    {filteredLogs.map((logItem, index) => {
                      const iconName =
                        logItem.entityType === 'PEDIDO'
                          ? 'cube-outline'
                          : logItem.entityType === 'PRODUCTO'
                          ? 'pricetag-outline'
                          : logItem.entityType === 'COTIZACION'
                          ? 'sparkles-outline'
                          : logItem.entityType === 'CHAT'
                          ? 'chatbubble-outline'
                          : 'shield-outline';

                      const badgeColor =
                        logItem.entityType === 'PEDIDO'
                          ? '#10B981'
                          : logItem.entityType === 'PRODUCTO'
                          ? '#F59E0B'
                          : logItem.entityType === 'COTIZACION'
                          ? '#8B5CF6'
                          : logItem.entityType === 'CHAT'
                          ? '#3B82F6'
                          : '#EC4899';

                      return (
                        <View key={logItem.id || index} style={styles.auditTimelineItem}>
                          <View style={[styles.auditTimelineIcon, { backgroundColor: badgeColor + '18', borderColor: badgeColor }]}>
                            <Ionicons name={iconName as any} size={16} color={badgeColor} />
                          </View>
                          <View style={styles.auditTimelineContent}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                              <View style={styles.adminResponsiblePill}>
                                <Ionicons name="person-circle" size={12} color="#1E2B58" style={{ marginRight: 4 }} />
                                <Text style={styles.adminResponsiblePillText}>{logItem.adminName} ({logItem.adminEmail})</Text>
                              </View>
                              <Text style={styles.auditTimelineTime}>
                                {new Date(logItem.createdAt).toLocaleString('es-CO', {
                                  day: 'numeric',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </Text>
                            </View>
                            <Text style={styles.auditTimelineDetails}>{logItem.details}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                );
              })()}

            </View>
            )}

          </View>
        )}
      </ScrollView>

      {/* ================================================================= */}
      {/* MODAL: CONFIRMACIÓN PARA ELIMINAR ARTÍCULO                      */}
      {/* ================================================================= */}
      <Modal visible={isDeleteModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalDialog, { maxWidth: 420, padding: 24 }]}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: '#FEE2E2',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 12,
              }}>
                <Ionicons name="trash" size={28} color="#DC2626" />
              </View>
              <Text style={[styles.modalDialogTitle, { fontSize: 18, textAlign: 'center' }]}>
                ¿Eliminar artículo del catálogo?
              </Text>
              <Text style={{ fontSize: 13, color: '#64748B', textAlign: 'center', marginTop: 8, lineHeight: 18 }}>
                ¿Estás seguro de que deseas eliminar permanentemente{' '}
                <Text style={{ fontWeight: 'bold', color: '#1E2B58' }}>"{productToDelete?.name}"</Text>?
                {'\n'}Esta acción borrará el artículo de la base de datos y de la vista de todos los clientes.
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#F1F5F9',
                  paddingVertical: 12,
                  borderRadius: 10,
                  alignItems: 'center',
                }}
                onPress={() => {
                  setIsDeleteModalVisible(false);
                  setProductToDelete(null);
                }}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#64748B' }}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#DC2626',
                  paddingVertical: 12,
                  borderRadius: 10,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                }}
                onPress={handleConfirmDelete}
                activeOpacity={0.8}
              >
                <Ionicons name="trash-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#FFFFFF' }}>Sí, Eliminar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ================================================================= */}
      {/* MODAL: EDITAR ARTÍCULO DEL CATÁLOGO                               */}
      {/* ================================================================= */}
      {/* MODAL: ADMINISTRADOR DE FOTOS Y ÁNGULOS (GALERÍA MULTI-FOTO)      */}
      {/* ================================================================= */}
      <Modal visible={isGalleryModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalDialog, { maxWidth: 560 }]}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalDialogTitle}>Fotos y Ángulos del Artículo</Text>
                <Text style={{ fontSize: 11, color: '#64748B' }}>
                  {productToManageGallery?.name} • ID: {productToManageGallery?.id}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsGalleryModalVisible(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={24} color="#1E2B58" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 440 }} showsVerticalScrollIndicator={true}>
              <View style={{ backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#E2E8F0' }}>
                <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#1E2B58', marginBottom: 4 }}>
                  📸 Gestión de Múltiples Ángulos
                </Text>
                <Text style={{ fontSize: 11, color: '#64748B', lineHeight: 16 }}>
                  Agrega fotos desde diferentes perspectivas (frontal, lateral, detalle del tejido, textura). Los clientes podrán desplazarse entre las fotos tocando sobre el artículo en la tienda.
                </Text>
              </View>

              {/* Botón para agregar más fotos */}
              <TouchableOpacity
                style={{
                  backgroundColor: '#1E2B58',
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderRadius: 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                }}
                onPress={() => productToManageGallery && handleAddPhotoToProduct(productToManageGallery)}
                disabled={isAddingGalleryPhoto}
                activeOpacity={0.8}
              >
                <Ionicons name="add-circle" size={18} color="#C5A880" style={{ marginRight: 8 }} />
                <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 }}>
                  {isAddingGalleryPhoto ? 'Subiendo foto a Supabase...' : '+ Adjuntar Nuevo Ángulo / Foto'}
                </Text>
              </TouchableOpacity>

              {/* Lista de fotos actuales del producto */}
              <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#1E2B58', marginBottom: 8 }}>
                Fotos Registradas en la Tienda:
              </Text>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {(() => {
                  let imgs: string[] = [];
                  if (productToManageGallery?.images && Array.isArray(productToManageGallery.images) && productToManageGallery.images.length > 0) {
                    imgs = productToManageGallery.images;
                  } else if (productToManageGallery?.imagePath) {
                    imgs = productToManageGallery.imagePath.split('|').filter(Boolean);
                  }

                  if (imgs.length === 0) {
                    return (
                      <View style={{ padding: 20, alignItems: 'center', width: '100%' }}>
                        <Ionicons name="images-outline" size={32} color="#94A3B8" />
                        <Text style={{ color: '#64748B', fontSize: 12, marginTop: 4 }}>No hay fotos registradas</Text>
                      </View>
                    );
                  }

                  return imgs.map((imgUri, idx) => (
                    <View key={idx} style={{
                      width: '47%',
                      backgroundColor: '#FFFFFF',
                      borderRadius: 10,
                      padding: 8,
                      borderWidth: 1.5,
                      borderColor: idx === 0 ? '#C5A880' : '#E2E8F0',
                      position: 'relative',
                      alignItems: 'center',
                    }}>
                      <TouchableOpacity
                        activeOpacity={0.88}
                        style={{ width: '100%' }}
                        onPress={() => {
                          const allGallerySources = imgs.map(resolveProductImage).filter(Boolean);
                          handleOpenImagePreview(
                            resolveProductImage(imgUri),
                            productToManageGallery?.name || 'Artículo',
                            `$ ${productToManageGallery?.priceValue.toLocaleString('es-CO')} COP`,
                            productToManageGallery?.ancestralRef,
                            productToManageGallery?.categoryId,
                            allGallerySources,
                            idx
                          );
                        }}
                      >
                        <Image
                          source={resolveProductImage(imgUri) || { uri: SUPABASE_FALLBACK_IMAGES.mochila1 }}
                          style={{ width: '100%', height: 110, borderRadius: 8, backgroundColor: '#F8FAFC' }}
                          resizeMode="cover"
                        />
                      </TouchableOpacity>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginTop: 6 }}>
                        <View style={{ backgroundColor: idx === 0 ? '#1E2B58' : '#E2E8F0', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                          <Text style={{ fontSize: 10, fontWeight: 'bold', color: idx === 0 ? '#FFFFFF' : '#475569' }}>
                            {idx === 0 ? '★ Principal' : `Ángulo #${idx + 1}`}
                          </Text>
                        </View>
                        {imgs.length > 1 && (
                          <TouchableOpacity
                            onPress={() => productToManageGallery && handleRemovePhotoFromProduct(productToManageGallery, idx)}
                            style={{ padding: 4 }}
                          >
                            <Ionicons name="trash-outline" size={16} color="#EF4444" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  ));
                })()}
              </View>
            </ScrollView>

            <View style={{ marginTop: 14, paddingTop: 10, borderTopWidth: 1, borderColor: '#E2E8F0', alignItems: 'flex-end' }}>
              <TouchableOpacity
                style={{
                  backgroundColor: '#1E2B58',
                  paddingVertical: 10,
                  paddingHorizontal: 20,
                  borderRadius: 8,
                }}
                onPress={() => setIsGalleryModalVisible(false)}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 }}>Listo / Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ================================================================= */}
      <Modal visible={isEditProductModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalDialog}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalDialogTitle}>Modificar Artículo del Catálogo</Text>
                <Text style={{ fontSize: 11, color: '#64748B' }}>
                  ID: {productToEdit?.id}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsEditProductModalVisible(false)}>
                <Ionicons name="close" size={24} color="#1E2B58" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 480 }}>
              <Text style={styles.formInputLabel}>Nombre del Artículo *</Text>
              <TextInput
                style={styles.formTextInput}
                placeholder="Nombre del artículo"
                value={editProdName}
                onChangeText={setEditProdName}
              />

              <Text style={styles.formInputLabel}>Categoría *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {categories.map(cat => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryChoiceChip,
                      editProdCategory === cat.id && styles.categoryChoiceChipActive,
                    ]}
                    onPress={() => setEditProdCategory(cat.id)}
                  >
                    <Text
                      style={[
                        styles.categoryChoiceChipText,
                        editProdCategory === cat.id && styles.categoryChoiceChipTextActive,
                      ]}
                    >
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formInputLabel}>Precio ($ COP) *</Text>
                  <TextInput
                    style={styles.formTextInput}
                    placeholder="150000"
                    keyboardType="numeric"
                    value={editProdPrice}
                    onChangeText={setEditProdPrice}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formInputLabel}>Stock Disponible *</Text>
                  <TextInput
                    style={styles.formTextInput}
                    placeholder="5"
                    keyboardType="numeric"
                    value={editProdStock}
                    onChangeText={setEditProdStock}
                  />
                </View>
              </View>

              <Text style={styles.formInputLabel}>Referencia e Historia Ancestral</Text>
              <TextInput
                style={[styles.formTextInput, { height: 75, textAlignVertical: 'top' }]}
                placeholder="Descripción cultural wayuu..."
                multiline
                value={editProdAncestral}
                onChangeText={setEditProdAncestral}
              />

              {/* Configuración de Descuento Promocional */}
              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#F8FAFC',
                padding: 10,
                borderRadius: 8,
                marginBottom: 10,
              }}>
                <View>
                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#1E2B58' }}>¿Activar Descuento?</Text>
                  <Text style={{ fontSize: 10, color: '#64748B' }}>Aplica descuento promocional directo</Text>
                </View>
                <TouchableOpacity
                  style={{
                    backgroundColor: editProdIsDiscount ? '#059669' : '#CBD5E1',
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 6,
                  }}
                  onPress={() => setEditProdIsDiscount(!editProdIsDiscount)}
                >
                  <Text style={{ color: '#FFF', fontSize: 11, fontWeight: 'bold' }}>
                    {editProdIsDiscount ? 'ACTIVO' : 'INACTIVO'}
                  </Text>
                </TouchableOpacity>
              </View>

              {editProdIsDiscount ? (
                <View style={{ marginBottom: 12 }}>
                  <Text style={styles.formInputLabel}>Porcentaje de Descuento (%)</Text>
                  <TextInput
                    style={styles.formTextInput}
                    placeholder="Ej. 15"
                    keyboardType="numeric"
                    value={editProdDiscount}
                    onChangeText={setEditProdDiscount}
                  />
                </View>
              ) : null}

              <TouchableOpacity style={styles.saveModalBtn} onPress={handleSaveEditedProduct}>
                <Text style={styles.saveModalBtnText}>Guardar Cambios del Artículo</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ================================================================= */}
      {/* MODAL: NUEVO PRODUCTO                                            */}
      {/* ================================================================= */}
      <Modal visible={isNewProductModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalDialog}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalDialogTitle}>Cargar Nuevo Artículo a la Tienda</Text>
              <TouchableOpacity onPress={() => setIsNewProductModalVisible(false)}>
                <Ionicons name="close" size={24} color="#1E2B58" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 480 }}>
              <Text style={styles.formInputLabel}>Nombre del Artículo *</Text>
              <TextInput
                style={styles.formTextInput}
                placeholder="Ej. Mochila Wayuu Kanaas Sol Naciente"
                value={newProdName}
                onChangeText={setNewProdName}
              />

              {/* Sección de Adjuntar Foto */}
              <Text style={styles.formInputLabel}>Foto del Artículo *</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    backgroundColor: '#1E2B58',
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    borderRadius: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onPress={handlePickProductImage}
                  disabled={isPickingImage}
                >
                  <Ionicons name="images-outline" size={18} color="#C5A880" style={{ marginRight: 8 }} />
                  <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 }}>
                    {isPickingImage ? 'Procesando...' : 'Adjuntar Foto / Archivo'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    backgroundColor: '#C5A880',
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    borderRadius: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onPress={handleTakePhoto}
                  disabled={isPickingImage}
                >
                  <Ionicons name="camera-outline" size={18} color="#1E2B58" style={{ marginRight: 6 }} />
                  <Text style={{ color: '#1E2B58', fontWeight: 'bold', fontSize: 13 }}>Cámara</Text>
                </TouchableOpacity>
              </View>

              {/* Vista previa de las fotos adjuntadas (Galería multi-ángulo) */}
              {Boolean(newProdImages.length > 0 || newProdImagePath) ? (
                <View style={{
                  marginBottom: 16,
                  backgroundColor: '#F8FAFC',
                  borderRadius: 12,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#1E2B58' }}>
                      Fotos seleccionadas ({newProdImages.length > 0 ? newProdImages.length : 1}):
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        setNewProdImages([]);
                        setNewProdImagePath('');
                      }}
                    >
                      <Text style={{ fontSize: 11, color: '#EF4444', fontWeight: '600' }}>Quitar todas</Text>
                    </TouchableOpacity>
                  </View>

                  <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
                    {(newProdImages.length > 0 ? newProdImages : [newProdImagePath]).map((imgUri, idx) => (
                      <View key={idx} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#CBD5E1' }}>
                        <Image
                          source={resolveProductImage(imgUri) || { uri: SUPABASE_FALLBACK_IMAGES.mochila1 }}
                          style={{ width: 90, height: 90, backgroundColor: '#FFF' }}
                          resizeMode="cover"
                        />
                        <TouchableOpacity
                          style={{
                            position: 'absolute',
                            top: 4,
                            right: 4,
                            backgroundColor: 'rgba(239, 68, 68, 0.9)',
                            borderRadius: 10,
                            width: 20,
                            height: 20,
                            justifyContent: 'center',
                            alignItems: 'center',
                          }}
                          onPress={() => {
                            const filtered = newProdImages.filter((_, i) => i !== idx);
                            setNewProdImages(filtered);
                            setNewProdImagePath(filtered[0] || '');
                          }}
                        >
                          <Ionicons name="close" size={13} color="#FFF" />
                        </TouchableOpacity>
                        <View style={{
                          position: 'absolute',
                          bottom: 2,
                          left: 2,
                          backgroundColor: 'rgba(30, 43, 88, 0.85)',
                          paddingHorizontal: 4,
                          borderRadius: 4,
                        }}>
                          <Text style={{ fontSize: 9, color: '#FFF', fontWeight: 'bold' }}>#{idx + 1}</Text>
                        </View>
                      </View>
                    ))}
                  </ScrollView>

                  <View style={{
                    marginTop: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: '#E6F4EA',
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 6
                  }}>
                    <Ionicons name="checkmark-circle" size={14} color="#1E7E34" style={{ marginRight: 4 }} />
                    <Text style={{ color: '#1E7E34', fontSize: 11, fontWeight: 'bold' }}>
                      Fotos listas para sincronizar con la base de datos
                    </Text>
                  </View>
                </View>
              ) : null}
              <Text style={styles.formInputLabel}>Nombre Personalizado de la Imagen en BD</Text>
              <TextInput
                style={styles.formTextInput}
                placeholder="Ej. mochila_sol_guajiro_2026"
                value={newProdImageName}
                onChangeText={setNewProdImageName}
              />

              <Text style={styles.formInputLabel}>Categoría *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {categories.map(cat => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryChoiceChip,
                      newProdCategory === cat.id && styles.categoryChoiceChipActive,
                    ]}
                    onPress={() => setNewProdCategory(cat.id)}
                  >
                    <Text
                      style={[
                        styles.categoryChoiceChipText,
                        newProdCategory === cat.id && styles.categoryChoiceChipTextActive,
                      ]}
                    >
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.formInputLabel}>Precio en Pesos Colombianos (COP) *</Text>
              <TextInput
                style={styles.formTextInput}
                placeholder="Ej. 180000"
                keyboardType="numeric"
                value={newProdPrice}
                onChangeText={setNewProdPrice}
              />

              <Text style={styles.formInputLabel}>Stock Inicial Disponible *</Text>
              <TextInput
                style={styles.formTextInput}
                placeholder="5"
                keyboardType="numeric"
                value={newProdStock}
                onChangeText={setNewProdStock}
              />

              {/* Opcional: enlace manual si no adjunta foto */}
              {!newProdImagePath ? (
                <>
                  <Text style={styles.formInputLabel}>Opcional: Identificador de Asset o URL web</Text>
                  <TextInput
                    style={styles.formTextInput}
                    placeholder="mochila1, mochila2, manta1 o https://..."
                    value={newProdImagePath}
                    onChangeText={setNewProdImagePath}
                  />
                </>
              ) : null}

              <Text style={styles.formInputLabel}>Referencia e Historia Ancestral</Text>
              <TextInput
                style={[styles.formTextInput, { height: 70 }]}
                placeholder="Describe el significado del tejido, el simbolismo de los colores..."
                multiline
                value={newProdAncestral}
                onChangeText={setNewProdAncestral}
              />
            </ScrollView>

            <TouchableOpacity style={styles.saveModalBtn} onPress={handleSaveProduct} activeOpacity={0.8}>
              <Text style={styles.saveModalBtnText}>Guardar y Publicar en Tienda</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ================================================================= */}
      {/* MODAL: NUEVA CATEGORÍA                                           */}
      {/* ================================================================= */}
      <Modal visible={isNewCategoryModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalDialog, { maxWidth: 460 }]}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginRight: 8 }}>
                  <Ionicons name="add-circle" size={18} color="#2563EB" />
                </View>
                <Text style={styles.modalDialogTitle}>Crear Nueva Categoría</Text>
              </View>
              <TouchableOpacity onPress={() => setIsNewCategoryModalVisible(false)}>
                <Ionicons name="close" size={24} color="#1E2B58" />
              </TouchableOpacity>
            </View>

            <Text style={styles.formInputLabel}>Nombre de la Categoría *</Text>
            <TextInput
              style={styles.formTextInput}
              placeholder="Ej. Calzado Wayuu, Joyería, Fajones"
              value={newCatName}
              onChangeText={setNewCatName}
            />

            <Text style={styles.formInputLabel}>Seleccionar Ícono Representativo</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}>
                {PRESET_CATEGORY_ICONS.map(p => {
                  const isSelected = newCatIcon === p.icon;
                  return (
                    <TouchableOpacity
                      key={p.icon}
                      style={{
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 10,
                        borderWidth: 1.5,
                        borderColor: isSelected ? '#C5A880' : '#E2E8F0',
                        backgroundColor: isSelected ? '#FFFBEB' : '#FFFFFF',
                      }}
                      onPress={() => setNewCatIcon(p.icon)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name={p.icon as any} size={20} color={isSelected ? '#C5A880' : '#1E2B58'} />
                      <Text style={{ fontSize: 10, marginTop: 2, color: isSelected ? '#C5A880' : '#64748B', fontWeight: isSelected ? 'bold' : 'normal' }}>
                        {p.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <Text style={styles.formInputLabel}>Ícono Personalizado (Nombre Ionicons)</Text>
            <TextInput
              style={styles.formTextInput}
              placeholder="Ej. sparkles-outline, shirt-outline, ribbon-outline"
              value={newCatIcon}
              onChangeText={setNewCatIcon}
            />

            <Text style={styles.formInputLabel}>Descripción</Text>
            <TextInput
              style={[styles.formTextInput, { height: 60 }]}
              placeholder="Breve reseña del significado cultural o tipo de producto..."
              multiline
              value={newCatDescription}
              onChangeText={setNewCatDescription}
            />

            <TouchableOpacity style={styles.saveModalBtn} onPress={handleSaveCategory} activeOpacity={0.8}>
              <Text style={styles.saveModalBtnText}>Registrar Categoría</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ================================================================= */}
      {/* MODAL: GESTOR Y DIRECTORIO DE CATEGORÍAS REGISTRADAS             */}
      {/* ================================================================= */}
      <Modal visible={isCategoryManagerModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalDialog, { maxWidth: 620, maxHeight: '88%' }]}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                  <Ionicons name="folder-open" size={20} color="#2563EB" />
                </View>
                <View>
                  <Text style={styles.modalDialogTitle}>Directorio de Categorías</Text>
                  <Text style={{ fontSize: 11, color: '#64748B' }}>
                    {categories.length} categorías registradas en el catálogo
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setIsCategoryManagerModalVisible(false)}>
                <Ionicons name="close" size={24} color="#1E2B58" />
              </TouchableOpacity>
            </View>

            {/* Cabecera de acciones */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 12, paddingBottom: 10, borderBottomWidth: 1, borderColor: '#F1F5F9' }}>
              <Text style={{ fontSize: 12, color: '#475569', fontWeight: '600' }}>
                Listado y Gestión de Categorías
              </Text>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E2B58', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}
                onPress={() => {
                  setIsNewCategoryModalVisible(true);
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: 'bold' }}>+ Nueva Categoría</Text>
              </TouchableOpacity>
            </View>

            {/* Lista de Categorías */}
            <ScrollView showsVerticalScrollIndicator={true} style={{ flexGrow: 1 }} contentContainerStyle={{ gap: 10, paddingBottom: 16 }}>
              {categories.map((cat, idx) => {
                const count = products.filter(p => p.categoryId === cat.id || p.categoryId === cat.name).length;
                return (
                  <View
                    key={cat.id || idx}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      backgroundColor: '#FFFFFF',
                      borderWidth: 1,
                      borderColor: '#E2E8F0',
                      borderRadius: 12,
                      padding: 12,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.04,
                      shadowRadius: 3,
                      elevation: 1,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 10 }}>
                      <View style={{
                        width: 42,
                        height: 42,
                        borderRadius: 21,
                        backgroundColor: '#F8FAFC',
                        borderWidth: 1.5,
                        borderColor: '#C5A880',
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginRight: 12,
                      }}>
                        <Ionicons name={(cat.icon as any) || 'sparkles-outline'} size={22} color="#1E2B58" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#1E2B58' }}>{cat.name}</Text>
                          <View style={{ backgroundColor: '#EFF6FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                            <Text style={{ fontSize: 10, color: '#2563EB', fontWeight: 'bold' }}>
                              {count} {count === 1 ? 'artículo' : 'artículos'}
                            </Text>
                          </View>
                        </View>
                        {cat.description ? (
                          <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }} numberOfLines={2}>
                            {cat.description}
                          </Text>
                        ) : (
                          <Text style={{ fontSize: 10, color: '#94A3B8', fontStyle: 'italic', marginTop: 2 }}>
                            Sin descripción registrada
                          </Text>
                        )}
                        <Text style={{ fontSize: 9, color: '#94A3B8', marginTop: 2 }}>ID: {cat.id}</Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <TouchableOpacity
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          backgroundColor: '#EFF6FF',
                          borderWidth: 1,
                          borderColor: '#BFDBFE',
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 8,
                        }}
                        onPress={() => handleStartEditCategory(cat)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="pencil" size={13} color="#2563EB" style={{ marginRight: 4 }} />
                        <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#2563EB' }}>Editar</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 6,
                          backgroundColor: '#FEF2F2',
                          borderWidth: 1,
                          borderColor: '#FECACA',
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}
                        onPress={() => handleDeleteCategory(cat)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="trash-outline" size={14} color="#DC2626" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            <View style={{ borderTopWidth: 1, borderColor: '#F1F5F9', paddingTop: 12, alignItems: 'flex-end' }}>
              <TouchableOpacity
                style={{ backgroundColor: '#1E2B58', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 }}
                onPress={() => setIsCategoryManagerModalVisible(false)}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 }}>Cerrar Gestor</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ================================================================= */}
      {/* MODAL: EDITAR CATEGORÍA                                           */}
      {/* ================================================================= */}
      <Modal visible={editingCategory !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalDialog, { maxWidth: 460 }]}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginRight: 8 }}>
                  <Ionicons name="pencil" size={18} color="#2563EB" />
                </View>
                <View>
                  <Text style={styles.modalDialogTitle}>Editar Categoría</Text>
                  <Text style={{ fontSize: 11, color: '#64748B' }}>ID: {editingCategory?.id}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setEditingCategory(null)}>
                <Ionicons name="close" size={24} color="#1E2B58" />
              </TouchableOpacity>
            </View>

            <Text style={styles.formInputLabel}>Nombre de la Categoría *</Text>
            <TextInput
              style={styles.formTextInput}
              placeholder="Ej. Mochilas, Mantas, Chinchorros"
              value={editCatName}
              onChangeText={setEditCatName}
            />

            <Text style={styles.formInputLabel}>Seleccionar Ícono Rápido</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}>
                {PRESET_CATEGORY_ICONS.map(p => {
                  const isSelected = editCatIcon === p.icon;
                  return (
                    <TouchableOpacity
                      key={p.icon}
                      style={{
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 10,
                        borderWidth: 1.5,
                        borderColor: isSelected ? '#C5A880' : '#E2E8F0',
                        backgroundColor: isSelected ? '#FFFBEB' : '#FFFFFF',
                      }}
                      onPress={() => setEditCatIcon(p.icon)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name={p.icon as any} size={20} color={isSelected ? '#C5A880' : '#1E2B58'} />
                      <Text style={{ fontSize: 10, marginTop: 2, color: isSelected ? '#C5A880' : '#64748B', fontWeight: isSelected ? 'bold' : 'normal' }}>
                        {p.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <Text style={styles.formInputLabel}>O escribir nombre de Ícono Ionicons</Text>
            <TextInput
              style={styles.formTextInput}
              placeholder="Ej. sparkles-outline, shirt-outline"
              value={editCatIcon}
              onChangeText={setEditCatIcon}
            />

            <Text style={styles.formInputLabel}>Descripción</Text>
            <TextInput
              style={[styles.formTextInput, { height: 60 }]}
              placeholder="Breve reseña o significado cultural..."
              multiline
              value={editCatDescription}
              onChangeText={setEditCatDescription}
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#F1F5F9', paddingVertical: 12, borderRadius: 10, alignItems: 'center' }}
                onPress={() => setEditingCategory(null)}
                disabled={isSavingCategory}
              >
                <Text style={{ color: '#475569', fontWeight: 'bold', fontSize: 13 }}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveModalBtn, { flex: 2, marginTop: 0 }]}
                onPress={handleSaveEditCategory}
                disabled={isSavingCategory}
                activeOpacity={0.8}
              >
                <Text style={styles.saveModalBtnText}>
                  {isSavingCategory ? 'Guardando...' : '💾 Guardar Cambios'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ================================================================= */}
      {/* MODAL: RESPONDER COTIZACIÓN                                      */}
      {/* ================================================================= */}
      <Modal visible={isQuoteModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalDialog}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalDialogTitle}>Cotizar Diseño para {selectedQuote?.userName}</Text>
              <TouchableOpacity onPress={() => setIsQuoteModalVisible(false)}>
                <Ionicons name="close" size={24} color="#1E2B58" />
              </TouchableOpacity>
            </View>

            <Text style={styles.quoteModalPromptLabel}>Diseño Solicitado:</Text>
            <Text style={styles.quoteModalPromptText}>"{selectedQuote?.prompt}"</Text>

            <Text style={styles.formInputLabel}>Valor Cotizado Oficial ($ COP) *</Text>
            <TextInput
              style={styles.formTextInput}
              placeholder="Ej. 220000"
              keyboardType="numeric"
              value={quotePriceInput}
              onChangeText={setQuotePriceInput}
            />

            <Text style={styles.formInputLabel}>Tiempo Estimado de Tejido (Días) *</Text>
            <TextInput
              style={styles.formTextInput}
              placeholder="Ej. 8"
              keyboardType="numeric"
              value={quoteDaysInput}
              onChangeText={setQuoteDaysInput}
            />

            <Text style={styles.formInputLabel}>Notas y Recomendaciones del Artesano</Text>
            <TextInput
              style={[styles.formTextInput, { height: 70 }]}
              placeholder="Detalles sobre el hilo, las gazas o la técnica wayuu..."
              multiline
              value={quoteNotesInput}
              onChangeText={setQuoteNotesInput}
            />

            <TouchableOpacity style={styles.saveModalBtn} onPress={handleSendQuoteResponse} activeOpacity={0.8}>
              <Text style={styles.saveModalBtnText}>Enviar Cotización Formal al Cliente</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ================================================================= */}
      {/* MODAL: CALENDARIO VISUAL INTERACTIVO                             */}
      {/* ================================================================= */}
      <Modal visible={isCalendarModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalDialog, { maxWidth: 440, padding: 18 }]}>
            {/* Header del Modal */}
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginRight: 8 }}>
                  <Ionicons name="calendar" size={18} color="#2563EB" />
                </View>
                <View>
                  <Text style={styles.modalDialogTitle}>Calendario de Fechas</Text>
                  <Text style={{ fontSize: 11, color: '#64748B' }}>
                    Toca en los días para seleccionar el rango
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setIsCalendarModalVisible(false)}>
                <Ionicons name="close" size={24} color="#1E2B58" />
              </TouchableOpacity>
            </View>

            {/* Pestañas de Selección: 'Desde' o 'Hasta' */}
            <View style={{ flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 10, padding: 3, marginVertical: 12 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  paddingVertical: 7,
                  alignItems: 'center',
                  borderRadius: 8,
                  backgroundColor: calendarActiveTarget === 'start' ? '#1E2B58' : 'transparent',
                }}
                onPress={() => setCalendarActiveTarget('start')}
                activeOpacity={0.8}
              >
                <Text style={{
                  fontSize: 11,
                  fontWeight: 'bold',
                  color: calendarActiveTarget === 'start' ? '#FFFFFF' : '#64748B'
                }}>
                  Desde: {orderStartDate || 'Sin elegir'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  flex: 1,
                  paddingVertical: 7,
                  alignItems: 'center',
                  borderRadius: 8,
                  backgroundColor: calendarActiveTarget === 'end' ? '#1E2B58' : 'transparent',
                }}
                onPress={() => setCalendarActiveTarget('end')}
                activeOpacity={0.8}
              >
                <Text style={{
                  fontSize: 11,
                  fontWeight: 'bold',
                  color: calendarActiveTarget === 'end' ? '#FFFFFF' : '#64748B'
                }}>
                  Hasta: {orderEndDate || 'Sin elegir'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Controles de Navegación de Mes */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingHorizontal: 4 }}>
              <TouchableOpacity
                onPress={() => {
                  setCalendarViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
                }}
                style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' }}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back" size={18} color="#1E2B58" />
              </TouchableOpacity>

              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#1E2B58' }}>
                  {CALENDAR_MONTH_NAMES[calendarViewDate.getMonth()]} {calendarViewDate.getFullYear()}
                </Text>
                <TouchableOpacity
                  onPress={() => setCalendarViewDate(new Date())}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Text style={{ fontSize: 10, color: '#C5A880', fontWeight: 'bold' }}>Ir a Hoy</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={() => {
                  setCalendarViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
                }}
                style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' }}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-forward" size={18} color="#1E2B58" />
              </TouchableOpacity>
            </View>

            {/* Días de la semana */}
            <View style={{ flexDirection: 'row', marginBottom: 6 }}>
              {CALENDAR_WEEK_DAYS.map((d, i) => (
                <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#64748B' }}>{d}</Text>
                </View>
              ))}
            </View>

            {/* Cuadrícula de Días */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {(() => {
                const days = getCalendarGridDays(calendarViewDate.getFullYear(), calendarViewDate.getMonth());
                const todayFormatted = new Date().toISOString().split('T')[0];

                return days.map((item, idx) => {
                  const itemFormatted = `${item.year}-${String(item.month + 1).padStart(2, '0')}-${String(item.day).padStart(2, '0')}`;
                  const isStart = orderStartDate === itemFormatted;
                  const isEnd = orderEndDate === itemFormatted;
                  const isInRange = Boolean(
                    orderStartDate && orderEndDate &&
                    itemFormatted > orderStartDate && itemFormatted < orderEndDate
                  );
                  const isToday = itemFormatted === todayFormatted;

                  return (
                    <TouchableOpacity
                      key={idx}
                      style={{
                        width: '14.28%',
                        height: 38,
                        justifyContent: 'center',
                        alignItems: 'center',
                        backgroundColor: (isStart || isEnd)
                          ? '#1E2B58'
                          : isInRange
                          ? '#E0E7FF'
                          : 'transparent',
                        borderRadius: (isStart || isEnd) ? 19 : 0,
                        marginVertical: 1,
                      }}
                      onPress={() => {
                        if (calendarActiveTarget === 'start') {
                          setOrderStartDate(itemFormatted);
                          if (orderEndDate && itemFormatted > orderEndDate) {
                            setOrderEndDate(itemFormatted);
                          }
                          setCalendarActiveTarget('end');
                        } else {
                          if (orderStartDate && itemFormatted < orderStartDate) {
                            setOrderStartDate(itemFormatted);
                            setCalendarActiveTarget('end');
                          } else {
                            setOrderEndDate(itemFormatted);
                          }
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={{
                        fontSize: 12,
                        fontWeight: (isStart || isEnd || isToday) ? 'bold' : 'normal',
                        color: (isStart || isEnd)
                          ? '#FFFFFF'
                          : !item.isCurrentMonth
                          ? '#CBD5E1'
                          : isToday
                          ? '#2563EB'
                          : '#1E2B58'
                      }}>
                        {item.day}
                      </Text>
                      {isToday && !isStart && !isEnd && (
                        <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#2563EB', marginTop: 1 }} />
                      )}
                    </TouchableOpacity>
                  );
                });
              })()}
            </View>

            {/* Accesos rápidos de rango */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14, paddingTop: 10, borderTopWidth: 1, borderColor: '#F1F5F9' }}>
              {[
                {
                  label: 'Hoy',
                  action: () => {
                    const todayStr = new Date().toISOString().split('T')[0];
                    setOrderStartDate(todayStr);
                    setOrderEndDate(todayStr);
                  }
                },
                {
                  label: 'Últimos 7 días',
                  action: () => {
                    const now = new Date();
                    const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
                    setOrderStartDate(sevenDaysAgo.toISOString().split('T')[0]);
                    setOrderEndDate(now.toISOString().split('T')[0]);
                  }
                },
                {
                  label: 'Este Mes',
                  action: () => {
                    const now = new Date();
                    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
                    setOrderStartDate(firstDay.toISOString().split('T')[0]);
                    setOrderEndDate(now.toISOString().split('T')[0]);
                  }
                },
                {
                  label: 'Mes Pasado',
                  action: () => {
                    const now = new Date();
                    const firstDayPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    const lastDayPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
                    setOrderStartDate(firstDayPrevMonth.toISOString().split('T')[0]);
                    setOrderEndDate(lastDayPrevMonth.toISOString().split('T')[0]);
                  }
                },
              ].map((shortcut, sIdx) => (
                <TouchableOpacity
                  key={sIdx}
                  style={{ backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}
                  onPress={shortcut.action}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 10, color: '#475569', fontWeight: '600' }}>{shortcut.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Botones de Acción */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#F1F5F9', paddingVertical: 10, borderRadius: 8, alignItems: 'center' }}
                onPress={() => setIsCalendarModalVisible(false)}
              >
                <Text style={{ color: '#475569', fontWeight: 'bold', fontSize: 12 }}>Cerrar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ flex: 2, backgroundColor: '#1E2B58', paddingVertical: 10, borderRadius: 8, alignItems: 'center' }}
                onPress={() => {
                  setOrderDatePreset('CUSTOM');
                  setIsCalendarModalVisible(false);
                }}
                activeOpacity={0.8}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 }}>
                  ✅ Aplicar Fechas
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ================================================================= */}
      {/* MODAL: LIQUIDACIÓN Y PAZ Y SALVO EN TIENDA                        */}
      {/* ================================================================= */}
      <Modal
        visible={isSettlementModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsSettlementModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalDialog, { maxWidth: 540 }]}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="shield-checkmark" size={24} color="#10B981" style={{ marginRight: 8 }} />
                <Text style={styles.modalDialogTitle}>Liquidación y Paz y Salvo</Text>
              </View>
              <TouchableOpacity onPress={() => setIsSettlementModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={true}
              persistentScrollbar={true}
              style={{ maxHeight: 480 }}
              contentContainerStyle={{ paddingRight: 8, paddingBottom: 20 }}
            >
              {/* RESUMEN DEL PEDIDO */}
              <View style={styles.settleSummaryBox}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={styles.settleSummaryOrder}>Pedido #{selectedOrderForSettlement?.id}</Text>
                  <Text style={{ fontSize: 11, color: '#64748B' }}>{selectedOrderForSettlement?.date}</Text>
                </View>
                <Text style={styles.settleSummaryClient}>
                  👤 Cliente: <Text style={{ fontWeight: 'bold', color: '#1E2B58' }}>{selectedOrderForSettlement?.client.name}</Text>
                </Text>
                <Text style={styles.settleSummaryDriver}>
                  🛵 Repartidor a Cargo: <Text style={{ fontWeight: 'bold', color: '#1E2B58' }}>{selectedOrderForSettlement?.driverName || 'No asignado'}</Text>
                </Text>
                <View style={styles.settleSummaryTotalRow}>
                  <Text style={styles.settleSummaryTotalLabel}>Monto a Liquidar:</Text>
                  <Text style={styles.settleSummaryTotalValue}>$ {(selectedOrderForSettlement?.total || 0).toLocaleString('es-CO')} COP</Text>
                </View>
              </View>

              {/* EVIDENCIA FOTOGRÁFICA DE ENTREGA ADJUNTA */}
              {selectedOrderForSettlement?.deliveryEvidencePhoto && (
                <View style={{ marginBottom: 12, padding: 8, backgroundColor: '#F0FDF4', borderRadius: 8, borderWidth: 1, borderColor: '#BBF7D0', flexDirection: 'row', alignItems: 'center' }}>
                  <Image source={{ uri: selectedOrderForSettlement.deliveryEvidencePhoto }} style={{ width: 52, height: 52, borderRadius: 6, marginRight: 10 }} resizeMode="cover" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#166534' }}>📸 Evidencia de Entrega Capturada</Text>
                    <Text style={{ fontSize: 10, color: '#15803D' }}>Fotografía tomada por el repartidor en el domicilio</Text>
                  </View>
                </View>
              )}

              {/* OPCIONES DE LIQUIDACIÓN */}
              <Text style={styles.settleFieldLabel}>
                Seleccione la forma como la tienda recibe o verifica el dinero:
              </Text>

              {/* OPCIÓN 1: EFECTIVO EN TIENDA */}
              <TouchableOpacity
                style={[
                  styles.settleOptionCard,
                  settlementType === 'EFECTIVO_EN_TIENDA' && styles.settleOptionCardActive
                ]}
                onPress={() => setSettlementType('EFECTIVO_EN_TIENDA')}
                activeOpacity={0.8}
              >
                <View style={styles.settleOptionHeader}>
                  <Ionicons 
                    name={settlementType === 'EFECTIVO_EN_TIENDA' ? "radio-button-on" : "radio-button-off"} 
                    size={20} 
                    color={settlementType === 'EFECTIVO_EN_TIENDA' ? "#10B981" : "#94A3B8"} 
                    style={{ marginRight: 8 }} 
                  />
                  <Text style={[styles.settleOptionTitle, settlementType === 'EFECTIVO_EN_TIENDA' && { color: '#047857' }]}>
                    💵 Efectivo Entregado por Repartidor en Tienda
                  </Text>
                </View>
                <Text style={styles.settleOptionDesc}>
                  El repartidor entregó físicamente el dinero en efectivo recibido del cliente en la caja de la tienda.
                </Text>
              </TouchableOpacity>

              {/* OPCIÓN 2: TRANSFERENCIA BANCARIA */}
              <TouchableOpacity
                style={[
                  styles.settleOptionCard,
                  settlementType === 'TRANSFERENCIA_TIENDA' && styles.settleOptionCardActive
                ]}
                onPress={() => setSettlementType('TRANSFERENCIA_TIENDA')}
                activeOpacity={0.8}
              >
                <View style={styles.settleOptionHeader}>
                  <Ionicons 
                    name={settlementType === 'TRANSFERENCIA_TIENDA' ? "radio-button-on" : "radio-button-off"} 
                    size={20} 
                    color={settlementType === 'TRANSFERENCIA_TIENDA' ? "#10B981" : "#94A3B8"} 
                    style={{ marginRight: 8 }} 
                  />
                  <Text style={[styles.settleOptionTitle, settlementType === 'TRANSFERENCIA_TIENDA' && { color: '#047857' }]}>
                    📲 Transferencia a Cuenta Bancaria de la Tienda
                  </Text>
                </View>
                <Text style={styles.settleOptionDesc}>
                  El dinero ingresó a la cuenta de la tienda (Bancolombia, Nequi o Daviplata) por parte del repartidor o cliente con soporte de pago.
                </Text>
              </TouchableOpacity>

              {/* CAMPO DE NÚMERO DE TRANSFERENCIA / COMPROBANTE */}
              {settlementType === 'TRANSFERENCIA_TIENDA' && (
                <View style={{ marginTop: 10 }}>
                  <Text style={styles.settleFieldLabel}>
                    Número de Transferencia / Comprobante de Pago * (Obligatorio)
                  </Text>
                  <TextInput
                    style={styles.formTextInput}
                    placeholder="Ej. 08492015 / Aprobación Bancolombia #5582"
                    placeholderTextColor="#94A3B8"
                    value={settlementTransferRef}
                    onChangeText={setSettlementTransferRef}
                  />
                </View>
              )}

              {/* CAMPO DE NOTA O EVIDENCIA */}
              <View style={{ marginTop: 10 }}>
                <Text style={styles.settleFieldLabel}>
                  Nota o Evidencia de Liquidación (Opcional)
                </Text>
                <TextInput
                  style={[styles.formTextInput, { height: 60, textAlignVertical: 'top' }]}
                  placeholder="Ej. Efectivo contado en caja física / Comprobante verificado en la app Bancolombia"
                  placeholderTextColor="#94A3B8"
                  value={settlementNotes}
                  onChangeText={setSettlementNotes}
                  multiline
                />
              </View>
            </ScrollView>

            <View style={styles.modalActionButtonsRow}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setIsSettlementModalVisible(false)}
                disabled={isSubmittingSettlement}
              >
                <Text style={styles.modalCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalConfirmButton, { backgroundColor: '#10B981' }]}
                onPress={handleConfirmSettlement}
                disabled={isSubmittingSettlement}
              >
                <Ionicons name="checkmark-done-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.modalConfirmButtonText}>
                  {isSubmittingSettlement ? 'Registrando...' : 'Confirmar Paz y Salvo'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ================================================================= */}
      {/* ================================================================= */}
      {/* MODAL: SEGUIMIENTO DE RUTA EN MAPA                              */}
      {/* ================================================================= */}
      <Modal visible={isMapModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalDialog, { height: '82%', padding: 0, overflow: 'hidden' }]}>
            <View style={[styles.modalHeaderRow, { padding: 16, backgroundColor: '#1E2B58' }]}>
              <View>
                <Text style={[styles.modalDialogTitle, { color: '#FFFFFF' }]}>
                  Ruta de Despacho: {activeTrackingOrder?.id}
                </Text>
                <Text style={{ color: '#C5A880', fontSize: 11 }}>
                  📍 {activeTrackingOrder?.client.address}, {activeTrackingOrder?.city || 'Riohacha'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsMapModalVisible(false)} style={{ padding: 4 }}>
                <Ionicons name="close-circle" size={26} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={{ flex: 1, backgroundColor: '#F1F5F9' }}>
              <LiveDeliveryMap
                orderId={activeTrackingOrder?.id}
                statusCode={activeTrackingOrder?.statusCode}
                driverName={activeTrackingOrder?.driverName}
                vehicleType={activeTrackingOrder?.vehicleType}
                plateOrNit={activeTrackingOrder?.plateOrNit}
                deliveryAddress={activeTrackingOrder?.client?.address}
                city={activeTrackingOrder?.city}
                height="100%"
              />
            </View>
          </View>
        </View>
      </Modal>
      {/* MODAL DE DIRECTORIO DE CLIENTES REGISTRADOS (SOLO CLIENTES, ADMINISTRADORES SE GESTIONAN EN CONFIGURACIÓN) */}
      <Modal 
        visible={isUsersModalVisible} 
        transparent 
        animationType="slide" 
        onRequestClose={() => setIsUsersModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalDialog, { maxWidth: 680, maxHeight: '90%', padding: 0, overflow: 'hidden' }]}>
            
            {/* Encabezado del Modal */}
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#1E2B58',
              paddingHorizontal: 20,
              paddingVertical: 16,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: '#C5A880',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: 12,
                }}>
                  <Ionicons name="people" size={22} color="#1E2B58" />
                </View>
                <View>
                  <Text style={{ fontSize: 17, fontWeight: 'bold', color: '#FFFFFF' }}>
                    Directorio de Clientes Registrados
                  </Text>
                  <Text style={{ fontSize: 11, color: '#C5A880' }}>
                    Base de Datos en Supabase • Solo Clientes ({(users || []).filter(isPureClientUser).length} registrados)
                  </Text>
                </View>
              </View>

              <TouchableOpacity 
                onPress={() => setIsUsersModalVisible(false)}
                style={{ padding: 4 }}
                activeOpacity={0.8}
              >
                <Ionicons name="close-circle" size={26} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Barra de Búsqueda */}
            <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, backgroundColor: '#F8FAFC', borderBottomWidth: 1, borderColor: '#E2E8F0' }}>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#FFFFFF',
                borderRadius: 10,
                borderWidth: 1,
                borderColor: '#CBD5E1',
                paddingHorizontal: 12,
                height: 42,
              }}>
                <Ionicons name="search-outline" size={18} color="#64748B" style={{ marginRight: 8 }} />
                <TextInput
                  placeholder="Buscar cliente por nombre, cédula, correo o ciudad..."
                  placeholderTextColor="#94A3B8"
                  value={usersSearchQuery}
                  onChangeText={setUsersSearchQuery}
                  style={[{ flex: 1, fontSize: 13, color: '#1E293B' }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]}
                />
                {usersSearchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setUsersSearchQuery('')}>
                    <Ionicons name="close-circle-outline" size={18} color="#94A3B8" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Lista de Usuarios con Scroll (Solo Clientes) */}
            <ScrollView style={{ flex: 1, padding: 16, backgroundColor: '#F1F5F9' }}>
              {(() => {
                const query = usersSearchQuery.trim().toLowerCase();
                const clientUsers = (users || []).filter(isPureClientUser);
                const filtered = clientUsers.filter(u => {
                  if (!query) return true;
                  return (
                    (u.fullName || '').toLowerCase().includes(query) ||
                    (u.email || '').toLowerCase().includes(query) ||
                    (u.cedula || '').toLowerCase().includes(query) ||
                    (u.phone || '').toLowerCase().includes(query) ||
                    (u.city || '').toLowerCase().includes(query)
                  );
                });

                if (filtered.length === 0) {
                  return (
                    <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
                      <Ionicons name="people-outline" size={44} color="#94A3B8" style={{ marginBottom: 10 }} />
                      <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#64748B' }}>
                        No se encontraron clientes
                      </Text>
                      <Text style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>
                        Prueba ajustando el término de búsqueda.
                      </Text>
                    </View>
                  );
                }

                return filtered.map((u, idx) => {
                  const initials = u.fullName
                    ? u.fullName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
                    : 'C';
                  
                  return (
                    <View 
                      key={u.id || idx}
                      style={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: 12,
                        padding: 14,
                        marginBottom: 12,
                        borderWidth: 1,
                        borderColor: '#E2E8F0',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.05,
                        shadowRadius: 2,
                        elevation: 1,
                      }}
                    >
                      {/* Cabecera del usuario */}
                      <View style={{ 
                        flexDirection: 'row', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        marginBottom: 12, 
                        borderBottomWidth: 1, 
                        borderColor: '#F1F5F9', 
                        paddingBottom: 10 
                      }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                          {u.avatar && u.avatar.startsWith('http') ? (
                            <Image 
                              source={{ uri: u.avatar }} 
                              style={{ width: 44, height: 44, borderRadius: 22, marginRight: 12 }} 
                            />
                          ) : (
                            <View style={{
                              width: 44,
                              height: 44,
                              borderRadius: 22,
                              backgroundColor: '#1E2B58',
                              justifyContent: 'center',
                              alignItems: 'center',
                              marginRight: 12,
                            }}>
                              <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 }}>
                                {initials}
                              </Text>
                            </View>
                          )}
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#1E293B' }}>
                              {u.fullName || 'Cliente Sin Nombre'}
                            </Text>
                            <Text style={{ fontSize: 11, color: '#64748B' }}>
                              ID: {u.id}
                            </Text>
                          </View>
                        </View>

                        <View style={{
                          backgroundColor: '#EFF6FF',
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: '#BFDBFE',
                        }}>
                          <Text style={{
                            fontSize: 11,
                            fontWeight: 'bold',
                            color: '#1D4ED8',
                          }}>
                            👤 Cliente
                          </Text>
                        </View>
                      </View>

                      {/* Cuadrícula de Datos Personales (Solo Lectura) */}
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                        <View style={{ width: '48%', backgroundColor: '#F8FAFC', padding: 8, borderRadius: 8 }}>
                          <Text style={{ fontSize: 10, color: '#64748B', fontWeight: '600' }}>CÉDULA / NIT</Text>
                          <Text style={{ fontSize: 12, color: '#1E293B', fontWeight: 'bold', marginTop: 2 }}>
                            {u.cedula || 'No registrada'}
                          </Text>
                        </View>

                        <View style={{ width: '48%', backgroundColor: '#F8FAFC', padding: 8, borderRadius: 8 }}>
                          <Text style={{ fontSize: 10, color: '#64748B', fontWeight: '600' }}>TELÉFONO</Text>
                          <Text style={{ fontSize: 12, color: '#1E293B', fontWeight: 'bold', marginTop: 2 }}>
                            {u.phone || 'No registrado'}
                          </Text>
                        </View>

                        <View style={{ width: '48%', backgroundColor: '#F8FAFC', padding: 8, borderRadius: 8 }}>
                          <Text style={{ fontSize: 10, color: '#64748B', fontWeight: '600' }}>CORREO ELECTRÓNICO</Text>
                          <Text style={{ fontSize: 12, color: '#1E293B', fontWeight: 'bold', marginTop: 2 }} numberOfLines={1}>
                            {u.email}
                          </Text>
                        </View>

                        <View style={{ width: '48%', backgroundColor: '#F8FAFC', padding: 8, borderRadius: 8 }}>
                          <Text style={{ fontSize: 10, color: '#64748B', fontWeight: '600' }}>CIUDAD</Text>
                          <Text style={{ fontSize: 12, color: '#1E293B', fontWeight: 'bold', marginTop: 2 }}>
                            {u.city || 'Riohacha'}
                          </Text>
                        </View>
                      </View>

                      {/* Pie de la tarjeta */}
                      <View style={{ 
                        flexDirection: 'row', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        marginTop: 10, 
                        paddingTop: 8, 
                        borderTopWidth: 1, 
                        borderColor: '#F1F5F9' 
                      }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons name="calendar-outline" size={12} color="#94A3B8" style={{ marginRight: 4 }} />
                          <Text style={{ fontSize: 10, color: '#94A3B8' }}>
                            Registrado: {u.createdAt ? new Date(u.createdAt).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Reciente'}
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons name="lock-closed" size={11} color="#10B981" style={{ marginRight: 3 }} />
                          <Text style={{ fontSize: 10, color: '#059669', fontWeight: '600' }}>
                            Protegido • Solo lectura
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                });
              })()}
            </ScrollView>

            {/* Pie del Modal con botón de cerrar */}
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingHorizontal: 20,
              paddingVertical: 12,
              backgroundColor: '#FFFFFF',
              borderTopWidth: 1,
              borderColor: '#E2E8F0',
            }}>
              <Text style={{ fontSize: 12, color: '#64748B' }}>
                Total: <Text style={{ fontWeight: 'bold', color: '#1E293B' }}>{(users || []).filter(isPureClientUser).length}</Text> clientes en Supabase
              </Text>
              <TouchableOpacity
                onPress={() => setIsUsersModalVisible(false)}
                style={{
                  backgroundColor: '#1E2B58',
                  paddingHorizontal: 22,
                  paddingVertical: 9,
                  borderRadius: 8,
                }}
                activeOpacity={0.8}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: 'bold' }}>
                  Cerrar
                </Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>

      {/* MODAL: SUPERADMIN ASIGNA / CAMBIA CONTRASEÑA A OTRO ADMINISTRADOR */}
      <Modal
        visible={!!selectedAdminForPasswordModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setSelectedAdminForPasswordModal(null);
          setNewPasswordForSelectedAdmin('');
          setChangeOtherAdminPasswordMsg(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalDialog, { maxWidth: 440, padding: 24 }]}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={[styles.settingsIconCircle, { backgroundColor: '#FEF3C7', width: 36, height: 36 }]}>
                  <Ionicons name="key" size={18} color="#B45309" />
                </View>
                <View>
                  <Text style={styles.modalDialogTitle}>Asignar Nueva Clave</Text>
                  <Text style={{ fontSize: 11, color: '#64748B' }}>Gestión de Superadministrador</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setSelectedAdminForPasswordModal(null);
                  setNewPasswordForSelectedAdmin('');
                  setChangeOtherAdminPasswordMsg(null);
                }}
              >
                <Ionicons name="close" size={24} color="#1E2B58" />
              </TouchableOpacity>
            </View>

            <View style={{ marginVertical: 14, backgroundColor: '#F8FAFC', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' }}>
              <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 2 }}>Administrador a modificar:</Text>
              <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#1E2B58' }}>{selectedAdminForPasswordModal?.fullName}</Text>
              <Text style={{ fontSize: 12, color: '#0284C7' }}>{selectedAdminForPasswordModal?.email}</Text>
            </View>

            {changeOtherAdminPasswordMsg && (
              <View style={[styles.feedbackMsgBox, changeOtherAdminPasswordMsg.type === 'success' ? styles.feedbackSuccess : styles.feedbackError, { marginBottom: 14 }]}>
                <Ionicons
                  name={changeOtherAdminPasswordMsg.type === 'success' ? 'checkmark-circle' : 'alert-circle'}
                  size={16}
                  color={changeOtherAdminPasswordMsg.type === 'success' ? '#166534' : '#DC2626'}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.feedbackText, changeOtherAdminPasswordMsg.type === 'success' ? { color: '#166534' } : { color: '#DC2626' }]}>
                  {changeOtherAdminPasswordMsg.text}
                </Text>
              </View>
            )}

            <View style={styles.settingsFormGroup}>
              <Text style={styles.settingsLabel}>Nueva Contraseña:</Text>
              <TextInput
                style={styles.settingsInput}
                value={newPasswordForSelectedAdmin}
                onChangeText={setNewPasswordForSelectedAdmin}
                placeholder="Mínimo 6 caracteres"
                placeholderTextColor="#94A3B8"
                secureTextEntry
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#E2E8F0',
                  paddingVertical: 12,
                  borderRadius: 8,
                  alignItems: 'center',
                }}
                onPress={() => {
                  setSelectedAdminForPasswordModal(null);
                  setNewPasswordForSelectedAdmin('');
                  setChangeOtherAdminPasswordMsg(null);
                }}
              >
                <Text style={{ color: '#475569', fontWeight: 'bold', fontSize: 13 }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.settingsPrimaryBtn,
                  { flex: 2 },
                  isChangingOtherAdminPassword && { opacity: 0.7 }
                ]}
                onPress={handleConfirmChangeOtherAdminPassword}
                disabled={isChangingOtherAdminPassword}
              >
                <Ionicons name="checkmark-sharp" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.settingsPrimaryBtnText}>
                  {isChangingOtherAdminPassword ? 'Actualizando...' : 'Confirmar y Guardar'}
                </Text>
              </TouchableOpacity>
            </View>
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

          {/* Cuerpo Central con la Imagen y Navegación de Galería */}
          <View style={[styles.fullImageBody, { position: 'relative', justifyContent: 'center', alignItems: 'center' }]}>
            {previewImage?.source && (
              <Image
                source={previewImage.source}
                style={styles.fullImageLarge}
                resizeMode="contain"
              />
            )}

            {/* Botones de navegación izquierda/derecha para galería multi-foto */}
            {Boolean(previewImage?.gallery && previewImage.gallery.length > 1) && (
              <>
                <TouchableOpacity
                  style={{
                    position: 'absolute',
                    left: 14,
                    backgroundColor: 'rgba(30, 43, 88, 0.85)',
                    width: 46,
                    height: 46,
                    borderRadius: 23,
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderWidth: 1.5,
                    borderColor: '#C5A880',
                    zIndex: 20,
                  }}
                  onPress={handlePrevPreviewImage}
                  activeOpacity={0.8}
                >
                  <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    position: 'absolute',
                    right: 14,
                    backgroundColor: 'rgba(30, 43, 88, 0.85)',
                    width: 46,
                    height: 46,
                    borderRadius: 23,
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderWidth: 1.5,
                    borderColor: '#C5A880',
                    zIndex: 20,
                  }}
                  onPress={handleNextPreviewImage}
                  activeOpacity={0.8}
                >
                  <Ionicons name="chevron-forward" size={28} color="#FFFFFF" />
                </TouchableOpacity>

                {/* Indicador de fotos (ej. Foto 1 de 4) */}
                <View style={{
                  position: 'absolute',
                  bottom: 12,
                  backgroundColor: 'rgba(0,0,0,0.75)',
                  paddingHorizontal: 14,
                  paddingVertical: 6,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: '#C5A880',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6
                }}>
                  <Ionicons name="images-outline" size={14} color="#C5A880" />
                  <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' }}>
                    Foto {((previewImage?.currentIndex || 0) + 1)} de {previewImage?.gallery?.length || 1}
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* Carrusel de Miniaturas Inferior */}
          {Boolean(previewImage?.gallery && previewImage.gallery.length > 1) && (
            <View style={{
              paddingVertical: 10,
              backgroundColor: 'rgba(15, 23, 42, 0.92)',
              borderTopWidth: 1,
              borderColor: 'rgba(197, 168, 128, 0.3)'
            }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                  paddingHorizontal: 16,
                  alignItems: 'center',
                  gap: 8,
                  justifyContent: 'center',
                  flexGrow: 1
                }}
              >
                {previewImage?.gallery?.map((thumbSrc, tIdx) => {
                  const isSelected = ((previewImage?.currentIndex) || 0) === tIdx;
                  return (
                    <TouchableOpacity
                      key={tIdx}
                      onPress={() => {
                        if (!previewImage) return;
                        setPreviewImage({
                          ...previewImage,
                          currentIndex: tIdx,
                          source: thumbSrc
                        });
                      }}
                      activeOpacity={0.8}
                      style={{
                        position: 'relative',
                        width: 52,
                        height: 52,
                        borderRadius: 8,
                        borderWidth: isSelected ? 2.5 : 1,
                        borderColor: isSelected ? '#C5A880' : 'rgba(255,255,255,0.25)',
                        overflow: 'hidden',
                        opacity: isSelected ? 1 : 0.65,
                      }}
                    >
                      <Image source={thumbSrc} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                      <View style={{
                        position: 'absolute',
                        bottom: 2,
                        right: 2,
                        backgroundColor: isSelected ? '#C5A880' : 'rgba(0,0,0,0.65)',
                        borderRadius: 4,
                        paddingHorizontal: 4,
                        paddingVertical: 1
                      }}>
                        <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: 'bold' }}>{tIdx + 1}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Footer Inferior con Detalles y Precio */}
          {(previewImage?.price || previewImage?.description) ? (
            <SafeAreaView style={styles.fullImageFooterSafeArea}>
              <View style={styles.fullImageFooter}>
                {previewImage.price ? (
                  <View style={styles.fullImagePriceRow}>
                    <Text style={styles.fullImagePriceLabel}>Valor del artículo:</Text>
                    <Text style={styles.fullImagePrice}>{previewImage.price}</Text>
                  </View>
                ) : null}
                {previewImage.description ? (
                  <Text style={styles.fullImageDescription} numberOfLines={3}>
                    {previewImage.description}
                  </Text>
                ) : null}
                <Text style={styles.fullImageHint}>
                  Toca las flechas o miniaturas para explorar los diferentes ángulos
                </Text>
              </View>
            </SafeAreaView>
          ) : null}
        </View>
      </Modal>

      {/* ================================================================= */}
      {/* MODAL 1: DESPACHO Y ASIGNACIÓN DE REPARTIDOR O TRANSPORTADORA    */}
      {/* ================================================================= */}
      <Modal
        visible={isDispatchModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsDispatchModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalDialog, { maxWidth: 560 }]}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: '#1E2B58',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 10,
                  }}
                >
                  <Ionicons name="paper-plane" size={18} color="#C5A880" />
                </View>
                <View>
                  <Text style={styles.modalDialogTitle}>Asignar y Despachar Pedido</Text>
                  <Text style={{ fontSize: 11, color: '#64748B' }}>
                    Orden #{selectedOrderToDispatch?.id} • {selectedOrderToDispatch?.client?.name}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setIsDispatchModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={true}
              persistentScrollbar={true}
              style={{ maxHeight: 460 }}
              contentContainerStyle={{ paddingRight: 8, paddingBottom: 16 }}
            >
              {/* Resumen del Destino */}
              <View
                style={{
                  backgroundColor: '#F8FAFC',
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 16,
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#1E2B58', marginBottom: 2 }}>
                  📍 Destino de Entrega:
                </Text>
                <Text style={{ fontSize: 13, color: '#334155' }}>
                  {selectedOrderToDispatch?.client?.address}, {selectedOrderToDispatch?.city || 'Riohacha'}
                </Text>
                <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                  Monto a cobrar / Total: <Text style={{ fontWeight: 'bold', color: '#166534' }}>${(selectedOrderToDispatch?.total || 0).toLocaleString('es-CO')} COP</Text> ({selectedOrderToDispatch?.client?.payment})
                </Text>
              </View>

              {/* Información del Destino */}
              {(() => {
                const city = (selectedOrderToDispatch?.city || '').toLowerCase().trim();
                const isLocal = !city || city.includes('riohacha') || city.includes('guajira');
                return (
                  <View
                    style={{
                      backgroundColor: '#F8FAFC',
                      borderRadius: 8,
                      padding: 10,
                      marginBottom: 12,
                      borderWidth: 1,
                      borderColor: '#E2E8F0',
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}
                  >
                    <Ionicons
                      name={isLocal ? "navigate-circle" : "airplane"}
                      size={20}
                      color="#1E2B58"
                      style={{ marginRight: 8 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#1E2B58' }}>
                        {isLocal ? 'Destino: Entrega Local (Riohacha / La Guajira)' : `Destino: Envío Nacional / Intermunicipal (${selectedOrderToDispatch?.city || 'Otra Ciudad'})`}
                      </Text>
                      <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                        {isLocal ? 'Dirección en el perímetro urbano para entrega directa.' : 'Dirección fuera de la ciudad para despacho por transportadora.'}
                      </Text>
                    </View>
                  </View>
                );
              })()}

              <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#1E2B58', marginBottom: 8 }}>
                Selecciona el Repartidor o Transportadora Registrado:
              </Text>

              {/* Filtros de selección de repartidor */}
              {(() => {
                const localDrivers = drivers.filter(d => d.driverType !== 'corporate');
                const corpDrivers = drivers.filter(d => d.driverType === 'corporate');

                const handleSelectTab = (tab: 'all' | 'local' | 'corporate') => {
                  setDispatchDriverFilter(tab);
                  let targetList = drivers;
                  if (tab === 'local') targetList = localDrivers;
                  else if (tab === 'corporate') targetList = corpDrivers;

                  if (targetList.length > 0 && !targetList.some(d => d.id === selectedDriverId)) {
                    setSelectedDriverId(targetList[0].id);
                  }
                };

                return (
                  <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                    <TouchableOpacity
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 12,
                        borderRadius: 16,
                        backgroundColor: dispatchDriverFilter === 'all' ? '#1E2B58' : '#F1F5F9',
                      }}
                      onPress={() => handleSelectTab('all')}
                      activeOpacity={0.8}
                    >
                      <Text style={{ fontSize: 11, fontWeight: 'bold', color: dispatchDriverFilter === 'all' ? '#FFFFFF' : '#475569' }}>
                        🌐 Todos ({drivers.length})
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 12,
                        borderRadius: 16,
                        backgroundColor: dispatchDriverFilter === 'local' ? '#1E2B58' : '#F1F5F9',
                      }}
                      onPress={() => handleSelectTab('local')}
                      activeOpacity={0.8}
                    >
                      <Text style={{ fontSize: 11, fontWeight: 'bold', color: dispatchDriverFilter === 'local' ? '#FFFFFF' : '#475569' }}>
                        🛵 Locales ({localDrivers.length})
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 12,
                        borderRadius: 16,
                        backgroundColor: dispatchDriverFilter === 'corporate' ? '#1E2B58' : '#F1F5F9',
                      }}
                      onPress={() => handleSelectTab('corporate')}
                      activeOpacity={0.8}
                    >
                      <Text style={{ fontSize: 11, fontWeight: 'bold', color: dispatchDriverFilter === 'corporate' ? '#FFFFFF' : '#475569' }}>
                        🚚 Transportadoras ({corpDrivers.length})
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })()}

              {(() => {
                const filteredDrivers = drivers.filter(drv => {
                  if (dispatchDriverFilter === 'local') return drv.driverType !== 'corporate';
                  if (dispatchDriverFilter === 'corporate') return drv.driverType === 'corporate';
                  return true;
                });

                if (drivers.length === 0) {
                  return (
                    <View style={{ padding: 18, backgroundColor: '#F8FAFC', borderRadius: 8, alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#CBD5E1' }}>
                      <Ionicons name="people-outline" size={30} color="#64748B" style={{ marginBottom: 6 }} />
                      <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#1E2B58', textAlign: 'center' }}>
                        No hay repartidores ni transportadoras registrados
                      </Text>
                      <Text style={{ fontSize: 11, color: '#64748B', textAlign: 'center', marginTop: 4, marginBottom: 12 }}>
                        Para despachar este pedido, registra un nuevo repartidor o transportadora en la base de datos.
                      </Text>
                      <TouchableOpacity
                        style={{
                          backgroundColor: '#1E2B58',
                          paddingVertical: 8,
                          paddingHorizontal: 14,
                          borderRadius: 6,
                          flexDirection: 'row',
                          alignItems: 'center',
                        }}
                        onPress={() => {
                          setIsDispatchModalVisible(false);
                          setIsNewDriverModalVisible(true);
                        }}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="person-add" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' }}>Registrar Nuevo Repartidor</Text>
                      </TouchableOpacity>
                    </View>
                  );
                }

                if (filteredDrivers.length === 0) {
                  return (
                    <View style={{ padding: 16, backgroundColor: '#F8FAFC', borderRadius: 8, alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' }}>
                      <Ionicons name="information-circle-outline" size={24} color="#64748B" style={{ marginBottom: 4 }} />
                      <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#475569', textAlign: 'center' }}>
                        No hay registros en esta categoría ({dispatchDriverFilter === 'local' ? 'Locales' : 'Transportadoras'}).
                      </Text>
                      <Text style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center', marginTop: 2 }}>
                        Puedes registrar nuevos repartidores o transportadoras desde la pestaña Configuración y Trazabilidad.
                      </Text>
                    </View>
                  );
                }

                return filteredDrivers.map((drv: any) => {
                  const isSelected = selectedDriverId === drv.id;
                  const isCorp = drv.driverType === 'corporate';
                  return (
                    <TouchableOpacity
                      key={drv.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        padding: 12,
                        borderRadius: 8,
                        borderWidth: 2,
                        borderColor: isSelected ? '#1E2B58' : '#E2E8F0',
                        backgroundColor: isSelected ? '#F0F4FF' : '#FFFFFF',
                        marginBottom: 8,
                      }}
                      onPress={() => setSelectedDriverId(drv.id)}
                      activeOpacity={0.8}
                    >
                      <View
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 19,
                          backgroundColor: isCorp ? '#EEF2FF' : '#FEF3C7',
                          justifyContent: 'center',
                          alignItems: 'center',
                          marginRight: 10,
                        }}
                      >
                        <Ionicons
                          name={isCorp ? 'business' : drv.vehicleType === 'Carro' ? 'car' : 'bicycle'}
                          size={18}
                          color={isCorp ? '#4338CA' : '#D97706'}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#1E2B58' }}>
                            {drv.fullName}
                          </Text>
                          <Text style={{ fontSize: 10, color: isCorp ? '#4338CA' : '#D97706', fontWeight: 'bold' }}>
                            {isCorp ? 'TRANSPORTADORA' : 'LOCAL'}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 11, color: '#64748B' }}>
                          📞 {drv.phone} • {drv.vehicleType || (isCorp ? 'Logística Nacional' : 'Moto')}{drv.plateOrNit ? ` • Placa: ${drv.plateOrNit}` : ''}
                        </Text>
                      </View>
                      <Ionicons
                        name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                        size={20}
                        color={isSelected ? '#1E2B58' : '#94A3B8'}
                      />
                    </TouchableOpacity>
                  );
                });
              })()}

              {/* Condicional de Número de Guía: SÓLO para Transportadoras */}
              {(() => {
                const currentSelectedDriver = drivers.find(d => d.id === selectedDriverId);
                const isCorporateCarrier = currentSelectedDriver?.driverType === 'corporate';

                if (isCorporateCarrier) {
                  return (
                    <View style={{ marginTop: 10, marginBottom: 16, backgroundColor: '#F8FAFC', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#CBD5E1' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                        <Ionicons name="barcode-outline" size={18} color="#1E2B58" style={{ marginRight: 6 }} />
                        <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#1E2B58' }}>
                          Número de Guía de la Transportadora ({currentSelectedDriver?.fullName || 'Oficial'}):
                        </Text>
                      </View>
                      <TextInput
                        style={[styles.modalInput, { backgroundColor: '#FFFFFF', marginBottom: 4 }]}
                        placeholder="Ej: 2198304918 o ENV-982341"
                        placeholderTextColor="#94A3B8"
                        value={customGuideNumber}
                        onChangeText={setCustomGuideNumber}
                      />
                      <Text style={{ fontSize: 11, color: '#64748B' }}>
                        📦 Esta guía se registrará en el sistema y se le reflejará al cliente en su vista móvil con acceso a rastreo en línea.
                      </Text>
                    </View>
                  );
                }

                return (
                  <View style={{ marginTop: 8, marginBottom: 16, backgroundColor: '#F0FDF4', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#BBF7D0', flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="checkmark-circle" size={22} color="#16A34A" style={{ marginRight: 10 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#166534' }}>
                        Entrega Local Directa — Sin Número de Guía
                      </Text>
                      <Text style={{ fontSize: 11, color: '#15803D', marginTop: 2 }}>
                        Los envíos locales se entregan de forma directa por {currentSelectedDriver?.fullName || 'el repartidor local'}. No requieren número de guía.
                      </Text>
                    </View>
                  </View>
                );
              })()}
            </ScrollView>

            <View style={styles.modalActionButtonsRow}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setIsDispatchModalVisible(false)}
              >
                <Text style={styles.modalCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalConfirmButton, { backgroundColor: '#1E2B58' }]}
                onPress={handleConfirmDispatchWithDriver}
              >
                <Ionicons name="paper-plane" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.modalConfirmButtonText}>Confirmar Despacho</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ================================================================= */}
      {/* MODAL 2: REGISTRO DE NUEVO REPARTIDOR O TRANSPORTADORA            */}
      {/* ================================================================= */}
      <Modal
        visible={isNewDriverModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsNewDriverModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalDialog, { maxWidth: 580 }]}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 19,
                    backgroundColor: '#1E2B58',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 10,
                  }}
                >
                  <Ionicons name="person-add" size={18} color="#C5A880" />
                </View>
                <View>
                  <Text style={styles.modalDialogTitle}>Nuevo Repartidor / Transportadora</Text>
                  <Text style={{ fontSize: 11, color: '#64748B' }}>
                    Habilita acceso logístico sincronizado al portal móvil
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setIsNewDriverModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={true}
              persistentScrollbar={true}
              style={{ maxHeight: 480 }}
              contentContainerStyle={{ paddingRight: 8, paddingBottom: 20 }}
            >
              {/* Selector de Tipo: Individual vs Corporativa */}
              <View style={{ marginBottom: 14 }}>
                <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#1E2B58', marginBottom: 6 }}>
                  Tipo de Prestador Logístico (*):
                </Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingVertical: 10,
                      borderRadius: 8,
                      borderWidth: 2,
                      borderColor: newDriverType === 'individual' ? '#1E2B58' : '#CBD5E1',
                      backgroundColor: newDriverType === 'individual' ? '#F0F4FF' : '#FFFFFF',
                    }}
                    onPress={() => setNewDriverType('individual')}
                  >
                    <Ionicons name="bicycle" size={18} color={newDriverType === 'individual' ? '#1E2B58' : '#64748B'} style={{ marginRight: 6 }} />
                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: newDriverType === 'individual' ? '#1E2B58' : '#64748B' }}>
                      Repartidor Local
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingVertical: 10,
                      borderRadius: 8,
                      borderWidth: 2,
                      borderColor: newDriverType === 'corporate' ? '#1E2B58' : '#CBD5E1',
                      backgroundColor: newDriverType === 'corporate' ? '#F0F4FF' : '#FFFFFF',
                    }}
                    onPress={() => setNewDriverType('corporate')}
                  >
                    <Ionicons name="business" size={18} color={newDriverType === 'corporate' ? '#1E2B58' : '#64748B'} style={{ marginRight: 6 }} />
                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: newDriverType === 'corporate' ? '#1E2B58' : '#64748B' }}>
                      Empresa Corporativa
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Nombre o Razón Social */}
              <View style={{ marginBottom: 10 }}>
                <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#1E2B58', marginBottom: 4 }}>
                  {newDriverType === 'corporate' ? 'Razón Social / Empresa (*):' : 'Nombre Completo del Repartidor (*):'}
                </Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder={newDriverType === 'corporate' ? 'Ej: Servientrega Express S.A.S.' : 'Ej: Carlos Peñalver'}
                  placeholderTextColor="#94A3B8"
                  value={newDriverName}
                  onChangeText={setNewDriverName}
                />
              </View>

              {/* Cédula o NIT */}
              <View style={{ marginBottom: 10 }}>
                <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#1E2B58', marginBottom: 4 }}>
                  {newDriverType === 'corporate' ? 'NIT de la Empresa (*):' : 'Cédula de Ciudadanía (*):'}
                </Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder={newDriverType === 'corporate' ? 'Ej: 900.123.456-7' : 'Ej: 1124019283'}
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  value={newDriverCedulaOrNit}
                  onChangeText={setNewDriverCedulaOrNit}
                />
              </View>

              {/* Correo Electrónico y Contraseña */}
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#1E2B58', marginBottom: 4 }}>
                    Correo de Acceso (*):
                  </Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="correo@repartidor.com"
                    placeholderTextColor="#94A3B8"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={newDriverEmail}
                    onChangeText={setNewDriverEmail}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#1E2B58', marginBottom: 4 }}>
                    Contraseña Inicial:
                  </Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Mínimo 6 caracteres"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry
                    value={newDriverPassword}
                    onChangeText={setNewDriverPassword}
                  />
                </View>
              </View>

              {/* Teléfono Celular */}
              <View style={{ marginBottom: 10 }}>
                <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#1E2B58', marginBottom: 4 }}>
                  Teléfono / WhatsApp (*):
                </Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Ej: 3015551234"
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                  value={newDriverPhone}
                  onChangeText={setNewDriverPhone}
                />
              </View>

              {/* Fila: Tipo de Vehículo (Lista Desplegable) y Placa al lado */}
              {newDriverType === 'individual' ? (
                <>
                  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10, zIndex: 100 }}>
                    {/* Lista desplegable para Tipo de Vehículo: Carro, Moto, Otro */}
                    <View style={{ flex: 1, position: 'relative' }}>
                      <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#1E2B58', marginBottom: 4 }}>
                        Tipo de Vehículo (*):
                      </Text>
                      <TouchableOpacity
                        style={[
                          styles.modalInput,
                          {
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            backgroundColor: '#FFFFFF',
                          },
                        ]}
                        onPress={() => setIsVehicleDropdownOpen(!isVehicleDropdownOpen)}
                        activeOpacity={0.8}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons
                            name={newDriverVehicle === 'Carro' ? 'car-outline' : newDriverVehicle === 'Moto' ? 'bicycle-outline' : 'cube-outline'}
                            size={16}
                            color="#1E2B58"
                            style={{ marginRight: 6 }}
                          />
                          <Text style={{ fontSize: 13, color: '#1E2B58', fontWeight: '600' }}>
                            {newDriverVehicle || 'Moto'}
                          </Text>
                        </View>
                        <Ionicons name={isVehicleDropdownOpen ? 'chevron-up' : 'chevron-down'} size={16} color="#64748B" />
                      </TouchableOpacity>

                      {/* Menú desplegable */}
                      {isVehicleDropdownOpen && (
                        <View
                          style={{
                            position: 'absolute',
                            top: 62,
                            left: 0,
                            right: 0,
                            backgroundColor: '#FFFFFF',
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: '#CBD5E1',
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.15,
                            shadowRadius: 6,
                            elevation: 8,
                            zIndex: 9999,
                            overflow: 'hidden',
                          }}
                        >
                          {(['Carro', 'Moto', 'Otro'] as const).map(opt => (
                            <TouchableOpacity
                              key={opt}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingVertical: 10,
                                paddingHorizontal: 12,
                                backgroundColor: newDriverVehicle === opt ? '#F1F5F9' : '#FFFFFF',
                                borderBottomWidth: opt !== 'Otro' ? 1 : 0,
                                borderBottomColor: '#F1F5F9',
                              }}
                              onPress={() => {
                                setNewDriverVehicle(opt);
                                setIsVehicleDropdownOpen(false);
                              }}
                            >
                              <Ionicons
                                name={opt === 'Carro' ? 'car' : opt === 'Moto' ? 'bicycle' : 'cube-outline'}
                                size={16}
                                color={newDriverVehicle === opt ? '#1E2B58' : '#64748B'}
                                style={{ marginRight: 8 }}
                              />
                              <Text
                                style={{
                                  fontSize: 13,
                                  color: newDriverVehicle === opt ? '#1E2B58' : '#334155',
                                  fontWeight: newDriverVehicle === opt ? 'bold' : 'normal',
                                  flex: 1,
                                }}
                              >
                                {opt}
                              </Text>
                              {newDriverVehicle === opt && (
                                <Ionicons name="checkmark" size={16} color="#1E2B58" />
                              )}
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>

                    {/* Diligenciar la Placa al lado */}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#1E2B58', marginBottom: 4 }}>
                        Placa del Vehículo (*):
                      </Text>
                      <TextInput
                        style={styles.modalInput}
                        placeholder={newDriverVehicle === 'Carro' ? 'Ej: ABC-123' : 'Ej: EIN-028'}
                        placeholderTextColor="#94A3B8"
                        autoCapitalize="characters"
                        value={newDriverPlate}
                        onChangeText={setNewDriverPlate}
                      />
                    </View>
                  </View>

                  {/* Campo complementario si seleccionó Otro */}
                  {newDriverVehicle === 'Otro' && (
                    <View style={{ marginBottom: 10 }}>
                      <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#1E2B58', marginBottom: 4 }}>
                        Especifica el tipo de vehículo:
                      </Text>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="Ej: Bicicleta de carga, Patineta eléctrica, Motocarro..."
                        placeholderTextColor="#94A3B8"
                        value={newDriverVehicleOther}
                        onChangeText={setNewDriverVehicleOther}
                      />
                    </View>
                  )}
                </>
              ) : (
                /* Para empresa corporativa */
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#1E2B58', marginBottom: 4 }}>
                      Flota / Modalidad de Envíos:
                    </Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="Carga Nacional Aérea/Terrestre"
                      placeholderTextColor="#94A3B8"
                      value={newDriverVehicle}
                      onChangeText={setNewDriverVehicle}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#1E2B58', marginBottom: 4 }}>
                      Código de Convenio / Flota:
                    </Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="Ej: FLOTA-COL-01"
                      placeholderTextColor="#94A3B8"
                      value={newDriverPlate}
                      onChangeText={setNewDriverPlate}
                    />
                  </View>
                </View>
              )}

              {/* Si es corporativo: URL de Rastreo */}
              {newDriverType === 'corporate' && (
                <View style={{ marginBottom: 10 }}>
                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#1E2B58', marginBottom: 4 }}>
                    URL Oficial de Rastreo Web (Opcional):
                  </Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="https://www.servientrega.com/rastreo?id="
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="none"
                    value={newDriverTrackingUrl}
                    onChangeText={setNewDriverTrackingUrl}
                  />
                </View>
              )}
            </ScrollView>

            <View style={styles.modalActionButtonsRow}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setIsNewDriverModalVisible(false)}
                disabled={isSubmittingNewDriver}
              >
                <Text style={styles.modalCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalConfirmButton, { backgroundColor: '#1E2B58' }]}
                onPress={handleSaveNewDriver}
                disabled={isSubmittingNewDriver}
              >
                <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.modalConfirmButtonText}>
                  {isSubmittingNewDriver ? 'Guardando...' : 'Registrar en Sistema'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// =========================================================================
// ESTILOS DE ALTA GAMA (PALETA ANCESTRAL: #1E2B58, #C5A880, #F8FAFC)
// =========================================================================
const styles = StyleSheet.create({
  // AUTH
  authContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  authCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 5,
  },
  authHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  authIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#1E2B58',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  authBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#C5A880',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  authTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1E2B58',
    marginBottom: 4,
  },
  authSubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },
  authErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    padding: 10,
    borderRadius: 10,
    marginBottom: 16,
  },
  authErrorText: {
    fontSize: 12,
    color: '#DC2626',
    flex: 1,
  },
  authInputGroup: {
    marginBottom: 14,
  },
  authInputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E2B58',
    marginBottom: 6,
  },
  authInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
  },
  authTextInput: {
    flex: 1,
    fontSize: 14,
    color: '#1E2B58',
  },
  authSubmitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E2B58',
    height: 48,
    borderRadius: 14,
    marginTop: 10,
    shadowColor: '#1E2B58',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  authSubmitButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  autofillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginTop: 8,
  },
  autofillText: {
    fontSize: 11,
    color: '#C5A880',
    fontWeight: '600',
  },
  backToStoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  backToStoreText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },

  // DASHBOARD LAYOUT
  dashboardContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E2B58',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  brandTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  adminStatusText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  topActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refreshIconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewStoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#C5A880',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  viewStoreText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1E2B58',
  },
  logoutIconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // TABS
  tabsNavContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tabsNavScroll: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  tabButtonActive: {
    backgroundColor: '#1E2B58',
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
  },

  // MAIN CONTENT
  mainScrollContent: {
    padding: 20,
    paddingBottom: 60,
  },
  sectionBlock: {
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  sectionHeaderTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E2B58',
    marginBottom: 4,
  },
  sectionHeaderSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 18,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 16,
    gap: 12,
  },

  // KPIS
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginBottom: 20,
  },
  kpiCard: {
    flex: 1,
    minWidth: 180,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  kpiIconWrapper: {
    marginBottom: 8,
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E2B58',
    marginBottom: 2,
  },
  kpiLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },

  // ANALYTICS CARD & RANKINGS
  analyticsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 10,
    marginBottom: 12,
  },
  cardHeaderTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1E2B58',
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#B45309',
  },
  rankNameText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E2B58',
  },
  rankSubText: {
    fontSize: 11,
    color: '#64748B',
  },
  rankSoldNumber: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1E2B58',
  },
  rankRevenueNumber: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '600',
  },
  twoColumnGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  miniRankRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  miniRankName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1E2B58',
  },
  miniRankValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1E2B58',
  },
  miniRankDate: {
    fontSize: 10,
    color: '#94A3B8',
  },
  starText: {
    fontSize: 11,
  },
  discountBadgeTag: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 10,
  },
  discountBadgeTagText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#DC2626',
  },
  finalDiscountPriceText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#C5A880',
  },
  emptyText: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
    paddingVertical: 8,
  },

  // PEDIDOS
  filterPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  dateFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dateFilterChipActive: {
    backgroundColor: '#1E2B58',
    borderColor: '#1E2B58',
  },
  dateFilterChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  dateFilterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterPillActive: {
    backgroundColor: '#1E2B58',
    borderColor: '#1E2B58',
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  orderAdminCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  orderCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 10,
    marginBottom: 10,
  },
  orderIdBadge: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1E2B58',
  },
  orderDateText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  statusBadgeBox: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 4,
  },
  statusBadgeBoxText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  paymentStatusText: {
    fontSize: 11,
    color: '#64748B',
  },
  orderClientInfoBox: {
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
  },
  clientInfoName: {
    fontSize: 12,
    color: '#1E2B58',
    marginBottom: 2,
  },
  clientInfoDetail: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 2,
  },
  orderItemsList: {
    marginBottom: 12,
  },
  orderItemLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  orderItemNameText: {
    fontSize: 12,
    color: '#1E2B58',
  },
  orderItemPriceText: {
    fontSize: 12,
    color: '#64748B',
  },
  orderTotalLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 6,
    marginTop: 4,
  },
  orderTotalLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1E2B58',
  },
  orderTotalValue: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#C5A880',
  },
  adminOrderActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  confirmPayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  dispatchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  deliverButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  arrivedNoticeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  mapRouteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },

  // INVENTARIO
  addProductMainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E2B58',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addProductMainBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  createCategoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#C5A880',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  createCategoryBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1E2B58',
  },
  inventoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  inventoryCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  inventoryImgWrapper: {
    width: '100%',
    height: 160,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    position: 'relative',
  },
  inventoryImg: {
    width: '100%',
    height: '100%',
  },
  discountFloatingTag: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#DC2626',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  discountFloatingTagText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  inventoryDetailsBox: {
    padding: 14,
  },
  inventoryCategoryBadge: {
    fontSize: 9,
    fontWeight: '700',
    color: '#C5A880',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  inventoryItemName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1E2B58',
    marginBottom: 4,
  },
  inventoryImageNameTag: {
    fontSize: 10,
    color: '#64748B',
    marginBottom: 8,
  },
  priceRowAdmin: {
    marginBottom: 10,
  },
  regularPriceText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#C5A880',
  },
  crossedPrice: {
    fontSize: 11,
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },
  discountPriceHighlight: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#DC2626',
  },
  stockControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  stockControlLabel: {
    fontSize: 11,
    color: '#64748B',
    marginRight: 8,
  },
  stockAdjustBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stockDisplayNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1E2B58',
    paddingHorizontal: 12,
    minWidth: 32,
    textAlign: 'center',
  },
  discountConfigRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginBottom: 10,
  },
  discountRowLabel: {
    fontSize: 11,
    color: '#64748B',
    marginRight: 4,
  },
  discountQuickPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  discountQuickPillActive: {
    backgroundColor: '#DC2626',
  },
  discountQuickPillText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1E2B58',
  },
  removeDiscountBtn: {
    padding: 2,
  },
  inventoryFilterBar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  invFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  invFilterChipActive: {
    backgroundColor: '#1E2B58',
    borderColor: '#1E2B58',
  },
  invFilterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  invFilterChipTextActive: {
    color: '#FFFFFF',
  },
  statusDotSmall: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  changePhotoBtn: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(30, 43, 88, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  changePhotoBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  cardActionsFooter: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
    marginTop: 4,
  },
  editProdBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginRight: 6,
  },
  editProdBtnText: {
    fontSize: 11,
    color: '#1E2B58',
    fontWeight: 'bold',
  },
  toggleActiveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    marginRight: 6,
  },
  toggleActiveBtnActivate: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  toggleActiveBtnPause: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  toggleActiveBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  deleteProdBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  deleteProdBtnText: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: 'bold',
  },

  // COTIZACIONES
  quoteAdminCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quoteCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
    marginBottom: 10,
  },
  quoteIdText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1E2B58',
  },
  quoteClientText: {
    fontSize: 11,
    color: '#64748B',
  },
  quoteStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  quoteStatusBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  quoteBodyRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  quoteThumbnail: {
    width: 90,
    height: 90,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
  },
  quoteNoThumbnail: {
    width: 90,
    height: 90,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quotePromptTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1E2B58',
    marginBottom: 2,
  },
  quotePromptText: {
    fontSize: 12,
    color: '#334155',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  quotePatternText: {
    fontSize: 11,
    color: '#C5A880',
    fontWeight: '600',
    marginBottom: 2,
  },
  quoteDateText: {
    fontSize: 10,
    color: '#94A3B8',
  },
  quoteAnswerBox: {
    backgroundColor: '#F0FDF4',
    padding: 8,
    borderRadius: 8,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  quoteAnswerPrice: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#166534',
  },
  quoteAnswerDays: {
    fontSize: 11,
    color: '#166534',
  },
  quoteAnswerNotes: {
    fontSize: 10,
    color: '#475569',
    fontStyle: 'italic',
  },
  quoteCardFooter: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  openQuoteActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E2B58',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  openQuoteActionBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  quoteChatShortcutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  quoteChatShortcutBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1E2B58',
  },

  // CHAT MODULE
  chatModuleContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    minHeight: 480,
  },
  chatConversationsList: {
    width: '100%',
    maxWidth: 300,
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    padding: 12,
  },
  chatListHeader: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1E2B58',
    marginBottom: 10,
  },
  convItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  convItemActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  convAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  convNameText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1E2B58',
  },
  convLastMsgText: {
    fontSize: 10,
    color: '#64748B',
  },
  convBadge: {
    backgroundColor: '#DC2626',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  convBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  chatWindow: {
    flex: 1,
    minWidth: 320,
    backgroundColor: '#FFFFFF',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  chatWindowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#F8FAFC',
  },
  chatWindowHeaderText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1E2B58',
  },
  chatMessagesArea: {
    flex: 1,
    minHeight: 300,
  },
  chatBubble: {
    maxWidth: '80%',
    padding: 10,
    borderRadius: 12,
    marginBottom: 10,
  },
  chatBubbleAdmin: {
    alignSelf: 'flex-end',
    backgroundColor: '#1E2B58',
  },
  chatBubbleClient: {
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9',
  },
  chatSenderName: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 2,
  },
  chatBubbleText: {
    fontSize: 12,
    color: '#1E2B58',
    lineHeight: 16,
  },
  chatBubbleTime: {
    fontSize: 9,
    color: '#94A3B8',
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  chatInputBar: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  chatTextInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    fontSize: 12,
    color: '#1E2B58',
  },
  chatSendBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#1E2B58',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatPlaceholderBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  chatPlaceholderText: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 10,
  },

  // MODALES
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalDialog: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalDialogTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E2B58',
  },
  formInputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1E2B58',
    marginBottom: 4,
  },
  formTextInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: '#1E2B58',
    marginBottom: 10,
  },
  categoryChoiceChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    marginRight: 6,
  },
  categoryChoiceChipActive: {
    backgroundColor: '#1E2B58',
  },
  categoryChoiceChipText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  categoryChoiceChipTextActive: {
    color: '#FFFFFF',
  },
  saveModalBtn: {
    backgroundColor: '#1E2B58',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  saveModalBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  quoteModalPromptLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#64748B',
  },
  quoteModalPromptText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#1E2B58',
    marginBottom: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 30,
  },
  emptyContainerText: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 10,
  },

  // ESTILOS PARA VISUALIZADOR DE FOTO A PANTALLA COMPLETA (LIGHTBOX)
  adminImgTouchWrapper: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  quoteThumbnailTouch: {
    position: 'relative',
  },
  imageZoomBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  imageZoomBadgeSmall: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    padding: 3,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
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

  // BANNER DE TRAZABILIDAD EN PEDIDOS
  orderTraceabilityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(197, 168, 128, 0.15)',
    borderLeftWidth: 3,
    borderLeftColor: '#C5A880',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  orderTraceabilityText: {
    fontSize: 11,
    color: '#1E2B58',
  },
  orderDeliveredSuccessBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginTop: 6,
  },
  orderDeliveredSuccessText: {
    fontSize: 11,
    color: '#166534',
    fontWeight: '600',
    flex: 1,
  },

  // CONFIGURACIÓN, MULTI-ADMIN Y AUDITORÍA
  settingsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  settingsCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  settingsIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsCardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E2B58',
  },
  settingsCardSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  feedbackMsgBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
  },
  feedbackSuccess: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  feedbackError: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  feedbackText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  settingsFormGrid: {
    gap: 12,
    marginBottom: 16,
  },
  settingsFormGroup: {
    gap: 4,
  },
  settingsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  settingsInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#1E2B58',
  },
  passwordInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  passwordTextInput: {
    flex: 1,
    paddingVertical: 9,
    fontSize: 13,
    color: '#1E2B58',
  },
  eyeBtn: {
    padding: 6,
  },
  settingsPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E2B58',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    shadowColor: '#1E2B58',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  settingsPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  settingsAccentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#C5A880',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    shadowColor: '#C5A880',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  settingsAccentBtnText: {
    color: '#1E2B58',
    fontSize: 13,
    fontWeight: 'bold',
  },
  adminListContainer: {
    gap: 10,
  },
  adminUserCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  adminUserCardCurrent: {
    backgroundColor: '#FEFCE8',
    borderColor: '#FEF08A',
  },
  adminAvatarBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  adminCardName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1E2B58',
  },
  adminCardEmail: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  adminCardDate: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  currentAdminPill: {
    backgroundColor: '#1E2B58',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  currentAdminPillText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
  roleBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roleBadgeText: {
    color: '#1D4ED8',
    fontSize: 10,
    fontWeight: 'bold',
  },
  superRoleBadge: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  superRoleBadgeText: {
    color: '#B45309',
    fontSize: 10,
    fontWeight: 'bold',
  },
  assignPasswordBtn: {
    backgroundColor: '#1E2B58',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  assignPasswordBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  forgotAdminPasswordBtn: {
    marginTop: 8,
    paddingVertical: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  forgotAdminPasswordText: {
    fontSize: 12,
    color: '#C5A880',
    fontWeight: '600',
  },
  auditFiltersRow: {
    marginBottom: 12,
  },
  auditFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  auditFilterChipActive: {
    backgroundColor: '#1E2B58',
    borderColor: '#1E2B58',
  },
  auditFilterChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  auditFilterChipTextActive: {
    color: '#FFFFFF',
  },
  auditSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 14,
  },
  auditSearchInput: {
    flex: 1,
    fontSize: 12,
    color: '#1E2B58',
  },
  emptyAuditBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
  },
  emptyAuditText: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 8,
  },
  auditTimeline: {
    gap: 10,
  },
  auditTimelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  auditTimelineIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  auditTimelineContent: {
    flex: 1,
  },
  adminResponsiblePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 43, 88, 0.08)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  adminResponsiblePillText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1E2B58',
  },
  auditTimelineTime: {
    fontSize: 10,
    color: '#94A3B8',
  },
  auditTimelineDetails: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 16,
    marginTop: 4,
  },

  // ESTILOS DE ARQUEO DE CAJA, LIQUIDACIÓN Y PAZ Y SALVO
  settlementArqueoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  settlementStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  settlementStatBox: {
    flex: 1,
    minWidth: 200,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
  },
  settlementStatLabel: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  settlementStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginVertical: 4,
  },
  settlementStatSub: {
    fontSize: 11,
    lineHeight: 15,
  },
  orderSettlementPendingBanner: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  orderSettlementPendingTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#B45309',
  },
  orderSettlementPendingDesc: {
    fontSize: 11,
    color: '#78350F',
    lineHeight: 15,
    marginBottom: 8,
  },
  settleActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D97706',
    borderRadius: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  settleActionButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  orderSettledSuccessBanner: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  orderSettledSuccessTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#15803D',
  },
  orderSettledSuccessDetail: {
    fontSize: 11,
    color: '#166534',
    lineHeight: 15,
    marginTop: 2,
  },
  settleCompactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D97706',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  settleSummaryBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  settleSummaryOrder: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1E2B58',
  },
  settleSummaryClient: {
    fontSize: 12,
    color: '#334155',
    marginTop: 4,
  },
  settleSummaryDriver: {
    fontSize: 12,
    color: '#334155',
    marginTop: 2,
  },
  settleSummaryTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 8,
    marginTop: 8,
  },
  settleSummaryTotalLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1E2B58',
  },
  settleSummaryTotalValue: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#10B981',
  },
  settleFieldLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1E2B58',
    marginBottom: 6,
  },
  settleOptionCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  settleOptionCardActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#10B981',
    borderWidth: 1.5,
  },
  settleOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  settleOptionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1E2B58',
  },
  settleOptionDesc: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 15,
    marginLeft: 28,
  },
  modalActionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  modalCancelButton: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  modalCancelButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#64748B',
  },
  modalConfirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  modalConfirmButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#1E2B58',
  },
  saveProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E2B58',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  saveProfileBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  settingsSubTabsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 6,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  settingsSubTabsScroll: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  settingsSubTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  settingsSubTabBtnActive: {
    backgroundColor: '#1E2B58',
  },
  settingsSubTabBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  settingsSubTabBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  settingsSubTabBadge: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 1,
    marginLeft: 6,
  },
  settingsSubTabBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#64748B',
  },
});
