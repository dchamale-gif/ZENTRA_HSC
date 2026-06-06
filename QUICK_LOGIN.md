# 🔐 LOGIN - GUÍA RÁPIDA (5 MINUTOS)

> **Sistema Zentra MED - Login Amarrado a Base de Datos**

---

## ⚡ INICIO RÁPIDO

### 0️⃣ Pre-requisitos
- Node.js instalado (`node --version`)
- PostgreSQL instalado (`psql --version`)

### 1️⃣ Crear Base de Datos y Usuario

**Opción A: Script automático** (Recomendado)
```bash
cd /Users/diego/SistemaContable
bash quick-login-setup.sh
```

**Opción B: Manual**
```bash
# Crear BD
psql -U postgres -c "CREATE DATABASE zentra_med;"

# Cargar schema
psql -U postgres -d zentra_med -f database/schema.sql

# Crear usuario de prueba
cd backend
node create-test-user.js
```

### 2️⃣ Iniciar Backend

```bash
cd backend
npm install  # Solo si no lo hiciste antes
npm start
```

Deberías ver:
```
✅ Conexión a PostgreSQL establecida
Server running on port 3000
```

### 3️⃣ Abrir Frontend

**Opción A: VS Code Live Server** (Más fácil)
- Click derecho en `index.html` → "Open with Live Server"

**Opción B: Terminal**
```bash
# En otra terminal
cd /Users/diego/SistemaContable
python3 -m http.server 5500
```

Ir a: **http://localhost:5500/login.html**

### 4️⃣ Probar Login

```
Email:      admin@zentra.com
Contraseña: admin123

Presionar: Ingresar
```

✅ Debe redirigir al dashboard automáticamente

---

## 📁 Archivos Clave

| Archivo | Propósito |
|---------|-----------|
| `/login.html` | Página de login con formulario |
| `/js/auth-utils.js` | Gestor de autenticación (clase AuthManager) |
| `/js/login.js` | Lógica del formulario |
| `/js/app.js` | Protección de rutas del dashboard |
| `/backend/create-test-user.js` | Script para crear usuario de prueba |
| `/backend/src/controllers/authController.js` | API de login |

---

## 🔑 Credenciales de Prueba

```
Email:      admin@zentra.com
Contraseña: admin123
```

---

## ✅ Checklist

- [ ] PostgreSQL corriendo (`brew services start postgresql@15`)
- [ ] Base de datos `zentra_med` creada
- [ ] Usuario de prueba creado (admin@zentra.com)
- [ ] Backend iniciado en puerto 3000 (`npm start`)
- [ ] Frontend en puerto 5500 (Live Server)
- [ ] Puedes hacer login
- [ ] Dashboard visible después del login

---

## 🐛 Si algo no funciona

### "Conexión rechazada a BD"
```bash
brew services start postgresql@15
```

### "CORS policy: No 'Access-Control-Allow-Origin'"
```
Editar /backend/.env
Cambiar: CORS_ORIGIN=http://localhost:5500,http://localhost:3000,file://
```

### "Cannot GET /auth/login"
```bash
Backend no está corriendo
Ejecutar: cd backend && npm start
```

### "Token inválido"
```
Limpiar localStorage:
F12 → Application → Clear All → Recarga página
```

---

## 📱 Flujo Visual

```
┌──────────────────────────────────────────────────────┐
│                 APLICACIÓN ZENTRA                     │
├──────────────────────────────────────────────────────┤
│                                                       │
│  ¿Token válido?  ────NO───→  REDIRECT → login.html   │
│       │                                       │       │
│      SÍ                                       │       │
│       │                           [FORMULARIO]│       │
│       └──────────────────────────→ Email ────┘       │
│                                   Password           │
│                                   [INGRESAR]         │
│                                       │               │
│                    ┌──────────────────┴──────────┐   │
│                    │                             │   │
│              BACKEND /auth/login                 │   │
│              - Validar email/pass                │   │
│              - Verificar en BD                   │   │
│              - Generar JWT                       │   │
│              - Retornar token                    │   │
│                    │                             │   │
│        ┌───────────┴───────────┐                 │   │
│        │                       │                 │   │
│     ✅ OK                    ❌ ERROR            │   │
│        │                       │                 │   │
│    Guardar token         Mostrar error           │   │
│    Guardar usuario       Limpiar form            │   │
│    REDIRECT → index.html                        │   │
│        │                                         │   │
│    ┌───┴────────────────────┐                   │   │
│    │                        │                   │   │
│  Dashboard protegido     Token en Header         │   │
│  Mostrar usuario         Auth: Bearer TOKEN      │   │
│  Menú logout             ────→ BACKEND          │   │
│                                                  │   │
└──────────────────────────────────────────────────────┘
```

---

## 🎯 Próximas Mejoras (Futuro)

- [ ] Recuperación de contraseña
- [ ] Registro de nuevos usuarios en frontend
- [ ] 2FA (autenticación de dos factores)
- [ ] Permisos por página basados en roles
- [ ] Token refresh automático
- [ ] Historial de login
- [ ] Bloqueo de cuenta

---

## 📞 Soporte

**Errores o dudas:**
1. Revisar consola del navegador (F12)
2. Revisar logs del backend (`npm start` output)
3. Revisar archivo [LOGIN_SETUP.md](LOGIN_SETUP.md) para detalles completos

---

**¡Listo! Ahora tienes Login amarrado a BD completo y funcionando.** ✅
