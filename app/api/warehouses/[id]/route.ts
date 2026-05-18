/**
 * app/api/warehouses/[id]/route.ts
 *
 * PATCH  /api/warehouses/:id — Actualizar depósito
 * DELETE /api/warehouses/:id — Soft delete
 */

import { NextRequest, NextResponse } from "next/server"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"
import { updateWarehouseSchema } from "@/lib/validations/product"

type RouteParams = { params: Promise<{ id: string }> }

// ---------------------------------------------------------------------------
// PATCH /api/warehouses/:id
// ---------------------------------------------------------------------------
export async function PATCH(
  req: NextRequest,
  { params }: RouteParams
) {
  try {
    const db = await getTenantDb()
    const { tenantId } = await getTenantContext()
    const { id } = await params

    const existing = await db.warehouse.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: { id: true },
    })

    if (!existing) {
      return NextResponse.json(
        { error: "Depósito no encontrado" },
        { status: 404 }
      )
    }

    const body: unknown = await req.json()
    const parsed = updateWarehouseSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    // If setting as default, unset previous default
    if (parsed.data.isDefault) {
      await db.warehouse.updateMany({
        where: { tenantId, isDefault: true, NOT: { id } },
        data: { isDefault: false },
      })
    }

    const updated = await db.warehouse.update({
      where: { id },
      data: parsed.data,
      include: {
        branch: { select: { id: true, name: true, city: true } },
      },
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error("[PATCH /api/warehouses/:id]", error)
    return NextResponse.json(
      { error: "Error al actualizar el depósito" },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/warehouses/:id (soft delete)
// ---------------------------------------------------------------------------
export async function DELETE(
  _req: NextRequest,
  { params }: RouteParams
) {
  try {
    const db = await getTenantDb()
    const { tenantId } = await getTenantContext()
    const { id } = await params

    const existing = await db.warehouse.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: { id: true, isDefault: true },
    })

    if (!existing) {
      return NextResponse.json(
        { error: "Depósito no encontrado" },
        { status: 404 }
      )
    }

    if (existing.isDefault) {
      return NextResponse.json(
        { error: "No se puede eliminar el depósito predeterminado" },
        { status: 409 }
      )
    }

    await db.warehouse.update({
      where: { id },
      data: { deletedAt: new Date() },
    })

    return NextResponse.json({ data: { success: true } })
  } catch (error) {
    console.error("[DELETE /api/warehouses/:id]", error)
    return NextResponse.json(
      { error: "Error al eliminar el depósito" },
      { status: 500 }
    )
  }
}
