import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { supabase, isSupabaseConfigured, uploadMediaToSupabase } from "./supabase";

// Limpieza automática preventiva de claves obsoletas pesadas de AsyncStorage (elimina error SQLITE_FULL)
(async () => {
  try {
    const legacyBloatedKeys = [
      "@einuushi_users_db_v1",
      "@einuushi_orders_db_v1",
      "@einuushi_products_db_v1",
      "@einuushi_custom_quotes_v1",
      "@einuushi_chat_messages_v1",
      "@einuushi_categories_db_v1",
      "@einuushi_notifications_db_v1",
      "einuushi_deleted_products",
    ];
    await AsyncStorage.multiRemove(legacyBloatedKeys);
  } catch (_) {}
})();

/**
 * =========================================================================
 * TIPOS Y MODELOS OFICIALES DE EINUUSHI (100% ALINEADOS CON SUPABASE)
 * =========================================================================
 */

export interface User {
  id: string;
  fullName: string;
  cedula: string;
  email: string;
  phone: string;
  city: string;
  password: string;
  role?: "client" | "admin" | "superadmin" | "driver";
  avatar?: string;
  createdAt: string;
  // Propiedades especializadas para Repartidores y Empresas de Envíos
  driverType?: "individual" | "corporate"; // individual (repartidor en moto/bici) | corporate (empresa transportadora)
  companyName?: string; // Nombre corporativo (ej. Servientrega, DHL, Coordinadora, FedEx)
  vehicleType?: string; // Ej: Motocicleta Yamaha XTZ 125, Bicicleta de carga, Camión, Encomiendas aéreas
  plateOrNit?: string; // Placa de rodamiento o NIT de la empresa
  carrierTrackingUrl?: string; // Portal de rastreo web corporativo
  isActive?: boolean;
}

export interface EmailConfig {
  serviceId: string;
  templateId: string;
  publicKey: string;
}

export interface OrderItem {
  id: string;
  name: string;
  priceValue: number;
  cartQuantity: number;
  category?: string;
}

export interface Order {
  id: string;
  userId?: string;
  userEmail?: string;
  clientName?: string;
  date: string;
  client: {
    name: string;
    cedula: string;
    phone: string;
    address: string;
    payment: string;
  };
  city?: string;
  country?: string;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  total: number;
  status: string;
  statusCode: string; // 'PENDING' | 'DISPATCHED' | 'ARRIVED' | 'DELIVERED'
  paymentStatus: string; // 'PENDING' | 'PAID'
  eta: string;
  rating: number;
  dispatchedAt?: number;
  receivedAt?: string;
  adminResponsible?: string; // Trazabilidad del administrador a cargo
  settlementStatus?: 'PENDING_SETTLEMENT' | 'SETTLED' | 'NOT_APPLICABLE'; // Paz y salvo de caja
  settledAt?: string; // Fecha y hora en que la tienda recibió el dinero o verificó transferencia
  settledBy?: string; // Administrador que dio Paz y Salvo
  settlementMethod?: 'EFECTIVO_EN_TIENDA' | 'TRANSFERENCIA_TIENDA'; // Medio de liquidación con tienda
  transferReference?: string; // Número de transferencia / comprobante
  driverName?: string; // Repartidor responsable (ej: José Guajiro)
  driverId?: string; // ID del usuario repartidor o transportadora
  driverEmail?: string; // Correo de la cuenta del repartidor
  driverPhone?: string; // Teléfono de contacto del repartidor
  driverType?: 'individual' | 'corporate'; // individual (repartidor) | corporate (transportadora)
  vehicleType?: string; // Tipo de vehículo (Moto, Carro, etc.)
  plateOrNit?: string; // Placa de vehículo o NIT corporativo
  trackingGuideNumber?: string; // Número de guía de envío de la transportadora
  carrierTrackingUrl?: string; // Enlace web de rastreo del paquete
  deliveryEvidencePhoto?: string; // Foto de evidencia tomada por el repartidor al entregar
  driverCollectionEvidence?: string; // Nota/evidencia de cobro tomada por el repartidor
  settlementNotes?: string; // Nota o evidencia de pago
}

export interface AdminActivityLog {
  id: string;
  adminId?: string;
  adminEmail: string;
  adminName: string;
  actionType: string;
  entityType: string;
  entityId?: string;
  details: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  orderId: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
}

export interface Category {
  id: string; // 'Mochilas', 'Mantas', etc.
  name: string;
  icon: string;
  description?: string;
}

export interface Product {
  id: string;
  name: string;
  categoryId: string;
  priceValue: number;
  price: string;
  icon: string;
  imagePath?: string | null;
  imageName?: string | null;
  ancestralRef: string;
  stock: number;
  likes: number;
  discountPercent?: number;
  isDiscountActive?: number; // 0 = inactivo, 1 = activo
  isActive?: number; // 0 = inactivo, 1 = activo
}

export interface CustomQuote {
  id: string;
  userId?: string;
  userEmail: string;
  userName: string;
  clientPhone?: string;
  designType: string;
  colorsJson?: string;
  pattern?: string;
  prompt: string;
  imageUrl?: string;
  status: "PENDING_QUOTE" | "QUOTED" | "ACCEPTED" | "REJECTED";
  quotedPrice?: number;
  quotedDeliveryDays?: number;
  adminNotes?: string;
  orderId?: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  userId?: string;
  userEmail: string;
  userName: string;
  senderRole: "client" | "admin";
  message: string;
  quoteId?: string;
  createdAt: string;
  read?: number;
}

export interface StoreAnalytics {
  totalRevenue: number;
  totalOrders: number;
  pendingOrders: number;
  dispatchedOrders: number;
  deliveredOrders: number;
  settledRevenue: number; // Ventas en Paz y Salvo (recibidas en tienda o cuenta bancaria)
  pendingSettlementRevenue: number; // Dinero en poder de los repartidores (pendiente Paz y Salvo en tienda)
  pendingSettlementCount: number; // Cantidad de pedidos pendientes de liquidar
  totalClients: number;
  totalProducts: number;
  topSellingProducts: Array<{
    id: string;
    name: string;
    category: string;
    categoryId: string;
    unitsSold: number;
    totalSold: number;
    revenue: number;
  }>;
  topSpendingClients: Array<{
    name: string;
    email: string;
    phone: string;
    city: string;
    totalOrders: number;
    totalSpent: number;
    lastOrderDate: string;
  }>;
  topRatedProducts: Array<{
    id: string;
    name: string;
    categoryId: string;
    likes: number;
    stock: number;
  }>;
  topRatedOrders: Array<Order>;
  discountedProducts: Array<{
    id: string;
    name: string;
    categoryId: string;
    discountPercent: number;
    priceValue: number;
    discountedPrice: number;
  }>;
}

// Claves de sesión ligera (sólo tokens / usuario activo, NUNCA binarios pesados para evitar SQLITE_FULL)
const SESSION_STORAGE_KEY = "@einuushi_active_session_v2";
const ADMIN_SESSION_STORAGE_KEY = "@einuushi_admin_session_v2";

export const DEFAULT_EMAIL_CONFIG: EmailConfig = {
  serviceId: "service_vmuqrwm",
  templateId: "template_av14rue",
  publicKey: "OsViJ6P2M_ebWewhr",
};

export async function getEmailConfig(): Promise<EmailConfig> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.from('email_config').select('*').limit(1).maybeSingle();
      if (!error && data) {
        return {
          serviceId: data.service_id,
          templateId: data.template_id,
          publicKey: data.public_key,
        };
      }
    } catch (_) {}
  }
  return DEFAULT_EMAIL_CONFIG;
}

export const INITIAL_CATEGORIES_DATA: Category[] = [
  {
    id: "Mochilas",
    name: "Mochilas",
    icon: "bag-handle-outline",
    description: "Mochilas tejidas a mano por mujeres wayuu con hilo de algodón."
  },
  {
    id: "Mantas",
    name: "Mantas",
    icon: "shirt-outline",
    description: "Vestimenta sagrada de gran fluidez, usada en rituales y danzas."
  },
  {
    id: "Chinchorros",
    name: "Chinchorros",
    icon: "git-commit-outline",
    description: "Hamaca ceremonial tejida a mano, símbolo de estatus y descanso."
  },
  {
    id: "Accesorios",
    name: "Accesorios",
    icon: "color-palette-outline",
    description: "Sombreros de zwele y detalles ancestrales para el sol guajiro."
  }
];

export const INITIAL_PRODUCTS_DATA: Product[] = [
  {
    id: "CHINCHORRO_INIT",
    name: "CHINCHORRO",
    categoryId: "Chinchorros",
    priceValue: 550000,
    price: "$ 550.000 COP",
    icon: "sparkles-outline",
    imagePath: "https://ismvmlcemxkawdwextzk.supabase.co/storage/v1/object/public/einuushi-media/crafts/chinchorro1.jpg",
    imageName: "chinchorro",
    ancestralRef: "Tejido ceremonial wayuu",
    stock: 2,
    likes: 0,
    discountPercent: 0,
    isDiscountActive: 0,
    isActive: 1
  }
];

const INITIAL_USERS: User[] = [
  {
    id: "USR-ADMIN-01",
    fullName: "Administrador Einuushi",
    cedula: "1124000000",
    email: "admin@einuushi.com",
    phone: "3009998877",
    city: "Riohacha",
    password: "admin2026",
    role: "superadmin",
    createdAt: new Date().toISOString(),
  },
];

