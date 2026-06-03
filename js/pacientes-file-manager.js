// ============================================
// EXTENSIONES PARA MÓDULO DE PACIENTES
// ============================================
// Funcionalidades de carga de archivos y generación de documentos

const PacientesFileManager = {
    // Templates disponibles
    templates: {
        ficha: {
            id: 'ficha',
            nombre: 'Ficha Clínica',
            descripcion: 'Información personal y médica del paciente',
            icono: '📋'
        },
        historia: {
            id: 'historia',
            nombre: 'Historia Médica',
            descripcion: 'Historia completa de consultas y tratamientos',
            icono: '📚'
        },
        referencia: {
            id: 'referencia',
            nombre: 'Referencia Médica',
            descripcion: 'Documento para referencia a otro especialista',
            icono: '↗️'
        },
        alta: {
            id: 'alta',
            nombre: 'Nota de Alta',
            descripcion: 'Resumen de hospitalización y recomendaciones',
            icono: '✓'
        },
        diagnostico: {
            id: 'diagnostico',
            nombre: 'Reporte de Diagnóstico',
            descripcion: 'Detalle de diagnóstico y procedimientos',
            icono: '🔍'
        },
        medicamentos: {
            id: 'medicamentos',
            nombre: 'Prescripción Médica',
            descripcion: 'Lista de medicamentos prescritos',
            icono: '💊'
        }
    },

    // Inicializar el gestor de archivos
    init() {
        this.setupFileUploadListeners();
    },

    // Configurar listeners para carga de archivos
    setupFileUploadListeners() {
        // Crear elemento de entrada oculto para archivos
        if (!document.getElementById('pacientFileInput')) {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.id = 'pacientFileInput';
            fileInput.style.display = 'none';
            fileInput.accept = '.jpg,.jpeg,.png,.webp,.pdf';
            fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
            document.body.appendChild(fileInput);
        }
    },

    // Manejar selección de archivo
    async handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Validar tipo de archivo
        if (!FileUtils.isValidFileType(file)) {
            alert('❌ Tipo de archivo no permitido. Solo se aceptan imágenes (JPG, PNG, WebP) y PDF');
            return;
        }

        // Validar tamaño
        if (!FileUtils.isValidFileSize(file, 10)) {
            alert('❌ El archivo es demasiado grande. Máximo 10 MB');
            return;
        }

        try {
            const base64File = await FileUtils.fileToBase64(file);
            const pacienteId = document.getElementById('pacientId').value;
            
            if (!pacienteId) {
                alert('⚠️ Por favor guarda el paciente primero antes de agregar archivos');
                return;
            }

            // Almacenar en el paciente
            this.storePacientFile(pacienteId, base64File);
            
            // Actualizar vista de archivos
            this.renderPacientFiles(pacienteId);
            
            alert('✅ Archivo cargado exitosamente');
        } catch (error) {
            console.error('Error al procesar archivo:', error);
            alert('❌ Error al procesar el archivo');
        }

        // Limpiar input
        event.target.value = '';
    },

    // Almacenar archivo en el paciente
    storePacientFile(pacienteId, base64File) {
        const paciente = PacientesModule.state.pacientes.find(p => p.id === pacienteId);
        if (!paciente) return;

        // Inicializar array de archivos si no existe
        if (!paciente.archivos) {
            paciente.archivos = [];
        }

        // Crear entrada de archivo
        const fileEntry = FileUtils.createFileEntry(base64File, pacienteId, 'general');
        paciente.archivos.push(fileEntry);

        // Guardar en BD (localStorage por ahora)
        PacientesModule.saveToDB();
    },

    // Renderizar archivos del paciente
    renderPacientFiles(pacienteId) {
        const paciente = PacientesModule.state.pacientes.find(p => p.id === pacienteId);
        if (!paciente || !paciente.archivos || paciente.archivos.length === 0) {
            return '<p style="text-align: center; color: #999;">No hay archivos cargados</p>';
        }

        const filesHTML = paciente.archivos.map(file => `
            <div style="background: white; border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                    <div>
                        <strong>${file.fileName}</strong><br>
                        <small style="color: #999;">
                            ${FileUtils.formatFileSize(file.fileSize)} - 
                            ${new Date(file.uploadDate).toLocaleDateString('es-ES')}
                        </small>
                    </div>
                    <button class="btn btn-sm btn-danger" onclick="PacientesFileManager.deletePacientFile('${pacienteId}', '${file.id}')">
                        <i class="fas fa-trash"></i> Eliminar
                    </button>
                </div>
                ${FileUtils.getFilePreview(file)}
            </div>
        `).join('');

        const container = document.getElementById('pacientFilesContainer');
        if (container) {
            container.innerHTML = filesHTML;
        }
    },

    // Eliminar archivo del paciente
    deletePacientFile(pacienteId, fileId) {
        if (!confirm('¿Estás seguro de que quieres eliminar este archivo?')) return;

        const paciente = PacientesModule.state.pacientes.find(p => p.id === pacienteId);
        if (!paciente || !paciente.archivos) return;

        paciente.archivos = paciente.archivos.filter(f => f.id !== fileId);
        PacientesModule.saveToDB();
        this.renderPacientFiles(pacienteId);
    },

    // Abrir diálogo de carga de archivos
    openFileUploadDialog() {
        const pacienteId = document.getElementById('pacientId').value;
        if (!pacienteId) {
            alert('⚠️ Por favor guarda el paciente primero');
            return;
        }
        document.getElementById('pacientFileInput').click();
    },

    // Abrir selector de templates
    openTemplateSelector(pacienteId) {
        const paciente = PacientesModule.state.pacientes.find(p => p.id === pacienteId);
        if (!paciente) return;

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-dialog" style="max-width: 700px;">
                <div class="modal-header">
                    <h2><i class="fas fa-file-word"></i> Selecciona un Template</h2>
                    <button class="close-btn" onclick="this.closest('.modal-overlay').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        ${Object.values(this.templates).map(template => `
                            <div style="background: white; border: 2px solid #ddd; border-radius: 8px; padding: 20px; cursor: pointer; text-align: center; transition: all 0.3s; text-decoration: none;"
                                 onmouseover="this.style.borderColor='#1e3a8a'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)';"
                                 onmouseout="this.style.borderColor='#ddd'; this.style.boxShadow='none';"
                                 onclick="PacientesFileManager.generateWordFromTemplate('${pacienteId}', '${template.id}'); this.closest('.modal-overlay').remove();">
                                <div style="font-size: 32px; margin-bottom: 10px;">${template.icono}</div>
                                <strong style="font-size: 16px; color: #1e3a8a; display: block; margin-bottom: 8px;">${template.nombre}</strong>
                                <small style="color: #666;">${template.descripcion}</small>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    // Generar Word desde template
    generateWordFromTemplate(pacienteId, templateId) {
        const paciente = PacientesModule.state.pacientes.find(p => p.id === pacienteId);
        if (!paciente) return;

        const template = this.templates[templateId];
        if (!template) return;

        const htmlContent = this.buildTemplateContent(paciente, templateId);
        this.downloadWord(htmlContent, `${template.nombre}_${paciente.nombre}_${new Date().getTime()}`);
    },

    // Construir contenido según el template seleccionado
    buildTemplateContent(paciente, templateId) {
        const fecha = new Date().toLocaleDateString('es-ES', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric'
        });

        let contenido = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Calibri, sans-serif; margin: 40px; line-height: 1.6; }
                    h1 { color: #1e3a8a; text-align: center; font-size: 24px; margin-bottom: 10px; border-bottom: 3px solid #0891b2; padding-bottom: 10px; }
                    h2 { color: #0891b2; font-size: 14px; margin-top: 20px; margin-bottom: 10px; text-transform: uppercase; border-left: 4px solid #0891b2; padding-left: 10px; }
                    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
                    td, th { border: 1px solid #ddd; padding: 10px; text-align: left; }
                    th { background-color: #e8f4f8; font-weight: bold; }
                    tr:nth-child(even) { background-color: #f9f9f9; }
                    .info-box { background: #f0f7ff; border-left: 4px solid #1e3a8a; padding: 15px; margin: 15px 0; }
                    .footer { margin-top: 40px; text-align: center; border-top: 1px solid #ddd; padding-top: 20px; font-size: 11px; color: #666; }
                </style>
            </head>
            <body>
        `;

        switch(templateId) {
            case 'ficha':
                contenido += this.buildFichaTemplate(paciente, fecha);
                break;
            case 'historia':
                contenido += this.buildHistoriaTemplate(paciente, fecha);
                break;
            case 'referencia':
                contenido += this.buildReferenciaTemplate(paciente, fecha);
                break;
            case 'alta':
                contenido += this.buildAltaTemplate(paciente, fecha);
                break;
            case 'diagnostico':
                contenido += this.buildDiagnosticoTemplate(paciente, fecha);
                break;
            case 'medicamentos':
                contenido += this.buildMedicamentosTemplate(paciente, fecha);
                break;
        }

        contenido += `
                <div class="footer">
                    <p>Documento generado automáticamente por Zentra MED - ${fecha}</p>
                    <p>Sistema Médico Integral</p>
                </div>
            </body>
            </html>
        `;

        return contenido;
    },

    // Template: Ficha Clínica
    buildFichaTemplate(paciente, fecha) {
        return `
            <h1>📋 FICHA CLÍNICA DEL PACIENTE</h1>
            
            <h2>Información Personal</h2>
            <table>
                <tr><td style="width: 40%;"><strong>Cédula:</strong></td><td>${paciente.cedula}</td></tr>
                <tr><td><strong>Nombre Completo:</strong></td><td>${paciente.nombre} ${paciente.apellido}</td></tr>
                <tr><td><strong>Edad:</strong></td><td>${this.calculateAge(paciente.fechaNacimiento)} años</td></tr>
                <tr><td><strong>Género:</strong></td><td>${paciente.genero || 'No especificado'}</td></tr>
                <tr><td><strong>Fecha de Nacimiento:</strong></td><td>${paciente.fechaNacimiento || 'No registrada'}</td></tr>
                <tr><td><strong>Teléfono:</strong></td><td>${paciente.telefono}</td></tr>
                <tr><td><strong>Email:</strong></td><td>${paciente.email}</td></tr>
            </table>

            <h2>Información de Ubicación</h2>
            <table>
                <tr><td style="width: 40%;"><strong>Dirección:</strong></td><td>${paciente.direccion || 'No registrada'}</td></tr>
                <tr><td><strong>Ciudad:</strong></td><td>${paciente.ciudad || 'No registrada'}</td></tr>
            </table>

            ${paciente.notas ? `
            <h2>Notas Médicas</h2>
            <div class="info-box">${paciente.notas}</div>
            ` : ''}

            <h2>Datos del Registro</h2>
            <p><strong>Registrado:</strong> ${paciente.fechaRegistro}<br>
            <strong>Estado:</strong> ${paciente.estado.toUpperCase()}<br>
            <strong>Tipo:</strong> ${paciente.isCliente ? 'Cliente y Paciente' : 'Paciente'}</p>
        `;
    },

    // Template: Historia Médica
    buildHistoriaTemplate(paciente, fecha) {
        return `
            <h1>📚 HISTORIA MÉDICA COMPLETA</h1>
            <p style="text-align: center; color: #666;">Paciente: <strong>${paciente.nombre} ${paciente.apellido}</strong> - Cédula: <strong>${paciente.cedula}</strong></p>

            <h2>Datos Demográficos</h2>
            <table>
                <tr><td style="width: 40%;"><strong>Edad:</strong></td><td>${this.calculateAge(paciente.fechaNacimiento)} años</td></tr>
                <tr><td><strong>Género:</strong></td><td>${paciente.genero || 'No especificado'}</td></tr>
                <tr><td><strong>Estado Civil:</strong></td><td>-</td></tr>
                <tr><td><strong>Ocupación:</strong></td><td>-</td></tr>
            </table>

            <h2>Antecedentes Médicos Personales</h2>
            <div class="info-box">
                <p>Se registrará información sobre enfermedades previas, cirugías y tratamientos realizados.</p>
            </div>

            <h2>Antecedentes Médicos Familiares</h2>
            <div class="info-box">
                <p>Se registrará información sobre enfermedades hereditarias en la familia.</p>
            </div>

            <h2>Medicamentos Actuales</h2>
            <div class="info-box">
                <p>No hay medicamentos registrados</p>
            </div>

            <h2>Alergias Conocidas</h2>
            <div class="info-box">
                <p>No hay alergias registradas</p>
            </div>

            <h2>Consultas y Procedimientos</h2>
            <div class="info-box">
                <p>Paciente registrado desde: ${paciente.fechaRegistro}</p>
            </div>

            ${paciente.notas ? `
            <h2>Observaciones Clínicas</h2>
            <div class="info-box">${paciente.notas}</div>
            ` : ''}
        `;
    },

    // Template: Referencia Médica
    buildReferenciaTemplate(paciente, fecha) {
        return `
            <h1>↗️ REFERENCIA MÉDICA</h1>

            <div class="info-box">
                <p><strong>Fecha:</strong> ${fecha}</p>
                <p><strong>De:</strong> Zentra MED - Sistema Médico Integral</p>
                <p><strong>Para:</strong> Médico Especialista</p>
            </div>

            <h2>Datos del Paciente</h2>
            <table>
                <tr><td style="width: 40%;"><strong>Nombre:</strong></td><td>${paciente.nombre} ${paciente.apellido}</td></tr>
                <tr><td><strong>Cédula:</strong></td><td>${paciente.cedula}</td></tr>
                <tr><td><strong>Edad:</strong></td><td>${this.calculateAge(paciente.fechaNacimiento)} años</td></tr>
                <tr><td><strong>Teléfono:</strong></td><td>${paciente.telefono}</td></tr>
                <tr><td><strong>Email:</strong></td><td>${paciente.email}</td></tr>
            </table>

            <h2>Motivo de Referencia</h2>
            <div class="info-box">
                <p>Se requiere valoración especializada para continuar diagnóstico y tratamiento.</p>
            </div>

            <h2>Hallazgos Actuales</h2>
            ${paciente.notas ? `
            <div class="info-box">${paciente.notas}</div>
            ` : `
            <div class="info-box">
                <p>Paciente actualmente en seguimiento médico.</p>
            </div>
            `}

            <h2>Recomendaciones</h2>
            <div class="info-box">
                <p>Se solicita valoración y opinión especializada.<br>
                Favor confirmar cita y mantener comunicación continua.</p>
            </div>

            <h2>Responsable Médico</h2>
            <table>
                <tr><td style="width: 40%;"><strong>Nombre:</strong></td><td>_________________________________</td></tr>
                <tr><td><strong>Especialidad:</strong></td><td>_________________________________</td></tr>
                <tr><td><strong>Firma:</strong></td><td>_________________________________</td></tr>
            </table>
        `;
    },

    // Template: Nota de Alta
    buildAltaTemplate(paciente, fecha) {
        return `
            <h1>✓ NOTA DE ALTA MÉDICA</h1>

            <h2>Datos del Paciente</h2>
            <table>
                <tr><td style="width: 40%;"><strong>Nombre:</strong></td><td>${paciente.nombre} ${paciente.apellido}</td></tr>
                <tr><td><strong>Cédula:</strong></td><td>${paciente.cedula}</td></tr>
                <tr><td><strong>Edad:</strong></td><td>${this.calculateAge(paciente.fechaNacimiento)} años</td></tr>
                <tr><td><strong>Fecha de Alta:</strong></td><td>${fecha}</td></tr>
            </table>

            <h2>Diagnóstico al Ingreso</h2>
            <div class="info-box">
                <p>Descripción del diagnóstico inicial.</p>
            </div>

            <h2>Procedimientos Realizados</h2>
            <div class="info-box">
                <p>Se realizaron los siguientes procedimientos durante la hospitalización:</p>
                <ul>
                    <li>Evaluación y monitoreo continuo</li>
                    <li>Tratamiento ambulatorio según protocolo</li>
                </ul>
            </div>

            <h2>Medicamentos Prescritos al Alta</h2>
            <table>
                <tr>
                    <th>Medicamento</th>
                    <th>Dosis</th>
                    <th>Frecuencia</th>
                    <th>Duración</th>
                </tr>
                <tr>
                    <td colspan="4" style="text-align: center; color: #666;">Especificar medicamentos prescritos</td>
                </tr>
            </table>

            <h2>Recomendaciones post-alta</h2>
            <div class="info-box">
                <ul>
                    <li>Completar el curso de medicamentos prescritos</li>
                    <li>Reposo relativo según indicaciones</li>
                    <li>Control en consulta externa</li>
                    <li>En caso de complicaciones, acudir a emergencias</li>
                </ul>
            </div>

            <h2>Próxima Cita</h2>
            <p><strong>Especialidad:</strong> ________________________<br>
            <strong>Fecha Sugerida:</strong> ________________________</p>

            <div style="margin-top: 40px; border-top: 1px solid #ddd; padding-top: 20px;">
                <p><strong>Médico Tratante:</strong> _________________________________<br>
                <strong>Firma y Sello:</strong> _________________________________</p>
            </div>
        `;
    },

    // Template: Reporte de Diagnóstico
    buildDiagnosticoTemplate(paciente, fecha) {
        return `
            <h1>🔍 REPORTE DE DIAGNÓSTICO</h1>

            <h2>Paciente</h2>
            <table>
                <tr><td style="width: 40%;"><strong>Nombre:</strong></td><td>${paciente.nombre} ${paciente.apellido}</td></tr>
                <tr><td><strong>Cédula:</strong></td><td>${paciente.cedula}</td></tr>
                <tr><td><strong>Edad:</strong></td><td>${this.calculateAge(paciente.fechaNacimiento)} años</td></tr>
                <tr><td><strong>Fecha del Reporte:</strong></td><td>${fecha}</td></tr>
            </table>

            <h2>Presentación Clínica</h2>
            <div class="info-box">
                <p>El paciente presenta síntomas que ameritan evaluación especializada.</p>
            </div>

            <h2>Antecedentes Relevantes</h2>
            <div class="info-box">
                ${paciente.notas || '<p>No hay antecedentes especiales registrados</p>'}
            </div>

            <h2>Hallazgos del Examen Físico</h2>
            <table>
                <tr><td style="width: 30%;"><strong>Parámetro</strong></td><td><strong>Hallazgo</strong></td></tr>
                <tr><td>Presión Arterial</td><td>_______________</td></tr>
                <tr><td>Frecuencia Cardíaca</td><td>_______________</td></tr>
                <tr><td>Frecuencia Respiratoria</td><td>_______________</td></tr>
                <tr><td>Temperatura</td><td>_______________</td></tr>
            </table>

            <h2>Impresión Diagnóstica</h2>
            <div class="info-box">
                <p>Diagnóstico preliminar basado en la evaluación clínica:</p>
            </div>

            <h2>Plan de Tratamiento</h2>
            <div class="info-box">
                <ul>
                    <li>Establecer diagnóstico definitivo mediante estudios complementarios</li>
                    <li>Iniciar tratamiento según protocolos establecidos</li>
                    <li>Seguimiento periódico y ajuste terapéutico según respuesta</li>
                </ul>
            </div>

            <div style="margin-top: 40px; border-top: 1px solid #ddd; padding-top: 20px;">
                <p><strong>Médico Evaluador:</strong> _________________________________<br>
                <strong>Especialidad:</strong> _________________________________<br>
                <strong>Firma:</strong> _________________________________</p>
            </div>
        `;
    },

    // Template: Prescripción de Medicamentos
    buildMedicamentosTemplate(paciente, fecha) {
        return `
            <h1>💊 PRESCRIPCIÓN MÉDICA</h1>

            <h2>Datos del Paciente</h2>
            <table>
                <tr><td style="width: 40%;"><strong>Nombre:</strong></td><td>${paciente.nombre} ${paciente.apellido}</td></tr>
                <tr><td><strong>Cédula:</strong></td><td>${paciente.cedula}</td></tr>
                <tr><td><strong>Edad:</strong></td><td>${this.calculateAge(paciente.fechaNacimiento)} años</td></tr>
                <tr><td><strong>Género:</strong></td><td>${paciente.genero || 'No especificado'}</td></tr>
                <tr><td><strong>Fecha de Prescripción:</strong></td><td>${fecha}</td></tr>
            </table>

            <h2>Medicamentos Prescritos</h2>
            <table>
                <tr>
                    <th>Medicamento</th>
                    <th>Presentación</th>
                    <th>Dosis</th>
                    <th>Frecuencia</th>
                    <th>Duración</th>
                </tr>
                <tr>
                    <td colspan="5" style="text-align: center; padding: 30px; color: #666;">Agregar medicamentos prescritos</td>
                </tr>
            </table>

            <h2>Indicaciones Importantes</h2>
            <div class="info-box">
                <ul>
                    <li>Tomar los medicamentos exactamente como se prescribe</li>
                    <li>No suspender abruptamente sin consultar al médico</li>
                    <li>Reportar cualquier reacción adversa</li>
                    <li>Mantener los medicamentos en su envase original</li>
                </ul>
            </div>

            <h2>Información de Seguridad</h2>
            <div class="info-box">
                <p><strong>Alergias Conocidas:</strong> ${paciente.alergias || 'No especificadas'}</p>
                <p><strong>Medicamentos Contraindicados:</strong> ${paciente.contraindicaciones || 'Ninguno'}</p>
            </div>

            <h2>Próxima Consulta</h2>
            <p><strong>Fecha Sugerida:</strong> _________________________________</p>

            <div style="margin-top: 40px; border-top: 1px solid #ddd; padding-top: 20px;">
                <p><strong>Médico Prescriptor:</strong> _________________________________<br>
                <strong>Cédula Profesional:</strong> _________________________________<br>
                <strong>Firma y Sello:</strong> _________________________________</p>
            </div>
        `;
    },

    // Calcular edad
    calculateAge(birthDate) {
        if (!birthDate) return 0;
        const today = new Date();
        const birth = new Date(birthDate);
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age--;
        }
        return age;
    },

    // Descargar documento Word
    downloadWord(htmlContent, fileName) {
        const blob = new Blob([htmlContent], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${fileName}.docx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    },

    // Mostrar modal de generación de Word (compatible)
    openWordGeneratorModal(pacienteId) {
        this.openTemplateSelector(pacienteId);
    }
};

// Inicializar cuando cargue el documento
document.addEventListener('DOMContentLoaded', () => {
    PacientesFileManager.init();
});
