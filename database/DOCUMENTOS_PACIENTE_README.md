# Migración: Documentos del Paciente - Base de Datos

## Descripción
Este script SQL agrega soporte completo para almacenar documentos y fotografías de pacientes con las siguientes categorías:

- **DPI_Paciente** - Documento de identidad personal del paciente
- **Pasaporte_Paciente** - Pasaporte del paciente
- **DPI_Responsable** - Documento de identidad del responsable
- **Pasaporte_Responsable** - Pasaporte del responsable
- **Foto_Perfil_Responsable** - Fotografía de perfil del responsable
- **Documentos_Medicos** - Documentos médicos adicionales
- **Otros** - Otros documentos relevantes

## Archivos de Migración

### `fix-documentos-paciente.sql`
Script principal que:
- ✅ Crea la tabla `documentos_paciente` si no existe
- ✅ Crea índices para optimizar búsquedas
- ✅ Agrega comentarios descriptivos
- ✅ Es idempotente (seguro ejecutar múltiples veces)

## Instalación en PostgreSQL

### Opción 1: Directamente desde el servidor
```bash
ssh root@178.128.72.110
cd /opt/stack/ZENTRA_HSC

# Ejecutar la migración
psql -h <DB_HOST> -U <DB_USER> -d dbaas-db-6841861 -f database/fix-documentos-paciente.sql
```

### Opción 2: Desde el cliente psql interactivo
```sql
-- Conectarse a la base de datos
psql -h <DB_HOST> -U <DB_USER> -d dbaas-db-6841861

-- Ejecutar el script
\i /ruta/a/database/fix-documentos-paciente.sql
```

### Opción 3: Con pg_restore (si usas backup)
```bash
psql -h <DB_HOST> -U <DB_USER> -d dbaas-db-6841861 < database/fix-documentos-paciente.sql
```

## Estructura de la Tabla

```sql
CREATE TABLE documentos_paciente (
    id VARCHAR(50) PRIMARY KEY,           -- UUID único
    paciente_id VARCHAR(50) NOT NULL,     -- FK a pacientes
    categoria VARCHAR(100),                -- Categoría del documento
    nombre_archivo VARCHAR(255),          -- Nombre original del archivo
    contenido TEXT,                       -- Datos en base64
    timestamp_carga TIMESTAMP,            -- Fecha de carga
    created_at TIMESTAMP                  -- Fecha de creación en BD
);
```

## Índices Creados

```sql
idx_documentos_paciente              -- Búsqueda por paciente_id
idx_documentos_categoria             -- Búsqueda por categoría
idx_documentos_paciente_categoria    -- Búsqueda combinada (más rápido)
```

## Campos de Contenido

El campo `contenido` almacena:
- **Fotografías**: Convertidas a Base64 (PNG, JPG, etc)
- **Documentos**: Escaneos en PDF/imagen, convertidos a Base64
- **Tamaño máximo**: ~1MB por documento (típicamente suficiente)

Ejemplo de carga:
```javascript
const file = await fetch(fileInput.files[0]);
const arrayBuffer = await file.arrayBuffer();
const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

// Guardar en BD
await fetch('/api/documentos-paciente', {
    method: 'POST',
    body: JSON.stringify({
        paciente_id: 'PAC-001',
        categoria: 'DPI_Paciente',
        nombre_archivo: 'dpi-scan.pdf',
        contenido: base64
    })
});
```

## Verificación

Después de ejecutar la migración, verifica:

```sql
-- Verificar tabla existe
\dt documentos_paciente

-- Verificar índices
\di idx_documentos*

-- Verificar estructura
\d+ documentos_paciente

-- Contar registros
SELECT COUNT(*) FROM documentos_paciente;
```

## Restauración en Caso de Error

Si necesitas revertir la migración:

```sql
-- ADVERTENCIA: Esto eliminará todos los documentos
DROP TABLE IF EXISTS documentos_paciente CASCADE;
```

## APIs Backend Disponibles

Una vez ejecutada la migración:

### GET - Obtener todos los documentos de un paciente
```
GET /api/documentos-paciente/:pacienteId
Authorization: Bearer <token>
```

### GET - Obtener documento específico por categoría
```
GET /api/documentos-paciente/:pacienteId/categoria/:categoria
Authorization: Bearer <token>
```

### POST - Crear/actualizar documento
```
POST /api/documentos-paciente
Authorization: Bearer <token>
Content-Type: application/json

{
    "paciente_id": "PAC-001",
    "categoria": "DPI_Paciente",
    "nombre_archivo": "dpi.pdf",
    "contenido": "<base64_string>"
}
```

### DELETE - Eliminar documento
```
DELETE /api/documentos-paciente/:id
Authorization: Bearer <token>
```

## Notas Importantes

1. **Tamaño de Base de Datos**: Cada documento en base64 aumenta el tamaño ~33%
2. **Backup**: Asegúrate de hacer backup antes de ejecutar la migración
3. **Idempotencia**: El script es seguro ejecutar múltiples veces
4. **Índices**: Se crean automáticamente para optimizar búsquedas
5. **Cascada**: Si se elimina un paciente, sus documentos se eliminan automáticamente

---

**Fecha**: 2026-09-21  
**Versión**: 1.0  
**Estado**: Producción
