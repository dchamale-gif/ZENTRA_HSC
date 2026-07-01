# 📊 DATOS DE EJEMPLO: MÓDULO DE FACTURACIÓN

## 📋 Descripción General

Este conjunto de datos de ejemplo permite probar completamente el módulo de facturación del sistema ZENTRA MED. Incluye pacientes, medicinas, descuentos, facturas completas, movimientos y pagos.

---

## 🚀 Cómo Usar

### Opción 1: Usar el Script Bash (Recomendado)

```bash
# 1. Asegúrate de estar en la raíz del proyecto
cd /Users/diego/SistemaContable

# 2. Dale permisos de ejecución al script
chmod +x load-facturacion-datos-ejemplo.sh

# 3. Ejecuta el script
./load-facturacion-datos-ejemplo.sh
```

### Opción 2: Ejecutar Directamente con MySQL

```bash
# Desde la raíz del proyecto
mysql -h localhost -u usuario -pcontraseña nombre_db < database/facturacion-datos-ejemplo.sql
```

### Opción 3: Usar en Interfaz de MySQL

```sql
-- En MySQL Workbench o similar
SOURCE database/facturacion-datos-ejemplo.sql;
```

---

## 📊 Datos Insertados

### 1. Pacientes (6 registros)

| ID | Nombre | Apellido | Edad | Teléfono | Estado |
|---|---|---|---|---|---|
| PAC-001 | Juan | Pérez | 45 | 555-1234567 | Activo |
| PAC-002 | María | González | 38 | 555-9876543 | Activo |
| PAC-003 | Carlos | López | 52 | 555-2223344 | Activo |
| PAC-004 | Ana | Martínez | 29 | 555-6667788 | Activo |
| PAC-005 | Roberto | García | 61 | 555-1313131 | Activo |
| PAC-006 | Elena | Rodríguez | 35 | 555-4545454 | Activo |

### 2. Medicinas (10 registros)

| Código | Nombre | Precio | Stock |
|---|---|---|---|
| MED-001 | Amoxicilina 500mg | Q150.00 | 100 |
| MED-002 | Ibuprofeno 400mg | Q85.00 | 150 |
| MED-003 | Paracetamol 500mg | Q65.00 | 200 |
| MED-004 | Vitamina D 1000UI | Q120.00 | 80 |
| MED-005 | Metformina 500mg | Q200.00 | 50 |
| MED-006 | Lisinopril 10mg | Q180.00 | 60 |
| MED-007 | Simvastatina 20mg | Q220.00 | 40 |
| MED-008 | Omeprazol 20mg | Q140.00 | 90 |
| MED-009 | Atorvastatina 40mg | Q240.00 | 35 |
| MED-010 | Fluoxetina 20mg | Q190.00 | 55 |

### 3. Tipos de Descuentos (3 tipos)

- ✓ Porcentaje (%)
- ✓ Cantidad Fija (Q)
- ✓ Copago

### 4. Descuentos Predefinidos (7 configuraciones)

| Código | Descuento | Tipo | Valor | Mínimo | Válido Hasta |
|---|---|---|---|---|---|
| VOLUMEN10 | Descuento Volumen 10% | Porcentaje | 10% | Q500 | 2026-12-31 |
| VOLUMEN15 | Descuento Volumen 15% | Porcentaje | 15% | Q1000 | 2026-12-31 |
| CLIENTEVIP | Cliente VIP 20% | Porcentaje | 20% | Q0 | 2026-12-31 |
| PROMO50 | Promoción Q50 | Cantidad Fija | Q50 | Q200 | 2026-07-25 |
| MEGA100 | Mega Descuento Q100 | Cantidad Fija | Q100 | Q500 | 2026-07-25 |
| AFILIADO | Descuento Afiliado 5% | Porcentaje | 5% | Q0 | 2026-12-31 |
| BULKBUY | Descuento Compra al Granel 25% | Porcentaje | 25% | Q2000 | 2026-12-31 |

### 5. Configuración de Impuestos (3 tipos)

| Nombre | Porcentaje | Activo | Predeterminado |
|---|---|---|---|
| IVA | 12.00% | ✓ | ✓ |
| ISR Retención | 5.00% | ✓ | ✗ |
| Impuesto Municipal | 2.00% | ✗ | ✗ |

### 6. Facturas (6 facturas completas)

#### Factura 1: FAC-001-2026-06-26-001
- **Paciente**: Juan Pérez (PAC-001)
- **Subtotal**: Q500.00
- **Descuentos**: Q0.00
- **Impuestos (12%)**: Q60.00
- **Total**: Q560.00
- **Estado**: Completada
- **Saldo Actual**: Q260.00 (Pagó Q300)
- **Items**: 3 (Amoxicilina x2, Ibuprofeno x1, Consulta)

