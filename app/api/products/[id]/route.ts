/**
 * app/api/products/[id]/route.ts
 *
 * GET    /api/products/:id  — Detalle completo con stock por depósito
 * PATCH  /api/products/:id  — Actualización parcial
 * DELETE /api/products/:id  — Soft delete
 */

import { NextRequest, NextResponse } from "next/server"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"
import { updateProductSchema } from "@/lib/validations/product"

type RouteParams = { params: Promise<{ id: string }> }

// ---------------------------------------------------------------------------
// GET /api/products/:id
// ---------------------------------------------------------------------------
export async function GET(
  _req: NextRequest,
  { params }: RouteParams
) {
  try {
    const db = await getTenantDb()
    const { tenantId } = await getTenantContext()
    const { id } = await params

    const product = await db.product.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        unit: { select: { id: true, name: true, abbreviation: true } },
        images: { orderBy: [{ isPrimary: "desc" }, { order: "asc" }] },
        stocks: {
          include: {
            warehouse: {
              select: {
                id: true,
                name: true,
                description: true,
                branch: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    })

    if (!product) {
      return NextResponse.json(
        { error: "Producto no encontrado" },
        { status: 404 }
      )
    }

    // Compute total stock and low stock flag.
    // Prisma v7 + adapter-pg returns Decimal fields as strings.
    const totalStock = product.stocks.reduce(
      (acc: number, s: { quantity: unknown }) => acc + Number(s.quantity),
      0
    )
    const isLowStock =
      product.trackStock &&
      product.minStock != null &&
      totalStock < Number(product.minStock)

    return NextResponse.json({ data: { ...product, totalStock, isLowStock } })
  } catch (error) {
    console.error("[GET /api/products/:id]", error)
    return NextResponse.json(
      { error: "Error al obtener el producto" },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/products/:id
// ---------------------------------------------------------------------------
export async function PATCH(
  req: NextRequest,
  { params }: RouteParams
) {
  try {
    const db = await getTenantDb()
    const { tenantId, userId } = await getTenantContext()
    const { id } = await params

    const existing = await db.product.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: { id: true },
    })

    if (!existing) {
      return NextResponse.json(
        { error: "Producto no encontrado" },
        { status: 404 }
      )
    }

    const body: unknown = await req.json()
    const parsed = updateProductSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const updated = await db.product.update({
      where: { id },
      data: {
        ...parsed.data,
        updatedById: userId,
      },
      include: {
        category: { select: { id: true, name: true } },
        unit: { select: { id: true, name: true, abbreviation: true } },
      },
    })

    return NextResponse.json({ data: updated })
  } catch (error: unknown) {
    console.error("[PATCH /api/products/:id]", error)

    if (
      error instanceof Error &&
      error.message.includes("Unique constraint")
    ) {
      return NextResponse.json(
        { error: "Ya existe un producto con ese código" },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: "Error al actualizar el producto" },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/products/:id  (soft delete)
// ---------------------------------------------------------------------------
export async function DELETE(
  _req: NextRequest,
  { params }: RouteParams
) {
  try {
    const db = await getTenantDb()
    const { tenantId } = await getTenantContext()
    const { id } = await params

    const existing = await db.product.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: { id: true },
    })

    if (!existing) {
      return NextResponse.json(
        { error: "Producto no encontrado" },
        { status: 404 }
      )
    }

    await db.product.update({
      where: { id },
      data: { deletedAt: new Date() },
    })

    return NextResponse.json({ data: { success: true } })
  } catch (error) {
    console.error("[DELETE /api/products/:id]", error)
    return NextResponse.json(
      { error: "Error al eliminar el producto" },
      { status: 500 }
    )
  }
}