// Memoria volátil en ejecución para sincronización ultrarrápida
let memoryUsers: User[] = [...INITIAL_USERS];
let memoryProducts: Product[] = [...INITIAL_PRODUCTS_DATA];
let memoryCategories: Category[] = [...INITIAL_CATEGORIES_DATA];
let memoryOrders: Order[] = [];
let memoryNotifications: AppNotification[] = [];
let memoryQuotes: CustomQuote[] = [];
let memoryChat: ChatMessage[] = [];
let memoryAdminLogs: AdminActivityLog[] = [];
let memoryFavorites: Map<string, Set<string>> = new Map();
const ADMIN_LOGS_STORAGE_KEY = '@einuushi_admin_logs_v1';

export function notifyDatabaseChange() {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('einuushi_db_updated'));
    }
  } catch (_) {}
}

export function ensureUsersAvatarColumn() {
  // No-op para compatibilidad
}

/**
 * =========================================================================
 * 1. MÓDULO DE USUARIOS (100% SUPABASE)
 * =========================================================================
 */

export async function getUsers(): Promise<User[]> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.from('users').select('*');
      if (!error && Array.isArray(data) && data.length > 0) {
        const mappedUsers: User[] = data.map((u: any) => ({
          id: u.id,
          fullName: u.full_name,
          cedula: u.cedula,
          email: u.email,
          phone: u.phone,
          city: u.city,
          password: u.password,
          role: (u.role === 'superadmin' || u.id === 'USR-ADMIN-01' || u.email?.toLowerCase() === 'admin@einuushi.com')
            ? ('superadmin' as const)
            : ((u.role as "client" | "admin" | "superadmin" | "driver") || "client"),
          avatar: u.avatar || undefined,
          driverType: u.driver_type || (u.company_name ? 'corporate' : 'individual'),
          companyName: u.company_name || undefined,
          vehicleType: u.vehicle_type || undefined,
          plateOrNit: u.plate_or_nit || undefined,
          carrierTrackingUrl: u.carrier_tracking_url || undefined,
          isActive: u.is_active !== undefined ? u.is_active : true,
          createdAt: u.created_at || new Date().toISOString(),
        }));
        
        // Mantener presentes los usuarios y repartidores semilla esenciales si aún no están en Supabase
        const existingEmails = new Set(mappedUsers.map(u => u.email.toLowerCase()));
        const missingSeeds = INITIAL_USERS.filter(seed => !existingEmails.has(seed.email.toLowerCase()));
        
        const combined = [...mappedUsers, ...missingSeeds];
        memoryUsers = combined;
        return combined;
      }
    } catch (_) {}
  }
  return memoryUsers;
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const normEmail = email.trim().toLowerCase();

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', normEmail)
        .maybeSingle();

      if (!error && data) {
        return {
          id: data.id,
          fullName: data.full_name,
          cedula: data.cedula,
          email: data.email,
          phone: data.phone,
          city: data.city,
          password: data.password,
          role: (data.role === 'superadmin' || data.id === 'USR-ADMIN-01' || data.email?.toLowerCase() === 'admin@einuushi.com')
            ? ('superadmin' as const)
            : ((data.role as "client" | "admin" | "superadmin") || "client"),
          avatar: data.avatar || undefined,
          createdAt: data.created_at || new Date().toISOString(),
        };
      }
    } catch (_) {}
  }

  const all = await getUsers();
  return all.find(u => u.email.trim().toLowerCase() === normEmail) || null;
}

export async function registerUser(
  userData: Omit<User, "id" | "createdAt" | "role">,
): Promise<{ success: boolean; user?: User; message?: string }> {
  try {
    const normalizedEmail = userData.email.trim().toLowerCase();
    const existing = await findUserByEmail(normalizedEmail);
    if (existing) {
      return {
        success: false,
        message: "Ya existe una cuenta registrada con este correo electrónico.",
      };
    }

    const nextId = `USR-${Date.now()}`;
    let finalAvatar = userData.avatar;

    // Subir imagen a Supabase Storage
    if (finalAvatar && !finalAvatar.startsWith('http') && isSupabaseConfigured()) {
      try {
        finalAvatar = await uploadMediaToSupabase(finalAvatar, 'avatars', nextId);
      } catch (_) {}
    }

    const newUser: User = {
      ...userData,
      id: nextId,
      email: normalizedEmail,
      avatar: finalAvatar,
      role: "client",
      createdAt: new Date().toISOString(),
    };

    if (isSupabaseConfigured()) {
      const { error } = await supabase.from('users').insert({
        id: newUser.id,
        full_name: newUser.fullName,
        cedula: newUser.cedula,
        email: newUser.email,
        phone: newUser.phone,
        city: newUser.city,
        password: newUser.password,
        role: 'client',
        avatar: newUser.avatar || null,
        created_at: newUser.createdAt,
      });
      if (error) {
        return { success: false, message: error.message };
      }
    }

    memoryUsers = [newUser, ...memoryUsers.filter(u => u.email !== normalizedEmail)];
    notifyDatabaseChange();

    return { success: true, user: newUser };
  } catch (err: any) {
    return { success: false, message: err.message || "Error al registrar usuario." };
  }
}

export async function authenticateUser(
  email: string,
  password: string,
): Promise<{ success: boolean; user?: User; message?: string }> {
  const user = await findUserByEmail(email);
  if (!user) {
    return {
      success: false,
      message: "No existe una cuenta registrada con este correo electrónico.",
    };
  }

  if (user.password !== password) {
    return {
      success: false,
      message: "La contraseña ingresada es incorrecta. Por favor verifica tus datos.",
    };
  }

  return { success: true, user };
}

export async function updatePassword(
  email: string,
  newPassword: string,
): Promise<{ success: boolean; message?: string }> {
  const normEmail = email.trim().toLowerCase();
  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase
        .from('users')
        .update({ password: newPassword })
        .eq('email', normEmail);
      if (error) return { success: false, message: error.message };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  memoryUsers = memoryUsers.map(u => 
    u.email.toLowerCase() === normEmail ? { ...u, password: newPassword } : u
  );
  return { success: true };
}

export async function updateUserProfile(
  userEmail: string,
  updates: {
    fullName?: string;
    cedula?: string;
    phone?: string;
    city?: string;
    password?: string;
    avatar?: string;
  }
): Promise<{ success: boolean; user?: User; message?: string }> {
  try {
    const normalizedEmail = userEmail.trim().toLowerCase();
    const existing = await findUserByEmail(normalizedEmail);

    let finalAvatar = updates.avatar;
    if (finalAvatar && !finalAvatar.startsWith('http') && isSupabaseConfigured()) {
      try {
        finalAvatar = await uploadMediaToSupabase(
          finalAvatar,
          'avatars',
          `avatar_${normalizedEmail.replace(/[^a-zA-Z0-9]/g, '_')}`
        );
      } catch (_) {}
    }

    const updatedUser: User = {
      id: existing?.id || `USR-${Date.now()}`,
      fullName: updates.fullName?.trim() || existing?.fullName || 'Cliente Einuushi',
      cedula: updates.cedula?.trim() || existing?.cedula || '',
      email: normalizedEmail,
      phone: updates.phone?.trim() || existing?.phone || '',
      city: updates.city?.trim() || existing?.city || 'Riohacha',
      password: updates.password?.trim() || existing?.password || '123456',
      role: existing?.role || 'client',
      avatar: finalAvatar !== undefined ? finalAvatar : existing?.avatar,
      createdAt: existing?.createdAt || new Date().toISOString(),
    };

    if (isSupabaseConfigured()) {
      await supabase.from('users').upsert({
        id: updatedUser.id,
        full_name: updatedUser.fullName,
        cedula: updatedUser.cedula,
        email: updatedUser.email,
        phone: updatedUser.phone,
        city: updatedUser.city,
        password: updatedUser.password,
        role: updatedUser.role,
        avatar: updatedUser.avatar || null,
      });
    }

    memoryUsers = [updatedUser, ...memoryUsers.filter(u => u.email.toLowerCase() !== normalizedEmail)];
    await saveSessionUser(updatedUser);
    notifyDatabaseChange();

    return { success: true, user: updatedUser };
  } catch (err: any) {
    return { success: false, message: err.message || "Error al actualizar perfil." };
  }
}

/**
 * =========================================================================
 * 2. MÓDULO DE SESIÓN (LIVIANO, SÓLO TOKEN/ID EN ASYNCSTORAGE)
 * =========================================================================
 */

export async function saveSessionUser(user: User): Promise<void> {
  try {
    const safeSession = {
      id: user.id,
      fullName: user.fullName,
      cedula: user.cedula,
      email: user.email,
      phone: user.phone,
      city: user.city,
      role: user.role,
      avatar: user.avatar && user.avatar.startsWith('http') ? user.avatar : undefined,
    };
    await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(safeSession));

    // Garantizar persistencia inmediata en Supabase
    if (isSupabaseConfigured() && user.email) {
      try {
        await supabase.from('users').upsert({
          id: user.id,
          full_name: user.fullName,
          cedula: user.cedula || '',
          email: user.email.trim().toLowerCase(),
          phone: user.phone || '',
          city: user.city || 'Riohacha',
          password: user.password || 'einuushi2026',
          role: user.role || 'client',
          avatar: user.avatar && user.avatar.startsWith('http') ? user.avatar : null,
        });
      } catch (_) {}
    }
  } catch (_) {}
}