#### Factura 2: FAC-002-2026-06-26-002
- **Paciente**: María González (PAC-002)
- **Subtotal**: Q1,200.00
- **Descuentos**: Q120.00 (10% volumen)
- **Base Impuesto**: Q1,080.00
- **Impuestos (12%)**: Q129.60
- **Total**: Q1,089.60
- **Estado**: Completada - PAGADA
- **Saldo Actual**: Q0.00
- **Items**: 3 (Metformina x3, Vitamina D x2, Análisis Lab)

#### Factura 3: FAC-003-2026-06-26-003
- **Paciente**: Carlos López (PAC-003)
- **Subtotal**: Q2,500.00
- **Descuentos**: Q375.00 (15% volumen)
- **Base Impuesto**: Q2,125.00
- **Impuestos (12%)**: Q255.00
- **Total**: Q2,380.00
- **Estado**: Completada
- **Saldo Actual**: Q880.00 (Pagó Q1,500)
- **Items**: 3 (Lisinopril x5, Simvastatina x4, Atorvastatina x3)

#### Factura 4: FAC-004-2026-06-26-004
- **Paciente**: Ana Martínez (PAC-004)
- **Subtotal**: Q300.00
- **Descuentos**: Q15.00 (5% afiliado)
- **Base Impuesto**: Q285.00
- **Impuestos (12%)**: Q34.20
- **Total**: Q319.20
- **Estado**: Completada - PAGADA
- **Saldo Actual**: Q0.00
- **Items**: 3 (Omeprazol, Paracetamol, Consulta Dentista)

#### Factura 5: FAC-005-2026-06-26-005
- **Paciente**: Roberto García (PAC-005)
- **Subtotal**: Q3,000.00
- **Descuentos**: Q750.00 (25% VIP)
- **Base Impuesto**: Q2,250.00
- **Impuestos (12%)**: Q270.00
- **Total**: Q2,520.00
- **Estado**: Completada
- **Saldo Actual**: Q2,520.00 (PENDIENTE)
- **Items**: 3 (Fluoxetina x10, Amoxicilina x5, Sesión Psicología x2)

#### Factura 6: FAC-006-2026-06-26-006
- **Paciente**: Elena Rodríguez (PAC-006)
- **Subtotal**: Q800.00
- **Descuentos**: Q100.00 (Q100 fijo - promoción)
- **Base Impuesto**: Q700.00
- **Impuestos (12%)**: Q84.00
- **Total**: Q784.00
- **Estado**: Completada
- **Saldo Actual**: Q284.00 (Pagó Q500)
- **Items**: 3 (Ibuprofeno x3, Paracetamol x4, Revisión General)

---

## 💰 Resumen Financiero

### Totales Generales
- **Total Facturado**: Q7,652.80
- **Total Descuentos Aplicados**: Q1,360.00
- **Total Impuestos**: Q832.80
- **Total Pagos Recibidos**: Q3,188.80
- **Saldo Pendiente**: Q4,464.00

### Estado por Paciente

| Paciente | Facturado | Pagado | Saldo |
|---|---|---|---|
| Juan Pérez | Q560.00 | Q300.00 | Q260.00 |
| María González | Q1,089.60 | Q1,089.60 | Q0.00 ✓ |
| Carlos López | Q2,380.00 | Q1,500.00 | Q880.00 |
| Ana Martínez | Q319.20 | Q319.20 | Q0.00 ✓ |
| Roberto García | Q2,520.00 | Q0.00 | Q2,520.00 |
| Elena Rodríguez | Q784.00 | Q500.00 | Q284.00 |

---

## 📝 Pagos Registrados (5 pagos)

1. **PAG-001**: Juan Pérez - Q300.00 (Efectivo) - Abono parcial
2. **PAG-002**: María González - Q1,089.60 (Tarjeta) - Pago completo
3. **PAG-003**: Carlos López - Q1,500.00 (Cheque) - Abono parcial
4. **PAG-004**: Ana Martínez - Q319.20 (Efectivo) - Pago completo
5. **PAG-006**: Elena Rodríguez - Q500.00 (Transferencia) - Abono parcial

---

## 🔍 Consultas Útiles para Verificación

### Ver todas las facturas
```sql
SELECT numero_factura, fecha, paciente_id, total, estado 
FROM ventas 
WHERE numero_factura LIKE 'FAC-%' 
ORDER BY fecha DESC;
```

### Ver saldo de pacientes
```sql
SELECT 
    p.nombre,
    p.apellido,
    ps.saldo_pendiente,
    ps.total_deuda
FROM pacientes_saldo ps
JOIN pacientes p ON ps.paciente_id = p.id
ORDER BY ps.saldo_pendiente DESC;
```

