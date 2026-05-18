/**
 * app/api/product-categories/[id]/route.ts
 *
 * PATCH  /api/product-categories/:id — Actualizar categoría
 * DELETE /api/product-categories/:id — Soft delete
 */

import { NextRequest, NextResponse } from "next/server"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"
import { updateProductCategorySchema } from "@/lib/validations/product"

type RouteParams = { params: Promise<{ id: string }> }

// ---------------------------------------------------------------------------
// PATCH /api/product-categories/:id
// ---------------------------------------------------------------------------
export async function PATCH(
  req: NextRequest,
  { params }: RouteParams
) {
  try {
    const db = await getTenantDb()
    const { tenantId } = await getTenantContext()
    const { id } = await params

    const existing = await db.productCategory.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: { id: true },
    })

    if (!existing) {
      return NextResponse.json(
        { error: "Categoría no encontrada" },
        { status: 404 }
      )
    }

    const body: unknown = await req.json()
    const parsed = updateProductCategorySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const updated = await db.productCategory.update({
      where: { id },
      data: parsed.data,
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error("[PATCH /api/product-categories/:id]", error)
    return NextResponse.json(
      { error: "Error al actualizar la categoría" },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/product-categories/:id (soft delete)
// ---------------------------------------------------------------------------
export async function DELETE(
  _req: NextRequest,
  { params }: RouteParams
) {
  try {
    const db = await getTenantDb()
    const { tenantId } = await getTenantContext()
    const { id } = await params

    const existing = await db.productCategory.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: { id: true },
    })

    if (!existing) {
      return NextResponse.json(
        { error: "Categoría no encontrada" },
        { status: 404 }
      )
    }

    // Check if it has products
    const productCount = await db.product.count({
      where: { categoryId: id, deletedAt: null },
    })

    if (productCount > 0) {
      return NextResponse.json(
        {
          error: `No se puede eliminar la categoría porque tiene ${productCount} producto(s) asociado(s)`,
        },
        { status: 409 }
      )
    }

    await db.productCategory.update({
      where: { id },
      data: { deletedAt: new Date() },
    })

    return NextResponse.json({ data: { success: true } })
  } catch (error) {
    console.error("[DELETE /api/product-categories/:id]", error)
    return NextResponse.json(
      { error: "Error al eliminar la categoría" },
      { status: 500 }
    )
  }
}
