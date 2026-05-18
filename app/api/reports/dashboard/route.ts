/**
 * app/api/reports/dashboard/route.ts
 *
 * GET /api/reports/dashboard
 *
 * Retorna todos los KPIs necesarios para el dashboard principal:
 *   - salesDay / salesWeek / salesMonth: totales de ventas por período
 *   - pendingReceivables: facturas pendientes de cobro (cuentas a cobrar)
 *   - pendingPayables: facturas de proveedores pendientes de pago
 *   - lowStockProducts: productos con stock por debajo del mínimo
 *   - topProducts: top 5 productos por monto vendido (último mes)
 *   - topCustomers: top 5 clientes por monto facturado (último mes)
 *   - recentInvoices: últimas 10 facturas emitidas
 *
 * Respuesta: { data: DashboardData }
 */

import { NextResponse } from "next/server"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"
import type { InvoiceStatus } from "@prisma/client"

export async function GET() {
  try {
    const db = await getTenantDb()
    const { tenantId } = await getTenantContext()

    const now = new Date()

    // Inicio del día actual (medianoche)
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
    // Inicio del día de ayer
    const startOfYesterday = new Date(startOfDay.getTime() - 24 * 60 * 60 * 1000)
    // Inicio de la semana actual (lunes)
    const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1
    const startOfWeek = new Date(startOfDay.getTime() - dayOfWeek * 24 * 60 * 60 * 1000)
    // Inicio del mes actual
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0)

    // Status de facturas activas (no borrador ni anulada)
    const activeStatuses: InvoiceStatus[] = ["ISSUED", "PAID", "PARTIAL"]

    // ---------------------------------------------------------------------------
    // 1. Ventas del día
    // ---------------------------------------------------------------------------
    type SalesAgg = { _sum: { total: number | null } | null; _count: { id: number } | null }
    const [salesDayAgg, salesYesterdayAgg, salesWeekAgg, salesMonthAgg] = (await Promise.all([
      db.invoice.aggregate({
        where: {
          tenantId,
          deletedAt: null,
          status: { in: activeStatuses },
          date: { gte: startOfDay },
        },
        _sum: { total: true },
        _count: { id: true },
      }),
      // Ventas de ayer para calcular tendencia
      db.invoice.aggregate({
        where: {
          tenantId,
          deletedAt: null,
          status: { in: activeStatuses },
          date: { gte: startOfYesterday, lt: startOfDay },
        },
        _sum: { total: true },
        _count: { id: true },
      }),
      db.invoice.aggregate({
        where: {
          tenantId,
          deletedAt: null,
          status: { in: activeStatuses },
          date: { gte: startOfWeek },
        },
        _sum: { total: true },
        _count: { id: true },
      }),
      db.invoice.aggregate({
        where: {
          tenantId,
          deletedAt: null,
          status: { in: activeStatuses },
          date: { gte: startOfMonth },
        },
        _sum: { total: true },
        _count: { id: true },
      }),
    ])) as [SalesAgg, SalesAgg, SalesAgg, SalesAgg]

    const salesDay = {
      total: Number(salesDayAgg._sum?.total ?? 0),
      count: salesDayAgg._count?.id ?? 0,
      yesterday: Number(salesYesterdayAgg._sum?.total ?? 0),
    }
    const salesWeek = {
      total: Number(salesWeekAgg._sum?.total ?? 0),
      count: salesWeekAgg._count?.id ?? 0,
    }
    const salesMonth = {
      total: Number(salesMonthAgg._sum?.total ?? 0),
      count: salesMonthAgg._count?.id ?? 0,
    }

    // ---------------------------------------------------------------------------
    // 2. Cuentas a cobrar — suma de (total - paidAmount) por factura pendiente
    // ---------------------------------------------------------------------------
    const receivableInvoices = await db.invoice.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: { in: ["ISSUED", "PARTIAL"] },
      },
      select: {
        total: true,
        paidAmount: true,
        customerId: true,
      },
    })

    const pendingReceivables = {
      total: receivableInvoices.reduce(
        (sum, inv) => sum + (Number(inv.total) - Number(inv.paidAmount)),
        0
      ),
      count: new Set(receivableInvoices.map((i) => i.customerId).filter(Boolean)).size,
    }

    // ---------------------------------------------------------------------------
    // 3. Cuentas a pagar — facturas de proveedores pendientes
    // ---------------------------------------------------------------------------
    const payableInvoicesAgg = await db.supplierInvoice.aggregate({
      where: {
        tenantId,
        deletedAt: null,
        status: { in: ["PENDING"] },
      },
      _sum: { total: true },
      _count: { id: true },
    })

    const pendingPayables = {
      total: Number(payableInvoicesAgg._sum.total ?? 0),
      count: payableInvoicesAgg._count.id,
    }

    // ---------------------------------------------------------------------------
    // 4. Productos con stock bajo mínimo
    // ---------------------------------------------------------------------------
    const lowStockItems = await db.stock.findMany({
      where: {
        product: {
          tenantId,
          deletedAt: null,
          status: "ACTIVE",
          trackStock: true,
          minStock: { not: null },
        },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            internalCode: true,
            minStock: true,
          },
        },
      },
    })

    // Filtrar en memoria: stock.quantity < product.minStock
    const lowStockFiltered = lowStockItems
      .filter(
        (s) =>
          s.product.minStock !== null &&
          Number(s.quantity) < Number(s.product.minStock)
      )
      .map((s) => ({
        id: s.product.id,
        name: s.product.name,
        code: s.product.internalCode,
        stock: Number(s.quantity),
        minStock: Number(s.product.minStock),
        warehouseId: s.warehouseId,
      }))

    const lowStockProducts = {
      count: lowStockFiltered.length,
      items: lowStockFiltered.slice(0, 10),
    }

    // ---------------------------------------------------------------------------
    // 5. Top 5 productos más vendidos (mes actual)
    // ---------------------------------------------------------------------------
    const topProductsRaw = await db.invoiceItem.groupBy({
      by: ["productId"],
      where: {
        invoice: {
          tenantId,
          deletedAt: null,
          status: { in: activeStatuses },
          date: { gte: startOfMonth },
        },
        productId: { not: null },
      },
      _sum: {
        quantity: true,
        total: true,
      },
      orderBy: {
        _sum: { total: "desc" },
      },
      take: 5,
    }) as Array<{ productId: string | null; _sum: { quantity: number | null; total: number | null } }>

    // Enriquecer con nombres de producto
    const topProductIds = topProductsRaw
      .map((r) => r.productId)
      .filter((id): id is string => id !== null)

    const topProductNames = await db.product.findMany({
      where: { id: { in: topProductIds } },
      select: { id: true, name: true },
    })

    const productNameMap = new Map(topProductNames.map((p) => [p.id, p.name]))

    const topProducts = topProductsRaw.map((r) => ({
      productId: r.productId,
      name: r.productId ? (productNameMap.get(r.productId) ?? "Producto sin nombre") : "N/A",
      totalQty: Number(r._sum.quantity ?? 0),
      totalAmount: Number(r._sum.total ?? 0),
    }))

    // ---------------------------------------------------------------------------
    // 6. Top 5 clientes (mes actual)
    // ---------------------------------------------------------------------------
    const topCustomersRaw = await db.invoice.groupBy({
      by: ["customerId"],
      where: {
        tenantId,
        deletedAt: null,
        status: { in: activeStatuses },
        date: { gte: startOfMonth },
        customerId: { not: null },
      },
      _sum: { total: true },
      orderBy: {
        _sum: { total: "desc" },
      },
      take: 5,
    }) as Array<{ customerId: string | null; _sum: { total: number | null } }>

    const topCustomerIds = topCustomersRaw
      .map((r) => r.customerId)
      .filter((id): id is string => id !== null)

    const topCustomerNames = await db.customer.findMany({
      where: { id: { in: topCustomerIds } },
      select: { id: true, companyName: true, firstName: true, lastName: true },
    })

    const customerNameMap = new Map(
      topCustomerNames.map((c) => [
        c.id,
        c.companyName ?? [c.firstName, c.lastName].filter(Boolean).join(" ") ?? "Sin nombre",
      ])
    )

    const topCustomers = topCustomersRaw.map((r) => ({
      customerId: r.customerId,
      name: r.customerId ? (customerNameMap.get(r.customerId) ?? "Cliente sin nombre") : "Consumidor final",
      totalAmount: Number(r._sum.total ?? 0),
    }))

    // ---------------------------------------------------------------------------
    // 7. Facturas recientes (últimas 10)
    // ---------------------------------------------------------------------------
    const recentInvoicesRaw = await db.invoice.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: { not: "DRAFT" },
      },
      orderBy: { date: "desc" },
      take: 10,
      select: {
        id: true,
        fullNumber: true,
        date: true,
        total: true,
        status: true,
        customer: {
          select: { companyName: true, firstName: true, lastName: true },
        },
      },
    })

    const recentInvoices = recentInvoicesRaw.map((inv) => ({
      id: inv.id,
      fullNumber: inv.fullNumber,
      customerName: inv.customer
        ? (inv.customer.companyName ??
          [inv.customer.firstName, inv.customer.lastName].filter(Boolean).join(" ") ??
          "Consumidor final")
        : "Consumidor final",
      total: Number(inv.total),
      status: inv.status,
      date: inv.date.toISOString(),
    }))

    // ---------------------------------------------------------------------------
    // Respuesta
    // ---------------------------------------------------------------------------
    return NextResponse.json({
      data: {
        salesDay,
        salesWeek,
        salesMonth,
        pendingReceivables,
        pendingPayables,
        lowStockProducts,
        topProducts,
        topCustomers,
        recentInvoices,
      },
    })
  } catch (error) {
    console.error("[GET /api/reports/dashboard]", error)
    return NextResponse.json(
      { error: "Error al obtener datos del dashboard" },
      { status: 500 }
    )
  }
}
