/**
 * tenant-db.ts
 *
 * Factory de clientes Prisma con search_path dinámico por tenant.
 *
 * Estrategia:
 *   El search_path se fija via el parámetro `options` del connection string de
 *   PostgreSQL (-c search_path=schema,public). Esto evita el patrón anterior
 *   de envolver cada query en $transaction + SET LOCAL, que causaba deadlock
 *   con max:1 conexiones: la transacción tomaba la única conexión del pool y
 *   query(args) intentaba adquirir otra — timeout garantizado en producción.
 */

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool as NeonPool } from "@neondatabase/serverless"
import { Pool as PgPool } from "pg"

function createBaseClient(dbSchema: string): PrismaClient {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL no está definida en las variables de entorno.")
  }

  const isProduction = process.env.NODE_ENV === "production"

  // Inyectar search_path como startup parameter de PostgreSQL.
  // Esto aplica a todas las queries de la conexión sin necesidad de transacciones.
  const url = new URL(connectionString)
  url.searchParams.set("options", `-c search_path=${dbSchema},public`)
  const connectionStringWithSchema = url.toString()

  const pool = isProduction
    ? new NeonPool({
        connectionString: connectionStringWithSchema,
        max: 1,
        connectionTimeoutMillis: 10000,
      })
    : new PgPool({
        connectionString: connectionStringWithSchema,
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
 * El llamador es responsable de desconectar el cliente cuando ya no lo necesite
 * (`client.$disconnect()`), o preferir `withTenantDb` que lo maneja automáticamente.
 */
export function createTenantClient(dbSchema: string): PrismaClient {
  return createBaseClient(dbSchema)
}

/**
 * Abre un cliente, ejecuta `fn` y lo desconecta automáticamente.
 * Ideal para operaciones únicas desde Route Handlers o Server Actions.
 */
export async function withTenantDb<T>(
  dbSchema: string,
  fn: (db: PrismaClient) => Promise<T>
): Promise<T> {
  const client = createBaseClient(dbSchema)
  try {
    return await fn(client)
  } finally {
    await client.$disconnect()
  }
}
