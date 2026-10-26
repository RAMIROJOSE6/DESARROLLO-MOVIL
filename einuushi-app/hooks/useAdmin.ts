import { useState, useEffect, useCallback } from 'react';
import {
  User,
  Order,
  Product,
  Category,
  CustomQuote,
  ChatMessage,
  StoreAnalytics,
  AdminActivityLog,
  authenticateAdmin,
  getAdminSession,
  clearAdminSession,
  getOrders,
  getProducts,
  getCategories,
  getCustomQuotes,
  getChatMessages,
  getStoreAnalytics,
  updateOrderStatusInDb,
  updateProductStockInDb,
  updateProduct,
  createProduct,
  createCategory,
  deleteProduct,
  updateCustomQuote,
  sendChatMessage,
  markChatMessagesAsRead,
  getUsers,
  getAdminUsers,
  getAdminActivityLogs,
  logAdminActivity,
  updateAdminProfile as dbUpdateAdminProfile,
  createAdminUser as dbCreateAdminUser,
  changeAdminPasswordBySuperAdmin,
  sendRecoveryCodeEmail,
  updatePassword,
  findUserByEmail,
  isSuperAdmin,
} from '../services/database';

export function useAdmin() {
  const [adminUser, setAdminUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [quotes, setQuotes] = useState<CustomQuote[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  const [activityLogs, setActivityLogs] = useState<AdminActivityLog[]>([]);
  const [analytics, setAnalytics] = useState<StoreAnalytics | null>(null);

  const [activeTrackingOrder, setActiveTrackingOrder] = useState<Order | null>(null);

  // Cargar sesión y datos del panel
  const refreshAll = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const activeSession = await getAdminSession();
      const isSuper = isSuperAdmin(activeSession);

      const [ord, prod, cat, qts, msgs, anl, usrs, logs, admins] = await Promise.all([
        getOrders(),
        getProducts(),
        getCategories(),
        getCustomQuotes(),
        getChatMessages(),
        getStoreAnalytics(),
        isSuper ? getUsers() : Promise.resolve([]),
        getAdminActivityLogs(100),
        getAdminUsers(activeSession),
      ]);
      setOrders(ord);
      setProducts(prod);
      setCategories(cat);
      setQuotes(qts);
      setMessages(msgs);
      setAnalytics(anl);
      setUsersList(isSuper ? usrs : []);
      // Si es administrador regular, no tiene acceso a visualizar movimientos ni datos del Superadministrador
      setActivityLogs(
        isSuper
          ? logs
          : logs.filter(
              l =>
                activeSession &&
                (l.adminId === activeSession.id ||
                  l.adminEmail.toLowerCase() === activeSession.email.toLowerCase())
            )
      );
      setAdminUsers(admins);
    } catch (err) {
      console.warn('Error refrescando datos de administración:', err);
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    async function initSession() {
      try {
        const session = await getAdminSession();
        if (session && (session.role === 'admin' || session.role === 'superadmin' || isSuperAdmin(session))) {
          if (isSuperAdmin(session)) {
            session.role = 'superadmin';
          }
          setAdminUser(session);
          await refreshAll();
        } else {
          setIsLoading(false);
        }
      } catch (err) {
        console.warn('Error verificando sesión administrativa:', err);
        setIsLoading(false);
      }
    }
    initSession();
  }, [refreshAll]);

  // Sincronización en tiempo real para chat, pedidos, logs y cotizaciones cada 3s
  useEffect(() => {
    if (!adminUser) return;
    const pollInterval = setInterval(() => {
      refreshAll();
    }, 3000);
    return () => clearInterval(pollInterval);
  }, [adminUser, refreshAll]);

  // Login de Administrador
  const login = async (email: string, pass: string) => {
    setIsLoading(true);
    const res = await authenticateAdmin(email, pass);
    if (res.success && res.user) {
      setAdminUser(res.user);
      await refreshAll();
      setIsLoading(false);
      return { success: true };
    }
    setIsLoading(false);
    return { success: false, message: res.message };
  };

  // Logout de Administrador
  const logout = async () => {
    await clearAdminSession();
    setAdminUser(null);
  };

  // Confirmar pago de un pedido (cambiar a PAID) con trazabilidad del admin
  const confirmPayment = async (orderId: string) => {
    const target = orders.find(o => o.id === orderId);
    if (!target) return;
    const adminLabel = adminUser ? `${adminUser.fullName} (${adminUser.email})` : 'Administrador';
    
    await updateOrderStatusInDb(orderId, {
      statusCode: target.statusCode,
      status: target.status,
      eta: target.eta,
      paymentStatus: 'PAID',
      adminResponsible: adminLabel,
    });

    await logAdminActivity({
      adminId: adminUser?.id,
      adminEmail: adminUser?.email || 'admin@einuushi.com',
      adminName: adminUser?.fullName || 'Administrador',
      actionType: 'CONFIRM_PAYMENT',
      entityType: 'PEDIDO',
      entityId: orderId,
      details: `${adminUser?.fullName || 'Administrador'} confirmó el pago del pedido #${orderId} ($ ${(target.total || 0).toLocaleString('es-CO')} COP).`,
    });

    setOrders(prev =>
      prev.map(o => (o.id === orderId ? { ...o, paymentStatus: 'PAID', adminResponsible: adminLabel } : o))
    );
    await refreshAll();
  };

  // Despachar pedido con trazabilidad
  const dispatchOrder = async (orderId: string) => {
    const target = orders.find(o => o.id === orderId);
    if (!target) return;
    const adminLabel = adminUser ? `${adminUser.fullName} (${adminUser.email})` : 'Administrador';

    await updateOrderStatusInDb(orderId, {
      statusCode: 'DISPATCHED',
      status: `¡Pedido Despachado por ${adminUser?.fullName || 'Administrador'}! Repartidor José Guajiro va en camino a tu dirección.`,
      eta: 'En ruta (aprox. 15-25 min)',
      dispatchedAt: Date.now(),
      adminResponsible: adminLabel,
    });

    await logAdminActivity({
      adminId: adminUser?.id,
      adminEmail: adminUser?.email || 'admin@einuushi.com',
      adminName: adminUser?.fullName || 'Administrador',
      actionType: 'DISPATCH_ORDER',
      entityType: 'PEDIDO',
      entityId: orderId,
      details: `${adminUser?.fullName || 'Administrador'} despachó a ruta el pedido #${orderId} para el cliente ${target.client?.name || 'Cliente'}.`,
    });

    setOrders(prev =>
      prev.map(o =>
        o.id === orderId
          ? {
              ...o,
              statusCode: 'DISPATCHED',
              status: `¡Pedido Despachado por ${adminUser?.fullName || 'Administrador'}! Repartidor José Guajiro va en camino.`,
              eta: 'En ruta (aprox. 15-25 min)',
              adminResponsible: adminLabel,
            }
          : o
      )
    );
    await refreshAll();
  };

  // Marcar pedido entregado con trazabilidad
  const markOrderDelivered = async (orderId: string) => {
    const target = orders.find(o => o.id === orderId);
    if (!target) return;
    const adminLabel = adminUser ? `${adminUser.fullName} (${adminUser.email})` : 'Administrador';

    await updateOrderStatusInDb(orderId, {
      statusCode: 'DELIVERED',
      status: `¡Pedido Entregado a Satisfacción! Verificado por ${adminUser?.fullName || 'Administrador'} ✅`,
      eta: 'Entrega finalizada',
      paymentStatus: 'PAID',
      receivedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      adminResponsible: adminLabel,
    });

    await logAdminActivity({
      adminId: adminUser?.id,
      adminEmail: adminUser?.email || 'admin@einuushi.com',
      adminName: adminUser?.fullName || 'Administrador',
      actionType: 'DELIVER_ORDER',
      entityType: 'PEDIDO',
      entityId: orderId,
      details: `${adminUser?.fullName || 'Administrador'} confirmó y finalizó la entrega del pedido #${orderId}.`,
    });

    setOrders(prev =>
      prev.map(o =>
        o.id === orderId
          ? {
              ...o,
              statusCode: 'DELIVERED',
              status: `¡Pedido Entregado a Satisfacción! Verificado por ${adminUser?.fullName || 'Administrador'} ✅`,
              eta: 'Entrega finalizada',
              paymentStatus: 'PAID',
              adminResponsible: adminLabel,
            }
          : o
      )
    );
    await refreshAll();
  };

  // Actualizar stock de un producto con trazabilidad
  const updateStock = async (productId: string, newStock: number) => {
    const safeStock = Math.max(0, newStock);
    const prod = products.find(p => p.id === productId);

    setProducts(prev =>
      prev.map(p => (p.id === productId ? { ...p, stock: safeStock } : p))
    );
    await updateProductStockInDb(productId, safeStock);

    await logAdminActivity({
      adminId: adminUser?.id,
      adminEmail: adminUser?.email || 'admin@einuushi.com',
      adminName: adminUser?.fullName || 'Administrador',
      actionType: 'STOCK_UPDATE',
      entityType: 'PRODUCTO',
      entityId: productId,
      details: `${adminUser?.fullName || 'Administrador'} ajustó el inventario de "${prod?.name || productId}" a ${safeStock} unidades.`,
    });
    await refreshAll();
  };

  // Activar o modificar porcentaje de descuento con trazabilidad
  const toggleDiscount = async (productId: string, percent: number, isActive: boolean) => {
    const prod = products.find(p => p.id === productId);
    setProducts(prev =>
      prev.map(p =>
        p.id === productId
          ? { ...p, discountPercent: percent, isDiscountActive: isActive ? 1 : 0 }
          : p
      )
    );
    await updateProduct(productId, {
      discountPercent: percent,
      isDiscountActive: isActive ? 1 : 0,
    });

    await logAdminActivity({
      adminId: adminUser?.id,
      adminEmail: adminUser?.email || 'admin@einuushi.com',
      adminName: adminUser?.fullName || 'Administrador',
      actionType: 'DISCOUNT_CHANGE',
      entityType: 'PRODUCTO',
      entityId: productId,
      details: isActive
        ? `${adminUser?.fullName || 'Administrador'} activó descuento del ${percent}% en "${prod?.name || productId}".`
        : `${adminUser?.fullName || 'Administrador'} desactivó el descuento en "${prod?.name || productId}".`,
    });
    await refreshAll();
  };

  // Crear producto nuevo con trazabilidad
  const addProduct = async (productData: Omit<Product, 'id' | 'likes'> & { id?: string }) => {
    const newProd = await createProduct(productData);
    setProducts(prev => [newProd, ...prev]);

    await logAdminActivity({
      adminId: adminUser?.id,
      adminEmail: adminUser?.email || 'admin@einuushi.com',
      adminName: adminUser?.fullName || 'Administrador',
      actionType: 'PRODUCT_CREATE',
      entityType: 'PRODUCTO',
      entityId: newProd.id,
      details: `${adminUser?.fullName || 'Administrador'} añadió la nueva artesanía "${newProd.name}" ($ ${newProd.priceValue.toLocaleString('es-CO')} COP).`,
    });
    await refreshAll();
    return newProd;
  };

  // Crear nueva categoría
  const addCategory = async (categoryData: Omit<Category, 'id'> & { id?: string }) => {
    const newCat = await createCategory(categoryData);
    setCategories(prev => [...prev, newCat]);
    return newCat;
  };

  // Eliminar producto con trazabilidad
  const removeProduct = async (productId: string) => {
    const prod = products.find(p => p.id === productId);
    setProducts(prev => prev.filter(p => p.id !== productId));
    await deleteProduct(productId);

    await logAdminActivity({
      adminId: adminUser?.id,
      adminEmail: adminUser?.email || 'admin@einuushi.com',
      adminName: adminUser?.fullName || 'Administrador',
      actionType: 'PRODUCT_DELETE',
      entityType: 'PRODUCTO',
      entityId: productId,
      details: `${adminUser?.fullName || 'Administrador'} eliminó la artesanía "${prod?.name || productId}" del catálogo.`,
    });
    await refreshAll();
  };

  // Inactivar / Activar producto
  const toggleProductActive = async (productId: string, isActive: number) => {
    const prod = products.find(p => p.id === productId);
    setProducts(prev =>
      prev.map(p => (p.id === productId ? { ...p, isActive } : p))
    );
    await updateProduct(productId, { isActive });

    await logAdminActivity({
      adminId: adminUser?.id,
      adminEmail: adminUser?.email || 'admin@einuushi.com',
      adminName: adminUser?.fullName || 'Administrador',
      actionType: 'PRODUCT_EDIT',
      entityType: 'PRODUCTO',
      entityId: productId,
      details: `${adminUser?.fullName || 'Administrador'} ${isActive === 1 ? 'activó' : 'pausó'} la visualización de "${prod?.name || productId}".`,
    });
    await refreshAll();
  };

  // Actualizar foto de un producto existente con trazabilidad
  const updateProductPhoto = async (productId: string, imagePath: string, imageName?: string) => {
    const prod = products.find(p => p.id === productId);
    setProducts(prev =>
      prev.map(p =>
        p.id === productId
          ? { ...p, imagePath, ...(imageName ? { imageName } : {}) }
          : p
      )
    );
    await updateProduct(productId, {
      imagePath,
      ...(imageName ? { imageName } : {}),
    });

    await logAdminActivity({
      adminId: adminUser?.id,
      adminEmail: adminUser?.email || 'admin@einuushi.com',
      adminName: adminUser?.fullName || 'Administrador',
      actionType: 'PHOTO_UPDATE',
      entityType: 'PRODUCTO',
      entityId: productId,
      details: `${adminUser?.fullName || 'Administrador'} subió una nueva fotografía oficial para "${prod?.name || productId}".`,
    });
    await refreshAll();
  };

  // Modificar información completa de un artículo existente con trazabilidad
  const editProduct = async (productId: string, updates: Partial<Product>) => {
    setProducts(prev =>
      prev.map(p => (p.id === productId ? { ...p, ...updates } : p))
    );
    const updated = await updateProduct(productId, updates);

    await logAdminActivity({
      adminId: adminUser?.id,
      adminEmail: adminUser?.email || 'admin@einuushi.com',
      adminName: adminUser?.fullName || 'Administrador',
      actionType: 'PRODUCT_EDIT',
      entityType: 'PRODUCTO',
      entityId: productId,
      details: `${adminUser?.fullName || 'Administrador'} editó datos y especificaciones de "${updates.name || productId}".`,
    });
    await refreshAll();
    return updated;
  };

  // Responder a una cotización de diseño de cliente con trazabilidad
  const respondQuote = async (
    quoteId: string,
    quotedPrice: number,
    quotedDeliveryDays: number,
    adminNotes: string
  ) => {
    const adminLabel = adminUser ? `${adminUser.fullName} (${adminUser.email})` : 'Administrador';
    const finalNotes = `[Atendido por: ${adminLabel}] ${adminNotes}`;

    const updated = await updateCustomQuote(quoteId, {
      status: 'QUOTED',
      quotedPrice,
      quotedDeliveryDays,
      adminNotes: finalNotes,
    });
    setQuotes(prev => prev.map(q => (q.id === quoteId ? updated : q)));

    // Enviar mensaje en el chat informando al cliente
    await sendChatMessage({
      userId: updated.userId,
      userEmail: updated.userEmail,
      userName: `Taller Einuushi (${adminUser?.fullName || 'Artesana Maestra'})`,
      senderRole: 'admin',
      message: `✨ ¡Hola ${updated.userName}! He revisado tu diseño personalizado (${updated.designType}). El valor estimado de elaboración es de $ ${quotedPrice.toLocaleString('es-CO')} COP con un tiempo de tejido de ${quotedDeliveryDays} días. Observaciones: "${adminNotes}".`,
      quoteId: updated.id,
    });

    await logAdminActivity({
      adminId: adminUser?.id,
      adminEmail: adminUser?.email || 'admin@einuushi.com',
      adminName: adminUser?.fullName || 'Administrador',
      actionType: 'QUOTE_RESPONSE',
      entityType: 'COTIZACION',
      entityId: quoteId,
      details: `${adminUser?.fullName || 'Administrador'} cotizó el requerimiento #${quoteId} del cliente ${updated.userName} en $ ${quotedPrice.toLocaleString('es-CO')} COP (${quotedDeliveryDays} días).`,
    });

    await refreshAll();
  };

  // Enviar mensaje de chat con trazabilidad
  const sendMessage = async (
    userEmail: string,
    userName: string,
    messageText: string,
    quoteId?: string
  ) => {
    const adminNameSender = adminUser?.fullName ? `${adminUser.fullName} (Admin)` : 'Administrador Einuushi';
    const newMsg = await sendChatMessage({
      userEmail,
      userName: adminNameSender,
      senderRole: 'admin',
      message: messageText,
      quoteId,
    });
    setMessages(prev => [...prev, newMsg]);

    await logAdminActivity({
      adminId: adminUser?.id,
      adminEmail: adminUser?.email || 'admin@einuushi.com',
      adminName: adminUser?.fullName || 'Administrador',
      actionType: 'CHAT_MESSAGE',
      entityType: 'CHAT',
      entityId: userEmail,
      details: `${adminUser?.fullName || 'Administrador'} respondió mensaje en vivo a ${userName} (${userEmail}).`,
    });
  };

  // Marcar chat como leído
  const markChatRead = async (userEmail: string) => {
    await markChatMessagesAsRead(userEmail, 'admin');
    setMessages(prev =>
      prev.map(m =>
        m.userEmail.toLowerCase() === userEmail.toLowerCase() ? { ...m, read: 1 } : m
      )
    );
  };

  // Actualizar datos propios del administrador (nombre, teléfono, email, contraseña)
  const updateAdminProfile = async (updates: {
    fullName?: string;
    phone?: string;
    email?: string;
    password?: string;
    city?: string;
  }) => {
    if (!adminUser) return { success: false, message: 'No hay sesión de administrador activa.' };
    const res = await dbUpdateAdminProfile(
      adminUser.id,
      adminUser.email,
      updates,
      { email: adminUser.email, name: adminUser.fullName, role: adminUser.role, id: adminUser.id }
    );
    if (res.success && res.user) {
      setAdminUser(res.user);
      await refreshAll();
    }
    return res;
  };

  // Crear un nuevo usuario administrador con plenos privilegios
  const createAdminUser = async (newAdmin: {
    fullName: string;
    cedula?: string;
    email: string;
    phone: string;
    password: string;
    city?: string;
  }) => {
    if (!adminUser) return { success: false, message: 'No hay sesión de administrador activa.' };
    const res = await dbCreateAdminUser(newAdmin, {
      email: adminUser.email,
      name: adminUser.fullName,
      role: adminUser.role,
      id: adminUser.id,
    });
    if (res.success) {
      await refreshAll();
    }
    return res;
  };

  // Reasignar contraseña a otro administrador (Exclusivo Superadministrador)
  const changeAdminPassword = async (targetAdminId: string, targetAdminEmail: string, newPassword: string) => {
    if (!adminUser) return { success: false, message: 'No hay sesión de administrador activa.' };
    const res = await changeAdminPasswordBySuperAdmin(targetAdminId, targetAdminEmail, newPassword, {
      email: adminUser.email,
      name: adminUser.fullName,
      role: adminUser.role,
      id: adminUser.id,
    });
    if (res.success) {
      await refreshAll();
    }
    return res;
  };

  // Solicitar código de recuperación de contraseña para administradores
  const requestAdminPasswordRecovery = async (email: string): Promise<{ success: boolean; code?: string; message?: string }> => {
    const normEmail = email.trim().toLowerCase();
    const user = await findUserByEmail(normEmail);
    const isEligibleAdmin = user && (user.role === 'admin' || user.role === 'superadmin' || normEmail === 'admin@einuushi.com');

    if (!user || !isEligibleAdmin) {
      return {
        success: false,
        message: `El correo "${email}" no corresponde a ninguna cuenta de administrador registrada en el sistema.`,
      };
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const sent = await sendRecoveryCodeEmail(normEmail, code, user.fullName || 'Administrador');

    return {
      success: true,
      code,
      message: sent
        ? `Se ha enviado un código de seguridad a ${normEmail}. Vigencia de 1 minuto.`
        : `Se generó el código de seguridad para ${normEmail}.`,
    };
  };

  // Restablecer contraseña administrativa usando el código verificado
  const verifyAndResetAdminPassword = async (email: string, newPassword: string) => {
    const normEmail = email.trim().toLowerCase();
    const res = await updatePassword(normEmail, newPassword);
    if (res.success) {
      await logAdminActivity({
        adminEmail: normEmail,
        adminName: 'Administrador (Recuperación)',
        actionType: 'ADMIN_PASSWORD_RESET',
        entityType: 'SEGURIDAD',
        entityId: normEmail,
        details: `El administrador con correo ${normEmail} restableció exitosamente su contraseña de acceso mediante verificación por correo.`,
      });
      await refreshAll();
    }
    return res;
  };

  const isSuper = isSuperAdmin(adminUser);

  return {
    adminUser,
    isAuthenticated: !!adminUser && (adminUser.role === 'admin' || adminUser.role === 'superadmin' || isSuper),
    isSuperAdmin: isSuper,
    isLoading,
    isRefreshing,
    orders,
    products,
    categories,
    quotes,
    messages,
    users: usersList,
    adminUsers,
    activityLogs,
    analytics,
    activeTrackingOrder,
    setActiveTrackingOrder,
    login,
    logout,
    refreshAll,
    confirmPayment,
    dispatchOrder,
    markOrderDelivered,
    updateStock,
    toggleDiscount,
    addProduct,
    addCategory,
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
  };
}

