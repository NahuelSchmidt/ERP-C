"use client"

import { useState, useCallback, useEffect } from "react"
import Link from "next/link"
import { PlusIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { toast } from "sonner"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { INVOICE_STATUS_LABELS, INVOICE_STATUSES } from "@/lib/validations/invoice"
import { formatCurrency } from "@/lib/format"

interface PurchaseOrder {
  id: string
  fullNumber: string | null
  date: string
  status: string
  total: number | string
  supplier: { companyName: string | null; firstName: string | null; lastName: string | null } | null
}

interface Meta {
  total: number
  page: number
  limit: number
  totalPages: number
}

function getSupplierName(order: PurchaseOrder): string {
  if (!order.supplier) return "—"
  return (
    order.supplier.companyName ??
    ([order.supplier.firstName, order.supplier.lastName].filter(Boolean).join(" ") || "—")
  )
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date))
}

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-500",
  ISSUED: "bg-blue-50 text-blue-700",
  PAID: "bg-green-50 text-green-700",
  PARTIAL: "bg-amber-50 text-amber-700",
  CANCELLED: "bg-red-50 text-red-600",
}

const STATUS_OPTIONS = [
  { value: "", label: "Todos los estados" },
  ...INVOICE_STATUSES.map((s) => ({ value: s, label: INVOICE_STATUS_LABELS[s] })),
]

export default function ComprasPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [meta, setMeta] = useState<Meta>({ total: 0, page: 1, limit: 20, totalPages: 1 })
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [status, setStatus] = useState("")
  const [isLoading, setIsLoading] = useState(true)

  const fetchData = useCallback(async (params: { page: number; search: string; status: string }) => {
    setIsLoading(true)
    try {
      const sp = new URLSearchParams({
        voucherType: "ORDEN_COMPRA",
        pageSize: "20",
        page: String(params.page),
        ...(params.search && { search: params.search }),
        ...(params.status && { status: params.status }),
      })
      const res = await fetch(`/api/invoices?${sp.toString()}`)
      if (!res.ok) throw new Error()
      const json = await res.json() as { data: PurchaseOrder[]; meta: Meta }
      setOrders(json.data)
      setMeta(json.meta)
    } catch {
      toast.error("Error al cargar órdenes de compra")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData({ page: 1, search: "", status: "" })
  }, [fetchData])

  function handleSearch() {
    setSearch(searchInput)
    setPage(1)
    void fetchData({ page: 1, search: searchInput, status })
  }

  function handleStatusChange(newStatus: string) {
    setStatus(newStatus)
    setPage(1)
    void fetchData({ page: 1, search, status: newStatus })
  }

  function handlePageChange(newPage: number) {
    setPage(newPage)
    void fetchData({ page: newPage, search, status })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compras</h1>
          {!isLoading && (
            <p className="text-sm text-gray-500 mt-0.5">
              {meta.total} orden{meta.total !== 1 ? "es" : ""} de compra
            </p>
          )}
        </div>
        <Link href="/facturacion/nueva" className={buttonVariants()}>
          <PlusIcon className="w-4 h-4 mr-1.5" />
          Nueva orden
        </Link>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSearch() }}
          placeholder="Buscar por número, proveedor..."
          className="max-w-xs"
        />
        <Button variant="outline" onClick={handleSearch}>Buscar</Button>
        <select
          value={status}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="h-8 rounded-lg border border-input bg-white px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Número</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Proveedor</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Total</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                    No hay órdenes de compra
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr
                    key={order.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => { window.location.href = `/facturacion/${order.id}` }}
                  >
                    <td className="px-4 py-3 font-mono text-sm font-medium text-gray-900">
                      {order.fullNumber ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {formatDate(order.date)}
                    </td>
                    <td className="px-4 py-3 text-gray-900">
                      {getSupplierName(order)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium text-gray-900">
                      {formatCurrency(Number(order.total))}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[order.status] ?? "bg-gray-100 text-gray-500"}`}>
                        {INVOICE_STATUS_LABELS[order.status as keyof typeof INVOICE_STATUS_LABELS] ?? order.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
          <p className="text-xs text-gray-500">
            {meta.total} resultado{meta.total !== 1 ? "s" : ""} · Página {page} de {meta.totalPages}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1 || isLoading}
            >
              <ChevronLeftIcon className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= meta.totalPages || isLoading}
            >
              <ChevronRightIcon className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
