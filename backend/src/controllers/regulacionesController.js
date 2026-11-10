// ============================================
// REGULACIONES DE INVENTARIO
// Lo que sale (o entra) del inventario sin ser venta ni compra: consumo interno, merma o
// daño, vencimiento, donación, ajuste por conteo físico. Solo las registra el administrador.
// Se aplican al guardarlas: cada renglón mueve el kárdex de su medicina o artículo con el
// número de la regulación como referencia. Al anularla se devuelve lo movido.
// Número por bodega y año: REG-FAR-0001-2026.
// ============================================

const pool = require('../db/connection');
const correlativos = require('../services/correlativos');
const inventario = require('../services/inventarioMedicinas');
const inventarioArticulos = require('../services/inventarioArticulos');

const MIGRACION = 'Falta preparar la base de datos para las regulaciones (npm run migrate:regulaciones).';
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RENGLONES = 200;

// Motivo -> texto; solo el ajuste por conteo puede sumar (cuando se encontró de más)
const MOTIVOS = {
  consumo_interno: 'Consumo interno',
  merma: 'Merma o daño',
  vencimiento: 'Vencimiento',
  donacion: 'Donación',
  ajuste_conteo: 'Ajuste por conteo físico',
  otro: 'Otro'
};

const errorConEstado = inventario.errorConEstado;

let cache = { valor: false, hasta: 0 };
const disponible = async () => {
  if (Date.now() < cache.hasta) return cache.valor;
  const { rows } = await pool.query(
    `SELECT to_regclass('public.regulacion_inventario_items') IS NOT NULL
        AND to_regclass('public.articulo_movimientos') IS NOT NULL AS listo`);
  const valor = rows[0].listo;
  cache = { valor, hasta: valor ? Infinity : Date.now() + 60000 };
  return valor;
};

const responderError = (res, error, accion) => {
  if (!error.status) console.error(`Error al ${accion}:`, error);
  res.status(error.status || 500).json({ error: error.status ? error.message : `Error al ${accion}` });
};

const hoyGuatemala = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala' }).format(new Date());

const SELECT_REGULACION = `
  SELECT r.id, r.numero, to_char(r.fecha, 'YYYY-MM-DD') AS fecha, r.motivo, r.observaciones, r.estado,
         r.total_costo, r.creado_por_nombre, r.created_at, r.motivo_anulacion, r.anulado_por_nombre, r.anulado_en,
         r.bodega_id, b.nombre AS bodega_nombre, b.codigo AS bodega_codigo,
         COALESCE((
           SELECT json_agg(json_build_object(
             'id', i.id,
             'tipo', CASE WHEN i.medicina_id IS NOT NULL THEN 'medicina' ELSE 'articulo' END,
             'concepto_id', COALESCE(i.medicina_id::text, i.articulo_id::text),
             'concepto_nombre', i.concepto_nombre,
             'sentido', i.sentido,
             'cantidad', i.cantidad,
             'presentacion_nombre', i.presentacion_nombre,
             'factor', i.factor,
             'unidades', i.unidades,
             'unidad_base', CASE WHEN i.medicina_id IS NOT NULL THEN m.unidad_base ELSE a.unidad_medida END,
             'costo_unitario', i.costo_unitario,
             'existencia_antes', i.existencia_antes
           ) ORDER BY i.id)
           FROM regulacion_inventario_items i
           LEFT JOIN medicinas m ON m.id = i.medicina_id
           LEFT JOIN codigos_articulos a ON a.id = i.articulo_id
           WHERE i.regulacion_id = r.id
         ), '[]'::json) AS items
  FROM regulaciones_inventario r
  JOIN bodegas b ON b.id = r.bodega_id`;

