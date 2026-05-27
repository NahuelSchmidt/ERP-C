import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

function createBaseClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL no está definida en las variables de entorno.")
  }
  const adapter = new PrismaPg(connectionString)
  return new PrismaClient({ adapter })
}

// Neon's pooler (PgBouncer transaction mode) rejects search_path as a startup
// parameter in the URL. We set it with a query after each new connection instead.
export async function applySearchPath(
  client: PrismaClient,
  dbSchema: string
): Promise<void> {
  if (!/^[a-zA-Z0-9_]+$/.test(dbSchema)) {
    throw new Error(`Schema inválido: ${dbSchema}`)
  }
  await client.$executeRawUnsafe(`SET search_path TO "${dbSchema}", public`)
}

/**
 * Crea un cliente Prisma sin search_path fijado.
 * El llamador debe llamar a `applySearchPath` antes de la primera query,
 * y desconectar el cliente con `$disconnect()` cuando termine.
 * Preferir `withTenantDb` que gestiona ambas cosas automáticamente.
 */
export function createTenantClient(dbSchema: string): PrismaClient {
  void dbSchema
  return createBaseClient()
}

/**
 * Abre un cliente, fija el search_path al schema del tenant, ejecuta `fn`
 * y desconecta automáticamente.
 * Ideal para operaciones únicas desde Route Handlers o Server Actions.
 */
export async function withTenantDb<T>(
  dbSchema: string,
  fn: (db: PrismaClient) => Promise<T>
): Promise<T> {
  const client = createBaseClient()
  try {
    await applySearchPath(client, dbSchema)
    return await fn(client)
  } finally {
    await client.$disconnect()
  }
}