export async function getSessionUser(): Promise<User | null> {
  try {
    let raw = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      raw = await AsyncStorage.getItem("@einuushi_active_session_v1");
    }
    if (!raw) return null;
    const basic = JSON.parse(raw);
    if (!basic?.email) return null;

    const cloudUser = await findUserByEmail(basic.email);
    if (cloudUser) {
      return cloudUser;
    }

    // Si el usuario existe en sesión local de la app móvil pero aún no en Supabase, registrarlo de inmediato
    if (isSupabaseConfigured() && basic.email) {
      try {
        const fallbackUser: User = {
          id: basic.id || `USR-${Date.now()}`,
          fullName: basic.fullName || 'Cliente Einuushi',
          cedula: basic.cedula || '',
          email: basic.email.trim().toLowerCase(),
          phone: basic.phone || '',
          city: basic.city || 'Riohacha',
          password: basic.password || 'einuushi2026',
          role: basic.role || 'client',
          avatar: basic.avatar && basic.avatar.startsWith('http') ? basic.avatar : undefined,
          createdAt: new Date().toISOString(),
        };

        await supabase.from('users').upsert({
          id: fallbackUser.id,
          full_name: fallbackUser.fullName,
          cedula: fallbackUser.cedula,
          email: fallbackUser.email,
          phone: fallbackUser.phone,
          city: fallbackUser.city,
          password: fallbackUser.password,
          role: fallbackUser.role,
          avatar: fallbackUser.avatar || null,
        });

        return fallbackUser;
      } catch (_) {}
    }

    return basic;
  } catch {
    return null;
  }
}

export async function clearSessionUser(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (_) {}
}

export function isSuperAdmin(user?: { email?: string; role?: string; id?: string } | null): boolean {
  if (!user) return false;
  const email = (user.email || '').trim().toLowerCase();
  const role = (user.role || '').trim().toLowerCase();
  const id = (user.id || '').trim();
  return role === 'superadmin' || id === 'USR-ADMIN-01' || email === 'admin@einuushi.com';
}

export async function saveAdminSession(adminUser: User): Promise<void> {
  try {
    const isSuper = isSuperAdmin(adminUser);
    const safeAdmin = {
      id: adminUser.id,
      fullName: adminUser.fullName,
      email: adminUser.email,
      role: isSuper ? 'superadmin' : (adminUser.role || 'admin'),
    };
    await AsyncStorage.setItem(ADMIN_SESSION_STORAGE_KEY, JSON.stringify(safeAdmin));
  } catch (_) {}
}

export async function getAdminSession(): Promise<User | null> {
  try {
    const raw = await AsyncStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const isSuper = isSuperAdmin(parsed);
    const isValid = parsed?.role === 'admin' || parsed?.role === 'superadmin' || isSuper;
    if (isValid && isSuper && parsed.role !== 'superadmin') {
      parsed.role = 'superadmin';
    }
    return isValid ? parsed : null;
  } catch {
    return null;
  }
}

export async function clearAdminSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
  } catch (_) {}
}

export async function authenticateAdmin(
  email: string,
  password: string,
): Promise<{ success: boolean; user?: User; message?: string }> {
  const normEmail = email.trim().toLowerCase();
  const user = await findUserByEmail(normEmail);

  const isSuper = isSuperAdmin(user) || normEmail === 'admin@einuushi.com';
  const isAdmin = user && (user.role === 'admin' || user.role === 'superadmin' || isSuper);

  if (!user || (!isAdmin && !isSuper)) {
    if (normEmail === 'admin@einuushi.com' && password === 'admin2026') {
      const fallbackAdmin: User = {
        ...INITIAL_USERS[0],
        role: 'superadmin',
      };
      await saveAdminSession(fallbackAdmin);
      return { success: true, user: fallbackAdmin };
    }
    return {
      success: false,
      message: 'Acceso denegado: este correo no tiene permisos de administrador.',
    };
  }

  if (user.password !== password) {
    return { success: false, message: 'Contraseña de administrador incorrecta.' };
  }

  const effectiveUser: User = {
    ...user,
    role: isSuper ? 'superadmin' : 'admin',
  };

  await saveAdminSession(effectiveUser);
  return { success: true, user: effectiveUser };
}

/**
 * =========================================================================
 * 3. MÓDULO DE PEDIDOS (100% SUPABASE)
 * =========================================================================
 */

export async function getOrders(filterUserEmail?: string): Promise<Order[]> {
  if (isSupabaseConfigured()) {
    try {
      let query = supabase.from('orders').select('*').order('created_at', { ascending: false });
      if (filterUserEmail) {
        query = query.eq('user_email', filterUserEmail.trim().toLowerCase());
      }
      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        const mappedOrders: Order[] = data.map((r: any) => ({
          id: r.id,
          userId: r.user_id || undefined,
          userEmail: r.user_email || undefined,
          clientName: r.client_name,
          date: r.date,
          client: {
            name: r.client_name,
            cedula: r.client_cedula,
            phone: r.client_phone,
            address: r.client_address,
            payment: r.payment_method,
          },
          subtotal: r.subtotal,
          shipping: r.shipping,
          total: r.total,
          status: r.status,
          statusCode: r.status_code,
          paymentStatus: r.payment_status || 'PENDING',
          eta: r.eta,
          rating: r.rating || 0,
          items: typeof r.items_json === 'string' ? JSON.parse(r.items_json) : (r.items_json || []),
          dispatchedAt: r.dispatched_at || undefined,
          receivedAt: r.received_at || undefined,
          adminResponsible: r.admin_responsible || undefined,
          settlementStatus: r.settlement_status || (
            (r.payment_method && (r.payment_method.toLowerCase().includes('contra') || r.payment_method.toLowerCase().includes('efectivo')))
              ? (r.status_code === 'DELIVERED' && r.settled_at ? 'SETTLED' : 'PENDING_SETTLEMENT')
              : 'SETTLED'
          ),
          settledAt: r.settled_at || undefined,
          settledBy: r.settled_by || undefined,
          settlementMethod: r.settlement_method || undefined,
          transferReference: r.transfer_reference || undefined,
          driverName: r.driver_name || undefined,
          driverId: r.driver_id || undefined,
          driverEmail: r.driver_email || undefined,
          driverPhone: r.driver_phone || undefined,
          driverType: r.driver_type || (r.carrier_tracking_url ? 'corporate' : (r.driver_name ? 'individual' : undefined)),
          vehicleType: r.vehicle_type || undefined,
          plateOrNit: r.plate_or_nit || undefined,
          trackingGuideNumber: r.tracking_guide_number || undefined,
          carrierTrackingUrl: r.carrier_tracking_url || undefined,
          deliveryEvidencePhoto: r.delivery_evidence_photo || undefined,
          driverCollectionEvidence: r.driver_collection_evidence || undefined,
          settlementNotes: r.settlement_notes || undefined,
        }));
        memoryOrders = mappedOrders;
        return mappedOrders;
      }
    } catch (_) {}
  }

  if (filterUserEmail) {
    const norm = filterUserEmail.trim().toLowerCase();
    return memoryOrders.filter(o => o.userEmail?.toLowerCase() === norm);
  }
  return memoryOrders;
}

export async function saveOrder(order: Order): Promise<void> {
  if (isSupabaseConfigured()) {
    try {
      const supaPayload: any = {
        id: order.id,
        user_id: order.userId || null,
        user_email: order.userEmail || null,
        date: order.date,
        client_name: order.client.name,
        client_cedula: order.client.cedula,
        client_phone: order.client.phone,
        client_address: order.client.address,
        payment_method: order.client.payment,
        payment_status: order.paymentStatus || 'PENDING',
        subtotal: order.subtotal,
        shipping: order.shipping,
        total: order.total,
        status: order.status,
        status_code: order.statusCode,
        eta: order.eta,
        rating: order.rating || 0,
        items_json: order.items,
        dispatched_at: order.dispatchedAt || null,
        received_at: order.receivedAt || null,
        admin_responsible: order.adminResponsible || null,
        settlement_status: order.settlementStatus || null,
        settled_at: order.settledAt || null,
        settled_by: order.settledBy || null,
        settlement_method: order.settlementMethod || null,
        transfer_reference: order.transferReference || null,
        driver_name: order.driverName || null,
        driver_id: order.driverId || null,
        driver_email: order.driverEmail || null,
        driver_phone: order.driverPhone || null,
        driver_type: order.driverType || null,
        tracking_guide_number: order.trackingGuideNumber || null,
        carrier_tracking_url: order.carrierTrackingUrl || null,
        driver_collection_evidence: order.driverCollectionEvidence || null,
        settlement_notes: order.settlementNotes || null,
      };

      const { error } = await supabase.from('orders').upsert(supaPayload);
      if (error) {
        // Fallback básico sin columnas adicionales si la tabla Supabase no las tiene todavía
        await supabase.from('orders').upsert({
          id: order.id,
          user_id: order.userId || null,
          user_email: order.userEmail || null,
          date: order.date,
          client_name: order.client.name,
          client_cedula: order.client.cedula,
          client_phone: order.client.phone,
          client_address: order.client.address,
          payment_method: order.client.payment,
          payment_status: order.paymentStatus || 'PENDING',
          subtotal: order.subtotal,
          shipping: order.shipping,
          total: order.total,
          status: order.status,
          status_code: order.statusCode,
          eta: order.eta,
          rating: order.rating || 0,
          items_json: order.items,
          dispatched_at: order.dispatchedAt || null,
          received_at: order.receivedAt || null,
        });
      }

      // Detalle relacional en order_items
      if (Array.isArray(order.items) && order.items.length > 0) {
        const itemsPayload = order.items.map((it, idx) => ({
          id: `${order.id}_${it.id || idx}`,
          order_id: order.id,
          product_id: it.id || null,
          product_name: it.name || 'Artesanía Wayuu',
          price_value: it.priceValue || 0,
          quantity: it.cartQuantity || 1,
          subtotal: (it.priceValue || 0) * (it.cartQuantity || 1),
          category: it.category || null,
        }));
        await supabase.from('order_items').upsert(itemsPayload);
      }
    } catch (_) {}
  }

  memoryOrders = [order, ...memoryOrders.filter(o => o.id !== order.id)];
  notifyDatabaseChange();
}

