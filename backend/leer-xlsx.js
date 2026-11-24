/**
 * Lector mínimo de .xlsx (zip + xml) sin librerías extra.
 * leerLibro(archivo) -> { 'Nombre de hoja': [[celda, celda, ...], ...] }
 * Cada celda llega como texto tal cual la guarda Excel (números y fechas como número serial).
 */

const fs = require('fs');
const zlib = require('zlib');

const leerZip = (buffer) => {
  let fin = buffer.length - 22;
  while (fin >= 0 && buffer.readUInt32LE(fin) !== 0x06054b50) fin--;
  if (fin < 0) throw new Error('El archivo no es un .xlsx válido');
  const total = buffer.readUInt16LE(fin + 10);
  let p = buffer.readUInt32LE(fin + 16);
  const archivos = {};
  for (let i = 0; i < total; i++) {
    const metodo = buffer.readUInt16LE(p + 10);
    const comprimido = buffer.readUInt32LE(p + 20);
    const largoNombre = buffer.readUInt16LE(p + 28);
    const largoExtra = buffer.readUInt16LE(p + 30);
    const largoComentario = buffer.readUInt16LE(p + 32);
    const local = buffer.readUInt32LE(p + 42);
    const nombre = buffer.toString('utf8', p + 46, p + 46 + largoNombre);
    archivos[nombre] = () => {
      const inicio = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
      const datos = buffer.subarray(inicio, inicio + comprimido);
      return (metodo === 8 ? zlib.inflateRawSync(datos) : datos).toString('utf8');
    };
    p += 46 + largoNombre + largoExtra + largoComentario;
  }
  return archivos;
};

const desescapar = (texto) => texto
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&amp;/g, '&');

const textoDe = (xml) => desescapar([...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(m => m[1]).join(''));

const columnaIndice = (ref) => [...ref.match(/^[A-Z]+/)[0]].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;

const leerLibro = (archivo) => {
  const zip = leerZip(fs.readFileSync(archivo));
  const libro = zip['xl/workbook.xml']();
  const rels = zip['xl/_rels/workbook.xml.rels']();
  const compartidos = zip['xl/sharedStrings.xml']
    ? [...zip['xl/sharedStrings.xml']().matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => textoDe(m[1]))
    : [];
  const resultado = {};
  for (const m of libro.matchAll(/<sheet\b[^>]*>/g)) {
    const nombre = desescapar(m[0].match(/name="([^"]*)"/)[1]);
    const rid = m[0].match(/r:id="([^"]*)"/)[1];
    const rel = [...rels.matchAll(/<Relationship\b[^>]*>/g)].map(r => r[0]).find(r => r.includes(`Id="${rid}"`));
    const destino = rel.match(/Target="([^"]*)"/)[1].replace(/^\/?(xl\/)?/, '');
    resultado[nombre] = [...zip[`xl/${destino}`]().matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].map(fila => {
      const valores = [];
      for (const c of fila[1].matchAll(/<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const [, ref, attrs, cuerpo = ''] = c;
        const tipo = (attrs.match(/t="(\w+)"/) || [])[1];
        const v = cuerpo.match(/<v>([\s\S]*?)<\/v>/);
        let valor = null;
        if (tipo === 's' && v) valor = compartidos[Number(v[1])];
        else if (tipo === 'inlineStr') valor = textoDe(cuerpo);
        else if (v) valor = desescapar(v[1]);
        valores[columnaIndice(ref)] = valor;
      }
      return valores;
    });
  }
  return resultado;
};

module.exports = { leerLibro };