### Ver descuentos aplicados
```sql
SELECT 
    f.numero_factura,
    vd.tipo_descuento,
    vd.valor,
    vd.monto_descuento
FROM venta_descuentos vd
JOIN ventas f ON vd.venta_id = f.id
ORDER BY f.numero_factura;
```

### Ver movimientos de un paciente
```sql
SELECT 
    tipo,
    descripcion,
    monto,
    saldo_nuevo,
    fecha
FROM movimientos_paciente
WHERE paciente_id = 'PAC-001'
ORDER BY fecha DESC;
```

### Ver historial de pagos
```sql
SELECT 
    p.nombre,
    pp.monto,
    pp.metodo_pago,
    pp.fecha_pago
FROM pagos_paciente pp
JOIN pacientes p ON pp.paciente_id = p.id
ORDER BY pp.fecha_pago DESC;
```

---

## 🧹 Limpiar Datos de Ejemplo

Si necesitas limpiar los datos de ejemplo (CUIDADO: borra todos los datos), ejecuta:

```sql
-- Eliminar en orden de dependencias
DELETE FROM pagos_paciente WHERE referencia LIKE 'PAGO-%' OR referencia LIKE 'ABONO-%' OR referencia LIKE 'CHEQUE-%' OR referencia LIKE 'TRANSF-%';
DELETE FROM movimientos_paciente WHERE referencia_id LIKE 'FAC-%' OR referencia_id LIKE 'PAG-%';
DELETE FROM venta_descuentos WHERE venta_id LIKE 'FAC-%';
DELETE FROM venta_item_descuentos WHERE venta_item_id LIKE 'ITEM-%';
DELETE FROM venta_items WHERE venta_id LIKE 'FAC-%';
DELETE FROM ventas WHERE numero_factura LIKE 'FAC-%';
DELETE FROM pacientes_saldo WHERE paciente_id IN ('PAC-001', 'PAC-002', 'PAC-003', 'PAC-004', 'PAC-005', 'PAC-006');
DELETE FROM pacientes WHERE id IN ('PAC-001', 'PAC-002', 'PAC-003', 'PAC-004', 'PAC-005', 'PAC-006');
```

---

## 📚 Características Demostradas

✓ **Tipos de Descuentos**:
  - Descuentos por Porcentaje (5%, 10%, 15%, 25%)
  - Descuentos por Cantidad Fija (Q50, Q100)

✓ **Aplicación de Descuentos**:
  - A nivel de item individual
  - A nivel de factura completa
  - Múltiples descuentos por factura

✓ **Cálculos de Impuestos**:
  - IVA 12% aplicado correctamente
  - Base imponible después de descuentos

✓ **Gestión de Pagos**:
  - Pagos completos
  - Abonos parciales
  - Diferentes métodos (efectivo, tarjeta, cheque, transferencia)

✓ **Seguimiento de Saldos**:
  - Actualización automática de saldos
  - Historial de movimientos
  - Deuda total y pendiente

✓ **Medicinas en Stock**:
  - 10 medicinas diferentes
  - Precios variados
  - Stock actualizado

---

## ⚠️ Notas Importantes

1. **Base de Datos**: Asegúrate de tener una base de datos MySQL compatible
2. **Tablas**: Todas las tablas necesarias deben estar creadas (ejecuta migraciones primero)
3. **Usuario**: El usuario de DB debe tener permisos para INSERT, UPDATE, SELECT
4. **Conflictos**: Se usa `INSERT IGNORE` para evitar errores si los datos ya existen
5. **IDs**: Los IDs se generan con el formato apropiado para cada tabla

---

## 🐛 Solución de Problemas

**Error: "Table doesn't exist"**
- Solución: Ejecuta primero las migraciones: `database/schema.sql` y `database/facturacion-mejorada-migration.sql`

**Error: "Access Denied"**
- Solución: Verifica las credenciales en `.env`

**Error: "Duplicate entry"**
- Solución: Los datos ya existen. Usa `INSERT IGNORE` se encarga de esto automáticamente

**Datos no aparecen**
- Solución: Verifica que uses la base de datos correcta con `USE sistema_contable;`

---

## 📞 Soporte

Para más información sobre el módulo de facturación, consulta:
- [FACTURACION_MODULO.md](../FACTURACION_MODULO.md)
- [FACTURACION_MEJORADA_INTEGRACION.md](../FACTURACION_MEJORADA_INTEGRACION.md)
- [BACKEND_INTEGRATION.md](../BACKEND_INTEGRATION.md)

