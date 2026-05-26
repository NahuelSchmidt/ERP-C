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
import { Pool as NeonPool } from "@neondatabase/serverless"
import { Pool as PgPool } from "pg"

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
  // TEMP: diagnóstico de producción — remover una vez confirmado
  console.log('[prisma] DB URL set:', !!process.env.DATABASE_URL, '| NODE_ENV:', process.env.NODE_ENV)

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL no está definida. " +
        "Verificar el archivo .env.local o las variables de entorno del servidor."
    )
  }

  const isProduction = process.env.NODE_ENV === "production"

  // En producción usamos el driver serverless de Neon (WebSocket/HTTP) para
  // evitar timeouts de conexión TCP en entornos efímeros como Vercel.
  // En desarrollo usamos pg estándar para mayor compatibilidad local.
  const pool = isProduction
    ? new NeonPool({
        connectionString,
        max: 1,
        connectionTimeoutMillis: 10000,
      })
    : new PgPool({
        connectionString,
        max: 10,
      })

  const adapter = new PrismaPg(pool as ConstructorParameters<typeof PrismaPg>[0])

  return new PrismaClient({
    adapter,
    ...(isProduction && {
      transactionOptions: { timeout: 10000, maxWait: 5000 },
    }),
  })
}

// ---------------------------------------------------------------------------
// Singleton: reutiliza la instancia en desarrollo para evitar hot-reload leaks
// ---------------------------------------------------------------------------
const prisma = global.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma
}

export default prisma
