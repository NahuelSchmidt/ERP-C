/**
 * ENDPOINT DE DEBUG TEMPORAL — BORRAR ANTES DE MERGEAR A PROD
 *
 * Diagnostica por qué falla el login en producción:
 * - Verifica variables de entorno
 * - Prueba la conexión raw con pg
 * - Consulta el usuario admin@demo.com via Prisma (sin exponer passwordHash)
 * - Consulta el tenant "demo" y su TenantUser
 */

import { NextResponse } from "next/server"
import { Pool } from "pg"
import prisma from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET() {
  const report: Record<string, unknown> = {}

  // ── 1. Variables de entorno ──────────────────────────────────────────────
  const dbUrl = process.env.DATABASE_URL ?? ""
  report.env = {
    DATABASE_URL: dbUrl
      ? `set (${dbUrl.split("@")[1]?.split("?")[0] ?? "no-host-visible"})`
      : "NOT SET",
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? "set" : "NOT SET",
    AUTH_SECRET: process.env.AUTH_SECRET ? "set" : "NOT SET",
    NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? "NOT SET",
    NODE_ENV: process.env.NODE_ENV,
  }

  // ── 2. Conexión raw pg ───────────────────────────────────────────────────
  const pool = new Pool({ connectionString: dbUrl })
  try {
    const client = await pool.connect()
    const res = await client.query(
      "SELECT current_schema() AS schema, current_user AS usr, version() AS ver"
    )
    const row = res.rows[0] as { schema: string; usr: string; ver: string }
    report.rawConnection = {
      ok: true,
      currentSchema: row.schema,
      currentUser: row.usr,
      pgVersion: (row.ver as string).split(" ")[0],
    }
    client.release()
  } catch (e) {
    report.rawConnection = { ok: false, error: String(e) }
  } finally {
    await pool.end().catch(() => undefined)
  }

  // ── 3. Prisma — usuario admin@demo.com ───────────────────────────────────
  try {
    const user = await prisma.user.findUnique({
      where: { email: "admin@demo.com" },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        deletedAt: true,
        createdAt: true,
        // passwordHash excluido intencionalmente
      },
    })
    report.user = user
      ? { found: true, isActive: user.isActive, deletedAt: user.deletedAt, email: user.email }
      : { found: false }
  } catch (e) {
    report.user = { found: false, error: String(e) }
  }

  // ── 4. Prisma — tenant demo ──────────────────────────────────────────────
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: "demo" },
      select: { id: true, slug: true, name: true, status: true, dbSchema: true, deletedAt: true },
    })
    report.tenant = tenant
      ? { found: true, status: tenant.status, dbSchema: tenant.dbSchema, deletedAt: tenant.deletedAt }
      : { found: false }

    if (tenant) {
      const tenantUser = await prisma.tenantUser.findFirst({
        where: { tenantId: tenant.id },
        select: { id: true, userId: true, tenantId: true, roleId: true, isActive: true },
      })
      report.tenantUser = tenantUser
        ? { found: true, isActive: tenantUser.isActive }
        : { found: false }
    }
  } catch (e) {
    report.tenant = { found: false, error: String(e) }
  }

  return NextResponse.json(report)
}
