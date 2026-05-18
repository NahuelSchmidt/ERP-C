/**
 * app/api/reports/accounts-receivable/route.ts
 *
 * GET /api/reports/accounts-receivable
 *
 * Cuentas por cobrar: clientes con saldo pendiente ordenados por monto DESC.
 * Incluye las últimas facturas pendientes de cada cliente.
 *
 * Query params:
 *   page     — número de página (default: 1)
 *   pageSize — registros por página (default: 20)
 *   search   — búsqueda por nombre o documento
 *
 * Respuesta: { data: AccountReceivable[], meta }
 */

import { NextRequest, NextResponse } from "next/server"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"
import { z } from "zod"

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
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

    const { page, pageSize, search } = parsed.data

    // Clientes con saldo positivo (deuda) o con facturas pendientes
    const where = {
      tenantId,
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { companyName: { contains: search, mode: "insensitive" as const } },
              { firstName: { contains: search, mode: "insensitive" as const } },
              { lastName: { contains: search, mode: "insensitive" as const } },
              { documentNumber: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
      // Clientes con saldo positivo o con facturas pendientes
      OR: [
        { currentBalance: { gt: 0 } },
        {
          invoices: {
            some: {
              status: { in: ["ISSUED", "PARTIAL"] },
              deletedAt: null,
            },
          },
        },
      ],
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause = where as any
    const [total, customers] = await Promise.all([
      db.customer.count({ where: whereClause }),
      db.customer.findMany({
        where: whereClause,
        orderBy: { currentBalance: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          companyName: true,
          firstName: true,
          lastName: true,
          documentNumber: true,
          vatCondition: true,
          currentBalance: true,
          email: true,
          phone: true,
          invoices: {
            where: {
              status: { in: ["ISSUED", "PARTIAL"] },
              deletedAt: null,
            },
            orderBy: { date: "desc" },
            take: 3,
            select: {
              id: true,
              fullNumber: true,
              date: true,
              total: true,
              paidAmount: true,
              status: true,
              dueDate: true,
            },
          },
        },
      }),
    ])

    const data = customers.map((c) => {
      const name =
        c.companyName ??
        [c.firstName, c.lastName].filter(Boolean).join(" ") ??
        "Sin nombre"

      // Calcular saldo real desde facturas pendientes
      const pendingFromInvoices = c.invoices.reduce(
        (sum, inv) => sum + (Number(inv.total) - Number(inv.paidAmount)),
        0
      )

      return {
        customerId: c.id,
        name,
        documentNumber: c.documentNumber,
        vatCondition: c.vatCondition,
        currentBalance: Number(c.currentBalance),
        pendingAmount: pendingFromInvoices,
        email: c.email,
        phone: c.phone,
        pendingInvoices: c.invoices.map((inv) => ({
          id: inv.id,
          fullNumber: inv.fullNumber,
          date: inv.date.toISOString(),
          dueDate: inv.dueDate?.toISOString() ?? null,
          total: Number(inv.total),
          paidAmount: Number(inv.paidAmount),
          balance: Number(inv.total) - Number(inv.paidAmount),
          status: inv.status,
        })),
      }
    })

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
    console.error("[GET /api/reports/accounts-receivable]", error)
    return NextResponse.json(
      { error: "Error al obtener cuentas por cobrar" },
      { status: 500 }
    )
  }
}
