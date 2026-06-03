// ============================================
// MÓDULO DE INTEGRACIÓN CON GOOGLE CALENDAR
// ============================================

const GoogleCalendarModule = {
    state: {
        isConnected: false,
        accessToken: null,
        syncedAppointments: [],
        config: {
            clientId: 'YOUR_CLIENT_ID.apps.googleusercontent.com',
            apiKey: 'YOUR_API_KEY',
            scopes: ['https://www.googleapis.com/auth/calendar']
        }
    },

    // Inicializar el módulo
    init() {
        this.setupEventListeners();
        console.log('Módulo de Google Calendar inicializado');
    },

    // Configurar event listeners
    setupEventListeners() {
        const connectGoogleBtn = document.getElementById('connectGoogleBtn');
        if (connectGoogleBtn) {
            connectGoogleBtn.addEventListener('click', () => this.connectGoogle());
        }

        const disconnectGoogleBtn = document.getElementById('disconnectGoogleBtn');
        if (disconnectGoogleBtn) {
            disconnectGoogleBtn.addEventListener('click', () => this.disconnectGoogle());
        }

        const syncBtn = document.getElementById('syncCalendarBtn');
        if (syncBtn) {
            syncBtn.addEventListener('click', () => this.syncCalendar());
        }
    },

    // Conectar con Google
    connectGoogle() {
        console.log('Iniciando autenticación con Google Calendar...');
        
        // Cargar Google API
        if (!window.gapi) {
            this.loadGoogleAPI(() => this.authenticateGoogle());
            return;
        }

        this.authenticateGoogle();
    },

    // Cargar la API de Google
    loadGoogleAPI(callback) {
        const script = document.createElement('script');
        script.src = 'https://apis.google.com/js/api.js';
        script.async = true;
        script.defer = true;
        script.onload = () => {
            gapi.load('client:auth2', callback);
        };
        document.head.appendChild(script);
    },

    // Autenticar con Google
    authenticateGoogle() {
        gapi.client.init({
            clientId: this.state.config.clientId,
            scope: this.state.config.scopes.join(' ')
        }).then(() => {
            const auth2 = gapi.auth2.getAuthInstance();
            auth2.signIn().then(user => {
                this.state.isConnected = true;
                this.state.accessToken = user.getAuthResponse().id_token;
                alert('Conectado a Google Calendar correctamente');
                this.updateConnectionStatus();
            });
        }).catch(err => {
            console.error('Error al conectar con Google:', err);
            alert('Error al conectar con Google Calendar');
        });
    },

    // Desconectar de Google
    disconnectGoogle() {
        if (window.gapi && gapi.auth2) {
            const auth2 = gapi.auth2.getAuthInstance();
            auth2.signOut().then(() => {
                this.state.isConnected = false;
                this.state.accessToken = null;
                alert('Desconectado de Google Calendar');
                this.updateConnectionStatus();
            });
        }
    },

    // Sincronizar calendario
    syncCalendar() {
        if (!this.state.isConnected) {
            alert('Por favor, conecta primero con Google Calendar');
            return;
        }

        console.log('Sincronizando calendario...');

        // Obtener citas de la BD y sincronizar con Google Calendar
        this.createCalendarEvents().then(result => {
            alert(`${result.created} eventos creados en Google Calendar`);
        });
    },

    // Crear eventos en Google Calendar
    createCalendarEvents() {
        return new Promise((resolve, reject) => {
            // En una aplicación real, obtendría las citas de la BD
            const appointments = [
                {
                    title: 'Consulta - Dr. García',
                    description: 'Consulta con Dr. García',
                    start: '2026-05-10T10:00:00',
                    end: '2026-05-10T10:30:00',
                    location: 'Consultorio 1'
                }
            ];

            let created = 0;

            appointments.forEach(appointment => {
                this.addEventToGoogleCalendar(appointment).then(() => {
                    created++;
                    if (created === appointments.length) {
                        resolve({ created });
                    }
                });
            });
        });
    },

    // Agregar evento individual a Google Calendar
    addEventToGoogleCalendar(event) {
        return new Promise((resolve, reject) => {
            const request = gapi.client.calendar.events.insert({
                'calendarId': 'primary',
                'resource': {
                    'summary': event.title,
                    'description': event.description,
                    'location': event.location,
                    'start': { 'dateTime': event.start, 'timeZone': 'America/Caracas' },
                    'end': { 'dateTime': event.end, 'timeZone': 'America/Caracas' }
                }
            });

            request.execute(event => {
                console.log('Evento creado en Google Calendar:', event.id);
                this.state.syncedAppointments.push(event.id);
                resolve(event);
            });
        });
    },

    // Obtener eventos de Google Calendar
    getGoogleCalendarEvents() {
        return new Promise((resolve, reject) => {
            const request = gapi.client.calendar.events.list({
                'calendarId': 'primary',
                'timeMin': new Date().toISOString(),
                'showDeleted': false,
                'singleEvents': true,
                'maxResults': 10,
                'orderBy': 'startTime'
            });

            request.execute(events => {
                console.log('Eventos obtenidos de Google Calendar:', events.items);
                resolve(events.items);
            });
        });
    },

    // Actualizar estado de conexión
    updateConnectionStatus() {
        const statusDiv = document.getElementById('googleCalendarStatus');
        if (!statusDiv) return;

        if (this.state.isConnected) {
            statusDiv.innerHTML = `
                <div class="alert alert-success">
                    <i class="fas fa-check-circle"></i> Conectado a Google Calendar
                    <button onclick="GoogleCalendarModule.syncCalendar()" class="btn btn-small">
                        Sincronizar ahora
                    </button>
                    <button onclick="GoogleCalendarModule.disconnectGoogle()" class="btn btn-small btn-danger">
                        Desconectar
                    </button>
                </div>
            `;
        } else {
            statusDiv.innerHTML = `
                <div class="alert alert-warning">
                    <i class="fas fa-exclamation-circle"></i> No conectado a Google Calendar
                    <button onclick="GoogleCalendarModule.connectGoogle()" class="btn btn-small">
                        Conectar
                    </button>
                </div>
            `;
        }
    },

    // Compartir calendario
    shareCalendar(email) {
        if (!this.state.isConnected) {
            alert('Debes estar conectado a Google Calendar');
            return;
        }

        const request = gapi.client.calendar.acl.insert({
            'calendarId': 'primary',
            'resource': {
                'scope': { 'type': 'user', 'value': email },
                'role': 'reader'
            }
        });

        request.execute(result => {
            alert(`Calendario compartido con ${email}`);
            console.log('Calendario compartido:', result);
        });
    },

    // Sincronización bidireccional automática
    enableAutoSync() {
        console.log('Habilitando sincronización automática...');

        setInterval(() => {
            if (this.state.isConnected) {
                this.syncCalendar();
            }
        }, 1800000); // Cada 30 minutos
    }
};

// Exportar para uso global
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GoogleCalendarModule;
}