export async function updateOrderStatusInDb(
  orderId: string,
  updates: {
    statusCode: string;
    status: string;
    eta: string;
    paymentStatus?: string;
    dispatchedAt?: number;
    receivedAt?: string;
    adminResponsible?: string;
    settlementStatus?: 'PENDING_SETTLEMENT' | 'SETTLED' | 'NOT_APPLICABLE';
    settledAt?: string;
    settledBy?: string;
    settlementMethod?: 'EFECTIVO_EN_TIENDA' | 'TRANSFERENCIA_TIENDA';
    transferReference?: string;
    driverName?: string;
    driverId?: string;
    driverEmail?: string;
    driverPhone?: string;
    driverType?: 'individual' | 'corporate';
    vehicleType?: string;
    plateOrNit?: string;
    trackingGuideNumber?: string;
    carrierTrackingUrl?: string;
    deliveryEvidencePhoto?: string;
    driverCollectionEvidence?: string;
    settlementNotes?: string;
  },
): Promise<void> {
  if (isSupabaseConfigured()) {
    try {
      const supaUpdates: any = {
        status: updates.status,
        status_code: updates.statusCode,
        eta: updates.eta,
      };
      if (updates.paymentStatus) supaUpdates.payment_status = updates.paymentStatus;
      if (updates.dispatchedAt) supaUpdates.dispatched_at = updates.dispatchedAt;
      if (updates.receivedAt) supaUpdates.received_at = updates.receivedAt;
      if (updates.adminResponsible) supaUpdates.admin_responsible = updates.adminResponsible;
      if (updates.settlementStatus) supaUpdates.settlement_status = updates.settlementStatus;
      if (updates.settledAt) supaUpdates.settled_at = updates.settledAt;
      if (updates.settledBy) supaUpdates.settled_by = updates.settledBy;
      if (updates.settlementMethod) supaUpdates.settlement_method = updates.settlementMethod;
      if (updates.transferReference) supaUpdates.transfer_reference = updates.transferReference;
      if (updates.driverName) supaUpdates.driver_name = updates.driverName;
      if (updates.driverId) supaUpdates.driver_id = updates.driverId;
      if (updates.driverEmail) supaUpdates.driver_email = updates.driverEmail;
      if (updates.driverPhone) supaUpdates.driver_phone = updates.driverPhone;
      if (updates.driverType) supaUpdates.driver_type = updates.driverType;
      if (updates.trackingGuideNumber) supaUpdates.tracking_guide_number = updates.trackingGuideNumber;
      if (updates.carrierTrackingUrl) supaUpdates.carrier_tracking_url = updates.carrierTrackingUrl;
      if (updates.deliveryEvidencePhoto) supaUpdates.delivery_evidence_photo = updates.deliveryEvidencePhoto;
      if (updates.driverCollectionEvidence) supaUpdates.driver_collection_evidence = updates.driverCollectionEvidence;
      if (updates.settlementNotes) supaUpdates.settlement_notes = updates.settlementNotes;
      
      const { error } = await supabase.from('orders').update(supaUpdates).eq('id', orderId);
      if (error) {
        // Fallback a columnas estándar si hay columnas no migradas
        const baseUpdates: any = {
          status: updates.status,
          status_code: updates.statusCode,
          eta: updates.eta,
        };
        if (updates.paymentStatus) baseUpdates.payment_status = updates.paymentStatus;
        if (updates.dispatchedAt) baseUpdates.dispatched_at = updates.dispatchedAt;
        if (updates.receivedAt) baseUpdates.received_at = updates.receivedAt;
        await supabase.from('orders').update(baseUpdates).eq('id', orderId);
      }
    } catch (_) {}
  }

  memoryOrders = memoryOrders.map(o => o.id === orderId ? { ...o, ...updates } : o);
  notifyDatabaseChange();
}

/**
 * Registra formalmente la liquidación de un pedido y otorga el Paz y Salvo en tienda.
 * Aplica tanto para efectivo recibido físicamente en tienda como para transferencias verificadas.
 */
export async function settleOrderInDb(
  orderId: string,
  settlementData: {
    settlementMethod: 'EFECTIVO_EN_TIENDA' | 'TRANSFERENCIA_TIENDA';
    transferReference?: string;
    settledBy: string;
    settlementNotes?: string;
  }
): Promise<Order | null> {
  const now = new Date();
  const formattedSettledAt = `${now.toLocaleDateString('es-CO')} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

  const currentOrder = memoryOrders.find(o => o.id === orderId);
  const updatedStatus = '¡Pedido Entregado y en Paz y Salvo con la Tienda! ✅';

  await updateOrderStatusInDb(orderId, {
    statusCode: 'DELIVERED',
    status: updatedStatus,
    eta: 'Entrega y Liquidación Finalizadas',
    paymentStatus: 'PAID',
    settlementStatus: 'SETTLED',
    settledAt: formattedSettledAt,
    settledBy: settlementData.settledBy,
    settlementMethod: settlementData.settlementMethod,
    transferReference: settlementData.transferReference,
    settlementNotes: settlementData.settlementNotes,
    adminResponsible: settlementData.settledBy,
  });

  return memoryOrders.find(o => o.id === orderId) || null;
}

/**
 * =========================================================================
 * GESTIÓN DE REPARTIDORES Y TRANSPORTADORAS CORPORATIVAS
 * =========================================================================
 */

export async function getDrivers(): Promise<User[]> {
  const all = await getUsers();
  return all.filter(u => u.role === 'driver');
}

export async function createDriverUser(
  operatorAdmin: { id?: string; email: string; name: string },
  driverData: {
    fullName: string;
    email: string;
    password?: string;
    phone: string;
    city?: string;
    cedulaOrNit: string;
    driverType: 'individual' | 'corporate';
    companyName?: string;
    vehicleType?: string;
    plateOrNit?: string;
    carrierTrackingUrl?: string;
  }
): Promise<{ success: boolean; user?: User; message?: string }> {
  try {
    const normEmail = driverData.email.trim().toLowerCase();
    const existing = await findUserByEmail(normEmail);
    if (existing) {
      return { success: false, message: 'El correo electrónico ya se encuentra registrado.' };
    }

    const newDriver: User = {
      id: `USR-DRIVER-${Date.now().toString().slice(-6)}`,
      fullName: driverData.fullName.trim(),
      cedula: driverData.cedulaOrNit.trim(),
      email: normEmail,
      phone: driverData.phone.trim(),
      city: driverData.city?.trim() || 'Riohacha',
      password: driverData.password?.trim() || 'repartidor2026',
      role: 'driver',
      driverType: driverData.driverType,
      companyName: driverData.companyName?.trim(),
      vehicleType: driverData.vehicleType?.trim(),
      plateOrNit: driverData.plateOrNit?.trim(),
      carrierTrackingUrl: driverData.carrierTrackingUrl?.trim(),
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    if (isSupabaseConfigured()) {
      try {
        const supaPayload: any = {
          id: newDriver.id,
          full_name: newDriver.fullName,
          cedula: newDriver.cedula,
          email: newDriver.email,
          phone: newDriver.phone,
          city: newDriver.city,
          password: newDriver.password,
          role: 'driver',
        };
        if (newDriver.driverType) supaPayload.driver_type = newDriver.driverType;
        if (newDriver.companyName) supaPayload.company_name = newDriver.companyName;
        if (newDriver.vehicleType) supaPayload.vehicle_type = newDriver.vehicleType;
        if (newDriver.plateOrNit) supaPayload.plate_or_nit = newDriver.plateOrNit;
        if (newDriver.carrierTrackingUrl) supaPayload.carrier_tracking_url = newDriver.carrierTrackingUrl;

        const { error: upsertErr } = await supabase.from('users').upsert(supaPayload);
        if (upsertErr) {
          // Fallback a columnas base de la tabla users si columnas extendidas no existen
          await supabase.from('users').upsert({
            id: newDriver.id,
            full_name: newDriver.fullName,
            cedula: newDriver.cedula,
            email: newDriver.email,
            phone: newDriver.phone,
            city: newDriver.city,
            password: newDriver.password,
            role: 'driver',
          });
        }
      } catch (_) {}
    }

    memoryUsers = [newDriver, ...memoryUsers];
    notifyDatabaseChange();

    await logAdminActivity({
      adminId: operatorAdmin.id,
      adminEmail: operatorAdmin.email,
      adminName: operatorAdmin.name,
      actionType: 'DRIVER_CREATE',
      entityType: 'LOGISTICA',
      entityId: newDriver.email,
      details: `${operatorAdmin.name} registró al ${newDriver.driverType === 'corporate' ? 'aliado logístico corporativo' : 'repartidor'}: ${newDriver.fullName} (${newDriver.email}).`,
    });

    return { success: true, user: newDriver };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Error al registrar repartidor.' };
  }
}

export async function updateDriverUser(
  operatorAdmin: { id?: string; email: string; name: string },
  driverId: string,
  updates: Partial<User>
): Promise<{ success: boolean; message?: string }> {
  try {
    const target = memoryUsers.find(u => u.id === driverId);
    if (!target) return { success: false, message: 'Repartidor no encontrado.' };

    const updated = { ...target, ...updates };
    memoryUsers = memoryUsers.map(u => u.id === driverId ? updated : u);

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('users').update({
          full_name: updated.fullName,
          phone: updated.phone,
          city: updated.city,
          password: updated.password,
        }).eq('id', driverId);
      } catch (_) {}
    }

    notifyDatabaseChange();

    await logAdminActivity({
      adminId: operatorAdmin.id,
      adminEmail: operatorAdmin.email,
      adminName: operatorAdmin.name,
      actionType: 'DRIVER_UPDATE',
      entityType: 'LOGISTICA',
      entityId: driverId,
      details: `${operatorAdmin.name} actualizó los datos de logística de ${updated.fullName}.`,
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Error al actualizar datos del repartidor.' };
  }
}

export async function assignOrderToDriver(
  orderId: string,
  driverData: {
    driverId: string;
    driverName: string;
    driverEmail: string;
    driverPhone: string;
    driverType: 'individual' | 'corporate';
    vehicleType?: string;
    plateOrNit?: string;
    trackingGuideNumber?: string;
    carrierTrackingUrl?: string;
  },
  adminResponsible: string
): Promise<void> {
  const isCorp = driverData.driverType === 'corporate';
  const vehicleDesc = driverData.vehicleType ? `${driverData.vehicleType}${driverData.plateOrNit ? ` (Placa ${driverData.plateOrNit})` : ''}` : 'Reparto express';
  const statusMessage = isCorp
    ? `¡Pedido Despachado con ${driverData.driverName}! Guía de transporte: ${driverData.trackingGuideNumber || 'En asignación'}.`
    : `¡Pedido Despachado por ${adminResponsible}! Repartidor ${driverData.driverName} (${vehicleDesc}) va en camino a tu dirección.`;

  await updateOrderStatusInDb(orderId, {
    statusCode: 'DISPATCHED',
    status: statusMessage,
    eta: isCorp ? 'En tránsito con transportadora (1 a 3 días hábiles)' : 'En ruta (aprox. 15-25 min)',
    dispatchedAt: Date.now(),
    adminResponsible,
    driverName: driverData.driverName,
    driverId: driverData.driverId,
    driverEmail: driverData.driverEmail,
    driverPhone: driverData.driverPhone,
    driverType: driverData.driverType,
    vehicleType: driverData.vehicleType,
    plateOrNit: driverData.plateOrNit,
    trackingGuideNumber: driverData.trackingGuideNumber,
    carrierTrackingUrl: driverData.carrierTrackingUrl,
  });

  await saveNotificationToDb({
    id: `notif-disp-${orderId}-${Date.now()}`,
    orderId: orderId,
    title: '📦 ¡Tu pedido ha sido despachado!',
    message: isCorp
      ? `Tu pedido #${orderId} ha sido despachado a través de ${driverData.driverName}. Guía de envío: ${driverData.trackingGuideNumber || 'Generada'}. ¡Puedes hacerle seguimiento en línea!`
      : `Tu pedido #${orderId} ha sido asignado al repartidor ${driverData.driverName} (${vehicleDesc} • Tel: ${driverData.driverPhone}). ¡Ahora puedes seguirlo en vivo!`,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    read: false,
  });
}

