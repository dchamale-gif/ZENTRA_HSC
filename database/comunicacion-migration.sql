-- ============================================
-- NOTIFICACIONES POR USUARIO Y CHAT INTERNO
-- Idempotente: se puede ejecutar varias veces.
-- ============================================

BEGIN;

-- Notificaciones dirigidas a un usuario
CREATE TABLE IF NOT EXISTS notificaciones (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL,
    titulo VARCHAR(200) NOT NULL,
    mensaje TEXT NOT NULL DEFAULT '',
    enlace VARCHAR(100),               -- página del sistema a la que lleva (p. ej. 'ordenes-medicas')
    leida BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario
    ON notificaciones(user_id, leida, created_at DESC);

-- Mensajes del chat interno (conversaciones uno a uno)
CREATE TABLE IF NOT EXISTS mensajes (
    id SERIAL PRIMARY KEY,
    remitente_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    destinatario_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contenido TEXT NOT NULL CHECK (char_length(contenido) BETWEEN 1 AND 2000),
    leido_en TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (remitente_id <> destinatario_id)
);

CREATE INDEX IF NOT EXISTS idx_mensajes_no_leidos
    ON mensajes(destinatario_id) WHERE leido_en IS NULL;

CREATE INDEX IF NOT EXISTS idx_mensajes_conversacion
    ON mensajes(LEAST(remitente_id, destinatario_id), GREATEST(remitente_id, destinatario_id), id DESC);

COMMIT;
