-- ============================================================================
-- UNIVERSO GRÁFICO – COTIZADOR
-- Esquema de Base de Datos para Cloudflare D1 (SQLite en el Edge)
-- ============================================================================

-- 1. Tabla de usuarios para autenticación privada
CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nombre TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 2. Tabla unificada de registros para sincronización multidispositivo
CREATE TABLE IF NOT EXISTS registros (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('catalogo', 'cotizacion', 'cuenta_cobro', 'cliente', 'config')),
  datos TEXT NOT NULL, -- Datos JSON serializados
  deleted INTEGER NOT NULL DEFAULT 0, -- 0 = activo, 1 = borrado lógico
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- 3. Índices de alta velocidad
CREATE INDEX IF NOT EXISTS idx_registros_user_tipo ON registros(user_id, tipo);
CREATE INDEX IF NOT EXISTS idx_registros_user_updated ON registros(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_registros_user_deleted ON registros(user_id, deleted);
