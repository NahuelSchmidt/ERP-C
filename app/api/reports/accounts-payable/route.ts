/**
 * app/api/reports/accounts-payable/route.ts
 *
 * GET /api/reports/accounts-payable
 *
 * Cuentas por pagar: proveedores con facturas pendientes ordenados por monto DESC.
 *
 * Query params:
 *   page     — número de página (default: 1)
 *   pageSize — registros por página (default: 20)
 *   search   — búsqueda por nombre o documento
 *
 * Respuesta: { data: AccountPayable[], meta }
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
      OR: [
        { currentBalance: { gt: 0 } },
        {
          supplierInvoices: {
            some: {
              status: "PENDING",
              deletedAt: null,
            },
          },
        },
      ],
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause = where as any
    const [total, suppliers] = await Promise.all([
      db.supplier.count({ where: whereClause }),
      db.supplier.findMany({
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
          supplierInvoices: {
            where: {
              status: "PENDING",
              deletedAt: null,
            },
            orderBy: { invoiceDate: "desc" },
            take: 3,
            select: {
              id: true,
              invoiceNumber: true,
              invoiceDate: true,
              dueDate: true,
              total: true,
              paidAmount: true,
              status: true,
            },
          },
        },
      }),
    ])

    const data = suppliers.map((s) => {
      const name =
        s.companyName ??
        [s.firstName, s.lastName].filter(Boolean).join(" ") ??
        "Sin nombre"

      const pendingAmount = s.supplierInvoices.reduce(
        (sum, inv) => sum + (Number(inv.total) - Number(inv.paidAmount)),
        0
      )

      return {
        supplierId: s.id,
        name,
        documentNumber: s.documentNumber,
        vatCondition: s.vatCondition,
        currentBalance: Number(s.currentBalance),
        pendingAmount,
        email: s.email,
        phone: s.phone,
        pendingInvoices: s.supplierInvoices.map((inv) => ({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          invoiceDate: inv.invoiceDate.toISOString(),
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
    console.error("[GET /api/reports/accounts-payable]", error)
    return NextResponse.json(
      { error: "Error al obtener cuentas por pagar" },
      { status: 500 }
    )
  }
}
