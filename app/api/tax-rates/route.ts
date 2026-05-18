/**
 * app/api/tax-rates/route.ts
 *
 * GET  /api/tax-rates  — Lista alícuotas del tenant
 * POST /api/tax-rates  — Crear alícuota
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"
import { createTaxRateSchema } from "@/lib/validations/invoice"
import { Decimal } from "@prisma/client/runtime/client"

export async function GET(_req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const { tenantId } = await getTenantContext()
    const db = await getTenantDb()

    const taxRates = await db.taxRate.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ type: "asc" }, { rate: "asc" }],
    })

    return NextResponse.json({ data: taxRates })
  } catch (err) {
    console.error("[GET /api/tax-rates]", err)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const { tenantId } = await getTenantContext()
    const db = await getTenantDb()

    const body = await req.json()
    const parsed = createTaxRateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 422 }
      )
    }

    const taxRate = await db.taxRate.create({
      data: {
        tenantId,
        ...parsed.data,
        rate: new Decimal(parsed.data.rate),
      },
    })

    return NextResponse.json({ data: taxRate }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/tax-rates]", err)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
