/**
 * app/api/purchase-orders/[id]/route.ts
 *
 * GET    /api/purchase-orders/:id  — Detalle de orden de compra
 * PATCH  /api/purchase-orders/:id  — Actualizar (solo DRAFT)
 * DELETE /api/purchase-orders/:id  — Soft delete (solo DRAFT)
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"
import { updatePurchaseOrderSchema } from "@/lib/validations/purchase-order"
import { Decimal } from "@prisma/client/runtime/client"

type Params = { params: Promise<{ id: string }> }

// ---------------------------------------------------------------------------
// GET — Detalle completo
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest, { params }: Params) {
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
      include: {
        supplier: true,
        items: {
          include: {
            product: { select: { id: true, name: true, internalCode: true, sku: true } },
            taxRate: { select: { id: true, name: true, rate: true } },
          },
          orderBy: { order: "asc" },
        },
      },
    })

    if (!order) {
      return NextResponse.json({ error: "Orden de compra no encontrada" }, { status: 404 })
    }

    return NextResponse.json({ data: order })
  } catch (err) {
    console.error("[GET /api/purchase-orders/:id]", err)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// PATCH — Actualizar (solo DRAFT)
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest, { params }: Params) {
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
    if (order.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Solo se pueden editar órdenes en borrador" },
        { status: 409 }
      )
    }

    const body = await req.json()
    const parsed = updatePurchaseOrderSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 422 }
      )
    }

    const data = parsed.data

    // Recalcular totales si se actualizan ítems
    type ComputedItem = {
      productId?: string; taxRateId?: string; description: string
      quantity: number; unitPrice: number; taxPercent: number; order?: number
      itemSubtotal: number; itemTax: number; itemTotal: number; idx: number
    }
    let totals: { subtotal: Decimal; taxAmount: Decimal; total: Decimal } | undefined
    let computedItems: ComputedItem[] | undefined

    if (data.items) {
      let subtotal = 0
      let taxAmount = 0
      computedItems = data.items.map((item, idx) => {
        const itemSubtotal = Math.round(item.quantity * item.unitPrice * 100) / 100
        const itemTax = Math.round(itemSubtotal * item.taxPercent * 100) / 100
        const itemTotal = Math.round((itemSubtotal + itemTax) * 100) / 100
        subtotal += itemSubtotal
        taxAmount += itemTax
        return { ...item, itemSubtotal, itemTax, itemTotal, idx }
      })
      subtotal = Math.round(subtotal * 100) / 100
      taxAmount = Math.round(taxAmount * 100) / 100
      const total = Math.round((subtotal + taxAmount) * 100) / 100
      totals = {
        subtotal: new Decimal(subtotal),
        taxAmount: new Decimal(taxAmount),
        total: new Decimal(total),
      }
    }

    const updated = await db.$transaction(async (tx) => {
      await tx.purchaseOrder.update({
        where: { id },
        data: {
          ...(data.supplierId && { supplierId: data.supplierId }),
          ...(data.date && { date: new Date(data.date) }),
          ...(data.expectedDelivery !== undefined && {
            expectedDelivery: data.expectedDelivery ? new Date(data.expectedDelivery) : null,
          }),
          ...(data.notes !== undefined && { notes: data.notes ?? null }),
          ...(data.currency && { currency: data.currency }),
          ...(data.exchangeRate !== undefined && {
            exchangeRate: new Decimal(data.exchangeRate),
          }),
          ...(totals ?? {}),
        },
      })

      if (computedItems) {
        await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } })
        await tx.purchaseOrderItem.createMany({
          data: computedItems.map((item) => ({
            purchaseOrderId: id,
            productId: item.productId ?? null,
            taxRateId: item.taxRateId ?? null,
            description: item.description,
            quantity: new Decimal(item.quantity),
            unitPrice: new Decimal(item.unitPrice),
            taxPercent: new Decimal(item.taxPercent),
            subtotal: new Decimal(item.itemSubtotal),
            taxAmount: new Decimal(item.itemTax),
            total: new Decimal(item.itemTotal),
            order: item.order ?? item.idx,
          })),
        })
      }

      return tx.purchaseOrder.findUniqueOrThrow({
        where: { id },
        include: {
          supplier: { select: { id: true, companyName: true } },
          items: { orderBy: { order: "asc" } },
        },
      })
    })

    return NextResponse.json({ data: updated })
  } catch (err) {
    console.error("[PATCH /api/purchase-orders/:id]", err)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// DELETE — Soft delete (solo DRAFT)
// ---------------------------------------------------------------------------

export async function DELETE(_req: NextRequest, { params }: Params) {
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
    if (order.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Solo se pueden eliminar órdenes en borrador" },
        { status: 409 }
      )
    }

    await db.purchaseOrder.update({
      where: { id },
      data: { deletedAt: new Date() },
    })

    return NextResponse.json({ data: { success: true } })
  } catch (err) {
    console.error("[DELETE /api/purchase-orders/:id]", err)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
