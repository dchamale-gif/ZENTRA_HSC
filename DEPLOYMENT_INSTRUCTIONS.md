# 🚀 DEPLOYMENT - Backend + Frontend (Separados)

## ⚠️ IMPORTANTE: SOLO ZENTRA-APP EN PM2

- `zentra-app` = Backend API de Zentra en puerto 3011 (gestionado por PM2)
- `webtrop` = Cliente independiente en PM2 (NO tocar)
- Frontend de Zentra = Se sirve desde `/opt/stack/ZENTRA_HSC/` en puerto 5501 (manualmente o independiente)

---

## EJECUTAR EN EL SERVIDOR PRODUCTIVO (178.128.72.110)

### 1️⃣ ACTUALIZAR CÓDIGO DESDE GIT

```bash
cd /opt/stack/ZENTRA_HSC
git pull origin main
```

---

### 2️⃣ DETENER PROCESO ANTERIOR DE ZENTRA-APP (si existe)

```bash
# Detener y eliminar SOLO zentra-app (NO afecta webtrop ni otros servicios)
pm2 stop zentra-app 2>/dev/null || true
pm2 delete zentra-app 2>/dev/null || true

# Crear directorio de logs (si no existe)
sudo mkdir -p /var/log/zentra
sudo chown $USER:$USER /var/log/zentra
```

---

### 3️⃣ INSTALAR DEPENDENCIAS DEL BACKEND

```bash
cd /opt/stack/ZENTRA_HSC/backend
npm install
```

---

### 4️⃣ INICIAR BACKEND API CON PM2

```bash
cd /opt/stack/ZENTRA_HSC

# Iniciar solo zentra-app (backend API)
pm2 start ecosystem.config.js

# Guardar configuración de PM2 para que reinicie al rebootear
pm2 save
sudo env PATH=$PATH:/usr/local/bin pm2 startup
```

---

### 4️⃣.B INICIAR FRONTEND (Manual - Separado)

```bash
# En otra terminal/ventana, servir el frontend en puerto 5501
cd /opt/stack/ZENTRA_HSC
node frontend-server.js

# O usando PM2 con OTRO nombre (no webtrop, que ya está en uso):
pm2 start frontend-server.js --name "zentra-frontend"
```

---

### 5️⃣ VERIFICAR QUE TODO FUNCIONA

```bash
# Ver estado de PM2
pm2 status

# Ver logs del backend
pm2 logs zentra-app

# Pruebas específicas
curl http://localhost:3011/health          # Backend API ✅
curl http://localhost:5501/                # Frontend (si está corriendo) ✅

# O desde otra máquina
curl http://178.128.72.110:3011/health
curl http://178.128.72.110:5501/
```

---

### ✅ RESULTADO ESPERADO

**Backend (zentra-app):**
```
┌──────────────┬─────┬─────┬──────────┬────────┬─────────┬─────────┐
│ App name     │ id  │ mode│ pid      │ status │ restart │ uptime  │
├──────────────┼─────┼─────┼──────────┼────────┼─────────┼─────────┤
│ zentra-app   │ 0   │ fork│ 1234     │ online │ 0       │ 2m      │
└──────────────┴─────┴─────┴──────────┴────────┴─────────┴─────────┘
```

**Frontend:**
```
✅ Frontend ejecutándose en http://0.0.0.0:5501
📁 Sirviendo archivos desde: /opt/stack/ZENTRA_HSC
```

**Endpoints:**
- Backend (API): http://178.128.72.110:3011 ✅
- Frontend (Web): http://178.128.72.110:5501 ✅

---

## 🔍 TROUBLESHOOTING

### Ver procesos de PM2:
```bash
# Ver TODOS los procesos (incluyendo webtrop y otros)
pm2 status

# Ver SOLO zentra-app
pm2 list | grep zentra-app
```

### Si PM2 no inicia:
```bash
cd /opt/stack/ZENTRA_HSC
pm2 start ecosystem.config.js
pm2 logs zentra-app
```

### Ver logs:
```bash
pm2 logs zentra-app      # Logs del backend
```

### Si necesitas reiniciar:
```bash
pm2 restart zentra-app
```

### Para actualizar código:
```bash
cd /opt/stack/ZENTRA_HSC
git pull origin main
pm2 restart zentra-app
```

### Para reiniciar frontend (si lo iniciaste con PM2):
```bash
pm2 restart zentra-frontend
```

---

## 📝 NOTAS IMPORTANTES

✅ **Backend (API)**: 
- Puerto 3011 (HTTP puro - sin SSL)
- Gestionado por PM2 como `zentra-app`
- No hay errores `ERR_SSL_PROTOCOL_ERROR`
- CORS configurado para aceptar requests del frontend

✅ **Frontend (Web)**:
- Puerto 5501 (servidor estático)
- Se inicia manualmente o con PM2 con nombre diferente: `zentra-frontend`
- Sirve `index.html` como página principal
- Hace requests al backend en `http://178.128.72.110:3011/api`

⚠️ **Otros Servicios**:
- `webtrop` en PM2 es un cliente INDEPENDIENTE, NO tocar
- Zentra no interfiere con webtrop

✅ **PM2 Configuration**:
- Solo `zentra-app` (backend) está en `ecosystem.config.js`
- Backend se reinicia automáticamente si falla
- Los logs van a `/var/log/zentra/`

---

## 🎯 ARQUITECTURA FINAL

```
Usuario (Cliente)
       |
       +--- http://178.128.72.110:5501 --> [Frontend Server - webtrop]
       |         Puerto 5501                      |
       |                                          |
       +--- http://178.128.72.110:3011/api --> [Backend API - zentra-app]
                    Puerto 3011                   |
                                                  |
                                            PostgreSQL
                                            Database
```

---

## ⚡ RESULTADO FINAL

✅ **Problema SSL original RESUELTO**: No hay más `net::ERR_SSL_PROTOCOL_ERROR`
✅ **Backend funcionando**: API REST en HTTP puro, gestionado por PM2
✅ **Frontend funcionando**: Interfaz web accesible en puerto 5501
✅ **Separado de otros servicios**: No interfiere con webtrop u otros procesos
✅ **Listo para cliente**: Mostrable y funcional

**Arquitectura limpia:**
- Backend: Zentra API + PM2 ✅
- Frontend: Static server (separado) ✅  
- Otros servicios: Intactos ✅
