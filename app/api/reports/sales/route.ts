/**
 * app/api/reports/sales/route.ts
 *
 * GET /api/reports/sales
 *
 * Reporte de ventas con agrupación temporal.
 *
 * Query params:
 *   dateFrom   — ISO date string, default: inicio del mes actual
 *   dateTo     — ISO date string, default: hoy
 *   groupBy    — "day" | "week" | "month" (default: "day")
 *   customerId — filtrar por cliente
 *   productId  — filtrar facturas que contengan un producto específico
 *
 * Respuesta: { data: { series, totals } }
 *   series: array de { date, total, count, avgTicket }
 *   totals: { total, count, avgTicket }
 */

import { NextRequest, NextResponse } from "next/server"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"
import { z } from "zod"
import type { InvoiceStatus } from "@prisma/client"

const querySchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  groupBy: z.enum(["day", "week", "month"]).default("day"),
  customerId: z.string().optional(),
  productId: z.string().optional(),
})

/** Trunca una fecha al inicio del período de agrupación */
function truncateDate(date: Date, groupBy: "day" | "week" | "month"): string {
  const d = new Date(date)
  if (groupBy === "month") {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  }
  if (groupBy === "week") {
    // Lunes de la semana
    const day = d.getDay() === 0 ? 6 : d.getDay() - 1
    const monday = new Date(d.getTime() - day * 24 * 60 * 60 * 1000)
    return monday.toISOString().slice(0, 10)
  }
  // day
  return d.toISOString().slice(0, 10)
}

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

    const { groupBy, customerId, productId } = parsed.data

    // Defaults de fechas
    const now = new Date()
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1)
    const dateFrom = parsed.data.dateFrom ? new Date(parsed.data.dateFrom) : defaultFrom
    const dateTo = parsed.data.dateTo ? new Date(parsed.data.dateTo) : now

    // Ajustar dateTo al fin del día
    dateTo.setHours(23, 59, 59, 999)

    const activeStatuses: InvoiceStatus[] = ["ISSUED", "PAID", "PARTIAL"]

    // Obtener facturas del período con o sin filtro de producto
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let invoiceFilter: any = {
      tenantId,
      deletedAt: null,
      status: { in: activeStatuses },
      date: { gte: dateFrom, lte: dateTo },
    }

    if (customerId) {
      invoiceFilter = { ...invoiceFilter, customerId }
    }

    // Si filtra por producto, primero busca IDs de facturas que lo contienen
    if (productId) {
      const invoiceIdsWithProduct = await db.invoiceItem.findMany({
        where: {
          productId,
          invoice: { tenantId, deletedAt: null, status: { in: activeStatuses } },
        },
        select: { invoiceId: true },
        distinct: ["invoiceId"],
      })
      const ids = invoiceIdsWithProduct.map((i) => i.invoiceId)
      invoiceFilter = { ...invoiceFilter, id: { in: ids } }
    }

    const invoices = await db.invoice.findMany({
      where: invoiceFilter,
      select: {
        date: true,
        total: true,
      },
      orderBy: { date: "asc" },
    })

    // Agrupar en memoria por período
    const seriesMap = new Map<string, { total: number; count: number }>()

    for (const inv of invoices) {
      const key = truncateDate(inv.date, groupBy)
      const existing = seriesMap.get(key) ?? { total: 0, count: 0 }
      seriesMap.set(key, {
        total: existing.total + Number(inv.total),
        count: existing.count + 1,
      })
    }

    const series = Array.from(seriesMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { total, count }]) => ({
        date,
        total,
        count,
        avgTicket: count > 0 ? total / count : 0,
      }))

    const grandTotal = invoices.reduce((sum, inv) => sum + Number(inv.total), 0)
    const grandCount = invoices.length

    return NextResponse.json({
      data: {
        series,
        totals: {
          total: grandTotal,
          count: grandCount,
          avgTicket: grandCount > 0 ? grandTotal / grandCount : 0,
        },
        meta: {
          dateFrom: dateFrom.toISOString(),
          dateTo: dateTo.toISOString(),
          groupBy,
        },
      },
    })
  } catch (error) {
    console.error("[GET /api/reports/sales]", error)
    return NextResponse.json(
      { error: "Error al generar reporte de ventas" },
      { status: 500 }
    )
  }
}
