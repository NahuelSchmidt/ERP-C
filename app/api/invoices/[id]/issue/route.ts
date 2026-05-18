/**
 * app/api/invoices/[id]/issue/route.ts
 *
 * POST /api/invoices/:id/issue
 * Emite una factura: DRAFT → ISSUED, asignando número definitivo con
 * bloqueo atómico sobre VoucherSeries.
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"
import { issueInvoice } from "@/lib/services/invoice.service"

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

    const issued = await issueInvoice(db, id, tenantId, session.user.id)

    return NextResponse.json({ data: issued })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno del servidor"
    const status =
      message.includes("no encontrada") ? 404
      : message.includes("Solo se pueden") ? 409
      : 500
    return NextResponse.json({ error: message }, { status })
  }
}
