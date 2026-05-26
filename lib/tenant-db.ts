/**
 * tenant-db.ts
 *
 * Factory de clientes Prisma con search_path dinámico por tenant.
 *
 * Estrategia:
 *   PostgreSQL utiliza `search_path` para resolver tablas sin schema prefix.
 *   Como Prisma no soporta search_path dinámico nativo, usamos un middleware
 *   `$extends` que ejecuta `SET LOCAL search_path TO "<schema>"` dentro de
 *   cada transacción antes de la query real.
 *
 * Prisma v7 requiere un Driver Adapter. Usamos @prisma/adapter-pg con pg Pool.
 *
 * Limitación conocida:
 *   `SET LOCAL` solo tiene efecto dentro de una transacción explícita.
 *   Por eso toda operación se envuelve en `$transaction([set, query])`.
 *   En queries que ya son transaccionales (createMany, etc.) esto puede
 *   generar transacciones anidadas — Prisma las aplana correctamente en PG.
 */

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool as NeonPool } from "@neondatabase/serverless"
import { Pool as PgPool } from "pg"

// ---------------------------------------------------------------------------
// Tipo del extended client
// ---------------------------------------------------------------------------
type TenantPrismaClient = ReturnType<typeof buildExtendedClient>

function buildExtendedClient(baseClient: PrismaClient, dbSchema: string) {
  return baseClient.$extends({
    query: {
      $allModels: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async $allOperations({ args, query }: any) {
          // Ejecutamos el SET search_path dentro de una transacción callback
          // para que quede restringido a la operación actual.
          return baseClient.$transaction(async (tx) => {
            await tx.$executeRawUnsafe(
              `SET LOCAL search_path TO "${dbSchema}", public`
            )
            return query(args)
          })
        },
      },
    },
  })
}

// ---------------------------------------------------------------------------
// Factory para crear un nuevo Pool + PrismaClient
// ---------------------------------------------------------------------------
function createBaseClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL no está definida en las variables de entorno.")
  }

  const isProduction = process.env.NODE_ENV === "production"

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

/**
 * Crea un cliente Prisma cuyo search_path está fijado al schema del tenant.
 *
 * IMPORTANTE: El llamador es responsable de desconectar el cliente cuando ya
 * no lo necesite (`client.$disconnect()`), o de preferir `withTenantDb` que
 * maneja esto automáticamente.
 *
 * @param dbSchema  Nombre del PG schema del tenant (ej: "tenant_abc123")
 * @returns Cliente Prisma con search_path configurado
 */
export function createTenantClient(dbSchema: string): TenantPrismaClient {
  const client = createBaseClient()
  return buildExtendedClient(client, dbSchema)
}

/**
 * Helper de alto nivel que abre una transacción, fija el search_path al schema
 * del tenant y ejecuta `fn` con el cliente transaccional.
 *
 * - Maneja apertura y cierre del cliente automáticamente.
 * - Ideal para operaciones únicas desde Route Handlers o Server Actions.
 * - Para operaciones múltiples en una misma request, preferir `createTenantClient`.
 *
 * @param dbSchema  Nombre del PG schema del tenant
 * @param fn        Función que recibe el cliente y retorna una Promise
 * @returns         El resultado de `fn`
 *
 * @example
 * const customers = await withTenantDb(session.user.tenantDbSchema, (db) =>
 *   db.customer.findMany({ where: { isActive: true } })
 * )
 */
export async function withTenantDb<T>(
  dbSchema: string,
  fn: (db: PrismaClient) => Promise<T>
): Promise<T> {
  const client = createBaseClient()
  try {
    return await client.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL search_path TO "${dbSchema}", public`
      )
      return fn(tx as unknown as PrismaClient)
    })
  } finally {
    await client.$disconnect()
  }
}
