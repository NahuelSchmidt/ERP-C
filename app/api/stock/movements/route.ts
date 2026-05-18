/**
 * app/api/stock/movements/route.ts
 *
 * GET  /api/stock/movements — Listado global de movimientos con filtros
 * POST /api/stock/movements — Crear movimiento manual
 */

import { NextRequest, NextResponse } from "next/server"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"
import { createStockMovementSchema } from "@/lib/validations/stock-movement"
import { createStockMovement } from "@/lib/services/stock.service"

// ---------------------------------------------------------------------------
// GET /api/stock/movements
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  try {
    const db = await getTenantDb()
    const { tenantId } = await getTenantContext()

    const { searchParams } = req.nextUrl
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)))
    const skip = (page - 1) * limit

    const type = searchParams.get("type")
    const productId = searchParams.get("productId")
    const warehouseId = searchParams.get("warehouseId")
    const dateFrom = searchParams.get("dateFrom")
    const dateTo = searchParams.get("dateTo")

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = { tenantId }
    if (type) where.type = type
    if (productId) where.productId = productId
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
          product: {
            select: { id: true, name: true, internalCode: true, sku: true },
          },
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
    console.error("[GET /api/stock/movements]", error)
    return NextResponse.json(
      { error: "Error al obtener los movimientos" },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// POST /api/stock/movements
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const db = await getTenantDb()
    const { tenantId, userId } = await getTenantContext()

    const body: unknown = await req.json()
    const parsed = createStockMovementSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const movement = await createStockMovement(db, {
      tenantId,
      productId: parsed.data.productId,
      warehouseId: parsed.data.warehouseId,
      type: parsed.data.type,
      quantity: parsed.data.quantity,
      unitCost: parsed.data.unitCost ?? null,
      reason: parsed.data.reason ?? null,
      notes: parsed.data.notes ?? null,
      referenceType: parsed.data.referenceType ?? null,
      referenceId: parsed.data.referenceId ?? null,
      date: parsed.data.date,
      createdById: userId,
    })

    return NextResponse.json({ data: movement }, { status: 201 })
  } catch (error: unknown) {
    console.error("[POST /api/stock/movements]", error)

    if (error instanceof Error) {
      // Business logic errors (e.g., negative stock)
      if (error.message.includes("Stock insuficiente")) {
        return NextResponse.json({ error: error.message }, { status: 422 })
      }
      if (error.message.includes("no encontrado")) {
        return NextResponse.json({ error: error.message }, { status: 404 })
      }
    }

    return NextResponse.json(
      { error: "Error al registrar el movimiento de stock" },
      { status: 500 }
    )
  }
}
