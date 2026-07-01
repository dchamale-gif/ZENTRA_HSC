// ============================================
// DEMO DATA FOR STOCK FLOW
// ============================================

const demoData = {
    // Products in inventory
    products: [
        {
            id: 'PRD001',
            name: 'Laptop Dell XPS 15',
            category: 'Electrónica',
            price: 9360.00,
            stock: 15,
            minStock: 5,
            lastUpdated: '2026-03-22'
        },
        {
            id: 'PRD002',
            name: 'Monitor LG 27"',
            category: 'Electrónica',
            price: 2730.00,
            stock: 8,
            minStock: 3,
            lastUpdated: '2026-03-21'
        },
        {
            id: 'PRD003',
            name: 'Teclado Mecánico RGB',
            category: 'Electrónica',
            price: 936.00,
            stock: 45,
            minStock: 10,
            lastUpdated: '2026-03-20'
        },
        {
            id: 'PRD004',
            name: 'Ratón Logitech',
            category: 'Electrónica',
            price: 507.00,
            stock: 120,
            minStock: 20,
            lastUpdated: '2026-03-22'
        },
        {
            id: 'PRD005',
            name: 'Camiseta Premium Talla M',
            category: 'Ropa',
            price: 234.00,
            stock: 250,
            minStock: 50,
            lastUpdated: '2026-03-22'
        },
        {
            id: 'PRD006',
            name: 'Pantalón Vaquero Azul',
            category: 'Ropa',
            price: 429.00,
            stock: 180,
            minStock: 40,
            lastUpdated: '2026-03-21'
        },
        {
            id: 'PRD007',
            name: 'Café Premium 250g',
            category: 'Alimentos',
            price: 66.30,
            stock: 500,
            minStock: 100,
            lastUpdated: '2026-03-22'
        },
        {
            id: 'PRD008',
            name: 'Aceite Oliva Extra Virgen',
            category: 'Alimentos',
            price: 93.60,
            stock: 300,
            minStock: 50,
            lastUpdated: '2026-03-20'
        },
        {
            id: 'PRD009',
            name: 'Taladro Eléctrico 20V',
            category: 'Herramientas',
            price: 1170.00,
            stock: 12,
            minStock: 3,
            lastUpdated: '2026-03-19'
        },
        {
            id: 'PRD010',
            name: 'Set de Destornilladores',
            category: 'Herramientas',
            price: 273.00,
            stock: 45,
            minStock: 15,
            lastUpdated: '2026-03-22'
        }
    ],

    // Recent transactions
    transactions: [
        {
            id: 'TRN001',
            date: '2026-05-15',
            type: 'Venta',
            description: 'Venta a cliente Juan García - Laptop',
            quantity: 2,
            amount: 18720.00,
            status: 'Completada',
            productId: 'PRD001',
            referencia: 'FAC-2026-001'
        },
        {
            id: 'TRN002',
            date: '2026-05-15',
            type: 'Compra',
            description: 'Compra a proveedor Tech Supply - Teclados',
            quantity: 50,
            amount: 46800.00,
            status: 'Completada',
            productId: 'PRD003',
            referencia: 'OC-2026-001'
        },
        {
            id: 'TRN003',
            date: '2026-05-14',
            type: 'Venta',
            description: 'Venta a cliente María López - Monitores',
            quantity: 5,
            amount: 13650.00,
            status: 'Completada',
            productId: 'PRD002',
            referencia: 'FAC-2026-002'
        },
        {
            id: 'TRN004',
            date: '2026-05-14',
            type: 'Devolución',
            description: 'Devolución cliente Pedro Rodríguez - Defecto',
            quantity: 1,
            amount: 936.00,
            status: 'Completada',
            productId: 'PRD003',
            referencia: 'DEV-2026-001'
        },
        {
            id: 'TRN005',
            date: '2026-05-13',
            type: 'Compra',
            description: 'Compra a proveedor Fashion Store - Ropa',
            quantity: 100,
            amount: 23400.00,
            status: 'Completada',
            productId: 'PRD005',
            referencia: 'OC-2026-002'
        },
        {
            id: 'TRN006',
            date: '2026-05-13',
            type: 'Venta',
            description: 'Venta en línea - Ratones',
            quantity: 3,
            amount: 1521.00,
            status: 'Completada',
            productId: 'PRD004',
            referencia: 'FAC-2026-003'
        },
        {
            id: 'TRN007',
            date: '2026-05-12',
            type: 'Venta',
            description: 'Venta a cliente Ana Martínez - Pantalones',
            quantity: 2,
            amount: 858.00,
            status: 'Completada',
            productId: 'PRD006',
            referencia: 'FAC-2026-004'
        },
        {
            id: 'TRN008',
            date: '2026-05-12',
            type: 'Compra',
            description: 'Compra a distribuidor Food Co - Café',
            quantity: 200,
            amount: 13260.00,
            status: 'Completada',
            productId: 'PRD007',
            referencia: 'OC-2026-003'
        },
        {
            id: 'TRN009',
            date: '2026-05-11',
            type: 'Venta',
            description: 'Venta corporativa Empresa XYZ - Laptops',
            quantity: 10,
            amount: 93600.00,
            status: 'Completada',
            productId: 'PRD001',
            referencia: 'FAC-2026-005'
        },
        {
            id: 'TRN010',
            date: '2026-05-11',
            type: 'Compra',
            description: 'Compra a herramientas Tools Plus - Taladros',
            quantity: 8,
            amount: 9360.00,
            status: 'Completada',
            productId: 'PRD009',
            referencia: 'OC-2026-004'
        },
        {
            id: 'TRN011',
            date: '2026-05-10',
            type: 'Venta',
            description: 'Venta al mayorista - Electrodomésticos',
            quantity: 15,
            amount: 40950.00,
            status: 'Completada',
            productId: 'PRD002',
            referencia: 'FAC-2026-006'
        },
        {
            id: 'TRN012',
            date: '2026-05-10',
            type: 'Compra',
            description: 'Compra a proveedor Aceites Premium - Aceite',
            quantity: 50,
            amount: 4680.00,
            status: 'Completada',
            productId: 'PRD008',
            referencia: 'OC-2026-005'
        },
        {
            id: 'TRN013',
            date: '2026-05-09',
            type: 'Venta',
            description: 'Venta a tienda minorista - Destornilladores',
            quantity: 20,
            amount: 5460.00,
            status: 'Completada',
            productId: 'PRD010',
            referencia: 'FAC-2026-007'
        },
        {
            id: 'TRN014',
            date: '2026-05-09',
            type: 'Devolución',
            description: 'Devolución por defecto de fabricación',
            quantity: 3,
            amount: 2808.00,
            status: 'Completada',
            productId: 'PRD004',
            referencia: 'DEV-2026-002'
        },
        {
            id: 'TRN015',
            date: '2026-05-08',
            type: 'Venta',
            description: 'Venta especial cliente frecuente',
            quantity: 4,
            amount: 21840.00,
            status: 'Pendiente',
            productId: 'PRD001',
            referencia: 'FAC-2026-008'
        }
    ],

    // Sales data for chart (7 days)
    salesByDay: [
        { day: 'Lun', sales: 24960 },
        { day: 'Mar', sales: 21840 },
        { day: 'Mié', sales: 31980 },
        { day: 'Jue', sales: 29640 },
        { day: 'Vie', sales: 40560 },
        { day: 'Sab', sales: 35880 },
        { day: 'Dom', sales: 24180 }
    ],

    // Inventory distribution
    inventoryByCategory: [
        { category: 'Electrónica', value: 975000 },
        { category: 'Ropa', value: 195000 },
        { category: 'Alimentos', value: 62400 },
        { category: 'Herramientas', value: 93600 }
    ],

    // Clients data
    clientes: [
        {
            id: 'CLI-0001',
            nombre: 'Distribuidora Centro',
            email: 'contacto@distribuidora-centro.com',
            telefono: '+57 301 234 5678',
            ciudad: 'Bogotá',
            direccion: 'Carrera 5 # 10-20',
            estado: 'activo',
            fechaRegistro: '2026-01-15'
        },
        {
            id: 'CLI-0002',
            nombre: 'Tienda Premium',
            email: 'ventas@tienda-premium.com',
            telefono: '+57 302 345 6789',
            ciudad: 'Medellín',
            direccion: 'Calle 50 # 45-30',
            estado: 'activo',
            fechaRegistro: '2026-02-01'
        }
    ],

    // Patients data (pueden o no ser clientes)
    pacientes: [
        {
            id: 'PAC-0001',
            cedula: '1023456789',
            nombre: 'Juan',
            apellido: 'Pérez García',
            email: 'juan.perez@email.com',
            telefono: '+57 310 123 4567',
            fechaNacimiento: '1985-05-15',
            genero: 'Masculino',
            direccion: 'Calle 10 # 5-20',
            ciudad: 'Bogotá',
            estado: 'activo',
            isCliente: false,
            clienteId: null,
            fechaRegistro: '2026-04-01',
            notas: 'Paciente regular con buena adherencia al tratamiento'
        },
        {
            id: 'PAC-0002',
            cedula: '1098765432',
            nombre: 'María',
            apellido: 'López Rodríguez',
            email: 'maria.lopez@email.com',
            telefono: '+57 311 234 5678',
            fechaNacimiento: '1990-08-22',
            genero: 'Femenino',
            direccion: 'Carrera 7 # 15-40',
            ciudad: 'Bogotá',
            estado: 'activo',
            isCliente: true,
            clienteId: 'CLI-0001',
            fechaRegistro: '2026-03-15',
            notas: 'Paciente cliente activo con saldo pendiente'
        },
        {
            id: 'PAC-0003',
            cedula: '1111222333',
            nombre: 'Carlos',
            apellido: 'Martínez Sánchez',
            email: 'carlos.martinez@email.com',
            telefono: '+57 312 345 6789',
            fechaNacimiento: '1992-03-10',
            genero: 'Masculino',
            direccion: 'Avenida 9 # 20-50',
            ciudad: 'Medellín',
            estado: 'activo',
            isCliente: true,
            clienteId: 'CLI-0002',
            fechaRegistro: '2026-02-20',
            notas: 'Requiere seguimiento especializado'
        },
        {
            id: 'PAC-0004',
            cedula: '1444555666',
            nombre: 'Ana',
            apellido: 'González Torres',
            email: 'ana.gonzalez@email.com',
            telefono: '+57 313 456 7890',
            fechaNacimiento: '1988-11-30',
            genero: 'Femenino',
            direccion: 'Calle 25 # 12-60',
            ciudad: 'Cali',
            estado: 'inactivo',
            isCliente: false,
            clienteId: null,
            fechaRegistro: '2025-12-10',
            notas: 'Paciente inactivo por 6 meses'
        },
        {
            id: 'PAC-0005',
            cedula: '1777888999',
            nombre: 'Roberto',
            apellido: 'Hernández Díaz',
            email: 'roberto.hernandez@email.com',
            telefono: '+57 314 567 8901',
            fechaNacimiento: '1980-07-05',
            genero: 'Masculino',
            direccion: 'Carrera 15 # 30-70',
            ciudad: 'Barranquilla',
            estado: 'activo',
            isCliente: false,
            clienteId: null,
            fechaRegistro: '2026-04-10',
            notas: 'Nuevo paciente derivado de referencia'
        }
    ],

    // Medicines data
    medicinas: [
        {
            id: 'MED-00001',
            codigoBarra: '7501001234567',
            nombre: 'Paracetamol 500mg',
            familia: 'Analgésicos',
            subfamilia: 'Monoterápicos',
            presentacion: 'Tabletas',
            principioActivo: 'Paracetamol',
            dosis: '500',
            unidadDosis: 'mg',
            lote: 'L202600125',
            fechaVencimiento: '2028-06-15',
            proveedor: 'Laboratorios Bayer',
            cantidad: 150,
            cantidadMinima: 50,
            precioUnitario: 0.85,
            contraindicaciones: 'Hipersensibilidad a paracetamol, insuficiencia hepática grave',
            efectosSecundarios: 'Reacciones alérgicas raras, hepatotoxicidad en dosis altas',
            fechaRegistro: '2026-01-10',
            activa: true
        },
        {
            id: 'MED-00002',
            codigoBarra: '7501001234568',
            nombre: 'Amoxicilina 500mg',
            familia: 'Antibióticos',
            subfamilia: 'Beta-lactámicos',
            presentacion: 'Cápsulas',
            principioActivo: 'Amoxicilina',
            dosis: '500',
            unidadDosis: 'mg',
            lote: 'L202600234',
            fechaVencimiento: '2027-12-20',
            proveedor: 'Laboratorios GlaxoSmithKline',
            cantidad: 45,
            cantidadMinima: 30,
            precioUnitario: 2.50,
            contraindicaciones: 'Alergia a penicilinas o cefalosporinas',
            efectosSecundarios: 'Náuseas, diarrea, erupción alérgica',
            fechaRegistro: '2026-01-15',
            activa: true
        },
        {
            id: 'MED-00003',
            codigoBarra: '7501001234569',
            nombre: 'Ibuprofeno 400mg',
            familia: 'Antinflamatorios',
            subfamilia: 'AINE',
            presentacion: 'Tabletas',
            principioActivo: 'Ibuprofeno',
            dosis: '400',
            unidadDosis: 'mg',
            lote: 'L202600145',
            fechaVencimiento: '2028-03-10',
            proveedor: 'Laboratorios Pfizer',
            cantidad: 200,
            cantidadMinima: 60,
            precioUnitario: 1.20,
            contraindicaciones: 'Úlcera péptica activa, insuficiencia renal grave',
            efectosSecundarios: 'Dolor abdominal, dispepsia, mareos',
            fechaRegistro: '2026-02-01',
            activa: true
        },
        {
            id: 'MED-00004',
            codigoBarra: '7501001234570',
            nombre: 'Loratadina 10mg',
            familia: 'Antihistamínicos',
            subfamilia: 'No sedantes',
            presentacion: 'Tabletas',
            principioActivo: 'Loratadina',
            dosis: '10',
            unidadDosis: 'mg',
            lote: 'L202600156',
            fechaVencimiento: '2028-08-22',
            proveedor: 'Laboratorios Merck',
            cantidad: 80,
            cantidadMinima: 25,
            precioUnitario: 1.75,
            contraindicaciones: 'Hipersensibilidad a loratadina',
            efectosSecundarios: 'Sedación leve, sequedad bucal',
            fechaRegistro: '2026-02-10',
            activa: true
        },
        {
            id: 'MED-00005',
            codigoBarra: '7501001234571',
            nombre: 'Metformina 850mg',
            familia: 'Antidiabéticos',
            subfamilia: 'Biguanidas',
            presentacion: 'Tabletas',
            principioActivo: 'Metformina',
            dosis: '850',
            unidadDosis: 'mg',
            lote: 'L202600167',
            fechaVencimiento: '2028-11-30',
            proveedor: 'Laboratorios Novartis',
            cantidad: 30,
            cantidadMinima: 40,
            precioUnitario: 3.50,
            contraindicaciones: 'Insuficiencia renal, acidosis',
            efectosSecundarios: 'Gastrointestinales, déficit B12',
            fechaRegistro: '2026-01-20',
            activa: true
        },
        {
            id: 'MED-00006',
            codigoBarra: '7501001234572',
            nombre: 'Omeprazol 20mg',
            familia: 'Gastroprotectores',
            subfamilia: 'Inhibidores de bomba protónica',
            presentacion: 'Cápsulas',
            principioActivo: 'Omeprazol',
            dosis: '20',
            unidadDosis: 'mg',
            lote: 'L202600178',
            fechaVencimiento: '2027-05-15',
            proveedor: 'Laboratorios AstraZeneca',
            cantidad: 0,
            cantidadMinima: 20,
            precioUnitario: 2.80,
            contraindicaciones: 'Hipersensibilidad al omeprazol',
            efectosSecundarios: 'Cefalea, diarrea, deficiencia mineral',
            fechaRegistro: '2026-03-05',
            activa: true
        },
        {
            id: 'MED-00007',
            codigoBarra: '7501001234573',
            nombre: 'Atorvastatina 20mg',
            familia: 'Hipolipemiantes',
            subfamilia: 'Estatinas',
            presentacion: 'Tabletas',
            principioActivo: 'Atorvastatina',
            dosis: '20',
            unidadDosis: 'mg',
            lote: 'L202600189',
            fechaVencimiento: '2027-09-20',
            proveedor: 'Laboratorios Pfizer',
            cantidad: 65,
            cantidadMinima: 30,
            precioUnitario: 5.25,
            contraindicaciones: 'Enfermedad hepática activa, embarazo',
            efectosSecundarios: 'Mialgia, elevación de enzimas hepáticas',
            fechaRegistro: '2026-01-25',
            activa: true
        },
        {
            id: 'MED-00008',
            codigoBarra: '7501001234574',
            nombre: 'Salbutamol Inhalador',
            familia: 'Broncodilatadores',
            subfamilia: 'Beta-2 agonistas',
            presentacion: 'Inyectable',
            principioActivo: 'Salbutamol',
            dosis: '100',
            unidadDosis: 'mcg/inhalación',
            lote: 'L202600190',
            fechaVencimiento: '2026-12-10',
            proveedor: 'Laboratorios GlaxoSmithKline',
            cantidad: 12,
            cantidadMinima: 8,
            precioUnitario: 8.50,
            contraindicaciones: 'Tirotoxicosis, arritmias cardíacas',
            efectosSecundarios: 'Temblor, taquicardia, cefalea',
            fechaRegistro: '2026-02-15',
            activa: true
        }
    ],

    // Medicines assigned to patients
    medicamentosAsignados: [
        {
            id: 'ASG-00001',
            pacienteId: 'PAC-0002',
            medicineId: 'MED-00001',
            cantidad: 10,
            dosis: '1 tableta cada 8 horas',
            frecuencia: 'Cada 8 horas',
            fechaInicio: '2026-05-01',
            fechaFin: '2026-05-15',
            estado: 'activo',
            notas: 'Por fiebre - Tomar con alimentos',
            fechaAsignacion: '2026-05-01'
        },
        {
            id: 'ASG-00002',
            pacienteId: 'PAC-0003',
            medicineId: 'MED-00002',
            cantidad: 15,
            dosis: '1 cápsula cada 8 horas',
            frecuencia: 'Cada 8 horas',
            fechaInicio: '2026-04-25',
            fechaFin: '2026-05-10',
            estado: 'activo',
            notas: 'Infección respiratoria - Completar el tratamiento',
            fechaAsignacion: '2026-04-25'
        },
        {
            id: 'ASG-00003',
            pacienteId: 'PAC-0001',
            medicineId: 'MED-00003',
            cantidad: 20,
            dosis: '1 tableta cada 12 horas',
            frecuencia: 'Cada 12 horas',
            fechaInicio: '2026-05-02',
            fechaFin: null,
            estado: 'activo',
            notas: 'Dolor articular - Uso prolongado',
            fechaAsignacion: '2026-05-02'
        }
    ],

    // Clinical histories
    historiasClinicas: [
        {
            id: 'HC-0001',
            pacienteId: 'PAC-0002',
            antecedentesMedicos: 'Diabetes Mellitus tipo 2 diagnosticada hace 5 años. Hipertensión arterial controlada. Sin cirugías previas. Alergia a la Penicilina.',
            antecedentesfamiliares: 'Madre diabética. Padre hipertenso. Hermano con enfermedad coronaria.',
            alergias: 'Penicilina (anafilaxis leve), Rojo de tartrazina',
            diagnosticosActivos: [
                {
                    id: 'DX-001',
                    nombre: 'Diabetes Mellitus Tipo 2',
                    descripcion: 'Diabetes controlada con metformina',
                    fecha: '2021-03-15'
                },
                {
                    id: 'DX-002',
                    nombre: 'Infección Respiratoria',
                    descripcion: 'Infección de vías respiratorias superiores',
                    fecha: '2026-04-25'
                }
            ],
            notas: [
                {
                    id: 'NOTE-001',
                    tipo: 'Diagnóstico',
                    contenido: 'Paciente presenta fiebre (38.5°C) y tos productiva. Evaluación clínica sugiere infección respiratoria viral. Se prescribió tratamiento sintomático.',
                    fecha: '2026-04-25',
                    medico: 'Dr. Francisco Rodríguez'
                },
                {
                    id: 'NOTE-002',
                    tipo: 'Observación',
                    contenido: 'Seguimiento: Paciente mejorando, fiebre en descenso. Continuar tratamiento antitérmico cada 8 horas con alimentos.',
                    fecha: '2026-04-27',
                    medico: 'Dr. Francisco Rodríguez'
                },
                {
                    id: 'NOTE-003',
                    tipo: 'Control',
                    contenido: 'Glucometría realizada: 156 mg/dL (control adecuado). Signos vitales dentro de los rangos normales. Paciente asintomático.',
                    fecha: '2026-05-02',
                    medico: 'Enfermera Carolina Morales'
                }
            ],
            fechaCreacion: '2026-04-25'
        },
        {
            id: 'HC-0002',
            pacienteId: 'PAC-0001',
            antecedentesMedicos: 'Sin enfermedades crónicas conocidas. Historia de migrañas ocasionales. Una fractura de radio hace 3 años (cicatrizado). Prostatismo leve.',
            antecedentesfamiliares: 'Padre con historia de infarto a los 65 años. Madre sin enfermedades relevantes.',
            alergias: 'Ninguna conocida',
            diagnosticosActivos: [
                {
                    id: 'DX-003',
                    nombre: 'Artralgias',
                    descripcion: 'Dolor articular crónico bilateral en rodillas',
                    fecha: '2026-03-10'
                }
            ],
            notas: [
                {
                    id: 'NOTE-004',
                    tipo: 'Evaluación',
                    contenido: 'Paciente consulta por dolor articular bilateral en rodillas. Dolor intermitente, worse con actividad física. No hay inflamación visible. Se realizó examen físico completo.',
                    fecha: '2026-03-10',
                    medico: 'Dr. Felipe Herrera'
                },
                {
                    id: 'NOTE-005',
                    tipo: 'Indicaciones',
                    contenido: 'Prescrited: Ibuprofeno 400mg cada 12 horas, reposo relativo, fisioterapia. Follow-up en 2 semanas.',
                    fecha: '2026-03-10',
                    medico: 'Dr. Felipe Herrera'
                },
                {
                    id: 'NOTE-006',
                    tipo: 'Seguimiento',
                    contenido: 'Paciente reporta mejora del 60% en dolor. Continuará con tratamiento farmacológico y terapia física.',
                    fecha: '2026-05-01',
                    medico: 'Dr. Felipe Herrera'
                }
            ],
            fechaCreacion: '2026-03-10'
        },
        {
            id: 'HC-0003',
            pacienteId: 'PAC-0003',
            antecedentesMedicos: 'Gastritis crónica. Hiperlipidemia. Sin cirugías previas. Historia de reflujo gastroesofágico.',
            antecedentesfamiliares: 'Abuelo materno con cáncer gástrico. Padre con colesterol elevado.',
            alergias: 'Ácido acetilsalicílico (urticaria)',
            diagnosticosActivos: [
                {
                    id: 'DX-004',
                    nombre: 'Gastritis Crónica',
                    descripcion: 'Inflamación crónica del estómago',
                    fecha: '2024-06-20'
                },
                {
                    id: 'DX-005',
                    nombre: 'Hiperlipidemia',
                    descripcion: 'Colesterol total elevado - Bajo control farmacológico',
                    fecha: '2025-01-15'
                }
            ],
            notas: [
                {
                    id: 'NOTE-007',
                    tipo: 'Diagnóstico',
                    contenido: 'Paciente con síntomas de infección respiratoria. Tos seca persistente por 5 días. Se realizó auscultación pulmonar normal. Prescritos antibióticos.',
                    fecha: '2026-04-25',
                    medico: 'Dra. Silvia Campos'
                },
                {
                    id: 'NOTE-008',
                    tipo: 'Contraindicación',
                    contenido: 'IMPORTANTE: No prescribir aspirina debido a alergia conocida. Usar omeprazol 20mg diario para gastroprotección dada gastritis crónica.',
                    fecha: '2026-04-25',
                    medico: 'Dra. Silvia Campos'
                }
            ],
            fechaCreacion: '2024-06-20'
        }
    ],

    // Patient account balances (Saldo del Paciente)
    saldosPacientes: [
        {
            pacienteId: 'PAC-0001',
            totalAcumulado: 850.00,
            totalAbonos: 350.00,
            saldoPendiente: 500.00,
            ultimaTransaccion: '2026-05-02'
        },
        {
            pacienteId: 'PAC-0002',
            totalAcumulado: 1250.50,
            totalAbonos: 1250.50,
            saldoPendiente: 0,
            ultimaTransaccion: '2026-05-01'
        },
        {
            pacienteId: 'PAC-0003',
            totalAcumulado: 2100.00,
            totalAbonos: 800.00,
            saldoPendiente: 1300.00,
            ultimaTransaccion: '2026-04-28'
        },
        {
            pacienteId: 'PAC-0005',
            totalAcumulado: 600.00,
            totalAbonos: 200.00,
            saldoPendiente: 400.00,
            ultimaTransaccion: '2026-04-30'
        }
    ],

    // Patient transactions/movements (Movimientos Paciente) - CON LÍNEAS DE CONCEPTO
    movimientosPaciente: [
        {
            id: 'MOV-001',
            pacienteId: 'PAC-0001',
            tipo: 'Cargo',
            monto: 500.00,
            descripcion: 'Consulta y medicamentos',
            fecha: '2026-05-01',
            lineas: [
                { concepto: 'Consulta Médica', cantidad: 1, unitario: 200.00, subtotal: 200.00 },
                { concepto: 'Medicamentos', cantidad: 3, unitario: 100.00, subtotal: 300.00 }
            ]
        },
        {
            id: 'MOV-002',
            pacienteId: 'PAC-0001',
            tipo: 'Cargo',
            monto: 350.00,
            descripcion: 'Servicios de enfermería y encamamiento',
            fecha: '2026-04-29',
            lineas: [
                { concepto: 'Encamamiento (1 noche)', cantidad: 1, unitario: 250.00, subtotal: 250.00 },
                { concepto: 'Servicios de enfermería', cantidad: 1, unitario: 100.00, subtotal: 100.00 }
            ]
        },
        {
            id: 'MOV-003',
            pacienteId: 'PAC-0001',
            tipo: 'Abono',
            monto: 350.00,
            descripcion: 'Pago parcial',
            fecha: '2026-05-02'
        },
        {
            id: 'MOV-004',
            pacienteId: 'PAC-0002',
            tipo: 'Cargo',
            monto: 1250.50,
            descripcion: 'Internación y servicios médicos',
            fecha: '2026-04-20',
            lineas: [
                { concepto: 'Encamamiento (5 noches)', cantidad: 5, unitario: 200.00, subtotal: 1000.00 },
                { concepto: 'Análisis de laboratorio', cantidad: 1, unitario: 150.00, subtotal: 150.00 },
                { concepto: 'Medicamentos especiales', cantidad: 1, unitario: 100.50, subtotal: 100.50 }
            ]
        },
        {
            id: 'MOV-005',
            pacienteId: 'PAC-0002',
            tipo: 'Abono',
            monto: 1250.50,
            descripcion: 'Pago completo',
            fecha: '2026-05-01'
        },
        {
            id: 'MOV-006',
            pacienteId: 'PAC-0003',
            tipo: 'Cargo',
            monto: 1300.00,
            descripcion: 'Tratamiento antibiótico',
            fecha: '2026-04-25'
        },
        {
            id: 'MOV-007',
            pacienteId: 'PAC-0003',
            tipo: 'Cargo',
            monto: 800.00,
            descripcion: 'Análisis clínicos',
            fecha: '2026-04-15'
        },
        {
            id: 'MOV-008',
            pacienteId: 'PAC-0003',
            tipo: 'Abono',
            monto: 800.00,
            descripcion: 'Pago parcial',
            fecha: '2026-04-28'
        }
    ],

    // Articles with dual coding (Códigos de Artículos)
    secciones: [
        { id: 'SEC-001', nombre: 'Medicamentos', descripcion: 'Fármacos y medicinas' },
        { id: 'SEC-002', nombre: 'Instrumental', descripcion: 'Equipos e instrumental médico' },
        { id: 'SEC-003', nombre: 'Consumibles', descripcion: 'Suministros y consumibles' },
        { id: 'SEC-004', nombre: 'Servicios', descripcion: 'Servicios profesionales' }
    ],

    familias: [
        { id: 'FAM-001', seccionId: 'SEC-001', nombre: 'Analgésicos', descripcion: 'Medicamentos para dolor' },
        { id: 'FAM-002', seccionId: 'SEC-001', nombre: 'Antibióticos', descripcion: 'Medicamentos antibacterianos' },
        { id: 'FAM-003', seccionId: 'SEC-001', nombre: 'Antiinflamatorios', descripcion: 'Medicamentos antiinflamatorios' },
        { id: 'FAM-004', seccionId: 'SEC-002', nombre: 'Equipos Diagnóstico', descripcion: 'Equipos para diagnóstico' },
        { id: 'FAM-005', seccionId: 'SEC-003', nombre: 'Insumos Hospital', descripcion: 'Insumos hospitalarios' }
    ],

    subfamilias: [
        { id: 'SUBFAM-001', familiaId: 'FAM-001', nombre: 'Acetaminofén', descripcion: 'Paracetamol' },
        { id: 'SUBFAM-002', familiaId: 'FAM-001', nombre: 'Ibuprofeno', descripcion: 'Anti-inflamatorio' },
        { id: 'SUBFAM-003', familiaId: 'FAM-002', nombre: 'Penicilinas', descripcion: 'Beta-lactámicos' }
    ],

    articulos: [
        {
            id: 'ART-001',
            nombre: 'Paracetamol 500mg',
            concepto: 'PARA-500',
            codigoVenta: 'PAR-0001',
            codigoCompra: 'LAB-BAYER-001',
            seccionId: 'SEC-001',
            familiaId: 'FAM-001',
            subfamiliaId: 'SUBFAM-001',
            precioCompra: 0.85,
            precioVenta: 2.50,
            estado: 'activo',
            descripcion: 'Analgésico de uso común',
            fechaCreacion: '2026-01-10'
        },
        {
            id: 'ART-002',
            nombre: 'Amoxicilina 500mg',
            concepto: 'AMOX-500',
            codigoVenta: 'AMX-0002',
            codigoCompra: 'LAB-GSK-001',
            seccionId: 'SEC-001',
            familiaId: 'FAM-002',
            subfamiliaId: 'SUBFAM-003',
            precioCompra: 2.50,
            precioVenta: 7.50,
            estado: 'activo',
            descripcion: 'Antibiótico beta-lactámico',
            fechaCreacion: '2026-01-15'
        },
        {
            id: 'ART-003',
            nombre: 'Ibuprofeno 400mg',
            concepto: 'IBU-400',
            codigoVenta: 'IBU-0003',
            codigoCompra: 'LAB-PFIZER-001',
            seccionId: 'SEC-001',
            familiaId: 'FAM-003',
            subfamiliaId: 'SUBFAM-002',
            precioCompra: 1.20,
            precioVenta: 3.80,
            estado: 'activo',
            descripcion: 'Antiinflamatorio AINE',
            fechaCreacion: '2026-02-01'
        },
        {
            id: 'ART-004',
            nombre: 'Alcohol al 70%',
            concepto: 'ALC-70',
            codigoVenta: 'ALC-0004',
            codigoCompra: 'CONS-001',
            seccionId: 'SEC-003',
            familiaId: 'FAM-005',
            precioCompra: 0.50,
            precioVenta: 1.50,
            estado: 'activo',
            descripcion: 'Desinfectante de uso hospitalario',
            fechaCreacion: '2026-02-10'
        },
        {
            id: 'ART-005',
            nombre: 'Vendas estériles 5cm',
            concepto: 'VEN-5',
            codigoVenta: 'VEN-0005',
            codigoCompra: 'CONS-002',
            seccionId: 'SEC-003',
            familiaId: 'FAM-005',
            precioCompra: 0.75,
            precioVenta: 2.00,
            estado: 'activo',
            descripcion: 'Vendaje estéril médico',
            fechaCreacion: '2026-03-01'
        }
    ],

    // Cash register movements (Movimientos de Caja)
    movimientosCaja: [
        {
            id: 'CAJ-001',
            tipo: 'Ingreso por Cobro',
            pacienteId: 'PAC-0002',
            monto: 1250.50,
            descripcion: 'Cobro de factura a paciente',
            fecha: '2026-05-01',
            referencia: 'FAC-2026-001',
            usuario: 'Recepcionista',
            hora: '09:15'
        },
        {
            id: 'CAJ-002',
            tipo: 'Egreso',
            pacienteId: null,
            monto: 500.00,
            descripcion: 'Reposición de medicamentos',
            fecha: '2026-05-01',
            referencia: 'ORD-COMPRA-001',
            usuario: 'Farmacéutico',
            hora: '10:30'
        },
        {
            id: 'CAJ-003',
            tipo: 'Ingreso por Cobro',
            pacienteId: 'PAC-0001',
            monto: 350.00,
            descripcion: 'Pago parcial de saldo',
            fecha: '2026-05-02',
            referencia: 'REC-2026-001',
            usuario: 'Caja',
            hora: '11:00'
        },
        {
            id: 'CAJ-004',
            tipo: 'Microfactura',
            pacienteId: 'PAC-0003',
            monto: 450.00,
            descripcion: 'Microfactura sin cierre de cuenta',
            fecha: '2026-04-28',
            referencia: 'MF-2026-001',
            usuario: 'Caja',
            hora: '14:20',
            detallesItems: [
                { descripcion: 'Consulta médica', monto: 200.00 },
                { descripcion: 'Medicamentos', monto: 250.00 }
            ]
        },
        {
            id: 'CAJ-005',
            tipo: 'Devolución',
            pacienteId: null,
            monto: 150.00,
            descripcion: 'Devolución de medicamento',
            fecha: '2026-04-27',
            referencia: 'DEV-2026-001',
            usuario: 'Farmacéutico',
            hora: '15:45'
        }
    ],

    // Medical prescriptions (Prescripciones Médicas)
    prescripciones: [
        {
            id: 'PRESC-001',
            pacienteId: 'PAC-0002',
            medicoId: 'DR-001',
            medicoNombre: 'Dr. Francisco Rodríguez',
            especialidad: 'Medicina General',
            fecha: '2026-05-15',
            hora: '10:30',
            estado: 'Activa',
            medicinas: [
                {
                    id: 'PRESC-001-MED1',
                    medicineId: 'MED-00001',
                    medicinaNombre: 'Paracetamol 500mg',
                    dosis: '500mg',
                    cantidad: 10,
                    frecuencia: 'Cada 8 horas',
                    duracion: '5 días',
                    precioUnitario: 0.85,
                    subtotal: 8.50,
                    indicaciones: 'Por fiebre - Tomar con alimentos',
                    monto: 8.50
                },
                {
                    id: 'PRESC-001-MED2',
                    medicineId: 'MED-00002',
                    medicinaNombre: 'Amoxicilina 500mg',
                    dosis: '500mg',
                    cantidad: 15,
                    frecuencia: 'Cada 8 horas',
                    duracion: '7 días',
                    precioUnitario: 2.50,
                    subtotal: 37.50,
                    indicaciones: 'Infección respiratoria - Completar el tratamiento',
                    monto: 37.50
                }
            ],
            montoTotal: 46.00,
            diagnostico: 'Infección respiratoria viral con fiebre',
            cargoAutomatico: true,
            cargadoEnCuenta: true,
            fechaCargo: '2026-05-15',
            referencia: 'PRESC-001',
            notas: 'Paciente hospitalizado - Cobrar automáticamente'
        },
        {
            id: 'PRESC-002',
            pacienteId: 'PAC-0001',
            medicoId: 'DR-002',
            medicoNombre: 'Dr. Felipe Herrera',
            especialidad: 'Traumatología',
            fecha: '2026-05-14',
            hora: '14:15',
            estado: 'Activa',
            medicinas: [
                {
                    id: 'PRESC-002-MED1',
                    medicineId: 'MED-00003',
                    medicinaNombre: 'Ibuprofeno 400mg',
                    dosis: '400mg',
                    cantidad: 20,
                    frecuencia: 'Cada 12 horas',
                    duracion: '10 días',
                    precioUnitario: 1.20,
                    subtotal: 24.00,
                    indicaciones: 'Dolor articular - Tomar con alimentos',
                    monto: 24.00
                }
            ],
            montoTotal: 24.00,
            diagnostico: 'Artralgias bilaterales en rodillas',
            cargoAutomatico: true,
            cargadoEnCuenta: true,
            fechaCargo: '2026-05-14',
            referencia: 'PRESC-002',
            notas: 'Paciente ambulatorio - Cobrar automáticamente'
        },
        {
            id: 'PRESC-003',
            pacienteId: 'PAC-0003',
            medicoId: 'DR-003',
            medicoNombre: 'Dra. Silvia Campos',
            especialidad: 'Medicina Interna',
            fecha: '2026-05-13',
            hora: '11:45',
            estado: 'Activa',
            medicinas: [
                {
                    id: 'PRESC-003-MED1',
                    medicineId: 'MED-00006',
                    medicinaNombre: 'Omeprazol 20mg',
                    dosis: '20mg',
                    cantidad: 30,
                    frecuencia: 'Diaria',
                    duracion: '30 días',
                    precioUnitario: 2.80,
                    subtotal: 84.00,
                    indicaciones: 'Gastroprotección - Tomar en ayunas',
                    monto: 84.00
                },
                {
                    id: 'PRESC-003-MED2',
                    medicineId: 'MED-00007',
                    medicinaNombre: 'Atorvastatina 20mg',
                    dosis: '20mg',
                    cantidad: 30,
                    frecuencia: 'Diaria',
                    duracion: '30 días',
                    precioUnitario: 5.25,
                    subtotal: 157.50,
                    indicaciones: 'Control de colesterol',
                    monto: 157.50
                }
            ],
            montoTotal: 241.50,
            diagnostico: 'Gastritis crónica con hiperlipidemia',
            cargoAutomatico: true,
            cargadoEnCuenta: true,
            fechaCargo: '2026-05-13',
            referencia: 'PRESC-003',
            notas: 'Paciente hospitalizado - Cobrar automáticamente'
        }
    ],

    // Medical doctors (Médicos)
    medicos: [
        {
            id: 'DR-001',
            nombre: 'Dr. Francisco Rodríguez',
            apellido: 'Rodríguez',
            cedula: '1098765432',
            especialidad: 'Medicina General',
            numero_registro: 'MED-00001',
            email: 'francisco.rodriguez@hospital.com',
            telefono: '+57 310 123 4567',
            estado: 'activo'
        },
        {
            id: 'DR-002',
            nombre: 'Dr. Felipe Herrera',
            apellido: 'Herrera',
            cedula: '1122334455',
            especialidad: 'Traumatología',
            numero_registro: 'MED-00002',
            email: 'felipe.herrera@hospital.com',
            telefono: '+57 311 234 5678',
            estado: 'activo'
        },
        {
            id: 'DR-003',
            nombre: 'Dra. Silvia Campos',
            apellido: 'Campos',
            cedula: '1133445566',
            especialidad: 'Medicina Interna',
            numero_registro: 'MED-00003',
            email: 'silvia.campos@hospital.com',
            telefono: '+57 312 345 6789',
            estado: 'activo'
        }
    ],

    // Hospital Stays (Hospitalizaciones)
    hospitalizaciones: [
        {
            id: 'HOSP-001',
            pacienteId: 'PAC-0001',
            habitacion: '1-1',
            cama: '1-1-1',
            fechaIngreso: '2026-05-20',
            diagnostico: 'Neumonía bilateral',
            observaciones: 'Paciente requiere monitoreo continuo de saturación de oxígeno',
            estado: 'activa'
        },
        {
            id: 'HOSP-002',
            pacienteId: 'PAC-0002',
            habitacion: '1-2',
            cama: '1-2-2',
            fechaIngreso: '2026-05-22',
            diagnostico: 'Infección urinaria complicada',
            observaciones: 'En tratamiento con antibióticos de amplio espectro',
            estado: 'activa'
        },
        {
            id: 'HOSP-003',
            pacienteId: 'PAC-0003',
            habitacion: '2-1',
            cama: '2-1-1',
            fechaIngreso: '2026-05-18',
            diagnostico: 'Cálculos renales',
            observaciones: 'Pendiente procedimiento urológico',
            estado: 'activa'
        }
    ],
    conceptos: [
        { id: 'CON-001', nombre: 'EEGSA', descripcion: 'Energía Eléctrica', categoria: 'Servicios Básicos' },
        { id: 'CON-002', nombre: 'Telefonía', descripcion: 'Servicios de Telefonía', categoria: 'Comunicaciones' },
        { id: 'CON-003', nombre: 'Internet', descripcion: 'Servicio de Internet', categoria: 'Comunicaciones' },
        { id: 'CON-004', nombre: 'Agua', descripcion: 'Suministro de Agua', categoria: 'Servicios Básicos' },
        { id: 'CON-005', nombre: 'Gasolina', descripcion: 'Combustible Vehículos', categoria: 'Transporte' },
        { id: 'CON-006', nombre: 'Mantenimiento', descripcion: 'Mantenimiento Infraestructura', categoria: 'Mantenimiento' }
    ],
    proveedores: [
        { id: 'PRV-001', nombre: 'EEGSA', referencia: 'Energía Eléctrica de Guatemala', telefono: '2206-6500', estado: 'activo' },
        { id: 'PRV-002', nombre: 'Claro Guatemala', referencia: 'Telefonía Móvil/Fija', telefono: '1200-1200', estado: 'activo' },
        { id: 'PRV-003', nombre: 'Movistar', referencia: 'Telefonía Móvil', telefono: '2500-0000', estado: 'activo' },
        { id: 'PRV-004', nombre: 'EMAYA', referencia: 'Empresa Municipal de Agua', telefono: '2221-2000', estado: 'activo' },
        { id: 'PRV-005', nombre: 'Shell Guatemala', referencia: 'Distribuidora de Combustibles', telefono: '2384-7000', estado: 'activo' }
    ],
    pagos: [
        { id: 'PAG-001', fecha: '2026-06-01', concepto: 'CON-001', proveedor: 'PRV-001', monto: 1560, referencia: 'Ref#2026-06-001', estado: 'pagado' },
        { id: 'PAG-002', fecha: '2026-06-02', concepto: 'CON-002', proveedor: 'PRV-002', monto: 780, referencia: 'Ref#2026-06-002', estado: 'pagado' },
        { id: 'PAG-003', fecha: '2026-06-02', concepto: 'CON-003', proveedor: 'PRV-002', monto: 390, referencia: 'Ref#2026-06-003', estado: 'pagado' },
        { id: 'PAG-004', fecha: '2026-05-28', concepto: 'CON-001', proveedor: 'PRV-001', monto: 1560, referencia: 'Ref#2026-05-028', estado: 'pagado' },
        { id: 'PAG-005', fecha: '2026-05-26', concepto: 'CON-004', proveedor: 'PRV-004', monto: 468, referencia: 'Ref#2026-05-026', estado: 'pagado' },
        { id: 'PAG-006', fecha: '2026-05-25', concepto: 'CON-002', proveedor: 'PRV-003', monto: 624, referencia: 'Ref#2026-05-025', estado: 'pagado' },
        { id: 'PAG-007', fecha: '2026-05-23', concepto: 'CON-005', proveedor: 'PRV-005', monto: 2340, referencia: 'Ref#2026-05-023', estado: 'pagado' }
    ],

    // Datos de ejemplo: Pacientes
    pacientes: [
        {
            id: 1001,
            nombre: 'Juan',
            apellido_paterno: 'López',
            apellido_materno: 'Rodríguez',
            edad: 45,
            fecha_nacimiento: '1981-03-15',
            genero: 'M',
            dpi: '1234567890101',
            telefono: '7856-1234',
            email: 'juan.lopez@email.com',
            direccion: 'Calle Principal 123',
            colonia: 'Zona 10',
            zona: '10',
            municipio: 'Guatemala',
            departamento: 'Guatemala',
            estado_civil: 'Casado',
            profesion: 'Ingeniero',
            ocupacion: 'Empleado Público',
            estado: 'activo'
        },
        {
            id: 1002,
            nombre: 'María',
            apellido_paterno: 'García',
            apellido_materno: 'Morales',
            edad: 38,
            fecha_nacimiento: '1988-07-22',
            genero: 'F',
            dpi: '2345678901012',
            telefono: '7865-5678',
            email: 'maria.garcia@email.com',
            direccion: 'Avenida Central 456',
            colonia: 'Zona 12',
            zona: '12',
            municipio: 'Guatemala',
            departamento: 'Guatemala',
            estado_civil: 'Soltera',
            profesion: 'Médica',
            ocupacion: 'Autónoma',
            estado: 'activo'
        },
        {
            id: 1003,
            nombre: 'Carlos',
            apellido_paterno: 'Pérez',
            apellido_materno: 'López',
            edad: 52,
            fecha_nacimiento: '1974-11-08',
            genero: 'M',
            dpi: '3456789012123',
            telefono: '7834-9012',
            email: 'carlos.perez@email.com',
            direccion: 'Boulevard los Próceres 789',
            colonia: 'Zona 15',
            zona: '15',
            municipio: 'Guatemala',
            departamento: 'Guatemala',
            estado_civil: 'Divorciado',
            profesion: 'Abogado',
            ocupacion: 'Profesional Independiente',
            estado: 'activo'
        },
        {
            id: 1004,
            nombre: 'Ana',
            apellido_paterno: 'Martínez',
            apellido_materno: 'Díaz',
            edad: 29,
            fecha_nacimiento: '1997-05-10',
            genero: 'F',
            dpi: '4567890123234',
            telefono: '7812-3456',
            email: 'ana.martinez@email.com',
            direccion: 'Paseo Montufar 321',
            colonia: 'Zona 3',
            zona: '3',
            municipio: 'Guatemala',
            departamento: 'Guatemala',
            estado_civil: 'Casada',
            profesion: 'Psicóloga',
            ocupacion: 'Clínica Privada',
            estado: 'activo'
        },
        {
            id: 1005,
            nombre: 'Roberto',
            apellido_paterno: 'Sánchez',
            apellido_materno: 'Gómez',
            edad: 61,
            fecha_nacimiento: '1965-12-25',
            genero: 'M',
            dpi: '5678901234345',
            telefono: '7843-7890',
            email: 'robert.sanchez@email.com',
            direccion: 'Carrera 8 654',
            colonia: 'Zona 9',
            zona: '9',
            municipio: 'Guatemala',
            departamento: 'Guatemala',
            estado_civil: 'Viudo',
            profesion: 'Contador',
            ocupacion: 'Jubilado',
            estado: 'activo'
        }
    ],

    // Datos de ejemplo: Saldos de Pacientes
    saldosPacientes: [
        {
            pacienteId: 1001,
            saldoPendiente: 1250.00,
            totalAcumulado: 3500.00,
            abonosRealizados: 2250.00,
            ultimaTransaccion: '2026-06-28',
            estado: 'deudor'
        },
        {
            pacienteId: 1002,
            saldoPendiente: 0.00,
            totalAcumulado: 850.00,
            abonosRealizados: 850.00,
            ultimaTransaccion: '2026-06-25',
            estado: 'pagado'
        },
        {
            pacienteId: 1003,
            saldoPendiente: 3750.50,
            totalAcumulado: 5200.50,
            abonosRealizados: 1450.00,
            ultimaTransaccion: '2026-06-29',
            estado: 'deudor'
        },
        {
            pacienteId: 1004,
            saldoPendiente: 450.75,
            totalAcumulado: 1200.75,
            abonosRealizados: 750.00,
            ultimaTransaccion: '2026-06-26',
            estado: 'deudor'
        },
        {
            pacienteId: 1005,
            saldoPendiente: 0.00,
            totalAcumulado: 2100.00,
            abonosRealizados: 2100.00,
            ultimaTransaccion: '2026-06-20',
            estado: 'pagado'
        }
    ],

    // Datos de ejemplo: Movimientos de Pacientes
    movimientosPaciente: [
        {
            id: 'MOV_001',
            pacienteId: 1001,
            tipo: 'cargo',
            descripcion: 'Consulta Psiquiátrica',
            monto: 500.00,
            saldoAnterior: 750.00,
            saldoNuevo: 1250.00,
            referenciaId: 'FAC_001',
            fecha: '2026-06-28'
        },
        {
            id: 'MOV_002',
            pacienteId: 1001,
            tipo: 'abono',
            descripcion: 'Pago parcial',
            monto: 500.00,
            saldoAnterior: 1250.00,
            saldoNuevo: 750.00,
            referenciaId: 'PAG_001',
            fecha: '2026-06-27'
        },
        {
            id: 'MOV_003',
            pacienteId: 1003,
            tipo: 'cargo',
            descripcion: 'Internamiento (3 días)',
            monto: 2000.00,
            saldoAnterior: 1750.50,
            saldoNuevo: 3750.50,
            referenciaId: 'FAC_002',
            fecha: '2026-06-29'
        },
        {
            id: 'MOV_004',
            pacienteId: 1003,
            tipo: 'abono',
            descripcion: 'Abono a cuenta',
            monto: 1000.00,
            saldoAnterior: 3750.50,
            saldoNuevo: 2750.50,
            referenciaId: 'PAG_002',
            fecha: '2026-06-24'
        },
        {
            id: 'MOV_005',
            pacienteId: 1002,
            tipo: 'cargo',
            descripcion: 'Medicamentos',
            monto: 350.00,
            saldoAnterior: 500.00,
            saldoNuevo: 850.00,
            referenciaId: 'FAC_003',
            fecha: '2026-06-23'
        },
        {
            id: 'MOV_006',
            pacienteId: 1002,
            tipo: 'abono',
            descripcion: 'Pago completo',
            monto: 850.00,
            saldoAnterior: 850.00,
            saldoNuevo: 0.00,
            referenciaId: 'PAG_003',
            fecha: '2026-06-25'
        },
        {
            id: 'MOV_007',
            pacienteId: 1004,
            tipo: 'cargo',
            descripcion: 'Consulta + Laboratorio',
            monto: 450.75,
            saldoAnterior: 0.00,
            saldoNuevo: 450.75,
            referenciaId: 'FAC_004',
            fecha: '2026-06-26'
        },
        {
            id: 'MOV_008',
            pacienteId: 1005,
            tipo: 'abono',
            descripcion: 'Pago total',
            monto: 2100.00,
            saldoAnterior: 2100.00,
            saldoNuevo: 0.00,
            referenciaId: 'PAG_004',
            fecha: '2026-06-20'
        }
    ]
};

