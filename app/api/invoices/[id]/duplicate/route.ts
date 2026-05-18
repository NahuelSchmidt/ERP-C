/**
 * app/api/invoices/[id]/duplicate/route.ts
 *
 * POST /api/invoices/:id/duplicate
 * Duplica un comprobante como nuevo borrador con los mismos ítems.
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"
import { duplicateInvoice } from "@/lib/services/invoice.service"

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

    const duplicate = await duplicateInvoice(db, id, tenantId, session.user.id)

    return NextResponse.json({ data: duplicate }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno del servidor"
    const status = message.includes("no encontrada") ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
