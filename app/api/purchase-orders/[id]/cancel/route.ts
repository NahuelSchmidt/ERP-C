/**
 * app/api/purchase-orders/[id]/cancel/route.ts
 *
 * POST /api/purchase-orders/:id/cancel — Cancelar orden de compra
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
    })

    if (!order) {
      return NextResponse.json({ error: "Orden de compra no encontrada" }, { status: 404 })
    }
    if (order.status === "RECEIVED") {
      return NextResponse.json(
        { error: "No se puede cancelar una orden ya recibida" },
        { status: 409 }
      )
    }
    if (order.status === "CANCELLED") {
      return NextResponse.json(
        { error: "La orden ya está cancelada" },
        { status: 409 }
      )
    }

    const updated = await db.purchaseOrder.update({
      where: { id },
      data: { status: "CANCELLED" },
    })

    return NextResponse.json({ data: updated })
  } catch (err) {
    console.error("[POST /api/purchase-orders/:id/cancel]", err)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
