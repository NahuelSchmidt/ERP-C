import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL no está definida. " +
        "Verificar el archivo .env.local o las variables de entorno del servidor."
    )
  }

  const adapter = new PrismaPg(connectionString)
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
