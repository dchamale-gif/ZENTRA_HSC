// Control de medicamentos: identifica cada medicamento transcrito de una orden médica.
// La clave es la medicina del catálogo (o su texto, en transcripciones antiguas); si la misma
// medicina aparece dos veces en la orden, la segunda lleva "#2". Así sobrevive a que la
// enfermera reordene o edite otras indicaciones.

const clavesMedicamentos = (indicaciones) => {
  const vistas = {};
  return (Array.isArray(indicaciones) ? indicaciones : [])
    .map((item, indice) => ({ item, indice }))
    .filter(({ item }) => item?.tipo === 'medicamento')
    .map(({ item, indice }) => {
      const base = item.catalogo?.id
        ? `med:${item.catalogo.id}`
        : `txt:${String(item.descripcion || '').trim().toLowerCase().slice(0, 140)}`;
      vistas[base] = (vistas[base] || 0) + 1;
      return { clave: vistas[base] > 1 ? `${base}#${vistas[base]}` : base, indice, item };
    });
};

// Al volver a guardar la transcripción, un medicamento que sigue suspendido conserva el detalle de la suspensión
const conservarSuspensiones = (nuevas, anteriores) => {
  const previas = new Map(clavesMedicamentos(anteriores).map(m => [m.clave, m.item]));
  for (const { clave, item } of clavesMedicamentos(nuevas)) {
    const previa = previas.get(clave);
    if (item.estado === 'suspendida' && previa?.estado === 'suspendida' && previa.suspension) item.suspension = previa.suspension;
  }
  return nuevas;
};

module.exports = { clavesMedicamentos, conservarSuspensiones };
