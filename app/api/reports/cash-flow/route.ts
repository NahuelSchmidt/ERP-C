/**
 * app/api/reports/cash-flow/route.ts
 *
 * GET /api/reports/cash-flow
 *
 * Flujo de caja: cobros y pagos agrupados por día en el período indicado.
 *
 * Query params:
 *   dateFrom — ISO date string (default: inicio del mes actual)
 *   dateTo   — ISO date string (default: hoy)
 *
 * Respuesta: { data: { series, totals } }
 *   series: array de { date, inflows, outflows, net }
 *   totals: { inflows, outflows, net }
 */

import { NextRequest, NextResponse } from "next/server"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"
import { z } from "zod"

const querySchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
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

    const now = new Date()
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1)
    const dateFrom = parsed.data.dateFrom ? new Date(parsed.data.dateFrom) : defaultFrom
    const dateTo = parsed.data.dateTo ? new Date(parsed.data.dateTo) : now
    dateTo.setHours(23, 59, 59, 999)

    // Pagos recibidos de clientes (cobros)
    const inflows = await db.payment.findMany({
      where: {
        tenantId,
        direction: "CUSTOMER",
        status: "COMPLETED",
        date: { gte: dateFrom, lte: dateTo },
      },
      select: { date: true, total: true },
    })

    // Pagos a proveedores (pagos)
    const outflows = await db.payment.findMany({
      where: {
        tenantId,
        direction: "SUPPLIER",
        status: "COMPLETED",
        date: { gte: dateFrom, lte: dateTo },
      },
      select: { date: true, total: true },
    })

    // Agrupar por día
    const seriesMap = new Map<string, { inflows: number; outflows: number }>()

    for (const payment of inflows) {
      const key = payment.date.toISOString().slice(0, 10)
      const existing = seriesMap.get(key) ?? { inflows: 0, outflows: 0 }
      seriesMap.set(key, {
        ...existing,
        inflows: existing.inflows + Number(payment.total),
      })
    }

    for (const payment of outflows) {
      const key = payment.date.toISOString().slice(0, 10)
      const existing = seriesMap.get(key) ?? { inflows: 0, outflows: 0 }
      seriesMap.set(key, {
        ...existing,
        outflows: existing.outflows + Number(payment.total),
      })
    }

    const series = Array.from(seriesMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { inflows: inf, outflows: out }]) => ({
        date,
        inflows: inf,
        outflows: out,
        net: inf - out,
      }))

    const totalInflows = inflows.reduce((sum, p) => sum + Number(p.total), 0)
    const totalOutflows = outflows.reduce((sum, p) => sum + Number(p.total), 0)

    return NextResponse.json({
      data: {
        series,
        totals: {
          inflows: totalInflows,
          outflows: totalOutflows,
          net: totalInflows - totalOutflows,
        },
        meta: {
          dateFrom: dateFrom.toISOString(),
          dateTo: dateTo.toISOString(),
        },
      },
    })
  } catch (error) {
    console.error("[GET /api/reports/cash-flow]", error)
    return NextResponse.json(
      { error: "Error al obtener flujo de caja" },
      { status: 500 }
    )
  }
}
