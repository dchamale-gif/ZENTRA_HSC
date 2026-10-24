// ============================================
// EXPORTAR A EXCEL
// Botones "Exportar a Excel" en Artículos, Medicinas y Pacientes.
// La librería (SheetJS) se descarga solo la primera vez que se exporta.
// ============================================

const ExportarExcel = {
    LIBRERIA: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',

    // Títulos de las columnas conocidas; las demás se muestran con su nombre de campo legible
    TITULOS: {
        id: 'ID', codigo: 'Código', nombre: 'Nombre', nombre_articulo: 'Nombre del artículo',
        descripcion: 'Descripción', descripcion2: 'Descripción 2', categoria: 'Categoría', seccion: 'Sección',
        familia: 'Familia', subfamilia: 'Subfamilia', tipo: 'Tipo', unidad_medida: 'Unidad de medida',
        precio_unitario: 'Precio unitario (Q)', precio_costo: 'Precio de costo (Q)', precio_venta: 'Precio de venta (Q)',
        cantidad_disponible: 'Existencia', stock: 'Existencia', stock_minimo: 'Existencia mínima',
        codigo_barras: 'Código de barras', codigo_barra: 'Código de barras', codigo_alternativo: 'Código alternativo',
        codigo_interno: 'Código interno', codigo_externo: 'Código externo', activo: 'Activo',
        created_at: 'Creado', updated_at: 'Actualizado', paciente_id: 'ID del paciente', paciente: 'Paciente',
        apellido_paterno: 'Apellido paterno', apellido_materno: 'Apellido materno', fecha_nacimiento: 'Fecha de nacimiento',
        genero: 'Género', dpi: 'DPI', telefono: 'Teléfono', email: 'Email', direccion: 'Dirección', estado: 'Estado',
        estado_civil: 'Estado civil', grado_academico: 'Grado académico', tipo_servicio: 'Tipo de servicio',
        segmento_coex: 'Segmento COEX', is_cliente: 'Es cliente', fecha_registro: 'Fecha de registro',
        fecha_primer_consulta: 'Primera consulta', motivo_consulta: 'Motivo de consulta', parentesco: 'Parentesco',
        relacion: 'Relación', factor: 'Unidades por presentación', medicina: 'Medicina',
        concentracion: 'Concentración', forma_farmaceutica: 'Forma farmacéutica', presentacion: 'Presentación',
        cantidad: 'Existencia', cantidad_minima: 'Existencia mínima', proveedor_id: 'ID del proveedor',
        fecha_vencimiento: 'Fecha de vencimiento', lote: 'Lote', unidad_base: 'Unidad base'
    },

    cargarLibreria() {
        if (window.XLSX) return Promise.resolve(window.XLSX);
        if (!this._carga) {
            this._carga = new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = this.LIBRERIA;
                script.onload = () => resolve(window.XLSX);
                script.onerror = () => {
                    this._carga = null;
                    reject(new Error('No se pudo descargar la librería de Excel. Revise la conexión a internet.'));
                };
                document.head.appendChild(script);
            });
        }
        return this._carga;
    },

    titulo(clave) {
        if (this.TITULOS[clave]) return this.TITULOS[clave];
        const texto = String(clave).replace(/_/g, ' ');
        return texto.charAt(0).toUpperCase() + texto.slice(1);
    },

    // Fecha de Excel (días desde 1899-12-30) a partir de sus partes, sin pasar por la zona horaria del equipo
    serial(anio, mes, dia, hora = 0, minuto = 0, segundo = 0) {
        return (Date.UTC(anio, mes - 1, dia, hora, minuto, segundo) - Date.UTC(1899, 11, 30)) / 86400000;
    },

    // Fechas como { fecha: serial, formato }. Las que traen zona (Z o ±hh:mm) se pasan a la hora de Guatemala.
    fecha(valor) {
        const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/.exec(valor);
        if (!m) return null;
        if (!m[4]) return { fecha: this.serial(+m[1], +m[2], +m[3]), formato: 'dd/mm/yyyy' };
        let partes = m.slice(1, 7).map(Number);
        if (m[7]) {
            const d = new Date(valor);
            if (Number.isNaN(d.getTime())) return null;
            const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
                timeZone: CONFIG.REGION.timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
            }).formatToParts(d).map(x => [x.type, x.value]));
            partes = [p.year, p.month, p.day, p.hour, p.minute, p.second].map(Number);
        }
        return { fecha: this.serial(...partes), formato: 'dd/mm/yyyy hh:mm' };
    },

    // Valor apto para una celda: fechas como fecha, sí/no, listas y objetos como texto
    celda(valor) {
        if (valor === null || valor === undefined) return '';
        if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
        if (typeof valor === 'object') return JSON.stringify(valor);
        if (typeof valor === 'string') {
            const fecha = this.fecha(valor);
            if (fecha) return fecha;
            if (valor.startsWith('data:')) return '(archivo)';
            // Montos NUMERIC (llegan como texto con decimales). DPI y teléfonos, sin punto, quedan como texto
            if (/^-?\d+\.\d+$/.test(valor)) return Number(valor);
        }
        return valor;
    },

    // Hoja a partir de filas (objetos). Las columnas salen de todas las claves, en orden de aparición,
    // salvo que se indiquen; "primero" pone esas columnas al inicio.
    hoja(filas, { columnas = null, primero = [], omitir = [] } = {}) {
        let claves = columnas;
        if (!claves) {
            const todas = [];
            filas.forEach(f => Object.keys(f).forEach(k => { if (!todas.includes(k)) todas.push(k); }));
            claves = [...primero.filter(k => todas.includes(k)), ...todas.filter(k => !primero.includes(k))];
        }
        claves = claves.filter(k => !omitir.includes(k));
        if (claves.length === 0) return XLSX.utils.aoa_to_sheet([['Sin registros']]);
        const valores = filas.map(f => claves.map(k => this.celda(f[k])));
        const datos = [claves.map(k => this.titulo(k)), ...valores.map(fila => fila.map(v => v?.fecha ?? v))];
        const hoja = XLSX.utils.aoa_to_sheet(datos);
        // Las fechas van como número de Excel con su formato
        valores.forEach((fila, r) => fila.forEach((v, c) => {
            if (v?.formato) hoja[XLSX.utils.encode_cell({ r: r + 1, c })].z = v.formato;
        }));
        // Ancho de columna según el contenido (máximo 50 caracteres)
        hoja['!cols'] = claves.map((k, i) => ({
            wch: Math.min(50, Math.max(10, ...[datos[0], ...valores.slice(0, 200)].map(fila => (fila[i]?.formato || String(fila[i] ?? '')).length + 2)))
        }));
        if (datos.length > 1) hoja['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: datos.length - 1, c: claves.length - 1 } }) };
        return hoja;
    },

    async descargar(nombre, hojas) {
        await this.cargarLibreria();
        const libro = XLSX.utils.book_new();
        hojas.forEach(({ titulo, filas, opciones }) => XLSX.utils.book_append_sheet(libro, this.hoja(filas, opciones), titulo.slice(0, 31)));
        const fecha = new Intl.DateTimeFormat('en-CA', { timeZone: CONFIG.REGION.timeZone }).format(new Date());
        XLSX.writeFile(libro, `${nombre}_${fecha}.xlsx`);
    },

    async pedir(path) {
        const response = await authManager.fetchWithAuth(path);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || data.message || `Error ${response.status}`);
        return data;
    },

    // ---------- Listados ----------
    async articulos() {
        const { articulos = [] } = await this.pedir('/api/codigos-articulos');
        await this.descargar('Articulos', [{
            titulo: 'Artículos',
            filas: articulos,
            opciones: { primero: ['codigo', 'nombre_articulo', 'categoria', 'familia', 'subfamilia', 'tipo'] }
        }]);
        return articulos.length;
    },

    async medicinas() {
        const { medicinas = [] } = await this.pedir('/api/medicinas?activo=todos');
        const presentaciones = medicinas.flatMap(m => (m.presentaciones || []).map(p => ({
            medicina: m.nombre, codigo_interno: m.codigo_interno, ...p
        })));
        const hojas = [{
            titulo: 'Medicinas',
            filas: medicinas,
            opciones: { primero: ['codigo_interno', 'nombre'], omitir: ['presentaciones'] }
        }];
        if (presentaciones.length) hojas.push({ titulo: 'Presentaciones', filas: presentaciones, opciones: { omitir: ['id'] } });
        await this.descargar('Medicinas', hojas);
        return medicinas.length;
    },

    // Todo lo de la ficha: datos del paciente y una hoja por cada pestaña con tabla propia
    async pacientes() {
        const data = await this.pedir('/api/pacientes/exportar');
        const pacientes = data.pacientes || [];
        const nombres = new Map(pacientes.map(p => [String(p.id),
            [p.nombre, p.apellido_paterno, p.apellido_materno].filter(Boolean).join(' ')]));
        const conPaciente = filas => (filas || []).map(({ paciente_id, ...resto }) =>
            ({ paciente_id, paciente: nombres.get(String(paciente_id)) || '', ...resto }));
        const relacionada = (titulo, filas) => ({ titulo, filas: conPaciente(filas), opciones: { omitir: ['id'] } });
        await this.descargar('Pacientes', [
            { titulo: 'Pacientes', filas: pacientes, opciones: { primero: ['id', 'nombre', 'apellido_paterno', 'apellido_materno', 'dpi'] } },
            relacionada('Lugar de trabajo', data.empresas),
            relacionada('Contactos de emergencia', data.contactos_emergencia),
            relacionada('Familiares', data.datos_familia),
            relacionada('Responsables', data.responsables)
        ]);
        return pacientes.length;
    },

    async exportar(listado, boton) {
        boton.disabled = true;
        const original = boton.innerHTML;
        boton.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Exportando…';
        try {
            const total = await this[listado]();
            showNotification(`Excel descargado (${total} registro${total === 1 ? '' : 's'})`, 'success');
        } catch (error) {
            showNotification(`No se pudo exportar: ${error.message}`, 'error');
        } finally {
            boton.disabled = false;
            boton.innerHTML = original;
        }
    },

    init() {
        document.querySelectorAll('[data-exportar-excel]').forEach(boton => {
            // La ficha completa de pacientes solo la exporta un administrador
            if (boton.dataset.exportarExcel === 'pacientes' && typeof Permisos !== 'undefined' && !Permisos.esAdmin()) {
                boton.hidden = true;
                return;
            }
            boton.addEventListener('click', () => this.exportar(boton.dataset.exportarExcel, boton));
        });
    }
};

window.ExportarExcel = ExportarExcel;
document.addEventListener('DOMContentLoaded', () => ExportarExcel.init());
