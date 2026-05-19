/**
 * app/api/products/[id]/stock/route.ts
 *
 * GET /api/products/:id/stock — Stock actual por depósito
 */

import { NextRequest, NextResponse } from "next/server"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(
  _req: NextRequest,
  { params }: RouteParams
) {
  try {
    const db = await getTenantDb()
    const { tenantId } = await getTenantContext()
    const { id: productId } = await params

    // Verify product exists and belongs to tenant
    const product = await db.product.findFirst({
      where: { id: productId, tenantId, deletedAt: null },
      select: { id: true, name: true, minStock: true, maxStock: true, trackStock: true },
    })

    if (!product) {
      return NextResponse.json(
        { error: "Producto no encontrado" },
        { status: 404 }
      )
    }

    const stocks = await db.stock.findMany({
      where: { productId },
      include: {
        warehouse: {
          select: {
            id: true,
            name: true,
            description: true,
            isDefault: true,
            branch: { select: { id: true, name: true, city: true } },
          },
        },
      },
      orderBy: { warehouse: { name: "asc" } },
    })

    // Prisma v7 + adapter-pg returns Decimal fields as strings.
    const enriched = stocks.map((s: {
      quantity: unknown
      reservedQuantity: unknown
      warehouse: unknown
      productId: string
      warehouseId: string
    }) => {
      const qty = Number(s.quantity)
      const reserved = Number(s.reservedQuantity)
      const available = qty - reserved
      const minStockVal = product.minStock != null ? Number(product.minStock) : null
      const isLow = product.trackStock && minStockVal !== null && qty < minStockVal

      return {
        ...s,
        quantity: qty,
        reservedQuantity: reserved,
        availableQuantity: available,
        isLow,
      }
    })

    const totalStock = enriched.reduce((acc: number, s: { quantity: number }) => acc + s.quantity, 0)

    return NextResponse.json({
      data: {
        product: {
          id: product.id,
          name: product.name,
          minStock: product.minStock != null ? Number(product.minStock) : null,
          maxStock: product.maxStock != null ? Number(product.maxStock) : null,
        },
        totalStock,
        stocks: enriched,
      },
    })
  } catch (error) {
    console.error("[GET /api/products/:id/stock]", error)
    return NextResponse.json(
      { error: "Error al obtener el stock" },
      { status: 500 }
    )
  }
}