// Make data globally available
window.DemoData = demoData;

// ============================================
// UTILITY FUNCTIONS FOR DEMO DATA
// ============================================

function getProduct(productId) {
    return demoData.products.find(p => p.id === productId);
}

function getTransactionsByType(type) {
    return demoData.transactions.filter(t => t.type === type);
}

function getTotalSales() {
    return demoData.transactions
        .filter(t => t.type === 'Venta' && t.status === 'Completada')
        .reduce((sum, t) => sum + t.amount, 0);
}

function getTotalExpenses() {
    return demoData.transactions
        .filter(t => t.type === 'Compra' && t.status === 'Completada')
        .reduce((sum, t) => sum + t.amount, 0);
}

function getTotalInventoryValue() {
    return demoData.products.reduce((sum, p) => sum + (p.price * p.stock), 0);
}

function getLowStockProducts() {
    return demoData.products.filter(p => p.stock <= p.minStock);
}

function formatCurrency(value) {
    return new Intl.NumberFormat('es-GT', {
        style: 'currency',
        currency: 'GTQ'
    }).format(value);
}

function formatDate(date) {
    return new Intl.DateTimeFormat('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }).format(new Date(date));
}

function getStatusBadgeClass(status) {
    switch(status) {
        case 'Completada':
            return 'status-completed';
        case 'Pendiente':
            return 'status-pending';
        case 'Fallida':
            return 'status-failed';
        default:
            return 'status-pending';
    }
}

function getTransactionTypeIcon(type) {
    switch(type) {
        case 'Venta':
            return 'fas fa-arrow-down';
        case 'Compra':
            return 'fas fa-arrow-up';
        case 'Devolución':
            return 'fas fa-undo';
        default:
            return 'fas fa-exchange-alt';
    }
}

function getProductStatus(stock, minStock) {
    if (stock === 0) return 'Agotado';
    if (stock <= minStock) return 'Stock Bajo';
    return 'Disponible';
}

function getProductStatusClass(stock, minStock) {
    if (stock === 0) return 'status-failed';
    if (stock <= minStock) return 'status-low-stock';
    return 'status-active';
}
