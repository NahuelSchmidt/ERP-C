/**
 * app/api/cash/sessions/route.ts
 *
 * GET  /api/cash/sessions — Lista de sesiones (filtros: ?cashRegisterId, ?status, ?dateFrom, ?dateTo)
 * POST /api/cash/sessions — Abrir una sesión de caja
 */

import { NextRequest, NextResponse } from "next/server"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"
import { openCashSessionSchema } from "@/lib/validations/payment"
import { openCashSession } from "@/lib/services/payment.service"
import { z } from "zod"

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  cashRegisterId: z.string().optional(),
  status: z.enum(["OPEN", "CLOSED"]).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const db = await getTenantDb()

    const queryResult = listQuerySchema.safeParse(
      Object.fromEntries(req.nextUrl.searchParams)
    )
    if (!queryResult.success) {
      return NextResponse.json(
        { error: "Parámetros inválidos", details: queryResult.error.flatten() },
        { status: 400 }
      )
    }

    const { page, pageSize, cashRegisterId, status, dateFrom, dateTo } =
      queryResult.data

    const where = {
      ...(cashRegisterId ? { cashRegisterId } : {}),
      ...(status ? { status } : {}),
      ...(dateFrom || dateTo
        ? {
            openedAt: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo ? { lte: new Date(dateTo) } : {}),
            },
          }
        : {}),
    }

    const [total, sessions] = await Promise.all([
      db.cashSession.count({ where }),
      db.cashSession.findMany({
        where,
        include: {
          cashRegister: {
            select: { id: true, name: true, branch: { select: { name: true } } },
          },
          _count: { select: { payments: true } },
        },
        orderBy: { openedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    return NextResponse.json({
      data: sessions,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error) {
    console.error("[GET /api/cash/sessions]", error)
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
    const result = openCashSessionSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: result.error.flatten() },
        { status: 422 }
      )
    }

    const session = await openCashSession(
      db,
      result.data.cashRegisterId,
      result.data.openingBalance,
      userId
    )

    return NextResponse.json({ data: session }, { status: 201 })
  } catch (error) {
    console.error("[POST /api/cash/sessions]", error)
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