// Renglones del formulario, validados (sin tocar la base)
const leerRenglones = (lista, motivo) => {
  if (!Array.isArray(lista) || !lista.length) throw errorConEstado('Agregue al menos una medicina o artículo');
  if (lista.length > MAX_RENGLONES) throw errorConEstado(`Puede registrar hasta ${MAX_RENGLONES} renglones por regulación`);
  const vistos = new Set();
  return lista.map((item, i) => {
    const n = i + 1;
    const tipo = item?.tipo;
    const conceptoId = String(item?.concepto_id ?? '').trim();
    if (!['medicina', 'articulo'].includes(tipo) || !conceptoId) throw errorConEstado(`Renglón ${n}: elija la medicina o el artículo`);
    const cantidad = Number(item.cantidad);
    if (!Number.isInteger(cantidad) || cantidad <= 0) throw errorConEstado(`Renglón ${n}: la cantidad debe ser un entero mayor a cero`);
    const sentido = item.sentido === 'entrada' ? 'entrada' : 'salida';
    if (sentido === 'entrada' && motivo !== 'ajuste_conteo') {
      throw errorConEstado(`Renglón ${n}: solo el ajuste por conteo puede sumar al inventario`);
    }
    const presentacionId = tipo === 'medicina' && item.presentacion_id !== '' && item.presentacion_id != null
      ? Number(item.presentacion_id) : null;
    if (presentacionId !== null && !Number.isInteger(presentacionId)) throw errorConEstado(`Renglón ${n}: presentación no válida`);
    const clave = `${tipo}|${conceptoId}|${presentacionId ?? ''}|${sentido}`;
    if (vistos.has(clave)) throw errorConEstado(`Renglón ${n}: ese concepto ya está en otro renglón`);
    vistos.add(clave);
    return { n, tipo, conceptoId, cantidad, sentido, presentacionId };
  });
};

const tipoKardex = (motivo, sentido) => (motivo === 'consumo_interno' && sentido === 'salida' ? 'consumo_interno' : 'ajuste');

