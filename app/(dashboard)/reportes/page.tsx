"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { KpiCard, KpiCardSkeleton } from "@/components/reports/kpi-card"
import { TopList } from "@/components/reports/top-list"
import { formatCurrency } from "@/lib/format"
import { INVOICE_STATUS_LABELS } from "@/lib/validations/invoice"
import type { InvoiceStatus } from "@/lib/validations/invoice"

interface DashboardData {
  salesDay: { total: number; count: number; yesterday: number }
  salesWeek: { total: number; count: number }
  salesMonth: { total: number; count: number }
  pendingReceivables: { total: number; count: number }
  pendingPayables: { total: number; count: number }
  lowStockProducts: { count: number; items: { id: string; name: string; code: string | null; stock: number; minStock: number }[] }
  topProducts: { productId: string | null; name: string; totalQty: number; totalAmount: number }[]
  topCustomers: { customerId: string | null; name: string; totalAmount: number }[]
  recentInvoices: { id: string; fullNumber: string; customerName: string; total: number; status: string; date: string }[]
}

function calcTrend(current: number, previous: number): { value: number; label: string } | undefined {
  if (previous === 0) return undefined
  return {
    value: ((current - previous) / previous) * 100,
    label: "vs ayer",
  }
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("es-AR").format(new Date(date))
}

const StatusColors: Record<string, string> = {
  DRAFT: "bg-secondary text-muted-foreground",
  ISSUED: "bg-blue-50 text-blue-700 border border-blue-100",
  PAID: "bg-emerald-50 text-emerald-700 border border-emerald-100",
  PARTIAL: "bg-amber-50 text-amber-700 border border-amber-100",
  CANCELLED: "bg-red-50 text-red-600 border border-red-100",
}

export default function ReportesPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/reports/dashboard")
        if (!res.ok) throw new Error()
        const json = await res.json() as { data: DashboardData }
        setData(json.data)
      } catch {
        toast.error("Error al cargar el dashboard")
      } finally {
        setIsLoading(false)
      }
    })()
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-foreground">Reportes</h1>
        <p className="text-sm text-muted-foreground mt-1">Dashboard de métricas del negocio</p>
      </div>

      {/* KPIs fila 1 — Ventas */}
      <div>
        <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Ventas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <KpiCardSkeleton key={i} />)
          ) : (
            <>
              <KpiCard
                title="Ventas del día"
                value={formatCurrency(data?.salesDay.total ?? 0)}
                subtitle={`${data?.salesDay.count ?? 0} facturas`}
                trend={data ? calcTrend(data.salesDay.total, data.salesDay.yesterday) : undefined}
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
              />
              <KpiCard
                title="Ventas de la semana"
                value={formatCurrency(data?.salesWeek.total ?? 0)}
                subtitle={`${data?.salesWeek.count ?? 0} facturas`}
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                  </svg>
                }
              />
              <KpiCard
                title="Ventas del mes"
                value={formatCurrency(data?.salesMonth.total ?? 0)}
                subtitle={`${data?.salesMonth.count ?? 0} facturas`}
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                }
              />
            </>
          )}
        </div>
      </div>

      {/* KPIs fila 2 — Cuentas y alertas */}
      <div>
        <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Posición financiera</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <KpiCardSkeleton key={i} />)
          ) : (
            <>
              <KpiCard
                title="Cuentas a cobrar"
                value={formatCurrency(data?.pendingReceivables.total ?? 0)}
                subtitle={`${data?.pendingReceivables.count ?? 0} clientes con saldo`}
                variant={data && data.pendingReceivables.total > 0 ? "warning" : "default"}
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                }
              />
              <KpiCard
                title="Cuentas a pagar"
                value={formatCurrency(data?.pendingPayables.total ?? 0)}
                subtitle={`${data?.pendingPayables.count ?? 0} facturas pendientes`}
                variant={data && data.pendingPayables.total > 0 ? "warning" : "default"}
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                }
              />
              <KpiCard
                title="Productos bajo stock"
                value={String(data?.lowStockProducts.count ?? 0)}
                subtitle="productos bajo mínimo"
                variant={data && data.lowStockProducts.count > 0 ? "danger" : "default"}
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                }
              />
            </>
          )}
        </div>
      </div>

      {/* Tops y facturas recientes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top productos */}
        {isLoading ? (
          <div className="bg-card rounded-2xl border border-border p-5">
            <div className="h-4 w-32 bg-muted rounded animate-pulse mb-4" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-8 bg-muted/60 rounded animate-pulse mb-2" />
            ))}
          </div>
        ) : (
          <TopList
            title="Top productos del mes"
            items={(data?.topProducts ?? []).map((p) => ({
              name: p.name,
              value: p.totalAmount,
              subtitle: `${p.totalQty.toFixed(0)} uds.`,
            }))}
            formatValue={formatCurrency}
          />
        )}

        {/* Top clientes */}
        {isLoading ? (
          <div className="bg-card rounded-2xl border border-border p-5">
            <div className="h-4 w-32 bg-muted rounded animate-pulse mb-4" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-8 bg-muted/60 rounded animate-pulse mb-2" />
            ))}
          </div>
        ) : (
          <TopList
            title="Top clientes del mes"
            items={(data?.topCustomers ?? []).map((c) => ({
              name: c.name,
              value: c.totalAmount,
            }))}
            formatValue={formatCurrency}
          />
        )}

        {/* Facturas recientes */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-sm font-bold text-foreground">Facturas recientes</h3>
          </div>
          {isLoading ? (
            <div>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-5 py-3 border-b border-border/60">
                  <div className="h-4 bg-muted rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : !data?.recentInvoices.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sin facturas recientes</p>
          ) : (
            <ul>
              {data.recentInvoices.map((inv) => (
                <li key={inv.id} className="border-b border-border/60 last:border-0">
                  <Link
                    href={`/facturacion/${inv.id}`}
                    className="flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-mono text-muted-foreground">{inv.fullNumber}</p>
                      <p className="text-sm font-medium text-foreground truncate">{inv.customerName}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(inv.date)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 ml-3 flex-shrink-0">
                      <p className="text-sm font-mono font-semibold text-foreground">
                        {formatCurrency(inv.total)}
                      </p>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          StatusColors[inv.status] ?? "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {INVOICE_STATUS_LABELS[inv.status as InvoiceStatus] ?? inv.status}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Productos bajo stock */}
      {!isLoading && data && data.lowStockProducts.count > 0 && (
        <div className="bg-card rounded-2xl border border-red-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-red-100 bg-red-50">
            <h3 className="text-sm font-bold text-red-700">
              Alertas de stock ({data.lowStockProducts.count})
            </h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-5 py-2.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Producto</th>
                <th className="text-right px-5 py-2.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Stock actual</th>
                <th className="text-right px-5 py-2.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Mínimo</th>
              </tr>
            </thead>
            <tbody>
              {data.lowStockProducts.items.map((item) => (
                <tr key={item.id} className="hover:bg-muted/30 transition-colors border-b border-border/60 last:border-0">
                  <td className="px-5 py-3">
                    <Link href={`/productos/${item.id}`} className="font-medium text-foreground hover:text-foreground/70">
                      {item.name}
                    </Link>
                    {item.code && <p className="text-xs text-muted-foreground font-mono">{item.code}</p>}
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-red-600 font-medium">{item.stock}</td>
                  <td className="px-5 py-3 text-right font-mono text-muted-foreground">{item.minStock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
