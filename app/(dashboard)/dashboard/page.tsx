import { auth } from "@/lib/auth"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"
import Link from "next/link"
import type { InvoiceStatus } from "@prisma/client"

function fmt(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n)
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("es-AR").format(new Date(iso))
}

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: "Borrador",
  ISSUED: "Emitida",
  PAID: "Cobrada",
  PARTIAL: "Parcial",
  CANCELLED: "Anulada",
}

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  ISSUED: "bg-blue-50 text-blue-700",
  PAID: "bg-green-50 text-green-700",
  PARTIAL: "bg-amber-50 text-amber-700",
  CANCELLED: "bg-red-50 text-red-600",
}

export default async function DashboardPage() {
  try {
    return await renderDashboard()
  } catch (err) {
    console.error("[Dashboard] Error al renderizar:", err)
    throw err
  }
}

async function renderDashboard() {
  const [session, db, { tenantId }] = await Promise.all([
    auth(),
    getTenantDb(),
    getTenantContext(),
  ])

  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1
  const startOfWeek = new Date(startOfDay.getTime() - dayOfWeek * 24 * 60 * 60 * 1000)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const activeStatuses: InvoiceStatus[] = ["ISSUED", "PAID", "PARTIAL"]

  const [salesMonthAgg, receivableInvoices, lowStockCount, recentInvoicesRaw] = await Promise.all([
    db.invoice.aggregate({
      where: { tenantId, deletedAt: null, status: { in: activeStatuses }, date: { gte: startOfMonth } },
      _sum: { total: true },
      _count: { id: true },
    }),
    db.invoice.findMany({
      where: { tenantId, deletedAt: null, status: { in: ["ISSUED", "PARTIAL"] } },
      select: { total: true, paidAmount: true },
    }),
    db.stock.count({
      where: {
        product: { tenantId, deletedAt: null, status: "ACTIVE", trackStock: true, minStock: { not: null } },
      },
    }),
    db.invoice.findMany({
      where: { tenantId, deletedAt: null, status: { not: "DRAFT" } },
      orderBy: { date: "desc" },
      take: 8,
      select: {
        id: true,
        fullNumber: true,
        date: true,
        total: true,
        status: true,
        customer: { select: { companyName: true, firstName: true, lastName: true } },
      },
    }),
  ])

  void startOfWeek // available for future use

  const salesMonth = Number(salesMonthAgg._sum?.total ?? 0)
  const salesMonthCount = salesMonthAgg._count?.id ?? 0
  const pendingReceivables = receivableInvoices.reduce(
    (sum, inv) => sum + (Number(inv.total) - Number(inv.paidAmount)),
    0
  )
  const pendingReceivablesCount = receivableInvoices.length

  const recentInvoices = recentInvoicesRaw.map((inv) => ({
    id: inv.id,
    fullNumber: inv.fullNumber,
    customerName: inv.customer
      ? (inv.customer.companyName ?? [inv.customer.firstName, inv.customer.lastName].filter(Boolean).join(" ") ?? "Consumidor final")
      : "Consumidor final",
    total: Number(inv.total),
    status: inv.status,
    date: inv.date.toISOString(),
  }))

  const kpis = [
    {
      label: "Ventas del mes",
      value: fmt(salesMonth),
      sub: `${salesMonthCount} comprobante${salesMonthCount !== 1 ? "s" : ""}`,
      href: "/facturacion",
      color: "text-gray-900",
    },
    {
      label: "Cobros pendientes",
      value: fmt(pendingReceivables),
      sub: `${pendingReceivablesCount} factura${pendingReceivablesCount !== 1 ? "s" : ""}`,
      href: "/facturacion?status=ISSUED",
      color: pendingReceivables > 0 ? "text-amber-600" : "text-gray-900",
    },
    {
      label: "Productos bajo stock",
      value: String(lowStockCount),
      sub: "alertas activas",
      href: "/inventario",
      color: lowStockCount > 0 ? "text-red-600" : "text-gray-900",
    },
    {
      label: "Clientes",
      value: "",
      sub: "Ver módulo",
      href: "/clientes",
      color: "text-gray-900",
      isLink: true,
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Bienvenido,{" "}
          <span className="font-medium text-gray-700">{session?.user.name}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Link
            key={kpi.label}
            href={kpi.href}
            className="bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 hover:shadow-sm transition-all"
          >
            <p className="text-sm text-gray-500">{kpi.label}</p>
            {kpi.value ? (
              <p className={`text-2xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
            ) : (
              <p className="text-2xl font-bold text-gray-300 mt-1">—</p>
            )}
            <p className="text-xs text-gray-400 mt-1">{kpi.sub}</p>
          </Link>
        ))}
      </div>

      {recentInvoices.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Últimos comprobantes</h2>
            <Link href="/facturacion" className="text-xs text-blue-600 hover:underline">
              Ver todos
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {recentInvoices.map((inv) => (
              <Link
                key={inv.id}
                href={`/facturacion/${inv.id}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-xs text-gray-500 shrink-0">{inv.fullNumber}</span>
                  <span className="text-sm text-gray-900 truncate">{inv.customerName}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <span className="text-xs text-gray-400">{fmtDate(inv.date)}</span>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[inv.status]}`}>
                    {STATUS_LABELS[inv.status]}
                  </span>
                  <span className="text-sm font-mono font-medium text-gray-900">{fmt(inv.total)}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
