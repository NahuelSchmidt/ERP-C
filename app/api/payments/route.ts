/**
 * app/api/payments/route.ts
 *
 * GET  /api/payments — Lista paginada de cobros/pagos
 *   Filtros: ?customerId, ?supplierId, ?dateFrom, ?dateTo, ?direction, ?status
 * POST /api/payments — Registrar cobro o pago
 */

import { NextRequest, NextResponse } from "next/server"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"
import { createPaymentSchema } from "@/lib/validations/payment"
import {
  recordCustomerPayment,
  recordSupplierPayment,
} from "@/lib/services/payment.service"
import { Decimal } from "@prisma/client/runtime/client"
import { z } from "zod"

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  customerId: z.string().optional(),
  supplierId: z.string().optional(),
  cashSessionId: z.string().optional(),
  direction: z.enum(["CUSTOMER", "SUPPLIER", "INTERNAL"]).optional(),
  status: z.enum(["PENDING", "COMPLETED", "CANCELLED"]).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const db = await getTenantDb()
    const { tenantId } = await getTenantContext()

    const queryResult = listQuerySchema.safeParse(
      Object.fromEntries(req.nextUrl.searchParams)
    )
    if (!queryResult.success) {
      return NextResponse.json(
        { error: "Parámetros inválidos", details: queryResult.error.flatten() },
        { status: 400 }
      )
    }

    const {
      page,
      pageSize,
      customerId,
      supplierId,
      cashSessionId,
      direction,
      status,
      dateFrom,
      dateTo,
    } = queryResult.data

    const where = {
      tenantId,
      ...(customerId ? { customerId } : {}),
      ...(supplierId ? { supplierId } : {}),
      ...(cashSessionId ? { cashSessionId } : {}),
      ...(direction ? { direction } : {}),
      ...(status ? { status } : {}),
      ...(dateFrom || dateTo
        ? {
            date: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo ? { lte: new Date(dateTo) } : {}),
            },
          }
        : {}),
    }

    const [total, payments] = await Promise.all([
      db.payment.count({ where }),
      db.payment.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              companyName: true,
              firstName: true,
              lastName: true,
            },
          },
          supplier: {
            select: { id: true, companyName: true },
          },
          items: {
            include: {
              paymentMethod: { select: { id: true, name: true, type: true } },
            },
          },
          invoiceLinks: {
            include: {
              invoice: {
                select: { id: true, number: true, voucherType: true, total: true },
              },
            },
          },
        },
        orderBy: { date: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    return NextResponse.json({
      data: payments,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error) {
    console.error("[GET /api/payments]", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = await getTenantDb()
    const { userId } = await getTenantContext()

    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const body: unknown = await req.json()
    const result = createPaymentSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: result.error.flatten() },
        { status: 422 }
      )
    }

    const data = result.data
    let payment

    if (data.direction === "CUSTOMER") {
      payment = await recordCustomerPayment(db, {
        cashSessionId: data.cashSessionId,
        customerId: data.customerId!,
        total: data.total,
        items: data.items,
        invoiceLinks: data.invoiceLinks,
        reference: data.reference,
        notes: data.notes,
        userId,
      })
    } else if (data.direction === "SUPPLIER") {
      payment = await recordSupplierPayment(db, {
        cashSessionId: data.cashSessionId,
        supplierId: data.supplierId!,
        total: data.total,
        items: data.items,
        reference: data.reference,
        notes: data.notes,
        userId,
      })
    } else {
      // INTERNAL — movimiento simple sin actualizar balances
      const { tenantId } = await getTenantContext()
      payment = await db.payment.create({
        data: {
          tenantId,
          cashSessionId: data.cashSessionId ?? null,
          direction: "INTERNAL",
          total: new Decimal(data.total),
          reference: data.reference ?? null,
          notes: data.notes ?? null,
          status: "COMPLETED",
          createdById: userId,
          items: {
            create: data.items.map((item) => ({
              paymentMethodId: item.paymentMethodId,
              amount: new Decimal(item.amount),
              bankRef: item.bankRef ?? null,
            })),
          },
        },
      })
    }

    return NextResponse.json({ data: payment }, { status: 201 })
  } catch (error) {
    console.error("[POST /api/payments]", error)
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
