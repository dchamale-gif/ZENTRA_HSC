const pool = require('../db/connection');
const { cargarPermisos } = require('../middleware/auth');
const { validarSubida, limpiarNombre, enviarArchivo } = require('../services/archivos');

// ============================================
// Base común de Personal médico y Personal (administrativo y de apoyo).
// Cada módulo indica su tabla y sus datos profesionales (especialidad y colegiado,
// o puesto y área); lo demás se comparte: foto y DPI, horario, disponibilidad para
// emergencias, documentos y el usuario del sistema vinculado.
// ============================================

const DIAS_VALIDOS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

// Documentos del personal: tipos aceptados (las etiquetas viven en el frontend)
const TIPOS_DOCUMENTO = [
  'titulo_universitario', 'titulo_especialidad', 'colegiado_activo', 'antecedentes_penales',
  'antecedentes_policiacos', 'contrato', 'curriculum', 'tarjeta_salud', 'otro'
];
const DIAS_AVISO_VENCIMIENTO = 30;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

const MIGRACION_PENDIENTE = 'Falta preparar la base de datos del personal (npm run migrate:personal).';

// Emergencias, documentos, usuarios y el módulo Personal llegan con la misma migración;
// mientras falte, Personal médico sigue funcionando como antes
let migracionCache = { valor: false, hasta: 0 };
const migracionLista = async () => {
  if (Date.now() < migracionCache.hasta) return migracionCache.valor;
  const result = await pool.query(
    `SELECT to_regclass('public.personal_general_documentos') IS NOT NULL
        AND to_regclass('public.personal_medico_documentos') IS NOT NULL
        AND EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'personal_medico' AND column_name = 'user_id') AS listo`
  );
  const valor = result.rows[0].listo;
  migracionCache = { valor, hasta: valor ? Infinity : Date.now() + 60000 };
  return valor;
};

// Persona (de cualquiera de los dos módulos) vinculada a cada usuario, para la pantalla de usuarios
const SQL_PERSONAL_DE_USUARIO = `
  COALESCE(
    (SELECT json_build_object('modulo', 'personal_medico', 'id', pm.id,
              'nombre', CONCAT_WS(' ', pm.nombre, pm.apellido_paterno))
     FROM personal_medico pm WHERE pm.user_id = u.id),
    (SELECT json_build_object('modulo', 'personal_general', 'id', pg.id,
              'nombre', CONCAT_WS(' ', pg.nombre, pg.apellido_paterno))
     FROM personal_general pg WHERE pg.user_id = u.id)
  ) AS personal`;

const normalizarDias = (dias) => {
  if (!Array.isArray(dias)) return null;
  const normalizados = [...new Set(dias.map(dia => String(dia).toLowerCase()))];
  return normalizados.length > 0 && normalizados.every(dia => DIAS_VALIDOS.includes(dia))
    ? normalizados
    : null;
};

const IMAGENES = ['foto_perfil', 'dpi_frente', 'dpi_reverso'];
const DATA_URL_IMAGEN = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;
const MAX_IMAGEN_BYTES = 3 * 1024 * 1024; // 3 MB por imagen ya decodificada

// Devuelve un mensaje de error o null. undefined = no se envió (no cambia), null = quitar.
const validarImagenes = (body) => {
  for (const campo of IMAGENES) {
    const valor = body[campo];
    if (valor === undefined || valor === null) continue;
    if (typeof valor !== 'string' || !DATA_URL_IMAGEN.test(valor)) {
      return `La imagen ${campo.replace('_', ' ')} debe ser JPG, PNG o WEBP`;
    }
    const base64 = valor.slice(valor.indexOf(',') + 1);
    if (Math.floor(base64.length * 3 / 4) > MAX_IMAGEN_BYTES) {
      return `La imagen ${campo.replace('_', ' ')} supera los 3 MB`;
    }
  }
  return null;
};

// DPI de Guatemala: 13 dígitos (se aceptan espacios o guiones)
const normalizarDPI = (dpi) => {
  if (dpi === undefined) return undefined;
  if (dpi === null || String(dpi).trim() === '') return null;
  const digitos = String(dpi).replace(/[\s-]/g, '');
  return /^\d{13}$/.test(digitos) ? digitos : false;
};

