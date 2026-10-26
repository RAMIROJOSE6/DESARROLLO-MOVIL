-- ============================================================================
-- ESQUEMA RELACIONAL INTEGRAL EINUUSHI - SUPABASE (POSTGRESQL + STORAGE)
-- ============================================================================
-- Este script define el modelo relacional completo y optimizado para la app móvil
-- y el panel web del administrador, garantizando integridad referencial (Foreign Keys),
-- soporte multimedia, métricas analíticas e indexación de alto rendimiento.

-- 1. EXTENSIONES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 2. TABLAS BASE
-- ============================================================================

-- 2.1 Categorías
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2.2 Artículos / Productos
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category_id TEXT,
  price_value INTEGER NOT NULL,
  price TEXT NOT NULL,
  icon TEXT NOT NULL,
  image_path TEXT, -- URL pública en Supabase Storage o asset local
  image_name TEXT,
  ancestral_ref TEXT NOT NULL DEFAULT '',
  stock INTEGER NOT NULL DEFAULT 0,
  likes INTEGER NOT NULL DEFAULT 0,
  discount_percent INTEGER DEFAULT 0,
  is_discount_active INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2.3 Usuarios Registrados (Clientes y Administradores)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  cedula TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  city TEXT NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'client', -- 'client' | 'admin'
  avatar TEXT, -- URL pública de Supabase Storage
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2.4 Pedidos
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  user_email TEXT,
  date TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_cedula TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  client_address TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING' | 'PAID'
  subtotal INTEGER NOT NULL DEFAULT 0,
  shipping INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Recibido',
  status_code TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING' | 'DISPATCHED' | 'ARRIVED' | 'DELIVERED'
  eta TEXT NOT NULL,
  rating INTEGER DEFAULT 0,
  items_json JSONB NOT NULL, -- Copia snapshot inmutable de los productos comprados
  dispatched_at BIGINT,
  received_at TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- 3. NUEVAS TABLAS RELACIONALES (INTEGRIDAD Y REPORTES)
-- ============================================================================

-- 3.1 Detalle Relacional de Pedidos (Items por pedido)
CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  order_id TEXT NOT NULL,
  product_id TEXT,
  product_name TEXT NOT NULL,
  price_value INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  subtotal INTEGER NOT NULL,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3.2 Favoritos / Likes de Usuarios (Relación Muchos a Muchos: Users <-> Products)
CREATE TABLE IF NOT EXISTS user_favorites (
  user_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (user_id, product_id)
);

