/**
 * app/api/products/[id]/movements/route.ts
 *
 * GET /api/products/:id/movements — Historial de movimientos paginado
 */

import { NextRequest, NextResponse } from "next/server"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(
  req: NextRequest,
  { params }: RouteParams
) {
  try {
    const db = await getTenantDb()
    const { tenantId } = await getTenantContext()
    const { id: productId } = await params

    // Verify product belongs to tenant
    const product = await db.product.findFirst({
      where: { id: productId, tenantId, deletedAt: null },
      select: { id: true, name: true },
    })

    if (!product) {
      return NextResponse.json(
        { error: "Producto no encontrado" },
        { status: 404 }
      )
    }

    const { searchParams } = req.nextUrl
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)))
    const skip = (page - 1) * limit
    const type = searchParams.get("type")
    const warehouseId = searchParams.get("warehouseId")
    const dateFrom = searchParams.get("dateFrom")
    const dateTo = searchParams.get("dateTo")

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = { productId, tenantId }
    if (type) where.type = type
    if (warehouseId) where.warehouseId = warehouseId
    if (dateFrom || dateTo) {
      where.date = {}
      if (dateFrom) where.date.gte = new Date(dateFrom)
      if (dateTo) where.date.lte = new Date(dateTo)
    }

    const [total, movements] = await Promise.all([
      db.stockMovement.count({ where }),
      db.stockMovement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: "desc" },
        include: {
          warehouse: { select: { id: true, name: true } },
        },
      }),
    ])

    return NextResponse.json({
      data: movements,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("[GET /api/products/:id/movements]", error)
    return NextResponse.json(
      { error: "Error al obtener los movimientos" },
      { status: 500 }
    )
  }
}
