#!/bin/bash

# ============================================
# SCRIPT PARA CARGAR DATOS DE EJEMPLO DE FACTURACIÓN
# ============================================

echo ""
echo "=========================================="
echo "CARGANDO DATOS DE EJEMPLO - MÓDULO FACTURACIÓN"
echo "=========================================="
echo ""

# Verificar que el archivo .env exista
if [ ! -f ".env" ]; then
    echo "❌ Error: Archivo .env no encontrado en el directorio actual"
    echo "📌 Por favor, asegúrate de estar en la raíz del proyecto"
    exit 1
fi

# Cargar variables de entorno
export $(cat .env | grep -v '#' | xargs)

# Validar que las variables necesarias estén definidas
if [ -z "$DB_HOST" ] || [ -z "$DB_USER" ] || [ -z "$DB_NAME" ] || [ -z "$DB_PASSWORD" ]; then
    echo "❌ Error: Variables de base de datos no configuradas en .env"
    echo "📌 Se necesitan: DB_HOST, DB_USER, DB_NAME, DB_PASSWORD"
    exit 1
fi

echo "📊 Información de Conexión:"
echo "   Host: $DB_HOST"
echo "   Usuario: $DB_USER"
echo "   Base de Datos: $DB_NAME"
echo ""

# Verificar que el archivo de datos exista
if [ ! -f "database/facturacion-datos-ejemplo.sql" ]; then
    echo "❌ Error: Archivo database/facturacion-datos-ejemplo.sql no encontrado"
    exit 1
fi

echo "📥 Cargando datos de ejemplo..."
echo ""

# Ejecutar el script SQL
if MYSQL_PWD="$DB_PASSWORD" mysql -h "$DB_HOST" -u "$DB_USER" "$DB_NAME" < "database/facturacion-datos-ejemplo.sql"; then
    echo ""
    echo "✅ Datos de ejemplo cargados exitosamente"
    echo ""
    echo "=========================================="
    echo "RESUMEN DE DATOS INSERTADOS:"
    echo "=========================================="
    echo ""
    echo "✓ 6 pacientes de ejemplo"
    echo "✓ 10 medicinas disponibles"
    echo "✓ 7 tipos de descuentos predefinidos"
    echo "✓ 3 configuraciones de impuestos"
    echo "✓ 6 facturas completas con items y descuentos"
    echo "✓ Historial de movimientos de pacientes"
    echo "✓ Ejemplos de pagos y abonos"
    echo ""
    echo "TOTALES:"
    echo "  • Total Facturado: Q7,652.80"
    echo "  • Total Pagado:    Q3,188.80"
    echo "  • Saldo Pendiente: Q4,464.00"
    echo ""
    echo "=========================================="
    echo ""
    echo "📝 Para verificar los datos, puedes ejecutar:"
    echo "   - SELECT * FROM ventas WHERE numero_factura LIKE 'FAC-%';"
    echo "   - SELECT * FROM pacientes_saldo;"
    echo "   - SELECT * FROM descuentos WHERE activo = true;"
    echo ""
else
    echo ""
    echo "❌ Error al cargar los datos de ejemplo"
    echo "⚠️ Verifica que:"
    echo "   - Las credenciales en .env sean correctas"
    echo "   - La base de datos exista"
    echo "   - El usuario tenga permisos suficientes"
    exit 1
fi
