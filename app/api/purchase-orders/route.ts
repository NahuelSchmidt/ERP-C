/**
 * app/api/purchase-orders/route.ts
 *
 * GET  /api/purchase-orders  — Lista paginada de órdenes de compra
 * POST /api/purchase-orders  — Crear nueva orden de compra
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"
import {
  purchaseOrderListQuerySchema,
  createPurchaseOrderSchema,
} from "@/lib/validations/purchase-order"
import { Decimal } from "@prisma/client/runtime/client"

// ---------------------------------------------------------------------------
// GET — Lista de órdenes de compra
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const { tenantId } = await getTenantContext()
    const db = await getTenantDb()

    const parsed = purchaseOrderListQuerySchema.safeParse(
      Object.fromEntries(req.nextUrl.searchParams)
    )
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Parámetros inválidos", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { page, limit, search, supplierId, status, dateFrom, dateTo } = parsed.data
    const skip = (page - 1) * limit

    const where = {
      tenantId,
      deletedAt: null,
      ...(status && { status }),
      ...(supplierId && { supplierId }),
      ...(dateFrom || dateTo
        ? {
            date: {
              ...(dateFrom && { gte: new Date(dateFrom) }),
              ...(dateTo && { lte: new Date(dateTo) }),
            },
          }
        : {}),
      ...(search && {
        OR: [
          { number: { contains: search, mode: "insensitive" } },
          { notes: { contains: search, mode: "insensitive" } },
          {
            supplier: {
              OR: [
                { companyName: { contains: search, mode: "insensitive" } },
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName: { contains: search, mode: "insensitive" } },
              ],
            },
          },
        ],
      }),
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause = where as any

    const [orders, total] = await Promise.all([
      db.purchaseOrder.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { date: "desc" },
        include: {
          supplier: {
            select: {
              id: true,
              companyName: true,
              firstName: true,
              lastName: true,
              documentNumber: true,
            },
          },
          _count: { select: { items: true } },
        },
      }),
      db.purchaseOrder.count({ where: whereClause }),
    ])

    return NextResponse.json({
      data: orders,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (err) {
    console.error("[GET /api/purchase-orders]", err)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// POST — Crear orden de compra
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const { tenantId } = await getTenantContext()
    const db = await getTenantDb()

    const body = await req.json()
    const parsed = createPurchaseOrderSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 422 }
      )
    }

    const data = parsed.data

    // Verificar que el proveedor exista y pertenezca al tenant
    const supplier = await db.supplier.findFirst({
      where: { id: data.supplierId, tenantId, deletedAt: null },
    })
    if (!supplier) {
      return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 })
    }

    // Generar número secuencial único por tenant
    const numResult = await db.$queryRaw<{ next_num: bigint }[]>`
      SELECT COALESCE(MAX(
        CASE WHEN number ~ '^OC-[0-9]+$'
        THEN CAST(SUBSTRING(number FROM 4) AS BIGINT)
        ELSE 0 END
      ), 0) + 1 AS next_num
      FROM "PurchaseOrder"
      WHERE "tenantId" = ${tenantId}
    `
    const nextNum = Number(numResult[0]?.next_num ?? 1)
    const number = `OC-${String(nextNum).padStart(5, "0")}`

    // Calcular totales — taxPercent es fracción decimal (0.21 = 21%)
    let subtotal = 0
    let taxAmount = 0
    const computedItems = data.items.map((item, idx) => {
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

    const order = await db.purchaseOrder.create({
      data: {
        tenantId,
        number,
        supplierId: data.supplierId,
        date: data.date ? new Date(data.date) : new Date(),
        expectedDelivery: data.expectedDelivery ? new Date(data.expectedDelivery) : undefined,
        status: "DRAFT",
        subtotal: new Decimal(subtotal),
        taxAmount: new Decimal(taxAmount),
        total: new Decimal(total),
        currency: data.currency ?? "ARS",
        exchangeRate: new Decimal(data.exchangeRate ?? 1),
        notes: data.notes ?? null,
        createdById: session.user.id,
        items: {
          create: computedItems.map((item) => ({
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
        },
      },
      include: {
        supplier: {
          select: { id: true, companyName: true, firstName: true, lastName: true },
        },
        items: true,
      },
    })

    return NextResponse.json({ data: order }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/purchase-orders]", err)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
