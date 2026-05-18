/**
 * prisma.config.ts
 *
 * Configuración de Prisma v7+ para el ERP multi-tenant.
 *
 * En Prisma v7, la URL de la base de datos se mueve desde datasource en
 * schema.prisma hacia este archivo de configuración para los comandos CLI
 * (migrate, introspect, etc.).
 *
 * Nota: El PrismaClient en tiempo de ejecución usa @prisma/adapter-pg directamente
 * (ver lib/prisma.ts y lib/tenant-db.ts).
 *
 * Referencias:
 *   - https://pris.ly/d/config-datasource
 *   - https://pris.ly/d/prisma7-client-config
 */

import path from "node:path"
import { defineConfig } from "prisma/config"
import { config } from "dotenv"

// Prisma CLI doesn't auto-load .env.local, so we load it explicitly.
// Falls back to .env which is also loaded here.
config({ path: ".env.local", override: false })
config({ path: ".env", override: false })

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    url: process.env.DATABASE_URL,
  },
})
