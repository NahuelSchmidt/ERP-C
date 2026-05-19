"use client"

/**
 * components/products/product-table.tsx
 *
 * Tabla de productos con columnas: código, nombre, categoría,
 * stock total, costo, precio lista, estado.
 * Badge rojo cuando stock < minStock.
 */

import Link from "next/link"
import { PencilIcon, TrashIcon, AlertTriangleIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  PRODUCT_STATUS_LABELS,
  type ProductStatus,
} from "@/lib/validations/product"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StockEntry {
  quantity: number
  warehouse: { id: string; name: string }
}

interface ProductRow {
  id: string
  internalCode: string | null
  sku: string | null
  name: string
  status: string
  costPrice: string | number
  defaultMargin: string | number
  minStock: string | number | null
  trackStock: boolean
  totalStock: number
  isLowStock: boolean
  category: { id: string; name: string } | null
  unit: { id: string; name: string; abbreviation: string } | null
  stocks: StockEntry[]
  images: { url: string }[]
}

interface ProductTableProps {
  products: ProductRow[]
  onDelete?: (id: string) => void
  isDeleting?: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStatusBadge(status: string) {
  const labels: Record<string, { label: string; classes: string }> = {
    ACTIVE: {
      label: PRODUCT_STATUS_LABELS.ACTIVE,
      classes: "bg-green-100 text-green-800",
    },
    INACTIVE: {
      label: PRODUCT_STATUS_LABELS.INACTIVE,
      classes: "bg-gray-100 text-gray-600",
    },
    DISCONTINUED: {
      label: PRODUCT_STATUS_LABELS.DISCONTINUED,
      classes: "bg-orange-100 text-orange-700",
    },
  }
  const cfg = labels[status as ProductStatus] ?? {
    label: status,
    classes: "bg-gray-100 text-gray-600",
  }
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.classes}`}
    >
      {cfg.label}
    </span>
  )
}

function toNum(val: string | number | null | undefined): number {
  if (val == null) return 0
  return Number(val)
}

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(val)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProductTable({
  products,
  onDelete,
  isDeleting,
}: ProductTableProps) {
  if (products.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <svg
          className="mx-auto w-12 h-12 mb-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10"
          />
        </svg>
        <p className="text-sm font-medium text-gray-500">No se encontraron productos</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Código
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Nombre
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Categoría
            </th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Stock Total
            </th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Costo
            </th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Precio Lista
            </th>
            <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Estado
            </th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {products.map((product) => {
            const cost = toNum(product.costPrice)
            const margin = toNum(product.defaultMargin)
            const listPrice = cost * (1 + margin)
            const unitLabel = product.unit?.abbreviation ?? ""

            return (
              <tr
                key={product.id}
                className="hover:bg-gray-50 transition-colors"
              >
                {/* Código */}
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                  {product.internalCode ?? product.sku ?? "—"}
                </td>

                {/* Nombre */}
                <td className="px-4 py-3">
                  <Link
                    href={`/productos/${product.id}`}
                    className="font-medium text-gray-900 hover:text-blue-600 transition-colors"
                  >
                    {product.name}
                  </Link>
                </td>

                {/* Categoría */}
                <td className="px-4 py-3 text-gray-500">
                  {product.category?.name ?? "—"}
                </td>

                {/* Stock Total */}
                <td className="px-4 py-3 text-right">
                  <span
                    className={`inline-flex items-center gap-1 font-medium ${
                      product.isLowStock ? "text-red-600" : "text-gray-900"
                    }`}
                  >
                    {product.isLowStock && (
                      <AlertTriangleIcon className="w-3.5 h-3.5 flex-shrink-0" />
                    )}
                    {product.trackStock
                      ? `${product.totalStock.toFixed(2)} ${unitLabel}`
                      : "Sin control"}
                  </span>
                </td>

                {/* Costo */}
                <td className="px-4 py-3 text-right text-gray-700">
                  {formatCurrency(cost)}
                </td>

                {/* Precio Lista */}
                <td className="px-4 py-3 text-right text-gray-700">
                  {margin > 0 ? formatCurrency(listPrice) : "—"}
                </td>

                {/* Estado */}
                <td className="px-4 py-3 text-center">
                  {getStatusBadge(product.status)}
                </td>

                {/* Acciones */}
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Link href={`/productos/${product.id}/editar`}>
                      <Button variant="ghost" size="icon-sm" title="Editar">
                        <PencilIcon className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                    {onDelete && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Eliminar"
                        onClick={() => onDelete(product.id)}
                        disabled={isDeleting === product.id}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
