-- ============================================
-- PREFERENCIAS DEL USUARIO: TEMA (claro, oscuro o el del sistema)
-- Cada perfil elige su tema desde el menú del usuario.
-- Idempotente: se puede ejecutar más de una vez.
-- ============================================

BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS tema VARCHAR(10) NOT NULL DEFAULT 'claro';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_tema_valido') THEN
        ALTER TABLE users ADD CONSTRAINT users_tema_valido CHECK (tema IN ('claro', 'oscuro', 'sistema'));
    END IF;
END $$;

COMMIT;
