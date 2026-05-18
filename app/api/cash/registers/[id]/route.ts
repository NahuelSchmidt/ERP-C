/**
 * app/api/cash/registers/[id]/route.ts
 *
 * GET   /api/cash/registers/:id — Detalle de una caja
 * PATCH /api/cash/registers/:id — Actualizar nombre/estado de caja
 */

import { NextRequest, NextResponse } from "next/server"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"
import { updateCashRegisterSchema } from "@/lib/validations/payment"

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const db = await getTenantDb()
    const { tenantId } = await getTenantContext()
    const { id } = await params

    const register = await db.cashRegister.findFirst({
      where: { id, tenantId },
      include: {
        branch: { select: { id: true, name: true } },
        sessions: {
          orderBy: { openedAt: "desc" },
          take: 10,
          select: {
            id: true,
            status: true,
            openedAt: true,
            closedAt: true,
            openingBalance: true,
            closingBalance: true,
            expectedBalance: true,
            difference: true,
            userId: true,
          },
        },
      },
    })

    if (!register) {
      return NextResponse.json({ error: "Caja no encontrada" }, { status: 404 })
    }

    return NextResponse.json({ data: register })
  } catch (error) {
    console.error("[GET /api/cash/registers/:id]", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const db = await getTenantDb()
    const { tenantId } = await getTenantContext()
    const { id } = await params

    const existing = await db.cashRegister.findFirst({
      where: { id, tenantId },
    })
    if (!existing) {
      return NextResponse.json({ error: "Caja no encontrada" }, { status: 404 })
    }

    const body: unknown = await req.json()
    const result = updateCashRegisterSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: result.error.flatten() },
        { status: 422 }
      )
    }

    const updated = await db.cashRegister.update({
      where: { id },
      data: result.data,
      include: {
        branch: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error("[PATCH /api/cash/registers/:id]", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
