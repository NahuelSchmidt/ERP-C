"use client"

import { useState, useCallback, useEffect } from "react"
import Link from "next/link"
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "lucide-react"
import { toast } from "sonner"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"

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

interface Meta {
  total: number
  page: number
  limit: number
  totalPages: number
}

const LIMIT = 50

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
  const [meta, setMeta] = useState<Meta>({ total: 0, page: 1, limit: LIMIT, totalPages: 1 })
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("")
  const [isLoading, setIsLoading] = useState(true)

  const fetchData = useCallback(
    async (params: { page: number; search: string; status: string }) => {
      setIsLoading(true)
      try {
        const sp = new URLSearchParams({
          limit: String(LIMIT),
          page: String(params.page),
          ...(params.search && { search: params.search }),
          ...(params.status && { status: params.status }),
        })
        const res = await fetch(`/api/products?${sp.toString()}`)
        if (!res.ok) throw new Error()
        const json = (await res.json()) as { data: ProductStock[]; meta: Meta }
        setProducts(json.data)
        setMeta(json.meta ?? { total: json.data.length, page: 1, limit: LIMIT, totalPages: 1 })
      } catch {
        toast.error("Error al cargar el inventario")
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

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

  const lowStock = products.filter((p) => getStockStatus(p) === "bajo-minimo").length
  const noStock = products.filter((p) => getStockStatus(p) === "sin-stock").length

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">Inventario</h1>
          {!isLoading && (
            <p className="text-sm text-muted-foreground mt-1">
              {meta.total} producto{meta.total !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        <Link href="/inventario/ajuste" className={buttonVariants()}>
          <PlusIcon className="w-4 h-4 mr-1.5" />
          Registrar ajuste
        </Link>
      </div>

      {/* KPIs */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-card rounded-2xl border border-border p-5 hover:shadow-sm transition-all">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Total productos</p>
            <p className="text-3xl font-black tracking-tight text-foreground">{meta.total}</p>
          </div>
          <div className={`bg-card rounded-2xl border p-5 hover:shadow-sm transition-all ${lowStock > 0 ? "border-amber-200" : "border-border"}`}>
            <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${lowStock > 0 ? "text-amber-600" : "text-muted-foreground"}`}>
              Bajo mínimo
            </p>
            <p className={`text-3xl font-black tracking-tight ${lowStock > 0 ? "text-amber-600" : "text-foreground"}`}>
              {lowStock}
            </p>
          </div>
          <div className={`bg-card rounded-2xl border p-5 hover:shadow-sm transition-all ${noStock > 0 ? "border-red-200" : "border-border"}`}>
            <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${noStock > 0 ? "text-red-600" : "text-muted-foreground"}`}>
              Sin stock
            </p>
            <p className={`text-3xl font-black tracking-tight ${noStock > 0 ? "text-red-600" : "text-foreground"}`}>
              {noStock}
            </p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSearch()
          }}
          placeholder="Buscar por nombre, código..."
          className="max-w-xs"
        />
        <Button variant="outline" onClick={handleSearch}>
          Buscar
        </Button>
        <select
          value={status}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="h-8 rounded-xl border border-input bg-background px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <option value="">Todos los estados</option>
          <option value="ACTIVE">Activo</option>
          <option value="INACTIVE">Inactivo</option>
        </select>
        <Link
          href="/productos"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Ir a Productos
        </Link>
      </div>

      {/* Tabla */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Código
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Producto
                </th>
                <th className="text-right px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Stock actual
                </th>
                <th className="text-right px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Stock mínimo
                </th>
                <th className="text-right px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Stock máximo
                </th>
                <th className="text-center px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Estado stock
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/60">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    {meta.total === 0
                      ? "No hay productos registrados"
                      : "Sin resultados para la búsqueda"}
                  </td>
                </tr>
              ) : (
                products.map((product) => {
                  const stockStatus = getStockStatus(product)
                  return (
                    <tr
                      key={product.id}
                      className="hover:bg-muted/30 transition-colors cursor-pointer border-b border-border/60 last:border-0"
                      onClick={() => {
                        window.location.href = `/productos/${product.id}`
                      }}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {product.internalCode ?? product.sku ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-foreground">{product.name}</td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-foreground">
                        {formatStock(product.totalStock)}
                        {product.unit && (
                          <span className="ml-1 text-muted-foreground text-xs">
                            {product.unit.abbreviation}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-muted-foreground">
                        {product.minStock != null ? formatStock(product.minStock) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-muted-foreground">
                        {product.maxStock != null ? formatStock(product.maxStock) : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {stockStatus === "sin-stock" && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-600 border border-red-100">
                            Sin stock
                          </span>
                        )}
                        {stockStatus === "bajo-minimo" && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-100">
                            Bajo mínimo
                          </span>
                        )}
                        {stockStatus === "ok" && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
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

        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20">
          <p className="text-xs text-muted-foreground">
            {meta.total} resultado{meta.total !== 1 ? "s" : ""} · Página {page} de{" "}
            {meta.totalPages}
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
