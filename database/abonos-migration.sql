-- ============================================
-- ABONOS: PAGOS EN PARTES
-- Una requisición, un gasto o una compra suelta se pueden pagar en varios abonos,
-- en fechas distintas y con distintas formas de pago. Mientras lo abonado no cubre
-- el total el documento queda en pago parcial; al completarlo queda pagado.
-- Los pagos registrados antes de esta migración pasan a ser un abono por el total.
-- Idempotente: se puede ejecutar varias veces.
-- Uso: cd backend && npm run migrate:abonos
-- __TIPO_USUARIO_ID__ lo reemplaza el script con el tipo real de users.id.
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS abonos (
    id SERIAL PRIMARY KEY,
    documento VARCHAR(12) NOT NULL,                     -- requisicion, gasto o compra
    documento_id VARCHAR(50) NOT NULL,                  -- el id del documento, como texto
    fecha DATE NOT NULL,
    monto NUMERIC(12, 2) NOT NULL,
    forma_pago VARCHAR(15) NOT NULL,
    numero_pago_banco VARCHAR(60),
    numero_autorizacion VARCHAR(60),
    referencia VARCHAR(60),
    registrado_por __TIPO_USUARIO_ID__ REFERENCES users(id) ON DELETE SET NULL,
    registrado_por_nombre VARCHAR(150) NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT abonos_documento_valido CHECK (documento IN ('requisicion', 'gasto', 'compra')),
    CONSTRAINT abonos_monto_valido CHECK (monto > 0),
    CONSTRAINT abonos_forma_pago_valida CHECK (forma_pago IN ('efectivo', 'tarjeta', 'cheque', 'transferencia'))
);

CREATE INDEX IF NOT EXISTS idx_abonos_documento ON abonos (documento, documento_id, fecha);

DO $$
BEGIN
    -- Requisiciones: estado "parcial", voucher por abono y sus pagos anteriores como un abono
    IF to_regclass('public.requisiciones') IS NOT NULL THEN
        ALTER TABLE requisiciones DROP CONSTRAINT IF EXISTS requisiciones_estado_valido;
        ALTER TABLE requisiciones ADD CONSTRAINT requisiciones_estado_valido
            CHECK (estado IN ('pendiente', 'parcial', 'pagada', 'anulada'));
        ALTER TABLE requisicion_vouchers ADD COLUMN IF NOT EXISTS abono_id INTEGER REFERENCES abonos(id) ON DELETE SET NULL;
        INSERT INTO abonos (documento, documento_id, fecha, monto, forma_pago, numero_pago_banco, numero_autorizacion, registrado_por_nombre, created_at)
        SELECT 'requisicion', r.id::text, r.fecha_pago,
               (SELECT SUM(c.total) FROM compras c WHERE c.requisicion_id = r.id AND c.estado <> 'cancelada'),
               r.forma_pago, r.numero_pago_banco, r.numero_autorizacion, COALESCE(r.pagado_por_nombre, ''), r.updated_at
        FROM requisiciones r
        WHERE r.estado = 'pagada'
          AND (SELECT SUM(c.total) FROM compras c WHERE c.requisicion_id = r.id AND c.estado <> 'cancelada') > 0
          AND NOT EXISTS (SELECT 1 FROM abonos a WHERE a.documento = 'requisicion' AND a.documento_id = r.id::text);
    END IF;

    -- Gastos: estado "parcial" y voucher por abono
    IF to_regclass('public.gastos') IS NOT NULL THEN
        ALTER TABLE gastos DROP CONSTRAINT IF EXISTS gastos_estado_valido;
        ALTER TABLE gastos ADD CONSTRAINT gastos_estado_valido
            CHECK (estado IN ('pendiente', 'cargado', 'parcial', 'pagado', 'anulado'));
        IF to_regclass('public.gasto_vouchers') IS NOT NULL THEN
            ALTER TABLE gasto_vouchers ADD COLUMN IF NOT EXISTS abono_id INTEGER REFERENCES abonos(id) ON DELETE SET NULL;
        END IF;
        INSERT INTO abonos (documento, documento_id, fecha, monto, forma_pago, numero_pago_banco, numero_autorizacion, referencia, registrado_por_nombre, created_at)
        SELECT 'gasto', g.id::text, g.fecha_pago, g.monto, g.forma_pago, g.numero_pago_banco, g.numero_autorizacion,
               g.referencia_pago, COALESCE(g.pagado_por_nombre, ''), g.updated_at
        FROM gastos g
        WHERE g.estado = 'pagado'
          AND NOT EXISTS (SELECT 1 FROM abonos a WHERE a.documento = 'gasto' AND a.documento_id = g.id::text);
    END IF;

    -- Compras con pago propio (las de una requisición las paga la requisición)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'compras' AND column_name = 'fecha_pago') THEN
        IF to_regclass('public.compra_vouchers') IS NOT NULL THEN
            ALTER TABLE compra_vouchers ADD COLUMN IF NOT EXISTS abono_id INTEGER REFERENCES abonos(id) ON DELETE SET NULL;
        END IF;
        INSERT INTO abonos (documento, documento_id, fecha, monto, forma_pago, referencia, created_at)
        SELECT 'compra', c.id::text, c.fecha_pago, c.total, COALESCE(c.forma_pago, 'efectivo'), c.referencia_pago, c.updated_at
        FROM compras c
        WHERE c.fecha_pago IS NOT NULL AND c.total > 0
          AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                          WHERE table_name = 'compras' AND column_name = 'requisicion_id')
          AND NOT EXISTS (SELECT 1 FROM abonos a WHERE a.documento = 'compra' AND a.documento_id = c.id::text);
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'compras' AND column_name = 'requisicion_id') THEN
            INSERT INTO abonos (documento, documento_id, fecha, monto, forma_pago, referencia, created_at)
            SELECT 'compra', c.id::text, c.fecha_pago, c.total, COALESCE(c.forma_pago, 'efectivo'), c.referencia_pago, c.updated_at
            FROM compras c
            WHERE c.fecha_pago IS NOT NULL AND c.total > 0 AND c.requisicion_id IS NULL
              AND NOT EXISTS (SELECT 1 FROM abonos a WHERE a.documento = 'compra' AND a.documento_id = c.id::text);
        END IF;
    END IF;
END $$;

COMMIT;
