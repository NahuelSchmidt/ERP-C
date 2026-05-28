# ERP-C

Sistema ERP multi-tenant para gestión de empresas: facturación, inventario, compras, tesorería y reportes.

## Stack técnico

- **Next.js 16** + **React 19** + **TypeScript 5**
- **Prisma 7** con PostgreSQL (multi-schema: `public` para datos globales, schema dinámico por tenant)
- **NextAuth v5** — autenticación JWT, sin sesiones en DB
- **shadcn/ui** + **Tailwind CSS v4** + **Zod v4** + **React Hook Form**
- **Sonner** (toasts), **Lucide React** (íconos), **Recharts** (gráficos)

## Requisitos previos

- Node.js >= 20
- PostgreSQL >= 14
- npm >= 10

## Setup local

```bash
# 1. Clonar el repositorio
git clone <repo-url>
cd ERP-C

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con los valores reales (ver sección Variables de entorno)

# 4. Inicializar la base de datos
npm run db:setup   # genera el cliente Prisma, aplica el schema y ejecuta el seed

# 5. Iniciar el servidor de desarrollo
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000) en el navegador.

## Variables de entorno

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | URL de conexión PostgreSQL (ej: `postgresql://user:pass@host:5432/db`) |
| `AUTH_SECRET` | Secreto para JWT de NextAuth — generar con `openssl rand -base64 32` |
| `NEXTAUTH_URL` | URL base de la app (ej: `http://localhost:3000`) |
| `NODE_ENV` | `development` \| `production` |

Ver `.env.example` para valores de referencia.

## Estructura del proyecto

```
app/
  (dashboard)/        — Páginas del ERP (requieren autenticación)
    dashboard/        — KPIs y resumen
    facturacion/      — Comprobantes (facturas, NC, ND)
    ventas/           — Vista de ventas
    compras/          — Órdenes de compra
    inventario/       — Stock por producto
    tesoreria/        — Cajas, sesiones y pagos
    clientes/         — ABM de clientes
    proveedores/      — ABM de proveedores
    productos/        — ABM de productos
    reportes/         — Informes y analytics
    configuracion/    — Datos de la empresa
  api/                — API Routes (Next.js route handlers)
  login/              — Página de autenticación
components/           — Componentes React
  ui/                 — Componentes shadcn/ui
  invoices/           — Componentes de facturación
  customers/          — Componentes de clientes
lib/
  auth.ts             — Configuración NextAuth
  prisma.ts           — Cliente Prisma (schema "public")
  tenant-db.ts        — Helpers para multi-tenant
  get-tenant-db.ts    — getTenantDb() y getTenantContext()
  format.ts           — Helpers de formateo (moneda, fechas)
  validations/        — Schemas Zod compartidos server/client
  services/           — Lógica de negocio (invoice, payment, stock)
prisma/
  schema.prisma       — Modelos de la DB
  seed.ts             — Datos de desarrollo
types/                — Augmentaciones de TypeScript
```

## Módulos disponibles

| Módulo | Descripción |
|---|---|
| Facturación | Crear, emitir y anular comprobantes (Factura A/B/C, NC, ND, Remito) |
| Ventas | Listado de ventas facturadas |
| Compras | Órdenes de compra a proveedores |
| Inventario | Control de stock por producto y depósito |
| Tesorería | Cajas registradoras, sesiones y registro de cobros/pagos |
| Clientes | ABM completo con direcciones y contactos |
| Proveedores | ABM completo con direcciones y contactos |
| Productos | ABM con precios, stock y movimientos |
| Reportes | Dashboard de KPIs, cuentas a cobrar/pagar, flujo de caja |
| Configuración | Datos fiscales y de configuración de la empresa |

## Scripts disponibles

| Script | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción (incluye `prisma generate`) |
| `npm run start` | Servidor de producción |
| `npm run lint` | Linting con ESLint |
| `npm run db:generate` | Genera el cliente Prisma |
| `npm run db:push` | Aplica el schema a la DB |
| `npm run db:seed` | Ejecuta el seed de desarrollo |
| `npm run db:setup` | Setup completo: generate + push + seed |

## Credenciales del seed

El seed crea un tenant demo con un usuario administrador:

| Campo | Valor |
|---|---|
| Email | `admin@demo.com` |
| Contraseña | `admin123` |
| Tenant slug | `demo` |
| Empresa | Demo Company S.A. |
| CUIT | 30-71234567-0 |
