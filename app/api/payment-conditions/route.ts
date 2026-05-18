/**
 * app/api/payment-conditions/route.ts
 *
 * GET  /api/payment-conditions  — Lista condiciones de pago del tenant
 * POST /api/payment-conditions  — Crear condición de pago
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"
import { createPaymentConditionSchema } from "@/lib/validations/invoice"

export async function GET(_req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const { tenantId } = await getTenantContext()
    const db = await getTenantDb()

    const conditions = await db.paymentCondition.findMany({
      where: { tenantId, isActive: true },
      orderBy: { days: "asc" },
    })

    return NextResponse.json({ data: conditions })
  } catch (err) {
    console.error("[GET /api/payment-conditions]", err)
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
    const parsed = createPaymentConditionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 422 }
      )
    }

    const condition = await db.paymentCondition.create({
      data: {
        tenantId,
        ...parsed.data,
      },
    })

    return NextResponse.json({ data: condition }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/payment-conditions]", err)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
