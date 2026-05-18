/**
 * app/api/payment-methods/route.ts
 *
 * GET  /api/payment-methods — Lista de medios de pago del tenant
 * POST /api/payment-methods — Crear medio de pago
 */

import { NextRequest, NextResponse } from "next/server"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"
import { createPaymentMethodSchema } from "@/lib/validations/payment"
import { Decimal } from "@prisma/client/runtime/client"

export async function GET(_req: NextRequest) {
  try {
    const db = await getTenantDb()
    const { tenantId } = await getTenantContext()

    const methods = await db.paymentMethod.findMany({
      where: { tenantId },
      orderBy: [{ order: "asc" }, { name: "asc" }],
    })

    return NextResponse.json({ data: methods })
  } catch (error) {
    console.error("[GET /api/payment-methods]", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = await getTenantDb()
    const { tenantId } = await getTenantContext()

    const body: unknown = await req.json()
    const result = createPaymentMethodSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: result.error.flatten() },
        { status: 422 }
      )
    }

    const method = await db.paymentMethod.create({
      data: {
        tenantId,
        name: result.data.name,
        type: result.data.type,
        surchargePercent: new Decimal(result.data.surchargePercent),
        isActive: result.data.isActive,
        order: result.data.order,
      },
    })

    return NextResponse.json({ data: method }, { status: 201 })
  } catch (error) {
    console.error("[POST /api/payment-methods]", error)
    if (
      error instanceof Error &&
      error.message.includes("Unique constraint")
    ) {
      return NextResponse.json(
        { error: "Ya existe un medio de pago con ese nombre" },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
