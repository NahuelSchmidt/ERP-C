/**
 * app/api/cash/sessions/[id]/close/route.ts
 *
 * POST /api/cash/sessions/:id/close — Cerrar sesión de caja con arqueo
 */

import { NextRequest, NextResponse } from "next/server"
import { getTenantDb } from "@/lib/get-tenant-db"
import { closeCashSessionSchema } from "@/lib/validations/payment"
import { closeCashSession } from "@/lib/services/payment.service"

type RouteParams = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const db = await getTenantDb()
    const { id } = await params

    const body: unknown = await req.json()
    const result = closeCashSessionSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: result.error.flatten() },
        { status: 422 }
      )
    }

    const session = await closeCashSession(
      db,
      id,
      result.data.closingBalance,
      result.data.notes
    )

    return NextResponse.json({ data: session })
  } catch (error) {
    console.error("[POST /api/cash/sessions/:id/close]", error)
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
