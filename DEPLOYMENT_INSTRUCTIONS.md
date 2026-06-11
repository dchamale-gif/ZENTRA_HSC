# 🚀 DEPLOYMENT COMPLETO - Frontend + Backend

## EJECUTAR EN EL SERVIDOR PRODUCTIVO (178.128.72.110)

### 1️⃣ ACTUALIZAR CÓDIGO DESDE GIT

```bash
cd /opt/stack/ZENTRA_HSC
git pull origin main
```

---

### 2️⃣ DETENER PROCESOS ANTIGUOS Y LIMPIAR

```bash
# Detener y eliminar procesos PM2 antiguos
pm2 stop all
pm2 delete all

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

### 4️⃣ INICIAR AMBOS PROCESOS CON PM2

```bash
cd /opt/stack/ZENTRA_HSC

# Iniciar usando el ecosystem.config.js
pm2 start ecosystem.config.js

# Guardar configuración de PM2 para que reinicie al rebootear
pm2 save
sudo env PATH=$PATH:/usr/local/bin pm2 startup
```

---

### 5️⃣ VERIFICAR QUE TODO FUNCIONA

```bash
# Ver estado de procesos
pm2 status

# Ver logs en tiempo real
pm2 logs

# Pruebas específicas
curl http://localhost:3011/health          # Backend API
curl http://localhost:5501/                # Frontend

# O desde otra máquina
curl http://178.128.72.110:3011/health
curl http://178.128.72.110:5501/
```

---

### ✅ RESULTADO ESPERADO

```
┌─────────────────────┬─────┬─────┬──────────┬────────┬─────────┬─────────┐
│ App name            │ id  │ mode│ pid      │ status │ restart │ uptime  │
├─────────────────────┼─────┼─────┼──────────┼────────┼─────────┼─────────┤
│ zentra-app          │ 0   │ fork│ 1234     │ online │ 0       │ 2m      │
│ webtrop             │ 1   │ fork│ 5678     │ online │ 0       │ 2m      │
└─────────────────────┴─────┴─────┴──────────┴────────┴─────────┴─────────┘
```

**Backend (API)**: http://178.128.72.110:3011 ✅
**Frontend (Web)**: http://178.128.72.110:5501 ✅

---

## 🔍 TROUBLESHOOTING

### Si PM2 no inicia:
```bash
cd /opt/stack/ZENTRA_HSC
pm2 start ecosystem.config.js
pm2 logs  # Ver qué pasó
```

### Si quieres ver logs específicos:
```bash
pm2 logs zentra-app      # Logs del backend
pm2 logs webtrop         # Logs del frontend
```

### Si necesitas reiniciar un proceso:
```bash
pm2 restart zentra-app
pm2 restart webtrop
```

### Si necesitas hacer cambios y recargar:
```bash
# Hacer cambios en el código
git pull

# Reiniciar ambos procesos
pm2 restart all
```

---

## 📝 NOTAS IMPORTANTES

✅ **Backend (API)**: 
- Puerto 3011 (HTTP puro - sin SSL)
- No hay errores `ERR_SSL_PROTOCOL_ERROR`
- CORS configurado para aceptar requests del frontend

✅ **Frontend (Web)**:
- Puerto 5501 (servidor estático)
- Sirve `index.html` como página principal
- Hace requests al backend en `http://178.128.72.110:3011/api`

✅ **PM2 Configuration**:
- Ambos procesos se reinician automáticamente si fallan
- Se guardan en `ecosystem.config.js`
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
✅ **Backend funcionando**: API REST en HTTP puro
✅ **Frontend funcionando**: Interfaz web accesible
✅ **Ambos sincronizados**: Se comunican sin errores
✅ **Listo para cliente**: Mostrable y funcional
