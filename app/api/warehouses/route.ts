/**
 * app/api/warehouses/route.ts
 *
 * GET  /api/warehouses — Listado de depósitos
 * POST /api/warehouses — Crear depósito
 */

import { NextRequest, NextResponse } from "next/server"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"
import { createWarehouseSchema } from "@/lib/validations/product"

// ---------------------------------------------------------------------------
// GET /api/warehouses
// ---------------------------------------------------------------------------
export async function GET(_req: NextRequest) {
  try {
    const db = await getTenantDb()
    const { tenantId } = await getTenantContext()

    const warehouses = await db.warehouse.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      include: {
        branch: { select: { id: true, name: true, city: true } },
        _count: { select: { stocks: true } },
      },
    })

    return NextResponse.json({ data: warehouses })
  } catch (error) {
    console.error("[GET /api/warehouses]", error)
    return NextResponse.json(
      { error: "Error al obtener los depósitos" },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// POST /api/warehouses
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const db = await getTenantDb()
    const { tenantId } = await getTenantContext()

    const body: unknown = await req.json()
    const parsed = createWarehouseSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { branchId, name, description, address, isDefault, isActive } =
      parsed.data

    // Verify branch belongs to tenant
    const branch = await db.branch.findFirst({
      where: { id: branchId, tenantId, deletedAt: null },
      select: { id: true },
    })

    if (!branch) {
      return NextResponse.json(
        { error: "Sucursal no encontrada" },
        { status: 404 }
      )
    }

    // If setting as default, unset previous default
    if (isDefault) {
      await db.warehouse.updateMany({
        where: { tenantId, isDefault: true },
        data: { isDefault: false },
      })
    }

    const warehouse = await db.warehouse.create({
      data: {
        tenantId,
        branchId,
        name,
        description: description ?? null,
        address: address ?? null,
        isDefault,
        isActive,
      },
      include: {
        branch: { select: { id: true, name: true, city: true } },
      },
    })

    return NextResponse.json({ data: warehouse }, { status: 201 })
  } catch (error: unknown) {
    console.error("[POST /api/warehouses]", error)

    if (
      error instanceof Error &&
      error.message.includes("Unique constraint")
    ) {
      return NextResponse.json(
        { error: "Ya existe un depósito con ese nombre" },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: "Error al crear el depósito" },
      { status: 500 }
    )
  }
}