// Disponibilidad para emergencias del formulario. undefined = no se envió (no cambia).
const datosEmergencia = (body) => {
  if (body.disponible_emergencias === undefined && body.telefono_emergencia === undefined) return undefined;
  return {
    disponible: Boolean(body.disponible_emergencias),
    telefono: String(body.telefono_emergencia || '').trim().slice(0, 30) || null
  };
};

// Usuario del sistema del formulario. undefined = no se envió (no cambia), null = desvincular.
const usuarioVinculado = (body) => {
  if (body.user_id === undefined) return undefined;
  if (body.user_id === null || body.user_id === '') return null;
  const id = Number(body.user_id);
  return Number.isInteger(id) && id > 0 ? id : false;
};

const COLUMNAS_DOCUMENTO = `id, tipo, nombre_archivo AS nombre, tipo_contenido, tamano,
  to_char(fecha_vencimiento, 'YYYY-MM-DD') AS fecha_vencimiento, notas,
  subido_por_nombre AS subido_por, created_at AS fecha`;

const errorConEstado = (message, status = 400) => Object.assign(new Error(message), { status });

/**
 * cfg:
 *   tabla, tablaDocumentos, columnaDocumento
 *   requiereMigracion  true si la tabla misma llega con la migración (Personal)
 *   etiqueta           "Personal médico" / "Personal", para mensajes
 *   profesional:
 *     columnas         columnas propias del módulo (se guardan tal cual)
 *     select, join     columnas y JOIN extra del listado
 *     leer(body)       { valores } con las columnas, o { error }
 *     duplicado        mensaje para una violación de unicidad
 */