-- 3.3 Notificaciones (Vinculadas a Pedido y Usuario)
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  user_id TEXT,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  time TEXT NOT NULL,
  read INTEGER DEFAULT 0 NOT NULL, -- 0 = no leída, 1 = leída
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3.4 Diseños Personalizados e IA (Cotizaciones de Clientes)
CREATE TABLE IF NOT EXISTS custom_quotes (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  user_email TEXT NOT NULL,
  userName TEXT NOT NULL,
  client_phone TEXT,
  design_type TEXT NOT NULL,
  colors_json TEXT,
  pattern TEXT,
  prompt TEXT NOT NULL,
  image_url TEXT, -- URL pública en Supabase Storage
  status TEXT NOT NULL DEFAULT 'PENDING_QUOTE', -- 'PENDING_QUOTE' | 'QUOTED' | 'ACCEPTED' | 'REJECTED'
  quoted_price INTEGER DEFAULT 0,
  quoted_delivery_days INTEGER DEFAULT 0,
  admin_notes TEXT,
  order_id TEXT, -- Si la cotización se convirtió en un pedido formal
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3.5 Mensajes de Chat (Cliente <-> Administrador / Vinculado a Cotización)
CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  user_email TEXT NOT NULL,
  userName TEXT NOT NULL,
  sender_role TEXT NOT NULL DEFAULT 'client', -- 'client' | 'admin'
  message TEXT NOT NULL,
  quote_id TEXT, -- Vinculado a una cotización específica si aplica
  read INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3.6 Reseñas y Calificaciones Detalladas
CREATE TABLE IF NOT EXISTS order_reviews (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  order_id TEXT NOT NULL,
  user_id TEXT,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3.7 Historial de Auditoría de Inventario (Cambios realizados por el Administrador)
CREATE TABLE IF NOT EXISTS inventory_logs (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  product_id TEXT NOT NULL,
  admin_id TEXT,
  action TEXT NOT NULL, -- 'STOCK_UPDATE' | 'DISCOUNT_APPLIED' | 'PRICE_CHANGE' | 'PRODUCT_CREATED'
  previous_stock INTEGER,
  new_stock INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3.8 Configuración EmailJS
CREATE TABLE IF NOT EXISTS email_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  service_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  public_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- 4. INTEGRIDAD REFERENCIAL (FOREIGN KEYS SEGURAS)
-- ============================================================================

-- Agregar columnas faltantes en tablas existentes si ya fueron creadas previamente
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='user_id') THEN
    ALTER TABLE notifications ADD COLUMN user_id TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='custom_quotes' AND column_name='order_id') THEN
    ALTER TABLE custom_quotes ADD COLUMN order_id TEXT;
  END IF;
END $$;

-- 4.1 products -> categories
ALTER TABLE products DROP CONSTRAINT IF EXISTS fk_products_category;
ALTER TABLE products ADD CONSTRAINT fk_products_category
  FOREIGN KEY (category_id) REFERENCES categories(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- 4.2 orders -> users
ALTER TABLE orders DROP CONSTRAINT IF EXISTS fk_orders_user;
ALTER TABLE orders ADD CONSTRAINT fk_orders_user
  FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- 4.3 order_items -> orders
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS fk_order_items_order;
ALTER TABLE order_items ADD CONSTRAINT fk_order_items_order
  FOREIGN KEY (order_id) REFERENCES orders(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- 4.4 order_items -> products
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS fk_order_items_product;
ALTER TABLE order_items ADD CONSTRAINT fk_order_items_product
  FOREIGN KEY (product_id) REFERENCES products(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- 4.5 user_favorites -> users & products
ALTER TABLE user_favorites DROP CONSTRAINT IF EXISTS fk_favorites_user;
ALTER TABLE user_favorites ADD CONSTRAINT fk_favorites_user
  FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE user_favorites DROP CONSTRAINT IF EXISTS fk_favorites_product;
ALTER TABLE user_favorites ADD CONSTRAINT fk_favorites_product
  FOREIGN KEY (product_id) REFERENCES products(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- 4.6 notifications -> orders & users
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS fk_notifications_order;
ALTER TABLE notifications ADD CONSTRAINT fk_notifications_order
  FOREIGN KEY (order_id) REFERENCES orders(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS fk_notifications_user;
ALTER TABLE notifications ADD CONSTRAINT fk_notifications_user
  FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- 4.7 custom_quotes -> users & orders
ALTER TABLE custom_quotes DROP CONSTRAINT IF EXISTS fk_quotes_user;
ALTER TABLE custom_quotes ADD CONSTRAINT fk_quotes_user
  FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE custom_quotes DROP CONSTRAINT IF EXISTS fk_quotes_order;
ALTER TABLE custom_quotes ADD CONSTRAINT fk_quotes_order
  FOREIGN KEY (order_id) REFERENCES orders(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- 4.8 chat_messages -> users & custom_quotes
ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS fk_chat_user;
ALTER TABLE chat_messages ADD CONSTRAINT fk_chat_user
  FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS fk_chat_quote;
ALTER TABLE chat_messages ADD CONSTRAINT fk_chat_quote
  FOREIGN KEY (quote_id) REFERENCES custom_quotes(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- 4.9 order_reviews -> orders & users
ALTER TABLE order_reviews DROP CONSTRAINT IF EXISTS fk_reviews_order;
ALTER TABLE order_reviews ADD CONSTRAINT fk_reviews_order
  FOREIGN KEY (order_id) REFERENCES orders(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE order_reviews DROP CONSTRAINT IF EXISTS fk_reviews_user;
ALTER TABLE order_reviews ADD CONSTRAINT fk_reviews_user
  FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- 4.10 inventory_logs -> products & users
ALTER TABLE inventory_logs DROP CONSTRAINT IF EXISTS fk_inventory_product;
ALTER TABLE inventory_logs ADD CONSTRAINT fk_inventory_product
  FOREIGN KEY (product_id) REFERENCES products(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE inventory_logs DROP CONSTRAINT IF EXISTS fk_inventory_admin;
ALTER TABLE inventory_logs ADD CONSTRAINT fk_inventory_admin
  FOREIGN KEY (admin_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- ============================================================================
-- 5. ÍNDICES DE RENDIMIENTO (BÚSQUEDAS RÁPIDAS EN MÓVIL Y ADMIN)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(user_email);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status_code);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_user ON user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_order ON notifications(order_id);
CREATE INDEX IF NOT EXISTS idx_quotes_user ON custom_quotes(user_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON custom_quotes(status);
CREATE INDEX IF NOT EXISTS idx_chat_email ON chat_messages(user_email);
CREATE INDEX IF NOT EXISTS idx_chat_quote ON chat_messages(quote_id);

-- ============================================================================
-- 6. VISTAS SQL PARA EL PANEL ADMINISTRADOR (MÉTRICAS EN TIEMPO REAL)
-- ============================================================================

CREATE OR REPLACE VIEW view_admin_metrics AS
SELECT
  COUNT(*) FILTER (WHERE TRUE) AS total_orders,
  COUNT(*) FILTER (WHERE status_code = 'PENDING') AS pending_orders,
  COUNT(*) FILTER (WHERE status_code = 'DISPATCHED') AS dispatched_orders,
  COUNT(*) FILTER (WHERE status_code = 'DELIVERED') AS delivered_orders,
  COALESCE(SUM(total) FILTER (WHERE payment_status = 'PAID'), 0) AS total_revenue,
  COALESCE(AVG(total) FILTER (WHERE payment_status = 'PAID'), 0) AS average_ticket
FROM orders;

CREATE OR REPLACE VIEW view_top_selling_products AS
SELECT 
  p.id,
  p.name,
  p.price,
  p.stock,
  p.image_path,
  COALESCE(SUM(oi.quantity), 0) AS total_units_sold,
  COALESCE(SUM(oi.subtotal), 0) AS total_generated
FROM products p
LEFT JOIN order_items oi ON oi.product_id = p.id
GROUP BY p.id, p.name, p.price, p.stock, p.image_path
ORDER BY total_units_sold DESC;

-- ============================================================================
-- 7. POLÍTICAS DE ACCESO (ROW LEVEL SECURITY - RLS)
-- ============================================================================

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total a categories" ON categories;
CREATE POLICY "Acceso total a categories" ON categories FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total a products" ON products;
CREATE POLICY "Acceso total a products" ON products FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total a users" ON users;
CREATE POLICY "Acceso total a users" ON users FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total a orders" ON orders;
CREATE POLICY "Acceso total a orders" ON orders FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total a order_items" ON order_items;
CREATE POLICY "Acceso total a order_items" ON order_items FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total a user_favorites" ON user_favorites;
CREATE POLICY "Acceso total a user_favorites" ON user_favorites FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total a notifications" ON notifications;
CREATE POLICY "Acceso total a notifications" ON notifications FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE custom_quotes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total a custom_quotes" ON custom_quotes;
CREATE POLICY "Acceso total a custom_quotes" ON custom_quotes FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total a chat_messages" ON chat_messages;
CREATE POLICY "Acceso total a chat_messages" ON chat_messages FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE order_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total a order_reviews" ON order_reviews;
CREATE POLICY "Acceso total a order_reviews" ON order_reviews FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE inventory_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total a inventory_logs" ON inventory_logs;
CREATE POLICY "Acceso total a inventory_logs" ON inventory_logs FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE email_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total a email_config" ON email_config;
CREATE POLICY "Acceso total a email_config" ON email_config FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 8. ALMACENAMIENTO DE FOTOS E IMÁGENES (SUPABASE STORAGE)
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('einuushi-media', 'einuushi-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Lectura publica de fotos einuushi" ON storage.objects;
CREATE POLICY "Lectura publica de fotos einuushi"
ON storage.objects FOR SELECT
USING (bucket_id = 'einuushi-media');

DROP POLICY IF EXISTS "Subida de fotos einuushi" ON storage.objects;
CREATE POLICY "Subida de fotos einuushi"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'einuushi-media');

DROP POLICY IF EXISTS "Actualizacion de fotos einuushi" ON storage.objects;
CREATE POLICY "Actualizacion de fotos einuushi"
ON storage.objects FOR UPDATE
USING (bucket_id = 'einuushi-media');

DROP POLICY IF EXISTS "Eliminacion de fotos einuushi" ON storage.objects;
CREATE POLICY "Eliminacion de fotos einuushi"
ON storage.objects FOR DELETE
USING (bucket_id = 'einuushi-media');

-- ============================================================================
-- 9. DATOS SEMILLA INICIALES
-- ============================================================================

-- Categorías ancestrales
INSERT INTO categories (id, name, icon, description)
VALUES 
  ('Mochilas', 'Mochilas', 'bag-handle-outline', 'Mochilas tejidas a mano por mujeres wayuu con hilo de algodón.'),
  ('Mantas', 'Mantas', 'shirt-outline', 'Vestimenta sagrada de gran fluidez, usada en rituales y danzas.'),
  ('Chinchorros', 'Chinchorros', 'git-commit-outline', 'Hamaca ceremonial tejida a mano, símbolo de estatus y descanso.'),
  ('Accesorios', 'Accesorios', 'color-palette-outline', 'Sombreros de zwele y detalles ancestrales para el sol guajiro.')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  description = EXCLUDED.description;

-- Producto inicial de catálogo
INSERT INTO products (id, name, category_id, price_value, price, icon, image_path, image_name, ancestral_ref, stock, likes, discount_percent, is_discount_active, is_active)
VALUES 
  ('CHINCHORRO_INIT', 'CHINCHORRO', 'Chinchorros', 550000, '$ 550.000 COP', 'sparkles-outline', 'https://ismvmlcemxkawdwextzk.supabase.co/storage/v1/object/public/einuushi-media/crafts/chinchorro1.jpg', 'chinchorro', 'Tejido ceremonial wayuu', 2, 0, 0, 0, 1)
ON CONFLICT (id) DO NOTHING;

-- Administrador oficial de la plataforma (Los clientes se registran dinámicamente desde la app móvil)
INSERT INTO users (id, full_name, cedula, email, phone, city, password, role)
VALUES 
  ('USR-ADMIN-01', 'Administrador Einuushi', '1124000000', 'admin@einuushi.com', '3009998877', 'Riohacha', 'admin2026', 'admin')
ON CONFLICT (id) DO NOTHING;

-- Configuración inicial de EmailJS
INSERT INTO email_config (id, service_id, template_id, public_key)
VALUES 
  ('default', 'service_vmuqrwm', 'template_av14rue', 'OsViJ6P2M_ebWewhr')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 10. TABLA DE TRAZABILIDAD Y AUDITORÍA DE ADMINISTRADORES
-- ============================================================================
-- Registra de forma inmutable quién realizó cada acción dentro del panel de administración
CREATE TABLE IF NOT EXISTS admin_activity_logs (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  admin_id TEXT,
  admin_email TEXT NOT NULL,
  admin_name TEXT NOT NULL,
  action_type TEXT NOT NULL, -- 'CONFIRM_PAYMENT' | 'DISPATCH_ORDER' | 'DELIVER_ORDER' | 'STOCK_UPDATE' | 'DISCOUNT_CHANGE' | 'PRODUCT_CREATE' | 'PRODUCT_EDIT' | 'PRODUCT_DELETE' | 'PHOTO_UPDATE' | 'QUOTE_RESPONSE' | 'ADMIN_PROFILE_UPDATE' | 'ADMIN_CREATE' | 'CHAT_MESSAGE'
  entity_type TEXT NOT NULL, -- 'PEDIDO' | 'PRODUCTO' | 'COTIZACION' | 'CHAT' | 'SEGURIDAD'
  entity_id TEXT,
  details TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Asegurar columna de trazabilidad en pedidos si no existe
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='admin_responsible') THEN
    ALTER TABLE orders ADD COLUMN admin_responsible TEXT;
  END IF;
END $$;

ALTER TABLE admin_activity_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lectura y escritura publica de admin_activity_logs" ON admin_activity_logs;
CREATE POLICY "Lectura y escritura publica de admin_activity_logs" ON admin_activity_logs
  FOR ALL USING (true) WITH CHECK (true);