export async function updateOrderRatingInDb(
  orderId: string,
  rating: number,
): Promise<void> {
  if (isSupabaseConfigured()) {
    try {
      await supabase.from('orders').update({ rating }).eq('id', orderId);
      await supabase.from('order_reviews').upsert({
        order_id: orderId,
        rating,
      });
    } catch (_) {}
  }

  memoryOrders = memoryOrders.map(o => o.id === orderId ? { ...o, rating } : o);
  notifyDatabaseChange();
}

/**
 * =========================================================================
 * 4. MÓDULO DE NOTIFICACIONES (100% SUPABASE)
 * =========================================================================
 */

export async function getNotificationsFromDb(): Promise<AppNotification[]> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && Array.isArray(data)) {
        const mapped = data.map((r: any) => ({
          id: r.id,
          orderId: r.order_id,
          title: r.title,
          message: r.message,
          time: r.time,
          read: Boolean(r.read),
        }));
        memoryNotifications = mapped;
        return mapped;
      }
    } catch (_) {}
  }
  return memoryNotifications;
}

export async function saveNotificationToDb(
  notification: AppNotification,
): Promise<void> {
  if (isSupabaseConfigured()) {
    try {
      await supabase.from('notifications').upsert({
        id: notification.id,
        order_id: notification.orderId,
        title: notification.title,
        message: notification.message,
        time: notification.time,
        read: notification.read ? 1 : 0,
      });
    } catch (_) {}
  }

  memoryNotifications = [notification, ...memoryNotifications.filter(n => n.id !== notification.id)];
}

export async function markNotificationAsReadInDb(
  notificationId: string,
): Promise<void> {
  if (isSupabaseConfigured()) {
    try {
      await supabase.from('notifications').update({ read: 1 }).eq('id', notificationId);
    } catch (_) {}
  }
  memoryNotifications = memoryNotifications.map(n => n.id === notificationId ? { ...n, read: true } : n);
}

/**
 * =========================================================================
 * 5. MÓDULO DE CATEGORÍAS (100% SUPABASE)
 * =========================================================================
 */

export async function getCategories(): Promise<Category[]> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.from('categories').select('*');
      if (!error && Array.isArray(data) && data.length > 0) {
        const mapped = data.map((c: any) => ({
          id: c.id,
          name: c.name,
          icon: c.icon,
          description: c.description || undefined,
        }));
        memoryCategories = mapped;
        return mapped;
      }
    } catch (_) {}
  }
  return memoryCategories;
}

export async function createCategory(
  categoryData: Omit<Category, "id"> & { id?: string },
): Promise<Category> {
  const categoryId = categoryData.id || categoryData.name.trim().replace(/\s+/g, "_");
  const newCat: Category = {
    id: categoryId,
    name: categoryData.name.trim(),
    icon: categoryData.icon || "sparkles-outline",
    description: categoryData.description || "",
  };

  if (isSupabaseConfigured()) {
    try {
      await supabase.from('categories').upsert({
        id: newCat.id,
        name: newCat.name,
        icon: newCat.icon,
        description: newCat.description || null,
      });
    } catch (_) {}
  }

  memoryCategories = [...memoryCategories.filter(c => c.id !== newCat.id), newCat];
  notifyDatabaseChange();
  return newCat;
}

/**
 * =========================================================================
 * 6. MÓDULO DE PRODUCTOS (100% SUPABASE CON STORAGE CDN)
 * =========================================================================
 */

export async function getProducts(): Promise<Product[]> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
      if (!error && Array.isArray(data) && data.length > 0) {
        const mapped: Product[] = data.map((p: any) => ({
          id: p.id,
          name: p.name,
          categoryId: p.category_id,
          priceValue: p.price_value,
          price: p.price,
          icon: p.icon || 'sparkles-outline',
          imagePath: p.image_path,
          imageName: p.image_name,
          ancestralRef: p.ancestral_ref || '',
          stock: p.stock ?? 0,
          likes: p.likes ?? 0,
          discountPercent: p.discount_percent ?? 0,
          isDiscountActive: p.is_discount_active ?? 0,
          isActive: p.is_active !== undefined ? p.is_active : 1,
        }));
        memoryProducts = mapped;
        return mapped;
      }
    } catch (_) {}
  }
  return memoryProducts;
}

export async function createProduct(
  productData: Omit<Product, "id" | "likes"> & { id?: string },
): Promise<Product> {
  const nextId = productData.id || String(Date.now());
  let finalImagePath = productData.imagePath;

  // Subir imagen a Supabase Storage y obtener CDN URL
  if (
    finalImagePath &&
    !finalImagePath.startsWith('http') &&
    !finalImagePath.startsWith('mochila') &&
    !finalImagePath.startsWith('manta') &&
    !finalImagePath.startsWith('chinchorro') &&
    !finalImagePath.startsWith('sombrero') &&
    isSupabaseConfigured()
  ) {
    try {
      finalImagePath = await uploadMediaToSupabase(finalImagePath, 'products', productData.imageName || nextId);
    } catch (_) {}
  }

  const newProduct: Product = {
    ...productData,
    id: nextId,
    imagePath: finalImagePath,
    likes: 0,
    discountPercent: productData.discountPercent || 0,
    isDiscountActive: productData.isDiscountActive || 0,
    isActive: productData.isActive !== undefined ? productData.isActive : 1,
  };

  if (isSupabaseConfigured()) {
    try {
      await supabase.from('products').upsert({
        id: newProduct.id,
        name: newProduct.name,
        category_id: newProduct.categoryId,
        price_value: newProduct.priceValue,
        price: newProduct.price,
        icon: newProduct.icon || 'sparkles-outline',
        image_path: newProduct.imagePath || null,
        image_name: newProduct.imageName || null,
        ancestral_ref: newProduct.ancestralRef || '',
        stock: newProduct.stock,
        likes: 0,
        discount_percent: newProduct.discountPercent || 0,
        is_discount_active: newProduct.isDiscountActive || 0,
        is_active: newProduct.isActive !== undefined ? newProduct.isActive : 1,
      });

      await supabase.from('inventory_logs').insert({
        product_id: newProduct.id,
        action: 'PRODUCT_CREATED',
        new_stock: newProduct.stock,
        notes: `Creación del artículo ${newProduct.name}`,
      });
    } catch (_) {}
  }

  memoryProducts = [newProduct, ...memoryProducts.filter(p => p.id !== nextId)];
  notifyDatabaseChange();
  return newProduct;
}

export async function updateProduct(
  productId: string,
  updates: Partial<Product>,
): Promise<Product> {
  let finalPath = updates.imagePath;
  if (finalPath && !finalPath.startsWith('http') && isSupabaseConfigured()) {
    try {
      finalPath = await uploadMediaToSupabase(finalPath, 'products', updates.imageName || productId);
      updates.imagePath = finalPath;
    } catch (_) {}
  }

  if (isSupabaseConfigured()) {
    try {
      const supaUpdates: any = {};
      if (updates.name !== undefined) supaUpdates.name = updates.name;
      if (updates.categoryId !== undefined) supaUpdates.category_id = updates.categoryId;
      if (updates.priceValue !== undefined) supaUpdates.price_value = updates.priceValue;
      if (updates.price !== undefined) supaUpdates.price = updates.price;
      if (updates.stock !== undefined) supaUpdates.stock = updates.stock;
      if (updates.imagePath !== undefined) supaUpdates.image_path = updates.imagePath;
      if (updates.imageName !== undefined) supaUpdates.image_name = updates.imageName;
      if (updates.discountPercent !== undefined) supaUpdates.discount_percent = updates.discountPercent;
      if (updates.isDiscountActive !== undefined) supaUpdates.is_discount_active = updates.isDiscountActive;
      if (updates.isActive !== undefined) supaUpdates.is_active = updates.isActive;

      await supabase.from('products').update(supaUpdates).eq('id', productId);

      if (updates.stock !== undefined) {
        await supabase.from('inventory_logs').insert({
          product_id: productId,
          action: 'STOCK_UPDATE',
          new_stock: updates.stock,
          notes: 'Ajuste de inventario',
        });
      }
    } catch (_) {}
  }

  memoryProducts = memoryProducts.map(p => p.id === productId ? { ...p, ...updates } : p);
  notifyDatabaseChange();
  const found = memoryProducts.find(p => p.id === productId);
  return found || (updates as Product);
}