const crearControladorPersonal = (cfg) => {
  const { tabla, tablaDocumentos, columnaDocumento, profesional } = cfg;
  const noEncontrado = `${cfg.etiqueta} no encontrado`;

  const disponible = async () => !cfg.requiereMigracion || migracionLista();

  // El listado incluye la foto de perfil (pequeña) pero no las fotos del DPI,
  // que se piden aparte en GET /:id/documentos para no cargar la tabla.
  // Con la migración trae también emergencias, el resumen de documentos y el usuario vinculado.
  const selectPersonal = (conExtras) => `
    SELECT pm.id, pm.nombre, pm.apellido_paterno, pm.apellido_materno,
           pm.email, pm.telefono, pm.horario_inicio, pm.horario_fin, pm.dias_disponibles, pm.estado,
           pm.created_at, pm.updated_at, pm.dpi, pm.foto_perfil,
           (pm.dpi_frente IS NOT NULL) AS tiene_dpi_frente,
           (pm.dpi_reverso IS NOT NULL) AS tiene_dpi_reverso,
           ${profesional.select}
           ${conExtras ? `, pm.disponible_emergencias, pm.telefono_emergencia,
           docs.total AS documentos_total, docs.vencidos AS documentos_vencidos, docs.por_vencer AS documentos_por_vencer,
           pm.user_id, us.email AS usuario_email, CONCAT_WS(' ', us.nombre, us.apellido) AS usuario_nombre` : ''}
    FROM ${tabla} pm
    ${profesional.join || ''}
    ${conExtras ? `LEFT JOIN users us ON us.id = pm.user_id
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE d.fecha_vencimiento < CURRENT_DATE)::int AS vencidos,
             COUNT(*) FILTER (WHERE d.fecha_vencimiento BETWEEN CURRENT_DATE AND CURRENT_DATE + ${DIAS_AVISO_VENCIMIENTO})::int AS por_vencer
      FROM ${tablaDocumentos} d WHERE d.${columnaDocumento} = pm.id
    ) docs ON true` : ''}
  `;

  const leerPersonal = async (id) => {
    const result = await pool.query(`${selectPersonal(await migracionLista())} WHERE pm.id = $1`, [id]);
    return result.rows[0];
  };

  // Validaciones comunes de crear y modificar. Devuelve los datos a guardar o lanza un error con estado.
  const leerFormulario = async (req, idActual = null) => {
    const { nombre, apellido_paterno, email, telefono } = req.body;
    if (!nombre || !apellido_paterno || !telefono) throw errorConEstado(`Faltan campos obligatorios del ${cfg.etiqueta.toLowerCase()}`);
    const propios = profesional.leer(req.body);
    if (propios.error) throw errorConEstado(propios.error);
    if (email && !String(email).includes('@')) throw errorConEstado('El email no tiene un formato válido');

    const dias = normalizarDias(req.body.dias_disponibles);
    if (!dias) throw errorConEstado('Selecciona al menos un día laboral válido');

    const dpi = normalizarDPI(req.body.dpi);
    if (dpi === false) throw errorConEstado('El DPI debe tener 13 dígitos');
    const errorImagen = validarImagenes(req.body);
    if (errorImagen) throw errorConEstado(errorImagen);

    const emergencia = datosEmergencia(req.body);
    const usuario = usuarioVinculado(req.body);
    if (usuario === false) throw errorConEstado('Usuario no válido');

    const lista = await migracionLista();
    if (!lista && ((emergencia && (emergencia.disponible || emergencia.telefono)) || usuario)) {
      throw errorConEstado(MIGRACION_PENDIENTE, 503);
    }
    if (usuario !== undefined && lista) {
      // Vincular o desvincular un usuario es cosa del administrador
      await cargarPermisos(req);
      if (!req.userRoles.includes('admin')) throw errorConEstado('Solo un administrador puede vincular usuarios', 403);
      if (usuario) await validarUsuarioLibre(usuario, idActual);
    }

    return {
      propios: propios.valores, dias, dpi, emergencia: lista ? emergencia : undefined,
      usuario: lista ? usuario : undefined
    };
  };

  // Un usuario se vincula a una sola persona, contando ambos módulos
  const validarUsuarioLibre = async (userId, idActual) => {
    const existe = await pool.query('SELECT 1 FROM users WHERE id = $1', [userId]);
    if (!existe.rowCount) throw errorConEstado('El usuario no existe');
    const ocupado = await pool.query(
      `SELECT 'personal_medico' AS tabla, id, CONCAT_WS(' ', nombre, apellido_paterno) AS nombre FROM personal_medico WHERE user_id = $1
       UNION ALL
       SELECT 'personal_general', id, CONCAT_WS(' ', nombre, apellido_paterno) FROM personal_general WHERE user_id = $1`,
      [userId]
    );
    const otro = ocupado.rows.find(r => !(r.tabla === tabla && String(r.id) === String(idActual)));
    if (otro) throw errorConEstado(`Ese usuario ya está vinculado a ${otro.nombre}`, 409);
  };

  const responder = (res, contexto, error) => {
    if (error.status) return res.status(error.status).json({ error: error.message });
    if (error.code === '42P01' || error.code === '42703') return res.status(503).json({ error: MIGRACION_PENDIENTE });
    if (error.code === '23514' || error.code === '22007') return res.status(400).json({ error: 'Revise el horario: la hora de fin debe ser posterior a la de inicio' });
    if (error.code === '23505') {
      return res.status(409).json({ error: /user/.test(error.constraint || '') ? 'Ese usuario ya está vinculado a otra persona' : profesional.duplicado });
    }
    console.error(`Error ${contexto} (${tabla}):`, error.message);
    res.status(500).json({ error: `No se pudo ${contexto}` });
  };

  const exigirMigracion = async () => {
    if (!(await disponible()) || !(await migracionLista())) throw errorConEstado(MIGRACION_PENDIENTE, 503);
  };

  return {
    getAll: async (req, res) => {
      try {
        if (!(await disponible())) throw errorConEstado(MIGRACION_PENDIENTE, 503);
        const result = await pool.query(`${selectPersonal(await migracionLista())} ORDER BY pm.apellido_paterno, pm.nombre`);
        res.json({ total: result.rows.length, personal: result.rows });
      } catch (error) {
        responder(res, 'obtener el personal', error);
      }
    },

    create: async (req, res) => {
      try {
        if (!(await disponible())) throw errorConEstado(MIGRACION_PENDIENTE, 503);
        const datos = await leerFormulario(req);
        const columnas = {
          nombre: req.body.nombre,
          apellido_paterno: req.body.apellido_paterno,
          apellido_materno: req.body.apellido_materno || null,
          ...datos.propios,
          email: req.body.email || null,
          telefono: req.body.telefono,
          horario_inicio: req.body.horario_inicio || '08:00',
          horario_fin: req.body.horario_fin || '16:00',
          dias_disponibles: datos.dias,
          estado: req.body.estado || 'activo',
          dpi: datos.dpi ?? null,
          foto_perfil: req.body.foto_perfil || null,
          dpi_frente: req.body.dpi_frente || null,
          dpi_reverso: req.body.dpi_reverso || null
        };
        if (datos.emergencia) {
          columnas.disponible_emergencias = datos.emergencia.disponible;
          columnas.telefono_emergencia = datos.emergencia.telefono;
        }
        if (datos.usuario !== undefined) columnas.user_id = datos.usuario;

        const nombres = Object.keys(columnas);
        const result = await pool.query(
          `INSERT INTO ${tabla} (${nombres.join(', ')})
           VALUES (${nombres.map((_, i) => `$${i + 1}`).join(', ')})
           RETURNING id`,
          Object.values(columnas)
        );
        res.status(201).json({ personal: await leerPersonal(result.rows[0].id) });
      } catch (error) {
        responder(res, 'guardar', error);
      }
    },

    update: async (req, res) => {
      const { id } = req.params;
      try {
        if (!(await disponible())) throw errorConEstado(MIGRACION_PENDIENTE, 503);
        const datos = await leerFormulario(req, id);
        const columnas = {
          nombre: req.body.nombre,
          apellido_paterno: req.body.apellido_paterno,
          apellido_materno: req.body.apellido_materno || null,
          ...datos.propios,
          email: req.body.email || null,
          telefono: req.body.telefono,
          horario_inicio: req.body.horario_inicio || '08:00',
          horario_fin: req.body.horario_fin || '16:00',
          dias_disponibles: datos.dias,
          estado: req.body.estado || 'activo'
        };
        // DPI, imágenes, emergencias y usuario solo se modifican si vienen en la petición (null = quitar)
        if (datos.dpi !== undefined) columnas.dpi = datos.dpi;
        IMAGENES.forEach(campo => {
          if (req.body[campo] !== undefined) columnas[campo] = req.body[campo] || null;
        });
        if (datos.emergencia) {
          columnas.disponible_emergencias = datos.emergencia.disponible;
          columnas.telefono_emergencia = datos.emergencia.telefono;
        }
        if (datos.usuario !== undefined) columnas.user_id = datos.usuario;

        const nombres = Object.keys(columnas);
        const result = await pool.query(
          `UPDATE ${tabla}
           SET ${nombres.map((c, i) => `${c} = $${i + 1}`).join(', ')}, updated_at = NOW()
           WHERE id = $${nombres.length + 1}
           RETURNING id`,
          [...Object.values(columnas), id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: noEncontrado });
        res.json({ personal: await leerPersonal(id) });
      } catch (error) {
        responder(res, 'guardar', error);
      }
    },

    // Foto y fotografías del DPI de una persona
    getDocumentos: async (req, res) => {
      try {
        if (!(await disponible())) throw errorConEstado(MIGRACION_PENDIENTE, 503);
        const result = await pool.query(
          `SELECT id, dpi, foto_perfil, dpi_frente, dpi_reverso FROM ${tabla} WHERE id = $1`,
          [req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: noEncontrado });
        res.json({ documentos: result.rows[0] });
      } catch (error) {
        responder(res, 'obtener las fotografías', error);
      }
    },

    // PUT /:id/emergencias { disponible_emergencias } - marcar o quitar desde el listado
    setEmergencias: async (req, res) => {
      try {
        await exigirMigracion();
        const result = await pool.query(
          `UPDATE ${tabla} SET disponible_emergencias = $2, updated_at = NOW() WHERE id = $1 RETURNING id`,
          [req.params.id, Boolean(req.body.disponible_emergencias)]
        );
        if (result.rowCount === 0) return res.status(404).json({ error: noEncontrado });
        res.json({ personal: await leerPersonal(req.params.id) });
      } catch (error) {
        responder(res, 'cambiar la disponibilidad para emergencias', error);
      }
    },

    // GET /:id/archivos - Documentos de la persona (sin el contenido)
    getArchivos: async (req, res) => {
      try {
        await exigirMigracion();
        const result = await pool.query(
          `SELECT ${COLUMNAS_DOCUMENTO} FROM ${tablaDocumentos}
           WHERE ${columnaDocumento} = $1 ORDER BY created_at DESC, id DESC`,
          [req.params.id]
        );
        res.json({ documentos: result.rows, dias_aviso: DIAS_AVISO_VENCIMIENTO });
      } catch (error) {
        responder(res, 'cargar los documentos', error);
      }
    },

    // POST /:id/archivos?tipo=&nombre=&vencimiento=&notas= (cuerpo: el PDF o la imagen tal cual)
    subirArchivo: async (req, res) => {
      const contenido = req.body;
      const { tipoContenido, status, error: errorArchivo } = validarSubida(contenido);
      if (errorArchivo) return res.status(status).json({ error: errorArchivo });
      const tipo = String(req.query.tipo || '');
      if (!TIPOS_DOCUMENTO.includes(tipo)) return res.status(400).json({ error: 'Seleccione el tipo de documento' });
      const vencimiento = String(req.query.vencimiento || '');
      if (vencimiento && !FECHA.test(vencimiento)) return res.status(400).json({ error: 'Fecha de vencimiento no válida' });
      const notas = String(req.query.notas || '').trim().slice(0, 300) || null;
      const autor = `${req.user.nombre || ''} ${req.user.apellido || ''}`.trim() || req.user.email;

      try {
        await exigirMigracion();
        const result = await pool.query(
          `INSERT INTO ${tablaDocumentos}
             (${columnaDocumento}, tipo, nombre_archivo, tipo_contenido, tamano, contenido,
              fecha_vencimiento, notas, subido_por, subido_por_nombre)
           SELECT pm.id, $2, $3, $4, $5, $6, $7, $8, $9, $10 FROM ${tabla} pm WHERE pm.id = $1
           RETURNING ${COLUMNAS_DOCUMENTO}`,
          [req.params.id, tipo, limpiarNombre(req.query.nombre, tipoContenido), tipoContenido,
            contenido.length, contenido, vencimiento || null, notas, req.user.id, autor]
        );
        if (result.rowCount === 0) return res.status(404).json({ error: noEncontrado });
        res.status(201).json({ documento: result.rows[0] });
      } catch (error) {
        if (error.code === '22008') return res.status(400).json({ error: 'Fecha de vencimiento no válida' });
        responder(res, 'guardar el documento', error);
      }
    },

    // GET /archivos/:archivoId - Devuelve el documento para verlo o descargarlo
    verArchivo: async (req, res) => {
      const archivoId = Number(req.params.archivoId);
      if (!Number.isInteger(archivoId)) return res.status(400).json({ error: 'Documento no válido' });
      try {
        await exigirMigracion();
        const result = await pool.query(
          `SELECT nombre_archivo, tipo_contenido, contenido FROM ${tablaDocumentos} WHERE id = $1`,
          [archivoId]
        );
        if (result.rowCount === 0) return res.status(404).json({ error: 'Documento no encontrado' });
        const { nombre_archivo: nombre, tipo_contenido: tipoContenido, contenido } = result.rows[0];
        enviarArchivo(res, { nombre, tipoContenido, contenido });
      } catch (error) {
        responder(res, 'abrir el documento', error);
      }
    },

    // DELETE /archivos/:archivoId
    eliminarArchivo: async (req, res) => {
      const archivoId = Number(req.params.archivoId);
      if (!Number.isInteger(archivoId)) return res.status(400).json({ error: 'Documento no válido' });
      try {
        await exigirMigracion();
        const result = await pool.query(`DELETE FROM ${tablaDocumentos} WHERE id = $1`, [archivoId]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Documento no encontrado' });
        res.json({ message: 'Documento eliminado' });
      } catch (error) {
        responder(res, 'eliminar el documento', error);
      }
    },

    delete: async (req, res) => {
      try {
        if (!(await disponible())) throw errorConEstado(MIGRACION_PENDIENTE, 503);
        const result = await pool.query(`DELETE FROM ${tabla} WHERE id = $1 RETURNING id`, [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: noEncontrado });
        res.json({ message: `${cfg.etiqueta} eliminado` });
      } catch (error) {
        responder(res, 'eliminar', error);
      }
    }
  };
};

module.exports = { crearControladorPersonal, migracionLista, SQL_PERSONAL_DE_USUARIO };
