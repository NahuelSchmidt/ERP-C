"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { PlusIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { ProductTable } from "@/components/products/product-table"

interface ProductRow {
  id: string
  internalCode: string | null
  sku: string | null
  name: string
  status: string
  costPrice: number
  defaultMargin: number
  minStock: number | null
  trackStock: boolean
  totalStock: number
  isLowStock: boolean
  category: { id: string; name: string } | null
  unit: { id: string; name: string; abbreviation: string } | null
  stocks: { quantity: number; warehouse: { id: string; name: string } }[]
  images: { url: string }[]
}

interface Meta {
  total: number
  page: number
  limit: number
  totalPages: number
}

interface ProductListClientProps {
  initialProducts: ProductRow[]
  initialMeta: Meta
}

export function ProductListClient({ initialProducts, initialMeta }: ProductListClientProps) {
  const router = useRouter()
  const [products, setProducts] = useState<ProductRow[]>(initialProducts)
  const [meta, setMeta] = useState<Meta>(initialMeta)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchData = useCallback(async (params: { page: number; search: string }) => {
    setIsLoading(true)
    try {
      const sp = new URLSearchParams({
        page: String(params.page),
        limit: "20",
        ...(params.search && { search: params.search }),
      })
      const res = await fetch(`/api/products?${sp.toString()}`)
      if (!res.ok) throw new Error()
      const json = await res.json() as { data: ProductRow[]; meta: Meta }
      setProducts(json.data)
      setMeta(json.meta)
    } catch {
      toast.error("Error al cargar productos")
    } finally {
      setIsLoading(false)
    }
  }, [])

  function handleSearch() {
    setSearch(searchInput)
    setPage(1)
    void fetchData({ page: 1, search: searchInput })
  }

  function handlePageChange(newPage: number) {
    setPage(newPage)
    void fetchData({ page: newPage, search })
  }

  async function handleDelete(id: string) {
    const product = products.find((p) => p.id === id)
    if (!confirm(`¿Eliminar "${product?.name}"?`)) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" })
      if (!res.ok) { toast.error("No se pudo eliminar"); return }
      toast.success("Producto eliminado")
      void fetchData({ page, search })
    } catch {
      toast.error("Error de conexión")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Barra de herramientas */}
      <div className="flex items-center gap-3">
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Buscar por nombre, código, SKU..."
          className="max-w-sm"
          onKeyDown={(e) => { if (e.key === "Enter") handleSearch() }}
        />
        <Button onClick={handleSearch} variant="outline">Buscar</Button>
        <div className="ml-auto">
          <Link
            href="/productos/nuevo"
            className="inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-primary text-primary-foreground px-2.5 h-8 text-sm font-medium whitespace-nowrap transition-all"
          >
            <PlusIcon className="w-4 h-4 mr-1.5" />
            Nuevo producto
          </Link>
        </div>
      </div>

      {/* Tabla */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <ProductTable
          products={products}
          onDelete={(id) => void handleDelete(id)}
          isDeleting={deletingId}
        />
      )}

      {/* Paginación */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>
          {meta.total} producto{meta.total !== 1 ? "s" : ""} · Página {page} de {meta.totalPages}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(page - 1)}
            disabled={page <= 1 || isLoading}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= meta.totalPages || isLoading}
          >
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  )
}