export async function updateProductStockInDb(
  productId: string,
  newStock: number,
): Promise<void> {
  const safeStock = Math.max(0, newStock);

  if (isSupabaseConfigured()) {
    try {
      await supabase.from('products').update({ stock: safeStock }).eq('id', productId);
      await supabase.from('inventory_logs').insert({
        product_id: productId,
        action: 'STOCK_UPDATE',
        new_stock: safeStock,
        notes: 'Ajuste manual de stock',
      });
    } catch (_) {}
  }

  memoryProducts = memoryProducts.map(p => p.id === productId ? { ...p, stock: safeStock } : p);
  notifyDatabaseChange();
}

export async function deleteProduct(productId: string): Promise<void> {
  if (isSupabaseConfigured()) {
    try {
      await supabase.from('products').delete().eq('id', productId);
    } catch (_) {}
  }

  memoryProducts = memoryProducts.filter(p => p.id !== productId);
  notifyDatabaseChange();
}

export async function deductStockForOrder(
  cartItems: Array<{ id: string; cartQuantity: number }>,
): Promise<Product[]> {
  const currentProducts = await getProducts();
  const updatedProducts = currentProducts.map(prod => {
    const boughtItem = cartItems.find(it => it.id === prod.id);
    if (boughtItem && boughtItem.cartQuantity > 0) {
      const remainingStock = Math.max(0, prod.stock - boughtItem.cartQuantity);
      return { ...prod, stock: remainingStock };
    }
    return prod;
  });

  if (isSupabaseConfigured()) {
    for (const item of cartItems) {
      const target = updatedProducts.find(p => p.id === item.id);
      if (target) {
        try {
          await supabase.from('products').update({ stock: target.stock }).eq('id', target.id);
        } catch (_) {}
      }
    }
  }

  memoryProducts = updatedProducts;
  notifyDatabaseChange();
  return updatedProducts;
}

/**
 * =========================================================================
 * 7. MÓDULO DE COTIZACIONES Y DISEÑADOR IA (100% SUPABASE)
 * =========================================================================
 */

export async function getCustomQuotes(): Promise<CustomQuote[]> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('custom_quotes')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && Array.isArray(data)) {
        const mapped: CustomQuote[] = data.map((r: any) => ({
          id: r.id,
          userId: r.user_id || undefined,
          userEmail: r.user_email,
          userName: r.userName || r.user_name || 'Cliente',
          clientPhone: r.client_phone || undefined,
          designType: r.design_type,
          colorsJson: r.colors_json || undefined,
          pattern: r.pattern || undefined,
          prompt: r.prompt,
          imageUrl: r.image_url || undefined,
          status: r.status as any,
          quotedPrice: r.quoted_price || 0,
          quotedDeliveryDays: r.quoted_delivery_days || 0,
          adminNotes: r.admin_notes || undefined,
          orderId: r.order_id || undefined,
          createdAt: r.created_at,
        }));
        memoryQuotes = mapped;
        return mapped;
      }
    } catch (_) {}
  }
  return memoryQuotes;
}

export async function createCustomQuote(
  quoteData: Omit<CustomQuote, "id" | "createdAt" | "status">,
): Promise<CustomQuote> {
  const quoteId = `COT-${Date.now()}`;
  let finalImageUrl = quoteData.imageUrl;

  if (finalImageUrl && !finalImageUrl.startsWith('http') && isSupabaseConfigured()) {
    try {
      finalImageUrl = await uploadMediaToSupabase(finalImageUrl, 'quotes', quoteId);
    } catch (_) {}
  }

  const newQuote: CustomQuote = {
    ...quoteData,
    id: quoteId,
    imageUrl: finalImageUrl,
    status: "PENDING_QUOTE",
    createdAt: new Date().toISOString(),
  };

  if (isSupabaseConfigured()) {
    try {
      await supabase.from('custom_quotes').insert({
        id: newQuote.id,
        user_id: newQuote.userId || null,
        user_email: newQuote.userEmail,
        userName: newQuote.userName,
        client_phone: newQuote.clientPhone || null,
        design_type: newQuote.designType,
        colors_json: newQuote.colorsJson || null,
        pattern: newQuote.pattern || null,
        prompt: newQuote.prompt,
        image_url: newQuote.imageUrl || null,
        status: newQuote.status,
        quoted_price: newQuote.quotedPrice || 0,
        quoted_delivery_days: newQuote.quotedDeliveryDays || 0,
        admin_notes: newQuote.adminNotes || null,
        order_id: newQuote.orderId || null,
        created_at: newQuote.createdAt,
      });
    } catch (_) {}
  }

  memoryQuotes = [newQuote, ...memoryQuotes];
  notifyDatabaseChange();
  return newQuote;
}

export async function updateCustomQuote(
  quoteId: string,
  updates: Partial<CustomQuote>,
): Promise<CustomQuote> {
  if (isSupabaseConfigured()) {
    try {
      const supaUpdates: any = {};
      if (updates.status !== undefined) supaUpdates.status = updates.status;
      if (updates.quotedPrice !== undefined) supaUpdates.quoted_price = updates.quotedPrice;
      if (updates.quotedDeliveryDays !== undefined) supaUpdates.quoted_delivery_days = updates.quotedDeliveryDays;
      if (updates.adminNotes !== undefined) supaUpdates.admin_notes = updates.adminNotes;
      if (updates.orderId !== undefined) supaUpdates.order_id = updates.orderId;
      await supabase.from('custom_quotes').update(supaUpdates).eq('id', quoteId);
    } catch (_) {}
  }

  memoryQuotes = memoryQuotes.map(q => q.id === quoteId ? { ...q, ...updates } : q);
  notifyDatabaseChange();
  const found = memoryQuotes.find(q => q.id === quoteId);
  return found || (updates as CustomQuote);
}

/**
 * =========================================================================
 * 8. MÓDULO DE CHAT EN TIEMPO REAL (100% SUPABASE)
 * =========================================================================
 */

export async function getChatMessages(
  filterEmail?: string,
): Promise<ChatMessage[]> {
  if (isSupabaseConfigured()) {
    try {
      let query = supabase.from('chat_messages').select('*').order('created_at', { ascending: true });
      if (filterEmail) {
        query = query.eq('user_email', filterEmail.trim().toLowerCase());
      }
      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        const mapped: ChatMessage[] = data.map((m: any) => ({
          id: m.id,
          userId: m.user_id || undefined,
          userEmail: m.user_email,
          userName: m.userName || m.user_name || 'Usuario',
          senderRole: m.sender_role as any,
          message: m.message,
          quoteId: m.quote_id || undefined,
          createdAt: m.created_at,
          read: m.read || 0,
        }));
        memoryChat = mapped;
        return mapped;
      }
    } catch (_) {}
  }

  if (filterEmail) {
    const norm = filterEmail.trim().toLowerCase();
    return memoryChat.filter(m => m.userEmail.toLowerCase() === norm);
  }
  return memoryChat;
}

export async function sendChatMessage(
  msgData: Omit<ChatMessage, "id" | "createdAt" | "read">,
): Promise<ChatMessage> {
  const newMsg: ChatMessage = {
    ...msgData,
    id: `MSG-${Date.now()}`,
    createdAt: new Date().toISOString(),
    read: 0,
  };

  if (isSupabaseConfigured()) {
    try {
      await supabase.from('chat_messages').insert({
        id: newMsg.id,
        user_id: newMsg.userId || null,
        user_email: newMsg.userEmail,
        username: newMsg.userName,
        sender_role: newMsg.senderRole,
        message: newMsg.message,
        quote_id: newMsg.quoteId || null,
        created_at: newMsg.createdAt,
        read: 0,
      });
    } catch (_) {}
  }

  memoryChat = [...memoryChat, newMsg];
  notifyDatabaseChange();
  return newMsg;
}

export async function markChatMessagesAsRead(
  userEmail: string,
  readerRole: "client" | "admin",
): Promise<void> {
  const targetSenderRole = readerRole === "admin" ? "client" : "admin";
  const normEmail = userEmail.trim().toLowerCase();

  if (isSupabaseConfigured()) {
    try {
      await supabase
        .from('chat_messages')
        .update({ read: 1 })
        .eq('user_email', normEmail)
        .eq('sender_role', targetSenderRole);
    } catch (_) {}
  }

  memoryChat = memoryChat.map(m =>
    m.userEmail.toLowerCase() === normEmail && m.senderRole === targetSenderRole
      ? { ...m, read: 1 }
      : m
  );
  notifyDatabaseChange();
}

/**
 * =========================================================================
 * 9. MÓDULO DE FAVORITOS (100% SUPABASE)
 * =========================================================================
 */

