"use client"

/**
 * components/products/stock-table.tsx
 *
 * Tabla de movimientos de stock con filtros por tipo y depósito.
 */

import { useState, useCallback } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  STOCK_MOVEMENT_TYPE_LABELS,
  type StockMovementType,
} from "@/lib/validations/stock-movement"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MovementRow {
  id: string
  type: StockMovementType
  quantity: { toNumber?: () => number } | number
  previousStock: { toNumber?: () => number } | number
  newStock: { toNumber?: () => number } | number
  unitCost: { toNumber?: () => number } | number | null
  reason: string | null
  notes: string | null
  date: string | Date
  referenceType: string | null
  referenceId: string | null
  warehouse: { id: string; name: string }
  product?: { id: string; name: string; internalCode: string | null }
}

interface PaginationMeta {
  total: number
  page: number
  limit: number
  totalPages: number
}

interface StockTableProps {
  movements: MovementRow[]
  meta: PaginationMeta
  showProduct?: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toNum(val: { toNumber?: () => number } | number | null | undefined): number {
  if (val == null) return 0
  if (typeof val === "number") return val
  if (typeof val.toNumber === "function") return val.toNumber()
  return Number(val)
}

function formatDate(d: string | Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(typeof d === "string" ? new Date(d) : d)
}

function getMovementBadge(type: StockMovementType) {
  const positiveTypes = new Set(["PURCHASE", "TRANSFER_IN", "RETURN", "INVENTORY_COUNT", "ADJUSTMENT"])
  const isPositive = positiveTypes.has(type)
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        isPositive
          ? "bg-green-100 text-green-800"
          : "bg-red-100 text-red-700"
      }`}
    >
      {STOCK_MOVEMENT_TYPE_LABELS[type] ?? type}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StockTable({
  movements,
  meta,
  showProduct = false,
}: StockTableProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [filterType, setFilterType] = useState(
    searchParams.get("type") ?? ""
  )

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString())
      Object.entries(updates).forEach(([k, v]) => {
        if (v) params.set(k, v)
        else params.delete(k)
      })
      params.set("page", "1")
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams]
  )

  const handleTypeChange = (type: string) => {
    setFilterType(type)
    updateParams({ type })
  }

  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("page", String(page))
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => handleTypeChange("")}
          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
            filterType === ""
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
          }`}
        >
          Todos
        </button>
        {(Object.keys(STOCK_MOVEMENT_TYPE_LABELS) as StockMovementType[]).map(
          (type) => (
            <button
              key={type}
              onClick={() => handleTypeChange(type)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                filterType === type
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
              }`}
            >
              {STOCK_MOVEMENT_TYPE_LABELS[type]}
            </button>
          )
        )}
      </div>

      {/* Tabla */}
      {movements.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">
          No hay movimientos registrados
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Fecha
                </th>
                {showProduct && (
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Producto
                  </th>
                )}
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Tipo
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Depósito
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Cantidad
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Stock Ant.
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Stock Nuevo
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Motivo
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {movements.map((m) => {
                const qty = toNum(m.quantity)
                return (
                  <tr
                    key={m.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {formatDate(m.date)}
                    </td>
                    {showProduct && m.product && (
                      <td className="px-4 py-3 text-gray-900 text-xs">
                        <div className="font-medium">{m.product.name}</div>
                        {m.product.internalCode && (
                          <div className="text-gray-400 font-mono">
                            {m.product.internalCode}
                          </div>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      {getMovementBadge(m.type)}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {m.warehouse.name}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-medium tabular-nums ${
                        qty >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {qty >= 0 ? "+" : ""}
                      {qty.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 tabular-nums text-xs">
                      {toNum(m.previousStock).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900 font-medium tabular-nums text-xs">
                      {toNum(m.newStock).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-[200px] truncate">
                      {m.reason ?? m.notes ?? "—"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginación */}
      {meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            Mostrando {(meta.page - 1) * meta.limit + 1}–
            {Math.min(meta.page * meta.limit, meta.total)} de {meta.total}{" "}
            movimientos
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={meta.page <= 1}
              onClick={() => goToPage(meta.page - 1)}
            >
              Anterior
            </Button>
            <span className="px-3 py-1 text-xs">
              {meta.page} / {meta.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={meta.page >= meta.totalPages}
              onClick={() => goToPage(meta.page + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
