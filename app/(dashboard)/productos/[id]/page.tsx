import { notFound } from "next/navigation"
import Link from "next/link"
import { ChevronLeftIcon, PencilIcon, AlertTriangleIcon } from "lucide-react"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { PRODUCT_STATUS_LABELS } from "@/lib/validations/product"

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(val)
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date))
}

export default async function ProductoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const db = await getTenantDb()
  const { tenantId } = await getTenantContext()

  const product = await db.product.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: {
      category: { select: { id: true, name: true } },
      unit: { select: { id: true, name: true, abbreviation: true } },
      stocks: {
        include: {
          warehouse: { select: { id: true, name: true } },
        },
      },
      images: { orderBy: [{ isPrimary: "desc" }, { order: "asc" }] },
    },
  })

  if (!product) notFound()

  const costPrice = Number(product.costPrice)
  const avgCost = Number(product.averageCost)
  const margin = Number(product.defaultMargin)
  const listPrice = costPrice * (1 + margin)
  const totalStock = product.stocks.reduce((acc, s) => acc + Number(s.quantity), 0)
  const minStock = product.minStock != null ? Number(product.minStock) : null
  const isLowStock = product.trackStock && minStock != null && totalStock < minStock

  const statusLabel = PRODUCT_STATUS_LABELS[product.status as keyof typeof PRODUCT_STATUS_LABELS] ?? product.status

  const serialized = JSON.parse(JSON.stringify(product))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/productos"
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ChevronLeftIcon className="w-4 h-4" />
          Productos
        </Link>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                product.status === "ACTIVE"
                  ? "bg-green-50 text-green-700"
                  : product.status === "DISCONTINUED"
                  ? "bg-orange-50 text-orange-700"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {statusLabel}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
            {product.internalCode && <span className="font-mono">Cód: {product.internalCode}</span>}
            {product.sku && <span className="font-mono">SKU: {product.sku}</span>}
            {product.barcode && <span className="font-mono">EAN: {product.barcode}</span>}
            {product.category && <span>{product.category.name}</span>}
          </div>
        </div>
        <Link href={`/productos/${id}/editar`} className={cn(buttonVariants())}>
          <PencilIcon className="w-4 h-4 mr-1.5" />
          Editar
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna principal */}
        <div className="lg:col-span-2 space-y-6">

          {/* Descripción */}
          {product.description && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-2">Descripción</h2>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{product.description}</p>
            </div>
          )}

          {/* Stock por depósito */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-gray-900">Stock</h2>
                {isLowStock && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
                    <AlertTriangleIcon className="w-3.5 h-3.5" />
                    Bajo mínimo
                  </span>
                )}
              </div>
              <div className="text-right">
                <p className={`text-lg font-bold ${isLowStock ? "text-red-600" : "text-gray-900"}`}>
                  {product.trackStock
                    ? `${totalStock.toFixed(2)} ${product.unit?.abbreviation ?? ""}`
                    : "Sin control"}
                </p>
                {minStock != null && (
                  <p className="text-xs text-gray-400">Mínimo: {minStock}</p>
                )}
              </div>
            </div>

            {product.trackStock && product.stocks.length > 0 ? (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase">Depósito</th>
                    <th className="text-right px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase">Disponible</th>
                    <th className="text-right px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase">Reservado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {product.stocks.map((s) => (
                    <tr key={s.id}>
                      <td className="px-5 py-3 text-gray-900">{s.warehouse.name}</td>
                      <td className="px-5 py-3 text-right font-mono">{Number(s.quantity).toFixed(2)}</td>
                      <td className="px-5 py-3 text-right font-mono text-gray-400">{Number(s.reservedQuantity).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : !product.trackStock ? (
              <p className="px-5 py-6 text-sm text-gray-400">Este producto no tiene control de stock.</p>
            ) : (
              <p className="px-5 py-6 text-sm text-gray-400">Sin registros de stock.</p>
            )}
          </div>

          {/* Notas */}
          {product.notes && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-2">Notas</h2>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{product.notes}</p>
            </div>
          )}
        </div>

        {/* Columna lateral */}
        <div className="space-y-6">
          {/* Precios */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-900">Precios</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Costo</span>
                <span className="font-mono font-medium text-gray-900">{formatCurrency(costPrice)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Costo promedio</span>
                <span className="font-mono text-gray-600">{formatCurrency(avgCost)}</span>
              </div>
              {margin > 0 && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Margen</span>
                    <span className="font-mono text-gray-600">{(margin * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-100 pt-2">
                    <span className="font-medium text-gray-700">Precio lista</span>
                    <span className="font-mono font-bold text-gray-900">{formatCurrency(listPrice)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Config de stock */}
          {product.trackStock && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2 text-sm">
              <h2 className="text-sm font-semibold text-gray-900 mb-2">Control de inventario</h2>
              <div className="flex justify-between">
                <span className="text-gray-500">Lotes</span>
                <span className={product.trackBatches ? "text-green-600" : "text-gray-400"}>
                  {product.trackBatches ? "Sí" : "No"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Seriales</span>
                <span className={product.trackSerials ? "text-green-600" : "text-gray-400"}>
                  {product.trackSerials ? "Sí" : "No"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Permite negativo</span>
                <span className={product.allowNegative ? "text-amber-600" : "text-gray-400"}>
                  {product.allowNegative ? "Sí" : "No"}
                </span>
              </div>
              {product.maxStock != null && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Stock máximo</span>
                  <span className="font-mono">{Number(product.maxStock)}</span>
                </div>
              )}
            </div>
          )}

          {/* Metadata */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2 text-xs text-gray-400">
            <p>Unidad: {product.unit?.name ?? "—"}</p>
            {product.weight != null && (
              <p>Peso: {Number(product.weight)} {product.weightUnit}</p>
            )}
            <p>Creado: {formatDate(serialized.createdAt)}</p>
            <p>Actualizado: {formatDate(serialized.updatedAt)}</p>
            <p className="font-mono break-all">{product.id}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
