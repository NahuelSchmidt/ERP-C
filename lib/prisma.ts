/**
 * lib/prisma.ts
 *
 * Singleton del Prisma client para el schema "public" (multi-tenancy, billing).
 *
 * Patrón estándar de Next.js para evitar múltiples conexiones durante hot-reload
 * en desarrollo (global.prisma persiste entre HMR cycles).
 *
 * Prisma v7 requiere un Driver Adapter para la conexión a la base de datos.
 * Usamos @prisma/adapter-pg con un Pool de pg para gestionar el connection pool.
 */

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

// ---------------------------------------------------------------------------
// Declaración global para que TypeScript conozca la variable en el scope global
// ---------------------------------------------------------------------------
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined
}

// ---------------------------------------------------------------------------
// Factory del cliente Prisma para el schema "public"
// ---------------------------------------------------------------------------
function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL no está definida. " +
        "Verificar el archivo .env.local o las variables de entorno del servidor."
    )
  }

  // En serverless (Vercel) cada instancia de función tiene su propio pool.
  // max:1 evita agotar el límite de conexiones de Neon en prod.
  const pool = new Pool({
    connectionString,
    max: process.env.NODE_ENV === "production" ? 1 : 10,
  })
  const adapter = new PrismaPg(pool)

  return new PrismaClient({ adapter })
}

// ---------------------------------------------------------------------------
// Singleton: reutiliza la instancia en desarrollo para evitar hot-reload leaks
// ---------------------------------------------------------------------------
const prisma = global.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma
}

export default prisma
