// Archivos (PDF o imagen) que se guardan en la base: documentos del personal, vouchers de compras…

const MAX_ARCHIVO_BYTES = 10 * 1024 * 1024;
const TIPOS_ACEPTADOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const EXTENSIONES = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

// El tipo real del archivo sale de sus primeros bytes, no de lo que diga el navegador
const tipoDeArchivo = (contenido) => {
  if (contenido.subarray(0, 4).toString('latin1') === '%PDF') return 'application/pdf';
  if (contenido[0] === 0xff && contenido[1] === 0xd8 && contenido[2] === 0xff) return 'image/jpeg';
  if (contenido.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (contenido.subarray(0, 4).toString('latin1') === 'RIFF' && contenido.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return null;
};

// El nombre llega en la URL; se limpia para guardarlo y para el encabezado de descarga
const limpiarNombre = (nombre, tipoContenido, porDefecto = 'documento') => {
  const limpio = String(nombre || '').replace(/[\\/\r\n"]/g, '_').trim().slice(0, 200) || porDefecto;
  return /\.(pdf|jpe?g|png|webp)$/i.test(limpio) ? limpio : `${limpio}.${EXTENSIONES[tipoContenido]}`;
};

// Valida el cuerpo crudo de una subida. Devuelve { tipoContenido } o { status, error }.
const validarSubida = (contenido) => {
  if (!Buffer.isBuffer(contenido) || contenido.length === 0) return { status: 400, error: 'Adjunte un PDF o una imagen' };
  if (contenido.length > MAX_ARCHIVO_BYTES) return { status: 413, error: 'El archivo puede pesar hasta 10 MB' };
  const tipoContenido = tipoDeArchivo(contenido);
  if (!tipoContenido) return { status: 400, error: 'El archivo debe ser PDF, JPG, PNG o WEBP' };
  return { tipoContenido };
};

// Responde con el archivo para verlo en el navegador o descargarlo
const enviarArchivo = (res, { nombre, tipoContenido, contenido }) => {
  res.set({
    'Content-Type': tipoContenido,
    'Content-Length': contenido.length,
    'Content-Disposition': `inline; filename="${nombre.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(nombre)}`,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store'
  });
  res.send(contenido);
};

// Middleware de express para recibir el archivo tal cual (hasta 10 MB)
const recibirArchivo = (express) => express.raw({ type: TIPOS_ACEPTADOS, limit: '10mb' });

module.exports = { MAX_ARCHIVO_BYTES, tipoDeArchivo, limpiarNombre, validarSubida, enviarArchivo, recibirArchivo };