export async function toggleProductFavoriteInDb(
  userId: string,
  productId: string,
  isLiked: boolean
): Promise<void> {
  if (!userId || !productId) return;

  if (isSupabaseConfigured()) {
    try {
      if (isLiked) {
        await supabase.from('user_favorites').upsert({
          user_id: userId,
          product_id: productId,
        });
      } else {
        await supabase
          .from('user_favorites')
          .delete()
          .eq('user_id', userId)
          .eq('product_id', productId);
      }
    } catch (_) {}
  }

  if (!memoryFavorites.has(userId)) {
    memoryFavorites.set(userId, new Set());
  }
  const favSet = memoryFavorites.get(userId)!;
  if (isLiked) favSet.add(productId);
  else favSet.delete(productId);
}

export async function getUserFavoritesFromDb(userId: string): Promise<string[]> {
  if (!userId) return [];

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('user_favorites')
        .select('product_id')
        .eq('user_id', userId);
      if (!error && Array.isArray(data)) {
        return data.map((r: any) => r.product_id);
      }
    } catch (_) {}
  }

  const set = memoryFavorites.get(userId);
  return set ? Array.from(set) : [];
}

/**
 * =========================================================================
 * 10. MÉTRICAS ANALÍTICAS PARA EL ADMINISTRADOR
 * =========================================================================
 */

export function calculateAdminAnalytics(
  orders: Order[],
  products: Product[],
  users: User[],
): StoreAnalytics {
  const validOrders = orders.filter(o => o.statusCode !== "CANCELLED");
  // Ventas Totales: Solo se cargan y suman al sistema cuando el pedido ha sido entregado (DELIVERED)
  const deliveredOrders = orders.filter(o => o.statusCode === "DELIVERED");
  const totalRevenue = deliveredOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const totalOrders = orders.length;
  const pendingOrders = orders.filter(o => o.statusCode === "PENDING").length;
  const dispatchedOrders = orders.filter(o => o.statusCode === "DISPATCHED" || o.statusCode === "ARRIVED").length;
  const deliveredOrdersCount = deliveredOrders.length;
  const totalClients = users.filter(u => u.role !== "admin").length;
  const totalProducts = products.length;

  // Liquidación y Arqueo de Caja (Paz y Salvo vs En Tránsito con repartidores)
  const settledOrders = deliveredOrders.filter(o => o.settlementStatus === 'SETTLED');
  const pendingSettlementOrders = orders.filter(o => o.settlementStatus === 'PENDING_SETTLEMENT');
  const settledRevenue = settledOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const pendingSettlementRevenue = pendingSettlementOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const pendingSettlementCount = pendingSettlementOrders.length;

  const productSalesMap = new Map<string, { id: string; name: string; category: string; categoryId: string; unitsSold: number; totalSold: number; revenue: number }>();
  const salesSourceOrders = deliveredOrders.length > 0 ? deliveredOrders : validOrders;
  for (const ord of salesSourceOrders) {
    if (Array.isArray(ord.items)) {
      for (const item of ord.items) {
        const cat = item.category || 'General';
        const existing = productSalesMap.get(item.id) || {
          id: item.id,
          name: item.name,
          category: cat,
          categoryId: cat,
          unitsSold: 0,
          totalSold: 0,
          revenue: 0,
        };
        const qty = item.cartQuantity || 1;
        existing.unitsSold += qty;
        existing.totalSold += qty;
        existing.revenue += ((item.priceValue || 0) * qty);
        productSalesMap.set(item.id, existing);
      }
    }
  }

  const topSellingProducts = Array.from(productSalesMap.values())
    .sort((a, b) => b.unitsSold - a.unitsSold)
    .slice(0, 5);

  const clientSpendingMap = new Map<string, { name: string; email: string; phone: string; city: string; totalOrders: number; totalSpent: number; lastOrderDate: string }>();
  for (const ord of validOrders) {
    const emailKey = ord.userEmail || ord.client.name.toLowerCase();
    const existing = clientSpendingMap.get(emailKey) || {
      name: ord.client.name,
      email: ord.userEmail || "Sin correo",
      phone: ord.client.phone,
      city: ord.city || "Riohacha",
      totalOrders: 0,
      totalSpent: 0,
      lastOrderDate: ord.date,
    };
    existing.totalOrders += 1;
    existing.totalSpent += (ord.total || 0);
    if (new Date(ord.date) > new Date(existing.lastOrderDate)) {
      existing.lastOrderDate = ord.date;
    }
    clientSpendingMap.set(emailKey, existing);
  }

  const topSpendingClients = Array.from(clientSpendingMap.values())
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 5);

  const topRatedProducts = [...products]
    .sort((a, b) => b.likes - a.likes)
    .slice(0, 5)
    .map(p => ({
      id: p.id,
      name: p.name,
      categoryId: p.categoryId,
      likes: p.likes,
      stock: p.stock,
    }));

  const topRatedOrders = orders.filter(o => o.rating && o.rating > 0);

  const discountedProducts = products
    .filter(p => p.isDiscountActive === 1 && p.discountPercent && p.discountPercent > 0)
    .map(p => {
      const pct = p.discountPercent || 0;
      const discountedPrice = Math.round(p.priceValue * (1 - pct / 100));
      return {
        id: p.id,
        name: p.name,
        categoryId: p.categoryId,
        discountPercent: pct,
        priceValue: p.priceValue,
        discountedPrice,
      };
    })
    .sort((a, b) => b.discountPercent - a.discountPercent);

  return {
    totalRevenue,
    totalOrders,
    pendingOrders,
    dispatchedOrders,
    deliveredOrders: deliveredOrdersCount,
    settledRevenue,
    pendingSettlementRevenue,
    pendingSettlementCount,
    totalClients,
    totalProducts,
    topSellingProducts,
    topSpendingClients,
    topRatedProducts,
    topRatedOrders,
    discountedProducts,
  };
}

export async function getStoreAnalytics(): Promise<StoreAnalytics> {
  const [orders, products, users] = await Promise.all([
    getOrders(),
    getProducts(),
    getUsers(),
  ]);
  return calculateAdminAnalytics(orders, products, users);
}

/**
 * =========================================================================
 * 11. MÓDULO DE TRAZABILIDAD, AUDITORÍA Y MULTI-ADMINISTRADOR (100% SUPABASE)
 * =========================================================================
 */

