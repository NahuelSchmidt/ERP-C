import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { createTenantClient } from "./tenant-db"

async function resolveTenantSchema(): Promise<string> {
  const headersList = await headers()
  const schemaFromHeader = headersList.get("x-tenant-schema")
  if (schemaFromHeader) return schemaFromHeader

  // Fallback: read from session when proxy headers aren't available
  const session = await auth()
  if (session?.user?.tenantDbSchema) return session.user.tenantDbSchema

  throw new Error(
    "No se pudo determinar el schema del tenant. " +
      "El usuario no tiene una sesión válida o no está asociado a ningún tenant."
  )
}

async function resolveTenantContext() {
  const headersList = await headers()

  const tenantIdFromHeader = headersList.get("x-tenant-id")
  const tenantSchemaFromHeader = headersList.get("x-tenant-schema")

  if (tenantIdFromHeader && tenantSchemaFromHeader) {
    return {
      tenantId: tenantIdFromHeader,
      tenantSchema: tenantSchemaFromHeader,
      userId: headersList.get("x-user-id") ?? null,
      roleId: headersList.get("x-role-id") ?? null,
    }
  }

  // Fallback: read from session
  const session = await auth()
  if (!session?.user?.tenantId || !session.user.tenantDbSchema) {
    throw new Error(
      "No se pudo determinar el contexto del tenant. " +
        "El usuario no tiene una sesión válida."
    )
  }

  return {
    tenantId: session.user.tenantId,
    tenantSchema: session.user.tenantDbSchema,
    userId: session.user.id ?? null,
    roleId: session.user.roleId ?? null,
  }
}

export async function getTenantDb() {
  const schema = await resolveTenantSchema()
  return createTenantClient(schema)
}

export async function getTenantContext() {
  return resolveTenantContext()
}
