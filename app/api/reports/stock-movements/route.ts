/**
 * app/api/reports/stock-movements/route.ts
 *
 * GET /api/reports/stock-movements
 *
 * Movimientos de stock paginados con filtros.
 *
 * Query params:
 *   productId   — filtrar por producto
 *   warehouseId — filtrar por depósito
 *   type        — StockMovementType (PURCHASE | SALE | ADJUSTMENT | ...)
 *   dateFrom    — ISO date string
 *   dateTo      — ISO date string
 *   page        — número de página (default: 1)
 *   pageSize    — registros por página (default: 20, max: 100)
 *
 * Respuesta: { data: StockMovement[], meta: { page, pageSize, total, totalPages } }
 */

import { NextRequest, NextResponse } from "next/server"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"
import { z } from "zod"

const StockMovementTypeValues = [
  "PURCHASE",
  "SALE",
  "ADJUSTMENT",
  "TRANSFER_IN",
  "TRANSFER_OUT",
  "LOSS",
  "RETURN",
  "INVENTORY_COUNT",
] as const

const querySchema = z.object({
  productId: z.string().optional(),
  warehouseId: z.string().optional(),
  type: z.enum(StockMovementTypeValues).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
})

export async function GET(req: NextRequest) {
  try {
    const db = await getTenantDb()
    const { tenantId } = await getTenantContext()

    const { searchParams } = req.nextUrl
    const parsed = querySchema.safeParse(Object.fromEntries(searchParams))

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Parámetros inválidos", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { productId, warehouseId, type, page, pageSize } = parsed.data

    const dateFrom = parsed.data.dateFrom ? new Date(parsed.data.dateFrom) : undefined
    const dateTo = parsed.data.dateTo
      ? (() => {
          const d = new Date(parsed.data.dateTo!)
          d.setHours(23, 59, 59, 999)
          return d
        })()
      : undefined

    const where = {
      tenantId,
      ...(productId && { productId }),
      ...(warehouseId && { warehouseId }),
      ...(type && { type }),
      ...(dateFrom || dateTo
        ? {
            date: {
              ...(dateFrom && { gte: dateFrom }),
              ...(dateTo && { lte: dateTo }),
            },
          }
        : {}),
    }

    const [total, movements] = await Promise.all([
      db.stockMovement.count({ where }),
      db.stockMovement.findMany({
        where,
        orderBy: { date: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          product: {
            select: { id: true, name: true, internalCode: true },
          },
          warehouse: {
            select: { id: true, name: true },
          },
        },
      }),
    ])

    const data = movements.map((m) => ({
      id: m.id,
      type: m.type,
      date: m.date.toISOString(),
      quantity: Number(m.quantity),
      previousStock: Number(m.previousStock),
      newStock: Number(m.newStock),
      unitCost: m.unitCost !== null ? Number(m.unitCost) : null,
      referenceType: m.referenceType,
      referenceId: m.referenceId,
      reason: m.reason,
      notes: m.notes,
      product: {
        id: m.product.id,
        name: m.product.name,
        code: m.product.internalCode,
      },
      warehouse: {
        id: m.warehouse.id,
        name: m.warehouse.name,
      },
    }))

    return NextResponse.json({
      data,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error) {
    console.error("[GET /api/reports/stock-movements]", error)
    return NextResponse.json(
      { error: "Error al obtener movimientos de stock" },
      { status: 500 }
    )
  }
}
