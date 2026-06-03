// ============================================
// MÓDULO DE CONFIRMACIONES AUTOMÁTICAS
// ============================================

const ConfirmacionesModule = {
    state: {
        confirmaciones: [],
        configAutomatica: {
            emailActivado: true,
            smsActivado: true,
            whatsappActivado: true,
            recordatoriosDias: 1,
            recordatoriosHoras: 1,
            horarioEnvio: { inicio: '08:00', fin: '20:00' }
        },
        plantillas: {}
    },

    // Inicializar el módulo
    init() {
        this.setupEventListeners();
        this.loadData();
        console.log('Módulo de Confirmaciones Automáticas inicializado');
    },

    // Configurar event listeners
    setupEventListeners() {
        const toggleEmailBtn = document.getElementById('toggleEmailConfirmation');
        if (toggleEmailBtn) {
            toggleEmailBtn.addEventListener('change', (e) => {
                this.state.configAutomatica.emailActivado = e.target.checked;
            });
        }

        const toggleSmsBtn = document.getElementById('toggleSmsConfirmation');
        if (toggleSmsBtn) {
            toggleSmsBtn.addEventListener('change', (e) => {
                this.state.configAutomatica.smsActivado = e.target.checked;
            });
        }

        const toggleWhatsappBtn = document.getElementById('toggleWhatsappConfirmation');
        if (toggleWhatsappBtn) {
            toggleWhatsappBtn.addEventListener('change', (e) => {
                this.state.configAutomatica.whatsappActivado = e.target.checked;
            });
        }
    },

    // Cargar datos
    loadData() {
        this.state.plantillas = {
            email: {
                confirmacion: `
                    <h2>¡Cita Confirmada!</h2>
                    <p>Hola {{nombre}},</p>
                    <p>Tu cita ha sido confirmada para el {{fecha}} a las {{hora}}</p>
                    <p><strong>Doctor:</strong> {{doctor}}</p>
                    <p><strong>Especialidad:</strong> {{especialidad}}</p>
                    <p><strong>Código de confirmación:</strong> {{codigo}}</p>
                `,
                recordatorio: `
                    <h2>Recordatorio de Cita</h2>
                    <p>Hola {{nombre}},</p>
                    <p>Te recordamos que tienes una cita mañana {{fecha}} a las {{hora}}</p>
                    <p>Doctor: {{doctor}}</p>
                `,
                cancelacion: `
                    <h2>Cita Cancelada</h2>
                    <p>Tu cita del {{fecha}} ha sido cancelada.</p>
                    <p>Por favor contactanos para agendar una nueva cita.</p>
                `
            },
            sms: {
                confirmacion: 'Cita confirmada {{fecha}} {{hora}} con {{doctor}}. Código: {{codigo}}',
                recordatorio: 'Recordatorio: Cita mañana {{hora}} con {{doctor}}. Código: {{codigo}}',
                cancelacion: 'Tu cita del {{fecha}} ha sido cancelada.'
            }
        };

        this.state.confirmaciones = [
            {
                id: 'CONF-001',
                citaId: 'CIT-001',
                tipo: 'email',
                estado: 'Enviado',
                fecha: '2026-04-01 10:30',
                destinatario: 'juan@example.com'
            }
        ];
    },

    // Enviar confirmación
    sendConfirmation(appointment, type = 'email') {
        if (!this.shouldSendConfirmation(type)) {
            console.log(`Confirmación por ${type} desactivada`);
            return;
        }

        const confirmation = {
            id: `CONF-${Date.now()}`,
            citaId: appointment.id,
            tipo: type,
            estado: 'Enviando',
            fecha: new Date().toISOString(),
            destinatario: type === 'email' ? appointment.email : appointment.telefono
        };

        this.state.confirmaciones.push(confirmation);

        switch(type) {
            case 'email':
                this.sendEmilConfirmation(appointment);
                break;
            case 'sms':
                this.sendSmsConfirmation(appointment);
                break;
            case 'whatsapp':
                this.sendWhatsappConfirmation(appointment);
                break;
        }

        confirmation.estado = 'Enviado';
    },

    // Enviar confirmación por email
    sendEmilConfirmation(appointment) {
        const template = this.state.plantillas.email.confirmacion;
        const content = this.replaceTemplate(template, appointment);

        console.log(`Enviando email de confirmación a ${appointment.email}`);
        console.log('Contenido:', content);

        // Integración con servicio de email (SendGrid, AWS SES, etc)
        // const response = await emailService.send({
        //     to: appointment.email,
        //     subject: 'Cita Confirmada',
        //     html: content
        // });
    },

    // Enviar confirmación por SMS
    sendSmsConfirmation(appointment) {
        const template = this.state.plantillas.sms.confirmacion;
        const content = this.replaceTemplate(template, appointment);

        console.log(`Enviando SMS de confirmación a ${appointment.telefono}`);
        console.log('Mensaje:', content);

        // Integración con servicio de SMS (Twilio, AWS SNS, etc)
        // const response = await smsService.send({
        //     to: appointment.telefono,
        //     body: content
        // });
    },

    // Enviar confirmación por WhatsApp
    sendWhatsappConfirmation(appointment) {
        const template = this.state.plantillas.sms.confirmacion;
        const content = this.replaceTemplate(template, appointment);

        console.log(`Enviando WhatsApp de confirmación a ${appointment.telefono}`);
        console.log('Mensaje:', content);

        // Integración con WhatsApp Business API
        // const response = await whatsappService.send({
        //     to: appointment.telefono,
        //     message: content
        // });
    },

    // Reemplazar placeholders en plantillas
    replaceTemplate(template, data) {
        let content = template;
        content = content.replace('{{nombre}}', data.paciente || data.nombre || '');
        content = content.replace('{{fecha}}', data.fecha || '');
        content = content.replace('{{hora}}', data.hora || '');
        content = content.replace('{{doctor}}', data.doctor || '');
        content = content.replace('{{especialidad}}', data.especialidad || '');
        content = content.replace('{{codigo}}', data.codigoConfirmacion || data.id || '');
        return content;
    },

    // Verificar si debe enviar confirmación
    shouldSendConfirmation(type) {
        switch(type) {
            case 'email':
                return this.state.configAutomatica.emailActivado;
            case 'sms':
                return this.state.configAutomatica.smsActivado;
            case 'whatsapp':
                return this.state.configAutomatica.whatsappActivado;
            default:
                return false;
        }
    },

    // Enviar recordatorios programados
    sendScheduledReminders() {
        console.log('Procesando recordatorios programados...');

        // Obtener citas para mañana o próximas horas
        const now = new Date();
        const reminderDate = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        // En una aplicación real, obtendrías las citas de una base de datos
        // appointments.forEach(appointment => {
        //     if (appointment.fecha === reminderDate && !appointment.recordatorioEnviado) {
        //         this.sendReminder(appointment);
        //         appointment.recordatorioEnviado = true;
        //     }
        // });
    },

    // Enviar recordatorio
    sendReminder(appointment) {
        ['email', 'sms', 'whatsapp'].forEach(type => {
            if (this.shouldSendConfirmation(type)) {
                const template = this.state.plantillas[type === 'email' ? 'email' : 'sms'].recordatorio;
                const content = this.replaceTemplate(template, appointment);

                console.log(`Recordatorio por ${type} para ${appointment.nombre || appointment.paciente}`);
                console.log('Contenido:', content);
            }
        });
    },

    // Obtener historial de confirmaciones
    getConfirmationHistory(appointmentId) {
        return this.state.confirmaciones.filter(c => c.citaId === appointmentId);
    },

    // Reenviar confirmación
    resendConfirmation(confirmationId) {
        const confirmation = this.state.confirmaciones.find(c => c.id === confirmationId);
        if (confirmation) {
            confirmation.estado = 'Reenviado';
            console.log('Confirmación reenviada:', confirmation);
        }
    }
};

// Ejecutar recordatorios cada hora
setInterval(() => {
    if (window.ConfirmacionesModule) {
        ConfirmacionesModule.sendScheduledReminders();
    }
}, 3600000); // Cada hora
