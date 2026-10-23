// ============================================
// INVENTARIO DE MEDICINAS POR UNIDADES DE MEDIDA
// ============================================
// La existencia se lleva en la unidad base (p. ej. tableta). Cada medicina puede tener
// presentaciones (caja, blíster…) con su factor de conversión, precio y código de barras.
// Lo usan Medicinas, Ventas y Compras.

const InventarioMedicinas = {
    UNIDADES: ['Tableta', 'Cápsula', 'Ampolla', 'Vial', 'Frasco', 'Sobre', 'Supositorio', 'Parche', 'ml', 'Unidad'],

    MOVIMIENTOS: {
        inicial: 'Existencia inicial',
        ingreso_compra: 'Compra recibida',
        reversion_compra: 'Compra revertida',
        venta: 'Venta',
        devolucion_venta: 'Devolución de venta',
        consumo_interno: 'Consumo interno',
        ajuste: 'Ajuste'
    },

    unidadBase(medicina) {
        return medicina?.unidad_base || 'Unidad';
    },

    // La unidad base (factor 1, precio de venta de la medicina) y luego las presentaciones de menor a mayor
    presentaciones(medicina) {
        const base = { id: '', nombre: this.unidadBase(medicina), factor: 1, precio_venta: Number(medicina?.precio_venta) || 0, codigo_barra: medicina?.codigo_barra || '' };
        const otras = (medicina?.presentaciones || [])
            .map(p => ({ ...p, id: String(p.id), factor: Number(p.factor), precio_venta: Number(p.precio_venta) || 0 }))
            .sort((a, b) => a.factor - b.factor);
        return [base, ...otras];
    },

    presentacion(medicina, id) {
        return this.presentaciones(medicina).find(p => String(p.id) === String(id ?? '')) || this.presentaciones(medicina)[0];
    },

    // "1 tableta", "3 tabletas", "2 cajas"; abreviaturas (ml) sin plural
    texto(cantidad, unidad) {
        const u = String(unidad || 'unidad').toLowerCase();
        if (Math.abs(cantidad) === 1 || u.length <= 3) return `${cantidad} ${u}`;
        if (/[aeiouáéó]$/.test(u)) return `${cantidad} ${u}s`;
        return `${cantidad} ${/[lnrd]$/.test(u) ? `${u}es` : u}`;
    },

    // Nombre de una presentación para listas: "Caja de 100 tabletas"
    nombrePresentacion(medicina, p) {
        return p.factor > 1 ? `${p.nombre} de ${this.texto(p.factor, this.unidadBase(medicina))}` : p.nombre;
    },

    // 926 tabletas → "9 cajas + 26 tabletas" (con la presentación más grande); vacío si no aplica
    desglose(cantidad, medicina) {
        const mayor = this.presentaciones(medicina).slice(1).pop();
        if (!mayor || cantidad < mayor.factor) return '';
        const enteras = Math.floor(cantidad / mayor.factor);
        const resto = cantidad % mayor.factor;
        return [this.texto(enteras, mayor.nombre), resto ? this.texto(resto, this.unidadBase(medicina)) : ''].filter(Boolean).join(' + ');
    },

    existencia(medicina) {
        const cantidad = Number(medicina?.cantidad ?? medicina?.stock) || 0;
        const desglose = this.desglose(cantidad, medicina);
        return `${this.texto(cantidad, this.unidadBase(medicina))}${desglose ? ` (${desglose})` : ''}`;
    },

    // Código de barras escaneado → medicina y presentación. El código de la medicina (el del fabricante,
    // impreso en la caja) elige la presentación más grande; el código de una presentación, esa presentación.
    buscarPorCodigo(medicinas, codigo) {
        const limpio = String(codigo || '').trim();
        if (!limpio) return null;
        for (const medicina of medicinas) {
            const presentacion = (medicina.presentaciones || []).find(p => p.codigo_barra && p.codigo_barra === limpio);
            if (presentacion) return { medicina, presentacion: this.presentacion(medicina, presentacion.id) };
        }
        const medicina = medicinas.find(m => m.codigo_barra && m.codigo_barra === limpio);
        if (!medicina) return null;
        return { medicina, presentacion: this.presentaciones(medicina).slice(-1)[0] };
    }
};

window.InventarioMedicinas = InventarioMedicinas;
