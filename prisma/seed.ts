/**
 * prisma/seed.ts
 *
 * Seed de desarrollo: crea un tenant demo con un usuario admin y
 * todos los datos de configuración base necesarios para usar el sistema.
 *
 * Credenciales de acceso:
 *   Email:      admin@demo.com
 *   Contraseña: admin123
 *   Tenant:     demo
 */

import { config } from "dotenv"
config({ path: ".env.local" })
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import bcrypt from "bcryptjs"

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

const TENANT_SCHEMA = "tenant" // Para dev, usamos el schema literal "tenant"

function makePool() {
  return new Pool({ connectionString: process.env.DATABASE_URL! })
}

function createPublicClient() {
  return new PrismaClient({ adapter: new PrismaPg(makePool()) })
}

function createTenantClient() {
  const pool = makePool()
  const base = new PrismaClient({ adapter: new PrismaPg(pool) })

  return base.$extends({
    query: {
      $allModels: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async $allOperations({ args, query }: any) {
          return base.$transaction(async (tx) => {
            await tx.$executeRawUnsafe(
              `SET LOCAL search_path TO "${TENANT_SCHEMA}", public`
            )
            return query(args)
          })
        },
      },
    },
  })
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const pub = createPublicClient()
  const ten = createTenantClient()

  console.log("\n🌱  Iniciando seed...\n")

  // ── Tenant ──────────────────────────────────────────────────────────────
  const tenant = await pub.tenant.upsert({
    where: { slug: "demo" },
    create: {
      slug: "demo",
      name: "Demo Company S.A.",
      dbSchema: TENANT_SCHEMA,
      status: "TRIAL",
    },
    update: { name: "Demo Company S.A.", dbSchema: TENANT_SCHEMA },
  })
  console.log(`✓  Tenant       ${tenant.name}  (${tenant.slug})`)

  // ── Usuario admin ────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("admin123", 12)
  const user = await pub.user.upsert({
    where: { email: "admin@demo.com" },
    create: {
      email: "admin@demo.com",
      passwordHash,
      firstName: "Admin",
      lastName: "Demo",
      isActive: true,
    },
    update: { passwordHash, isActive: true },
  })
  console.log(`✓  Usuario      ${user.email}`)

  // ── Rol administrador (tenant schema) ────────────────────────────────────
  const role = await ten.role.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: "Administrador" } },
    create: {
      tenantId: tenant.id,
      name: "Administrador",
      description: "Acceso completo al sistema",
      isDefault: true,
      isSystem: true,
    },
    update: { isSystem: true, isDefault: true },
  })
  console.log(`✓  Rol          ${role.name}`)

  // ── TenantUser ───────────────────────────────────────────────────────────
  await pub.tenantUser.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
    create: {
      tenantId: tenant.id,
      userId: user.id,
      roleId: role.id,
      isActive: true,
    },
    update: { roleId: role.id, isActive: true },
  })
  console.log(`✓  TenantUser   vinculado`)

  // ── TenantConfig ─────────────────────────────────────────────────────────
  const existingConfig = await ten.tenantConfig.findFirst()
  if (!existingConfig) {
    await ten.tenantConfig.create({
      data: {
        companyName: "Demo Company S.A.",
        documentType: "CUIT",
        documentNumber: "30-71234567-0",
        vatCondition: "RESPONSABLE_INSCRIPTO",
        address: "Av. Corrientes 1234",
        city: "Buenos Aires",
        state: "CABA",
        country: "Argentina",
        currency: "ARS",
      },
    })
    console.log(`✓  TenantConfig creado`)
  } else {
    console.log(`✓  TenantConfig ya existe`)
  }

  // ── Sucursal ─────────────────────────────────────────────────────────────
  const branch = await ten.branch.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: "Casa Central" } },
    create: {
      tenantId: tenant.id,
      name: "Casa Central",
      address: "Av. Corrientes 1234",
      city: "Buenos Aires",
      isMain: true,
      isActive: true,
    },
    update: {},
  })
  console.log(`✓  Sucursal     ${branch.name}`)

  // ── Depósito ─────────────────────────────────────────────────────────────
  const warehouse = await ten.warehouse.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: "Depósito Principal" } },
    create: {
      tenantId: tenant.id,
      branchId: branch.id,
      name: "Depósito Principal",
      isDefault: true,
      isActive: true,
    },
    update: {},
  })
  console.log(`✓  Depósito     ${warehouse.name}`)

  // ── Punto de venta ────────────────────────────────────────────────────────
  const pos = await ten.pointOfSale.upsert({
    where: { tenantId_number: { tenantId: tenant.id, number: 1 } },
    create: {
      tenantId: tenant.id,
      branchId: branch.id,
      number: 1,
      name: "PV 0001",
      isActive: true,
    },
    update: {},
  })
  console.log(`✓  Punto venta  ${pos.name}`)

  // ── Condiciones de pago ───────────────────────────────────────────────────
  const paymentConditions = [
    { name: "Contado", days: 0, isDefault: true },
    { name: "30 días", days: 30 },
    { name: "60 días", days: 60 },
    { name: "90 días", days: 90 },
  ]
  for (const pc of paymentConditions) {
    await ten.paymentCondition.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: pc.name } },
      create: { tenantId: tenant.id, isActive: true, isDefault: false, ...pc },
      update: {},
    })
  }
  console.log(`✓  Condiciones de pago (${paymentConditions.length})`)

  // ── Alícuotas de IVA ─────────────────────────────────────────────────────
  const taxRates = [
    { name: "IVA 21%",   type: "IVA" as const, rate: 0.21,   isDefault: true },
    { name: "IVA 10.5%", type: "IVA" as const, rate: 0.105,  isDefault: false },
    { name: "IVA 27%",   type: "IVA" as const, rate: 0.27,   isDefault: false },
    { name: "Exento",    type: "IVA" as const, rate: 0,       isDefault: false },
  ]
  for (const tr of taxRates) {
    await ten.taxRate.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: tr.name } },
      create: { tenantId: tenant.id, isActive: true, ...tr },
      update: {},
    })
  }
  console.log(`✓  Alícuotas IVA (${taxRates.length})`)

  // ── Unidades de medida ────────────────────────────────────────────────────
  const units = [
    { name: "Unidad",    abbreviation: "un",  isBase: true },
    { name: "Kilogramo", abbreviation: "kg",  isBase: false },
    { name: "Litro",     abbreviation: "L",   isBase: false },
    { name: "Metro",     abbreviation: "m",   isBase: false },
    { name: "Caja",      abbreviation: "cja", isBase: false },
  ]
  for (const u of units) {
    await ten.unitOfMeasure.upsert({
      where: { tenantId_abbreviation: { tenantId: tenant.id, abbreviation: u.abbreviation } },
      create: { tenantId: tenant.id, isActive: true, ...u },
      update: {},
    })
  }
  console.log(`✓  Unidades de medida (${units.length})`)

  // ── Categorías de clientes ────────────────────────────────────────────────
  const categories = [
    { name: "VIP",       color: "#f59e0b" },
    { name: "Mayorista", color: "#3b82f6" },
    { name: "Minorista", color: "#10b981" },
  ]
  for (const cat of categories) {
    await ten.customerCategory.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: cat.name } },
      create: { tenantId: tenant.id, isActive: true, ...cat },
      update: {},
    })
  }
  console.log(`✓  Categorías de clientes (${categories.length})`)

  // ── Caja registradora ─────────────────────────────────────────────────────
  const existingRegister = await ten.cashRegister.findFirst({
    where: { tenantId: tenant.id },
  })
  if (!existingRegister) {
    await ten.cashRegister.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        name: "Caja 1",
        isActive: true,
      },
    })
    console.log(`✓  Caja registradora creada`)
  } else {
    console.log(`✓  Caja registradora ya existe`)
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅  Seed completado

  URL:        http://localhost:3000
  Email:      admin@demo.com
  Contraseña: admin123
  Tenant:     demo  (dejar vacío en el login)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)

  await pub.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
