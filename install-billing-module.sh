#!/bin/bash

# ============================================
# SCRIPT DE INSTALACIÓN DEL MÓDULO DE FACTURACIÓN
# ============================================

echo "=========================================="
echo "Instalando Módulo de Facturación Robusta"
echo "=========================================="
echo ""

# Verificar que el archivo de conexión esté disponible
if [ ! -f ".env" ]; then
    echo "❌ Error: Archivo .env no encontrado"
    echo "Por favor, crear .env con la configuración de base de datos"
    exit 1
fi

# Cargar variables de entorno
export $(cat .env | grep -v '#' | xargs)

echo "📦 Conectando a la base de datos..."
echo "Host: $DB_HOST"
echo "Database: $DB_NAME"
echo "Usuario: $DB_USER"
echo ""

# Paso 1: Ejecutar extensión del schema
echo "📊 Aplicando cambios al schema..."

if psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f database/billing-schema-extension.sql; then
    echo "✅ Schema actualizado exitosamente"
else
    echo "❌ Error al actualizar el schema"
    exit 1
fi

echo ""

# Paso 2: Insertar descuentos predefinidos de ejemplo
echo "🏷️ Insertando descuentos predefinidos de ejemplo..."

psql -h $DB_HOST -U $DB_USER -d $DB_NAME << EOF

-- Limpiar descuentos previos (opcional)
-- DELETE FROM descuentos;

-- Insertar tipos de descuentos
INSERT INTO tipos_descuentos (nombre, descripcion, codigo, activo) 
VALUES 
  ('Porcentaje', 'Descuento expresado como porcentaje', 'PCT', true),
  ('Cantidad Fija', 'Descuento expresado como cantidad fija', 'FIX', true)
ON CONFLICT DO NOTHING;

-- Insertar descuentos predefinidos
INSERT INTO descuentos (id, nombre, descripcion, tipo_descuento, valor, minimo_aplicable, codigo_promocion, activo, fecha_inicio, fecha_fin) 
VALUES 
  ('DESC-VOLUMEN10', 'Descuento por Volumen 10%', 'Aplicable a compras mayores a Q500', 'porcentaje', 10, 500, 'VOLUMEN10', true, '2026-06-25', '2026-12-31'),
  ('DESC-VOLUMEN15', 'Descuento por Volumen 15%', 'Aplicable a compras mayores a Q1000', 'porcentaje', 15, 1000, 'VOLUMEN15', true, '2026-06-25', '2026-12-31'),
  ('DESC-CLIENTE-VIP', 'Descuento Cliente VIP 20%', 'Descuento exclusivo para clientes VIP', 'porcentaje', 20, 0, 'CLIENTEVIP', true, '2026-06-25', '2026-12-31'),
  ('DESC-PROMO-Q50', 'Promoción Q50 de Descuento', 'Descuento especial de Q50', 'fijo', 50, 200, 'PROMO50', true, '2026-06-25', '2026-07-25'),
  ('DESC-PROMO-Q100', 'Mega Descuento Q100', 'Gran descuento de Q100', 'fijo', 100, 500, 'MEGA100', true, '2026-06-25', '2026-07-25'),
  ('DESC-LIQUIDACION', 'Liquidación 30%', 'Descuento por cierre de temporada', 'porcentaje', 30, 0, 'LIQVER2026', true, '2026-07-01', '2026-08-31')
ON CONFLICT (id) DO NOTHING;

-- Insertar configuración de impuestos
INSERT INTO configuracion_impuestos (nombre, porcentaje, activo, es_predeterminado) 
VALUES 
  ('IVA', 12, true, true),
  ('ISR', 5, true, false),
  ('IMPUESTO MUNICIPAL', 2, true, false)
ON CONFLICT DO NOTHING;

EOF

if [ $? -eq 0 ]; then
    echo "✅ Datos de ejemplo insertados"
else
    echo "⚠️ Advertencia: No se pudieron insertar todos los datos de ejemplo"
fi

echo ""
echo "=========================================="
echo "✅ Instalación completada exitosamente"
echo "=========================================="
echo ""
echo "Próximos pasos:"
echo "1. Incluir <script src='js/facturacion.js'></script> en index.html"
echo "2. Reiniciar el servidor backend"
echo "3. Acceder a /facturacion-ejemplo.html para probar"
echo ""
echo "Documentación disponible en: FACTURACION_MODULO.md"
