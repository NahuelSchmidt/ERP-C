"use client"

/**
 * components/customers/customer-table.tsx
 *
 * Tabla de clientes con TanStack Table — paginación, búsqueda, filtros,
 * ordenamiento y acciones de fila.
 */

import { useState, useCallback } from "react"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from "@tanstack/react-table"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ChevronUpIcon,
  ChevronDownIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { VAT_CONDITION_LABELS } from "@/lib/validations/customer"
import type { Customer, PaginatedMeta } from "@/lib/types/entities"

interface CustomerTableProps {
  initialData: Customer[]
  initialMeta: PaginatedMeta
}

const columnHelper = createColumnHelper<Customer>()

function getDisplayName(customer: Customer): string {
  if (customer.type === "COMPANY") return customer.companyName ?? "-"
  const parts = [customer.firstName, customer.lastName].filter(Boolean)
  return parts.join(" ") || "-"
}

function formatBalance(balance: string): string {
  const n = parseFloat(balance)
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n)
}

export function CustomerTable({ initialData, initialMeta }: CustomerTableProps) {
  const router = useRouter()

  const [data, setData] = useState<Customer[]>(initialData)
  const [meta, setMeta] = useState<PaginatedMeta>(initialMeta)
  const [page, setPage] = useState(initialMeta.page)
  const [search, setSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [sorting, setSorting] = useState<SortingState>([])

  const fetchData = useCallback(async (params: { page: number; search: string }) => {
    setIsLoading(true)
    try {
      const sp = new URLSearchParams({
        page: String(params.page),
        pageSize: "20",
        ...(params.search && { search: params.search }),
      })
      const res = await fetch(`/api/customers?${sp.toString()}`)
      if (!res.ok) throw new Error("Error fetching customers")
      const json = await res.json() as { data: Customer[]; meta: PaginatedMeta }
      setData(json.data)
      setMeta(json.meta)
    } catch {
      toast.error("Error al cargar clientes")
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

  async function handleDelete(customer: Customer) {
    if (!confirm(`¿Eliminar al cliente "${getDisplayName(customer)}"?`)) return
    try {
      const res = await fetch(`/api/customers/${customer.id}`, { method: "DELETE" })
      if (!res.ok) {
        toast.error("No se pudo eliminar el cliente")
        return
      }
      toast.success("Cliente eliminado")
      void fetchData({ page, search })
    } catch {
      toast.error("Error de conexión")
    }
  }

  const columns = [
    columnHelper.accessor(getDisplayName, {
      id: "name",
      header: "Nombre / Razón social",
      cell: ({ row }) => {
        const name = getDisplayName(row.original)
        const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
        return (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
              <span className="text-[11px] font-bold text-foreground">{initials}</span>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{name}</p>
              {row.original.category && (
                <p className="text-xs text-muted-foreground">{row.original.category.name}</p>
              )}
            </div>
          </div>
        )
      },
    }),
    columnHelper.accessor("documentNumber", {
      header: "CUIT / DNI",
      cell: ({ getValue }) => (
        <span className="font-mono text-sm text-foreground">{getValue() ?? "-"}</span>
      ),
    }),
    columnHelper.accessor("vatCondition", {
      header: "Condición IVA",
      cell: ({ getValue }) => {
        const val = getValue()
        return (
          <span className="text-sm text-muted-foreground">
            {VAT_CONDITION_LABELS[val as keyof typeof VAT_CONDITION_LABELS] ?? val}
          </span>
        )
      },
    }),
    columnHelper.accessor("phone", {
      header: "Teléfono",
      cell: ({ getValue }) => <span className="text-sm text-muted-foreground">{getValue() ?? "-"}</span>,
    }),
    columnHelper.accessor("currentBalance", {
      header: "Saldo CC",
      cell: ({ getValue }) => {
        const balance = parseFloat(getValue())
        return (
          <span
            className={`text-sm font-medium ${
              balance > 0 ? "text-red-600" : balance < 0 ? "text-emerald-600" : "text-muted-foreground"
            }`}
          >
            {formatBalance(getValue())}
          </span>
        )
      },
    }),
    columnHelper.accessor("isActive", {
      header: "Estado",
      cell: ({ getValue }) => (
        getValue()
          ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">Activo</span>
          : <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-secondary text-muted-foreground">Inactivo</span>
      ),
    }),
    columnHelper.display({
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex items-center gap-1 justify-end">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => router.push(`/clientes/${row.original.id}`)}
            title="Ver detalle"
          >
            <EyeIcon className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => router.push(`/clientes/${row.original.id}/editar`)}
            title="Editar"
          >
            <PencilIcon className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => void handleDelete(row.original)}
            title="Eliminar"
            className="text-red-400 hover:text-red-600 hover:bg-red-50"
          >
            <TrashIcon className="w-3.5 h-3.5" />
          </Button>
        </div>
      ),
    }),
  ]

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    pageCount: meta.totalPages,
  })

  return (
    <div className="space-y-4">
      {/* Barra de búsqueda */}
      <div className="flex gap-3">
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Buscar por nombre, CUIT, email..."
          className="max-w-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSearch()
          }}
        />
        <Button onClick={handleSearch} variant="outline">
          Buscar
        </Button>
      </div>

      {/* Tabla */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider"
                    >
                      {header.isPlaceholder ? null : (
                        <button
                          className={`flex items-center gap-1 ${
                            header.column.getCanSort() ? "cursor-pointer hover:text-foreground" : ""
                          }`}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getIsSorted() === "asc" && (
                            <ChevronUpIcon className="w-3 h-3" />
                          )}
                          {header.column.getIsSorted() === "desc" && (
                            <ChevronDownIcon className="w-3 h-3" />
                          )}
                        </button>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/60">
                    {columns.map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    No se encontraron clientes
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-muted/30 transition-colors cursor-pointer border-b border-border/60 last:border-0"
                    onClick={() => router.push(`/clientes/${row.original.id}`)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="px-4 py-3"
                        onClick={
                          cell.column.id === "actions"
                            ? (e) => e.stopPropagation()
                            : undefined
                        }
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20">
          <p className="text-xs text-muted-foreground">
            {meta.total} resultado{meta.total !== 1 ? "s" : ""} •{" "}
            Página {page} de {meta.totalPages}
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