const regulacionesController = {
  // GET /api/regulaciones?desde&hasta&motivo&bodega_id&estado&buscar
  async listar(req, res) {
    try {
      if (!(await disponible())) return res.json({ regulaciones: [], resumen: null, disponible: false, mensaje: MIGRACION });
      const condiciones = [];
      const valores = [];
      const agregar = (sql, valor) => { valores.push(valor); condiciones.push(sql.replace('?', `$${valores.length}`)); };
      const { desde, hasta, motivo, bodega_id: bodegaId, estado, buscar } = req.query;
      if (FECHA.test(desde || '')) agregar('r.fecha >= ?', desde);
      if (FECHA.test(hasta || '')) agregar('r.fecha <= ?', hasta);
      if (MOTIVOS[motivo]) agregar('r.motivo = ?', motivo);
      if (Number.isInteger(Number(bodegaId)) && bodegaId) agregar('r.bodega_id = ?', Number(bodegaId));
      if (['aplicada', 'anulada'].includes(estado)) agregar('r.estado = ?', estado);
      if (buscar && String(buscar).trim()) {
        valores.push(`%${String(buscar).trim()}%`);
        const p = `$${valores.length}`;
        condiciones.push(`(r.numero ILIKE ${p} OR r.observaciones ILIKE ${p} OR EXISTS (
          SELECT 1 FROM regulacion_inventario_items i WHERE i.regulacion_id = r.id AND i.concepto_nombre ILIKE ${p}))`);
      }
      const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
      const { rows } = await pool.query(`${SELECT_REGULACION} ${where} ORDER BY r.fecha DESC, r.id DESC LIMIT 500`, valores);

      // Resumen de lo filtrado: valor al costo de lo que salió, por motivo (solo aplicadas)
      const porMotivo = {};
      let total = 0;
      for (const r of rows.filter(x => x.estado === 'aplicada')) {
        porMotivo[r.motivo] = (porMotivo[r.motivo] || 0) + Number(r.total_costo);
        total += Number(r.total_costo);
      }
      res.json({
        regulaciones: rows,
        resumen: { aplicadas: rows.filter(x => x.estado === 'aplicada').length, total_costo: total, por_motivo: porMotivo },
        motivos: MOTIVOS,
        disponible: true
      });
    } catch (error) {
      responderError(res, error, 'listar las regulaciones');
    }
  },

  // GET /api/regulaciones/:id
  async obtener(req, res) {
    try {
      if (!(await disponible())) throw errorConEstado(MIGRACION, 503);
      const { rows } = await pool.query(`${SELECT_REGULACION} WHERE r.id = $1`, [Number(req.params.id) || 0]);
      if (!rows.length) throw errorConEstado('Regulación no encontrada', 404);
      res.json({ regulacion: rows[0] });
    } catch (error) {
      responderError(res, error, 'obtener la regulación');
    }
  },

  // POST /api/regulaciones { fecha, bodega_id, motivo, observaciones, items: [{ tipo, concepto_id, presentacion_id, cantidad, sentido }] }
  async crear(req, res) {
    let client;
    try {
      if (!(await disponible())) throw errorConEstado(MIGRACION, 503);
      const fecha = String(req.body.fecha || hoyGuatemala());
      if (!FECHA.test(fecha)) throw errorConEstado('Fecha no válida');
      if (fecha > hoyGuatemala()) throw errorConEstado('La fecha no puede ser futura');
      const motivo = String(req.body.motivo || '');
      if (!MOTIVOS[motivo]) throw errorConEstado('Elija el motivo de la regulación');
      const observaciones = String(req.body.observaciones || '').trim().slice(0, 1000);
      if (motivo === 'otro' && observaciones.length < 3) throw errorConEstado('Con motivo "Otro" explique en observaciones qué pasó');
      const renglones = leerRenglones(req.body.items, motivo);
      const hayMedicinas = renglones.some(r => r.tipo === 'medicina');
      if (hayMedicinas && !(await inventario.disponible())) {
        throw errorConEstado('Las medicinas necesitan el kárdex (npm run migrate:inventario-medicinas)', 503);
      }

      client = await pool.connect();
      await client.query('BEGIN');
      const bodega = await correlativos.bodega(client, req.body.bodega_id);
      if (!bodega) throw errorConEstado('Elija la bodega');
      if (!bodega.activo) throw errorConEstado(`La bodega ${bodega.nombre} está desactivada`);
      const numero = await correlativos.siguiente(client, 'regulacion', `REG-${bodega.codigo}`, fecha);
      const usuario = inventario.nombreUsuario(req);

      const { rows: [regulacion] } = await client.query(
        `INSERT INTO regulaciones_inventario (numero, bodega_id, fecha, motivo, observaciones, creado_por, creado_por_nombre)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [numero, bodega.id, fecha, motivo, observaciones || null, req.user?.id || null, usuario]
      );
      const textoKardex = `Regulación ${numero}: ${MOTIVOS[motivo]}${observaciones ? ` — ${observaciones}` : ''}`;

      let totalCosto = 0;
      for (const r of renglones) {
        const signo = r.sentido === 'salida' ? -1 : 1;
        let datos;
        if (r.tipo === 'medicina') {
          const { rows: [m] } = await client.query(
            'SELECT nombre, cantidad, precio_costo FROM medicinas WHERE id::text = $1', [r.conceptoId]);
          if (!m) throw errorConEstado(`Renglón ${r.n}: la medicina no existe`);
          const pres = await inventario.presentacion(client, r.conceptoId, r.presentacionId);
          const unidades = r.cantidad * pres.factor;
          const costo = Number(m.precio_costo) || 0;
          await inventario.mover(client, {
            medicinaId: r.conceptoId, cantidad: signo * unidades, tipo: tipoKardex(motivo, r.sentido),
            presentacion: pres, cantidadPresentacion: r.cantidad, costoUnitario: costo,
            referencia: numero, motivo: textoKardex, req
          });
          datos = [regulacion.id, r.conceptoId, null, m.nombre, r.sentido, r.cantidad, pres.id, pres.nombre, pres.factor,
            unidades, costo, Number(m.cantidad) || 0];
          totalCosto -= signo * unidades * costo;
        } else {
          const { rows: [a] } = await client.query(
            'SELECT nombre_articulo AS nombre, cantidad_disponible, precio_costo FROM codigos_articulos WHERE id::text = $1',
            [r.conceptoId]);
          if (!a) throw errorConEstado(`Renglón ${r.n}: el artículo no existe`);
          const costo = Number(a.precio_costo) || 0;
          await inventarioArticulos.mover(client, {
            articuloId: r.conceptoId, cantidad: signo * r.cantidad, tipo: tipoKardex(motivo, r.sentido),
            costoUnitario: costo, referencia: numero, motivo: textoKardex, req
          });
          datos = [regulacion.id, null, r.conceptoId, a.nombre, r.sentido, r.cantidad, null, null, 1,
            r.cantidad, costo, Number(a.cantidad_disponible) || 0];
          totalCosto -= signo * r.cantidad * costo;
        }
        await client.query(
          `INSERT INTO regulacion_inventario_items
             (regulacion_id, medicina_id, articulo_id, concepto_nombre, sentido, cantidad, presentacion_id,
              presentacion_nombre, factor, unidades, costo_unitario, existencia_antes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`, datos);
      }
      await client.query('UPDATE regulaciones_inventario SET total_costo = $2 WHERE id = $1',
        [regulacion.id, Math.round(totalCosto * 100) / 100]);
      await client.query('COMMIT');

      const { rows } = await pool.query(`${SELECT_REGULACION} WHERE r.id = $1`, [regulacion.id]);
      res.status(201).json({ message: `Regulación ${numero} aplicada al inventario`, regulacion: rows[0] });
    } catch (error) {
      if (client) await client.query('ROLLBACK').catch(() => {});
      responderError(res, error, 'registrar la regulación');
    } finally {
      if (client) client.release();
    }
  },

  // PUT /api/regulaciones/:id/anular { motivo } -> devuelve al inventario lo que movió
  async anular(req, res) {
    let client;
    try {
      if (!(await disponible())) throw errorConEstado(MIGRACION, 503);
      const motivoAnulacion = String(req.body.motivo || '').trim().slice(0, 500);
      if (motivoAnulacion.length < 3) throw errorConEstado('Escriba por qué se anula');
      client = await pool.connect();
      await client.query('BEGIN');
      const { rows: [r] } = await client.query(
        'SELECT id, numero, estado FROM regulaciones_inventario WHERE id = $1 FOR UPDATE', [Number(req.params.id) || 0]);
      if (!r) throw errorConEstado('Regulación no encontrada', 404);
      if (r.estado === 'anulada') throw errorConEstado(`La regulación ${r.numero} ya está anulada`, 409);

      const { rows: items } = await client.query(
        'SELECT * FROM regulacion_inventario_items WHERE regulacion_id = $1 ORDER BY id', [r.id]);
      const textoKardex = `Anulación de ${r.numero}: ${motivoAnulacion}`;
      const faltante = `No se puede anular ${r.numero}: lo que sumó ya salió del inventario.`;
      for (const item of items) {
        const signo = item.sentido === 'salida' ? 1 : -1; // lo contrario de lo que hizo
        if (item.medicina_id) {
          await inventario.mover(client, {
            medicinaId: item.medicina_id, cantidad: signo * item.unidades, tipo: 'ajuste',
            presentacion: { nombre: item.presentacion_nombre, factor: item.factor }, cantidadPresentacion: item.cantidad,
            costoUnitario: item.costo_unitario, referencia: r.numero, motivo: textoKardex, req
          }).catch(error => {
            if (error.status === 409) error.message = `${faltante} ${error.message}`;
            throw error;
          });
        } else {
          await inventarioArticulos.mover(client, {
            articuloId: item.articulo_id, cantidad: signo * item.unidades, tipo: 'ajuste',
            costoUnitario: item.costo_unitario, referencia: r.numero, motivo: textoKardex, req, mensajeFaltante: faltante
          });
        }
      }
      await client.query(
        `UPDATE regulaciones_inventario SET estado = 'anulada', motivo_anulacion = $2, anulado_por_nombre = $3,
           anulado_en = CURRENT_TIMESTAMP WHERE id = $1`,
        [r.id, motivoAnulacion, inventario.nombreUsuario(req)]);
      await client.query('COMMIT');

      const { rows } = await pool.query(`${SELECT_REGULACION} WHERE r.id = $1`, [r.id]);
      res.json({ message: `Regulación ${r.numero} anulada; el inventario volvió a como estaba`, regulacion: rows[0] });
    } catch (error) {
      if (client) await client.query('ROLLBACK').catch(() => {});
      responderError(res, error, 'anular la regulación');
    } finally {
      if (client) client.release();
    }
  }
};

module.exports = regulacionesController;