export async function logAdminActivity(
  logData: Omit<AdminActivityLog, 'id' | 'createdAt'>
): Promise<AdminActivityLog> {
  const newLog: AdminActivityLog = {
    ...logData,
    id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    createdAt: new Date().toISOString(),
  };

  memoryAdminLogs = [newLog, ...memoryAdminLogs];

  // Persistir en AsyncStorage local
  try {
    const serialized = JSON.stringify(memoryAdminLogs.slice(0, 100));
    await AsyncStorage.setItem(ADMIN_LOGS_STORAGE_KEY, serialized);
  } catch (_) {}

  // Persistir en Supabase
  if (isSupabaseConfigured()) {
    try {
      await supabase.from('admin_activity_logs').insert({
        id: newLog.id,
        admin_id: newLog.adminId || null,
        admin_email: newLog.adminEmail,
        admin_name: newLog.adminName,
        action_type: newLog.actionType,
        entity_type: newLog.entityType,
        entity_id: newLog.entityId || null,
        details: newLog.details,
        created_at: newLog.createdAt,
      });
    } catch (_) {}

    // Si es acción sobre inventario y tiene producto válido, registrar también en inventory_logs
    if (newLog.entityType === 'PRODUCTO' && newLog.entityId) {
      try {
        await supabase.from('inventory_logs').insert({
          id: `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          product_id: newLog.entityId,
          admin_id: newLog.adminEmail,
          action: newLog.actionType,
          notes: `${newLog.adminName}: ${newLog.details}`,
          created_at: newLog.createdAt,
        });
      } catch (_) {}
    }
  }

  notifyDatabaseChange();
  return newLog;
}

export async function getAdminActivityLogs(limit = 100): Promise<AdminActivityLog[]> {
  // Intentar cargar de Supabase
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('admin_activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!error && Array.isArray(data) && data.length > 0) {
        const mapped: AdminActivityLog[] = data.map((r: any) => ({
          id: r.id,
          adminId: r.admin_id || undefined,
          adminEmail: r.admin_email || 'admin@einuushi.com',
          adminName: r.admin_name || 'Administrador',
          actionType: r.action_type || 'GENERAL',
          entityType: r.entity_type || 'SISTEMA',
          entityId: r.entity_id || undefined,
          details: r.details || '',
          createdAt: r.created_at || new Date().toISOString(),
        }));
        memoryAdminLogs = mapped;
        return mapped;
      }
    } catch (_) {}
  }

  // Fallback a AsyncStorage local si no hay datos en Supabase aún
  if (memoryAdminLogs.length === 0) {
    try {
      const raw = await AsyncStorage.getItem(ADMIN_LOGS_STORAGE_KEY);
      if (raw) {
        memoryAdminLogs = JSON.parse(raw);
      }
    } catch (_) {}
  }

  return memoryAdminLogs.slice(0, limit);
}

export async function getAdminUsers(viewerAdmin?: { email?: string; id?: string; role?: string } | null): Promise<User[]> {
  const allUsers = await getUsers();
  const admins = allUsers
    .filter(u => u.role === 'admin' || u.role === 'superadmin' || isSuperAdmin(u))
    .map(u => ({
      ...u,
      role: isSuperAdmin(u) ? ('superadmin' as const) : ('admin' as const),
    }));

  // Si el usuario observador es un administrador regular, se oculta completamente al Superadministrador
  // y solo se permite visualizar los datos propios de su cuenta
  if (viewerAdmin && !isSuperAdmin(viewerAdmin)) {
    const normViewerEmail = (viewerAdmin.email || '').toLowerCase().trim();
    return admins.filter(u => !isSuperAdmin(u) && (u.id === viewerAdmin.id || u.email.toLowerCase() === normViewerEmail));
  }

  if (admins.length === 0) {
    return [{ ...INITIAL_USERS[0], role: 'superadmin' }];
  }
  return admins;
}

export async function updateAdminProfile(
  adminId: string,
  currentEmail: string,
  updates: {
    fullName?: string;
    phone?: string;
    email?: string;
    password?: string;
    city?: string;
  },
  operatorAdmin: { email: string; name: string; role?: string; id?: string }
): Promise<{ success: boolean; user?: User; message?: string }> {
  try {
    const isSuper = isSuperAdmin(operatorAdmin);
    const isSelf = operatorAdmin.email.toLowerCase() === currentEmail.toLowerCase() || (operatorAdmin.id && operatorAdmin.id === adminId);

    // Si no es el mismo admin y no es superadmin, rechazar
    if (!isSelf && !isSuper) {
      return { success: false, message: 'Operación denegada: Sólo puedes modificar tu propio perfil administrativo.' };
    }

    const existing = await findUserByEmail(currentEmail) || memoryUsers.find(u => u.id === adminId || u.email.toLowerCase() === currentEmail.toLowerCase());
    const isTargetSuper = isSuperAdmin(existing) || isSuperAdmin({ id: adminId, email: currentEmail, role: existing?.role });

    // Un administrador regular no puede cambiarle la clave o datos al superadministrador
    if (isTargetSuper && !isSuper) {
      return { success: false, message: 'Operación denegada: No tienes permisos para modificar al Superadministrador.' };
    }

    const newEmail = updates.email?.trim().toLowerCase() || currentEmail.toLowerCase();
    
    // Si cambia de email, verificar que no esté ocupado por otro usuario distinto
    if (newEmail !== currentEmail.toLowerCase()) {
      const emailTaken = await findUserByEmail(newEmail);
      if (emailTaken && emailTaken.id !== adminId && emailTaken.email.toLowerCase() !== currentEmail.toLowerCase()) {
        return { success: false, message: 'El correo electrónico ya está en uso por otra cuenta.' };
      }
    }

    // SI LA CUENTA ES SUPERADMINISTRADOR (POR ROL, POR ID O POR EMAIL ANTERIOR), SE MANTIENE SIEMPRE COMO SUPERADMINISTRADOR
    const updatedRole: "client" | "admin" | "superadmin" = (isTargetSuper || isSuper) ? 'superadmin' : 'admin';

    const updatedUser: User = {
      id: existing?.id || adminId || (isTargetSuper ? 'USR-ADMIN-01' : `USR-ADMIN-${Date.now()}`),
      fullName: updates.fullName?.trim() || existing?.fullName || 'Administrador Einuushi',
      cedula: existing?.cedula || '1124000000',
      email: newEmail,
      phone: updates.phone?.trim() || existing?.phone || '3009998877',
      city: updates.city?.trim() || existing?.city || 'Riohacha',
      password: updates.password?.trim() || existing?.password || 'admin2026',
      role: updatedRole,
      avatar: existing?.avatar,
      createdAt: existing?.createdAt || new Date().toISOString(),
    };

    if (isSupabaseConfigured()) {
      await supabase.from('users').upsert({
        id: updatedUser.id,
        full_name: updatedUser.fullName,
        cedula: updatedUser.cedula,
        email: updatedUser.email,
        phone: updatedUser.phone,
        city: updatedUser.city,
        password: updatedUser.password,
        role: updatedUser.role,
        avatar: updatedUser.avatar || null,
      });
    }

    memoryUsers = [updatedUser, ...memoryUsers.filter(u => u.id !== updatedUser.id && u.email.toLowerCase() !== currentEmail.toLowerCase() && u.email.toLowerCase() !== newEmail)];
    
    if (isSelf) {
      await saveAdminSession(updatedUser);
    }

    await logAdminActivity({
      adminId: updatedUser.id,
      adminEmail: operatorAdmin.email,
      adminName: operatorAdmin.name,
      actionType: 'ADMIN_PROFILE_UPDATE',
      entityType: 'SEGURIDAD',
      entityId: updatedUser.email,
      details: `${operatorAdmin.name} (${updatedRole === 'superadmin' ? 'Superadministrador' : 'Administrador'}) actualizó sus datos de acceso (${updatedUser.email})${updates.password ? ' y modificó su contraseña' : ''}.`,
    });

    notifyDatabaseChange();
    return { success: true, user: updatedUser };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Error al actualizar credenciales de administrador.' };
  }
}

export async function createAdminUser(
  newAdmin: {
    fullName: string;
    cedula?: string;
    email: string;
    phone: string;
    password: string;
    city?: string;
  },
  operatorAdmin: { email: string; name: string; role?: string; id?: string }
): Promise<{ success: boolean; user?: User; message?: string }> {
  try {
    if (!isSuperAdmin(operatorAdmin)) {
      return {
        success: false,
        message: 'Acceso denegado: Únicamente el Superadministrador principal puede autorizar y crear nuevos usuarios administradores.',
      };
    }

    const normalizedEmail = newAdmin.email.trim().toLowerCase();
    const existing = await findUserByEmail(normalizedEmail);
    if (existing) {
      return { success: false, message: 'Ya existe un usuario o administrador registrado con este correo.' };
    }

    const createdAdmin: User = {
      id: `USR-ADMIN-${Date.now()}`,
      fullName: newAdmin.fullName.trim(),
      cedula: newAdmin.cedula?.trim() || '1124000000',
      email: normalizedEmail,
      phone: newAdmin.phone.trim() || '3000000000',
      city: newAdmin.city?.trim() || 'Riohacha',
      password: newAdmin.password.trim(),
      role: 'admin',
      createdAt: new Date().toISOString(),
    };

    if (isSupabaseConfigured()) {
      const { error } = await supabase.from('users').insert({
        id: createdAdmin.id,
        full_name: createdAdmin.fullName,
        cedula: createdAdmin.cedula,
        email: createdAdmin.email,
        phone: createdAdmin.phone,
        city: createdAdmin.city,
        password: createdAdmin.password,
        role: 'admin',
      });
      if (error) {
        return { success: false, message: `Error en Supabase: ${error.message}` };
      }
    }

    memoryUsers = [createdAdmin, ...memoryUsers];

    await logAdminActivity({
      adminId: createdAdmin.id,
      adminEmail: operatorAdmin.email,
      adminName: operatorAdmin.name,
      actionType: 'ADMIN_CREATE',
      entityType: 'SEGURIDAD',
      entityId: createdAdmin.email,
      details: `${operatorAdmin.name} (Superadministrador) creó al nuevo administrador: ${createdAdmin.fullName} (${createdAdmin.email}) con privilegios operativos.`,
    });

    notifyDatabaseChange();
    return { success: true, user: createdAdmin };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Error al crear el nuevo administrador.' };
  }
}

export async function changeAdminPasswordBySuperAdmin(
  targetAdminId: string,
  targetAdminEmail: string,
  newPassword: string,
  operatorAdmin: { email: string; name: string; role?: string; id?: string }
): Promise<{ success: boolean; message?: string }> {
  if (!isSuperAdmin(operatorAdmin)) {
    return { success: false, message: 'Operación denegada: Solo el Superadministrador puede reasignar contraseñas a otros administradores.' };
  }

  const normTarget = targetAdminEmail.trim().toLowerCase();
  const targetUser = await findUserByEmail(normTarget) || memoryUsers.find(u => u.email.toLowerCase() === normTarget || u.id === targetAdminId);
  const isTargetSuper = isSuperAdmin(targetUser) || isSuperAdmin({ id: targetAdminId, email: normTarget });

  if (isTargetSuper) {
    const isSelfSuper = operatorAdmin.id === targetAdminId || operatorAdmin.email.toLowerCase() === normTarget;
    if (!isSelfSuper) {
      return { success: false, message: 'No se puede modificar la clave del Superadministrador principal desde esta función.' };
    }
  }

  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase
        .from('users')
        .update({ password: newPassword })
        .eq('id', targetAdminId);
      if (error) {
        await supabase
          .from('users')
          .update({ password: newPassword })
          .eq('email', normTarget);
      }
    } catch (err: any) {
      return { success: false, message: err?.message || 'Error en Supabase al actualizar contraseña.' };
    }
  }

  memoryUsers = memoryUsers.map(u =>
    u.id === targetAdminId || u.email.toLowerCase() === normTarget
      ? { ...u, password: newPassword }
      : u
  );

  await logAdminActivity({
    adminId: targetAdminId,
    adminEmail: operatorAdmin.email,
    adminName: operatorAdmin.name,
    actionType: 'ADMIN_PASSWORD_CHANGE',
    entityType: 'SEGURIDAD',
    entityId: normTarget,
    details: `${operatorAdmin.name} (Superadministrador) reasignó la contraseña de acceso del administrador ${normTarget}.`,
  });

  notifyDatabaseChange();
  return { success: true };
}

export async function sendRecoveryCodeEmail(
  targetEmail: string,
  code: string,
  recipientName = 'Usuario Einuushi'
): Promise<boolean> {
  const config = await getEmailConfig();
  const activeConfig = config.serviceId ? config : DEFAULT_EMAIL_CONFIG;

  try {
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8081',
      },
      body: JSON.stringify({
        service_id: activeConfig.serviceId,
        template_id: activeConfig.templateId,
        user_id: activeConfig.publicKey,
        template_params: {
          to_email: targetEmail,
          user_email: targetEmail,
          email_to: targetEmail,
          recipient: targetEmail,
          to_name: recipientName,
          recovery_code: code,
          code: code,
          store_name: 'Einuushi Artesanías',
          origin_city: 'Riohacha, La Guajira',
          message: `Hola ${recipientName}, tu código de verificación de seguridad para restablecer tu contraseña en Einuushi es: ${code} (vigencia de 1 minuto).`,
        },
      }),
    });

    return response.ok;
  } catch (error) {
    console.warn('Error enviando código de recuperación con EmailJS:', error);
    return false;
  }
}
