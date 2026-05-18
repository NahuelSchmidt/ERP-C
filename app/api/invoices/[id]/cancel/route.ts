/**
 * app/api/invoices/[id]/cancel/route.ts
 *
 * POST /api/invoices/:id/cancel
 * Cancela una factura en estado DRAFT o ISSUED sin pagos vinculados.
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"
import { cancelInvoice } from "@/lib/services/invoice.service"

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

    await cancelInvoice(db, id, tenantId, session.user.id)

    return NextResponse.json({ data: { success: true } })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno del servidor"
    const status =
      message.includes("no encontrada") ? 404
      : message.includes("ya está") || message.includes("No se puede") ? 409
      : 500
    return NextResponse.json({ error: message }, { status })
  }
}
