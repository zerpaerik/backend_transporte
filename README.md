# Backend — Sistema de Gestión de Transporte de Carga Pesada

API REST construida con **NestJS + Prisma + PostgreSQL**. Cubre todos los procesos de la web:
flota, conductores (con documentos), mantenimiento, repuestos, neumáticos, operaciones/despachos,
facturación SUNAT, planilla y usuarios — con autenticación **JWT** y **control por roles**.

## Stack

- **NestJS 11** (TypeScript)
- **Prisma 6** ORM
- **PostgreSQL**
- **JWT** (@nestjs/jwt + passport-jwt) y **bcryptjs**
- Validación con **class-validator**

## Requisitos

- Node 20+
- PostgreSQL (local, Docker o Railway)

## Puesta en marcha (local)

```bash
# 1) Variables de entorno
cp .env.example .env        # ajusta DATABASE_URL si hace falta

# 2) Base de datos (opción A: Docker)
docker compose up -d
# (opción B: Postgres local de Homebrew — ver DATABASE_URL en .env)

# 3) Dependencias, migración y datos de ejemplo
npm install
npx prisma migrate dev
npm run seed

# 4) Levantar en desarrollo
npm run start:dev
```

La API queda en `http://localhost:3001/api`.

## Usuarios de prueba (seed)

| Correo | Contraseña | Rol |
| --- | --- | --- |
| admin@transporte.pe | admin123 | Administrador |
| gerente@transporte.pe | gerente123 | Administrador |
| operador@transporte.pe | operador123 | Operador |
| mecanico@transporte.pe | mecanico123 | Mecánico |

## Endpoints

Todos bajo el prefijo `/api`. Requieren `Authorization: Bearer <token>` salvo los públicos.

| Método | Ruta | Descripción | Roles |
| --- | --- | --- | --- |
| POST | `/auth/login` | Login → `{ access_token, user }` | público |
| GET | `/auth/me` | Usuario actual | autenticado |
| GET/POST/PATCH/DELETE | `/vehiculos` | Flota (tractos y carretas) | todos (DELETE: Admin) |
| GET/POST/PATCH/DELETE | `/conductores` | Conductores + documentos | Admin, Operador |
| GET/POST/PATCH/DELETE | `/ordenes` | Mantenimiento (órdenes) | Admin, Mecánico |
| GET/POST/PATCH/DELETE | `/repuestos` | Repuestos | Admin, Mecánico |
| GET/POST/PATCH/DELETE | `/neumaticos` | Neumáticos por posición | Admin, Mecánico |
| GET/POST/PATCH/DELETE | `/viajes` | Operaciones / despachos | Admin, Operador |
| GET/POST/PATCH/DELETE | `/facturas` | Facturación SUNAT | Admin, Operador |
| GET/POST/PATCH/DELETE | `/empleados` | Planilla / sueldos | Administrador |
| GET/POST/PATCH/DELETE | `/usuarios` | Usuarios (contraseñas hasheadas) | Administrador |

> Nota: el control fino de roles por módulo se aplica en el backend (guard de roles) y refleja
> el mismo mapa que usa el menú del frontend. Ajústalo en los `@Roles(...)` de cada controlador.

### Ejemplo

```bash
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@transporte.pe","password":"admin123"}' | jq -r .access_token)

curl http://localhost:3001/api/vehiculos -H "Authorization: Bearer $TOKEN"
```

## Formato de datos

- Las fechas puras (`vencimiento`, `fecha`, `fechaLimite`) se devuelven como `"YYYY-MM-DD"`.
- Los valores de estado/tipo usan exactamente las mismas cadenas que el frontend
  (p. ej. `"En taller"`, `"N. Crédito"`, `"Mecánico"`).
- El IGV de una factura se calcula automáticamente (18%) si no se envía.

## Despliegue en Railway

1. **New Project → Deploy from GitHub repo** → `zerpaerik/backend_transporte`.
2. Agregar el plugin **PostgreSQL** (Railway inyecta `DATABASE_URL`).
3. Variables de entorno:
   - `JWT_SECRET` = un secreto largo y aleatorio
   - `JWT_EXPIRES_IN` = `1d`
   - `FRONTEND_URL` = la URL del frontend (o `*` en demo)
4. Build: `npm run build` · Start: `npm start`
   (el `start` ejecuta `prisma migrate deploy` antes de arrancar).
5. Para cargar datos de ejemplo la primera vez: `npm run seed` (Railway → Shell del servicio).

## Estructura

```
prisma/
  schema.prisma      # modelo de datos
  seed.ts            # datos de ejemplo (mismos usuarios/volumen que la web)
src/
  main.ts            # bootstrap (CORS, validación, prefijo /api)
  app.module.ts      # guards globales JWT + roles
  auth/              # login, JWT, guards
  common/            # decoradores (@Roles, @Public, @CurrentUser), interceptor de fechas
  prisma/            # PrismaService
  vehiculos/ conductores/ ordenes/ repuestos/ neumaticos/
  viajes/ facturas/ empleados/ usuarios/   # un módulo CRUD por proceso
```
