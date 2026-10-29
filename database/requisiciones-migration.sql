-- ============================================
-- REQUISICIONES A PROVEEDORES
-- Junta las facturas (compras) de un proveedor de un mes en un solo documento
-- que se le manda al proveedor y se paga de una vez: al pagarla, todas sus
-- facturas quedan pagadas. Correlativo por año: RQS-0001-2026.
-- No confundir con los requerimientos de compra (lo que pide cada bodega).
-- Idempotente: se puede ejecutar varias veces.
-- Uso: cd backend && npm run migrate:requisiciones
-- Los __TIPO_…__ los reemplaza el script con el tipo real de cada id en esta base.
-- ============================================

BEGIN;

-- Mismo contador que usan requerimientos, compras y gastos
CREATE TABLE IF NOT EXISTS correlativos (
    tipo VARCHAR(20) NOT NULL,
    ambito VARCHAR(10) NOT NULL,
    anio INTEGER NOT NULL,
    ultimo INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (tipo, ambito, anio)
);

CREATE TABLE IF NOT EXISTS requisiciones (
    id SERIAL PRIMARY KEY,
    numero VARCHAR(30) NOT NULL UNIQUE,
    proveedor_id __TIPO_PROVEEDOR_ID__ NOT NULL REFERENCES proveedores(id),
    periodo DATE NOT NULL,                              -- primer día del mes que agrupa
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    observaciones TEXT,
    estado VARCHAR(12) NOT NULL DEFAULT 'pendiente',
    fecha_pago DATE,
    forma_pago VARCHAR(15),
    numero_pago_banco VARCHAR(60),
    numero_autorizacion VARCHAR(60),
    pagado_por_nombre VARCHAR(150),
    motivo_anulacion TEXT,
    creado_por __TIPO_USUARIO_ID__ REFERENCES users(id) ON DELETE SET NULL,
    creado_por_nombre VARCHAR(150) NOT NULL DEFAULT '',
    actualizado_por_nombre VARCHAR(150),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT requisiciones_estado_valido CHECK (estado IN ('pendiente', 'pagada', 'anulada')),
    CONSTRAINT requisiciones_forma_pago_valida CHECK (forma_pago IS NULL OR forma_pago IN ('efectivo', 'tarjeta', 'cheque', 'transferencia')),
    CONSTRAINT requisiciones_periodo_mes CHECK (EXTRACT(DAY FROM periodo) = 1),
    CONSTRAINT requisiciones_pago_completo CHECK (estado <> 'pagada' OR (fecha_pago IS NOT NULL AND forma_pago IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_requisiciones_proveedor ON requisiciones (proveedor_id, periodo DESC);
CREATE INDEX IF NOT EXISTS idx_requisiciones_estado ON requisiciones (estado, periodo DESC);

-- Cada factura (compra) va en una sola requisición. El número de factura también
-- lo agrega la migración de requerimientos; aquí por si esta se corre antes.
ALTER TABLE compras ADD COLUMN IF NOT EXISTS numero_factura VARCHAR(60);
ALTER TABLE compras ADD COLUMN IF NOT EXISTS requisicion_id INTEGER REFERENCES requisiciones(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_compras_requisicion ON compras (requisicion_id) WHERE requisicion_id IS NOT NULL;

-- Voucher del pago (opcional): PDF o imagen guardado en la base
CREATE TABLE IF NOT EXISTS requisicion_vouchers (
    id SERIAL PRIMARY KEY,
    requisicion_id INTEGER NOT NULL REFERENCES requisiciones(id) ON DELETE CASCADE,
    nombre_archivo VARCHAR(255) NOT NULL,
    tipo_contenido VARCHAR(40) NOT NULL
        CHECK (tipo_contenido IN ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
    tamano INTEGER NOT NULL,
    contenido BYTEA NOT NULL,
    subido_por __TIPO_USUARIO_ID__ REFERENCES users(id) ON DELETE SET NULL,
    subido_por_nombre VARCHAR(150) NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_requisicion_vouchers ON requisicion_vouchers (requisicion_id);

COMMIT;
