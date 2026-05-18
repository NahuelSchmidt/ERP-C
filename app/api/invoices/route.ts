/**
 * app/api/invoices/route.ts
 *
 * GET  /api/invoices  — Lista paginada de comprobantes con filtros
 * POST /api/invoices  — Crear nuevo comprobante (en borrador)
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"
import {
  invoiceListQuerySchema,
  createInvoiceSchema,
} from "@/lib/validations/invoice"
import { createInvoice } from "@/lib/services/invoice.service"

// ---------------------------------------------------------------------------
// GET — Lista de comprobantes
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const { tenantId } = await getTenantContext()
    const db = await getTenantDb()

    const { searchParams } = req.nextUrl
    const parsed = invoiceListQuerySchema.safeParse(Object.fromEntries(searchParams))
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Parámetros inválidos", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { page, limit, search, status, voucherType, customerId, dateFrom, dateTo, pointOfSaleId } =
      parsed.data

    const skip = (page - 1) * limit

    // Construir filtros
    const where = {
      tenantId,
      deletedAt: null,
      ...(status && { status }),
      ...(voucherType && { voucherType }),
      ...(customerId && { customerId }),
      ...(pointOfSaleId && { pointOfSaleId }),
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
          { fullNumber: { contains: search, mode: "insensitive" } },
          { notes: { contains: search, mode: "insensitive" } },
          {
            customer: {
              OR: [
                { companyName: { contains: search, mode: "insensitive" } },
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName: { contains: search, mode: "insensitive" } },
                { documentNumber: { contains: search, mode: "insensitive" } },
              ],
            },
          },
        ],
      }),
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause = where as any
    const [invoices, total] = await Promise.all([
      db.invoice.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { date: "desc" },
        include: {
          customer: {
            select: {
              id: true,
              companyName: true,
              firstName: true,
              lastName: true,
              documentNumber: true,
              vatCondition: true,
            },
          },
          pointOfSale: { select: { id: true, number: true, name: true } },
          paymentCondition: { select: { id: true, name: true, days: true } },
          _count: { select: { items: true } },
        },
      }),
      db.invoice.count({ where: whereClause }),
    ])

    return NextResponse.json({
      data: invoices,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (err) {
    console.error("[GET /api/invoices]", err)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// POST — Crear comprobante en borrador
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
    const parsed = createInvoiceSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 422 }
      )
    }

    // Verificar que el punto de venta pertenezca al tenant
    const pos = await db.pointOfSale.findFirst({
      where: { id: parsed.data.pointOfSaleId, tenantId, isActive: true },
    })
    if (!pos) {
      return NextResponse.json(
        { error: "Punto de venta no encontrado o inactivo" },
        { status: 404 }
      )
    }

    const invoice = await createInvoice(db, {
      ...parsed.data,
      tenantId,
      createdById: session.user.id,
    })

    return NextResponse.json({ data: invoice }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/invoices]", err)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
