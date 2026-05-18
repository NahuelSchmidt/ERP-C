/**
 * app/api/payment-methods/[id]/route.ts
 *
 * PATCH  /api/payment-methods/:id — Actualizar medio de pago
 * DELETE /api/payment-methods/:id — Eliminar medio de pago (solo si no tiene pagos)
 */

import { NextRequest, NextResponse } from "next/server"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"
import { updatePaymentMethodSchema } from "@/lib/validations/payment"
import { Decimal } from "@prisma/client/runtime/client"

type RouteParams = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const db = await getTenantDb()
    const { tenantId } = await getTenantContext()
    const { id } = await params

    const existing = await db.paymentMethod.findFirst({
      where: { id, tenantId },
    })
    if (!existing) {
      return NextResponse.json(
        { error: "Medio de pago no encontrado" },
        { status: 404 }
      )
    }

    const body: unknown = await req.json()
    const result = updatePaymentMethodSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: result.error.flatten() },
        { status: 422 }
      )
    }

    const { surchargePercent, ...rest } = result.data

    const updated = await db.paymentMethod.update({
      where: { id },
      data: {
        ...rest,
        ...(surchargePercent !== undefined
          ? { surchargePercent: new Decimal(surchargePercent) }
          : {}),
      },
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error("[PATCH /api/payment-methods/:id]", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const db = await getTenantDb()
    const { tenantId } = await getTenantContext()
    const { id } = await params

    const existing = await db.paymentMethod.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { paymentItems: true } } },
    })
    if (!existing) {
      return NextResponse.json(
        { error: "Medio de pago no encontrado" },
        { status: 404 }
      )
    }

    if (existing._count.paymentItems > 0) {
      return NextResponse.json(
        {
          error:
            "No se puede eliminar este medio de pago porque ya fue utilizado en cobros/pagos. Desactivalo en su lugar.",
        },
        { status: 409 }
      )
    }

    await db.paymentMethod.delete({ where: { id } })

    return NextResponse.json({ data: { id } })
  } catch (error) {
    console.error("[DELETE /api/payment-methods/:id]", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
