"use client"

import { useState, useCallback, useEffect } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { PlusIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { toast } from "sonner"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge"
import { VOUCHER_TYPE_LABELS } from "@/lib/validations/invoice"
import type { VoucherType, InvoiceStatus } from "@/lib/validations/invoice"

interface Invoice {
  id: string
  fullNumber: string
  voucherType: VoucherType
  date: string
  dueDate: string | null
  status: InvoiceStatus
  total: number | string
  paidAmount: number | string
  customer: {
    id: string
    companyName: string | null
    firstName: string | null
    lastName: string | null
  } | null
  pointOfSale: { id: string; number: number; name: string }
  paymentCondition: { id: string; name: string; days: number } | null
  _count: { items: number }
}

interface Meta {
  total: number
  page: number
  limit: number
  totalPages: number
}

function getCustomerName(inv: Invoice): string {
  if (!inv.customer) return "Consumidor Final"
  return (
    inv.customer.companyName ??
    [inv.customer.firstName, inv.customer.lastName].filter(Boolean).join(" ") ??
    "Consumidor Final"
  )
}

function formatCurrency(val: number | string): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(Number(val))
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("es-AR").format(new Date(date))
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Todos los estados" },
  { value: "DRAFT", label: "Borrador" },
  { value: "ISSUED", label: "Emitida" },
  { value: "PAID", label: "Cobrada" },
  { value: "PARTIAL", label: "Pago parcial" },
  { value: "CANCELLED", label: "Anulada" },
]

export default function FacturacionPage() {
  const searchParams = useSearchParams()
  const customerId = searchParams.get("customerId") ?? ""

  const [invoices, setInvoices] = useState<Invoice[]>([])
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
        page: String(params.page),
        limit: "20",
        ...(params.search && { search: params.search }),
        ...(params.status && { status: params.status }),
        ...(customerId && { customerId }),
      })
      const res = await fetch(`/api/invoices?${sp.toString()}`)
      if (!res.ok) throw new Error()
      const json = await res.json() as { data: Invoice[]; meta: Meta }
      setInvoices(json.data)
      setMeta(json.meta)
    } catch {
      toast.error("Error al cargar facturas")
    } finally {
      setIsLoading(false)
    }
  }, [customerId])

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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Facturación</h1>
          {!isLoading && (
            <p className="text-sm text-gray-500 mt-0.5">
              {meta.total} comprobante{meta.total !== 1 ? "s" : ""}
              {customerId && " (filtrado por cliente)"}
            </p>
          )}
        </div>
        <Link
          href={`/facturacion/nueva${customerId ? `?customerId=${customerId}` : ""}`}
          className={buttonVariants()}
        >
          <PlusIcon className="w-4 h-4 mr-1.5" />
          Nuevo comprobante
        </Link>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSearch() }}
          placeholder="Buscar por número, cliente..."
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
        {customerId && (
          <Link href="/facturacion" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Ver todos
          </Link>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">N° Comprobante</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Total</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                    No se encontraron comprobantes
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => window.location.href = `/facturacion/${inv.id}`}
                  >
                    <td className="px-4 py-3 font-mono text-sm font-medium text-gray-900">
                      {inv.fullNumber}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {VOUCHER_TYPE_LABELS[inv.voucherType] ?? inv.voucherType}
                    </td>
                    <td className="px-4 py-3 text-gray-900">
                      {getCustomerName(inv)}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {formatDate(inv.date)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium text-gray-900">
                      {formatCurrency(inv.total)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <InvoiceStatusBadge status={inv.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
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
