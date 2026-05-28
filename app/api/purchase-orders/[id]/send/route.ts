/**
 * app/api/purchase-orders/[id]/send/route.ts
 *
 * POST /api/purchase-orders/:id/send — Enviar orden al proveedor (DRAFT → SENT)
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const { tenantId } = await getTenantContext()
    const db = await getTenantDb()
    const { id } = await params

    const order = await db.purchaseOrder.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { _count: { select: { items: true } } },
    })

    if (!order) {
      return NextResponse.json({ error: "Orden de compra no encontrada" }, { status: 404 })
    }
    if (order.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Solo se pueden enviar órdenes en borrador" },
        { status: 409 }
      )
    }
    if (order._count.items === 0) {
      return NextResponse.json(
        { error: "La orden debe tener al menos un ítem" },
        { status: 422 }
      )
    }

    const updated = await db.purchaseOrder.update({
      where: { id },
      data: { status: "SENT" },
    })

    return NextResponse.json({ data: updated })
  } catch (err) {
    console.error("[POST /api/purchase-orders/:id/send]", err)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
