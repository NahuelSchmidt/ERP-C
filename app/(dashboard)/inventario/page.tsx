"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { buttonVariants } from "@/components/ui/button"

interface ProductStock {
  id: string
  name: string
  internalCode: string | null
  sku: string | null
  status: string
  totalStock: number
  minStock: number | null
  maxStock: number | null
  unit: { abbreviation: string } | null
}

function formatStock(n: number): string {
  return Number.isInteger(n)
    ? new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(n)
    : new Intl.NumberFormat("es-AR").format(n)
}

function getStockStatus(product: ProductStock): "sin-stock" | "bajo-minimo" | "ok" {
  if (product.totalStock === 0) return "sin-stock"
  if (product.minStock != null && product.totalStock < product.minStock) return "bajo-minimo"
  return "ok"
}

export default function InventarioPage() {
  const [products, setProducts] = useState<ProductStock[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    void (async () => {
      setIsLoading(true)
      try {
        const res = await fetch("/api/products?pageSize=100")
        if (!res.ok) throw new Error()
        const json = await res.json() as { data: ProductStock[] }
        setProducts(json.data)
      } catch {
        toast.error("Error al cargar el inventario")
      } finally {
        setIsLoading(false)
      }
    })()
  }, [])

  const filtered = products.filter((p) => {
    const q = search.toLowerCase()
    return (
      p.name.toLowerCase().includes(q) ||
      (p.internalCode?.toLowerCase().includes(q) ?? false) ||
      (p.sku?.toLowerCase().includes(q) ?? false)
    )
  })

  const totalProducts = products.length
  const lowStock = products.filter((p) => getStockStatus(p) === "bajo-minimo").length
  const noStock = products.filter((p) => getStockStatus(p) === "sin-stock").length

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Inventario</h1>
        <p className="text-sm text-gray-500 mt-0.5">Niveles de stock por producto</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-500">Total productos</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{totalProducts}</p>
          </div>
          <div className={`bg-white rounded-xl border p-5 ${lowStock > 0 ? "border-amber-200" : "border-gray-200"}`}>
            <p className={`text-sm ${lowStock > 0 ? "text-amber-600" : "text-gray-500"}`}>Bajo mínimo</p>
            <p className={`text-2xl font-bold mt-1 ${lowStock > 0 ? "text-amber-600" : "text-gray-900"}`}>{lowStock}</p>
          </div>
          <div className={`bg-white rounded-xl border p-5 ${noStock > 0 ? "border-red-200" : "border-gray-200"}`}>
            <p className={`text-sm ${noStock > 0 ? "text-red-600" : "text-gray-500"}`}>Sin stock</p>
            <p className={`text-2xl font-bold mt-1 ${noStock > 0 ? "text-red-600" : "text-gray-900"}`}>{noStock}</p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, código..."
          className="h-8 max-w-xs rounded-lg border border-input bg-white px-3 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
        />
        <Link href="/productos" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Ir a Productos
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Código</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Producto</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Stock actual</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Stock mínimo</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Stock máximo</th>
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
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                    {products.length === 0 ? "No hay productos registrados" : "Sin resultados para la búsqueda"}
                  </td>
                </tr>
              ) : (
                filtered.map((product) => {
                  const stockStatus = getStockStatus(product)
                  return (
                    <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">
                        {product.internalCode ?? product.sku ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-900 font-medium">{product.name}</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-900">
                        {formatStock(product.totalStock)}
                        {product.unit && (
                          <span className="ml-1 text-gray-400 text-xs">{product.unit.abbreviation}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-500">
                        {product.minStock != null ? formatStock(product.minStock) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-500">
                        {product.maxStock != null ? formatStock(product.maxStock) : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {stockStatus === "sin-stock" && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600">
                            Sin stock
                          </span>
                        )}
                        {stockStatus === "bajo-minimo" && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                            Bajo mínimo
                          </span>
                        )}
                        {stockStatus === "ok" && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                            OK
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
