import Link from "next/link"
import { PlusIcon } from "lucide-react"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"
import { SupplierTable } from "@/components/suppliers/supplier-table"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Supplier, PaginatedMeta } from "@/lib/types/entities"

export default async function ProveedoresPage() {
  const db = await getTenantDb()
  const { tenantId } = await getTenantContext()

  const pageSize = 20

  const [total, suppliers] = await Promise.all([
    db.supplier.count({ where: { tenantId, deletedAt: null } }),
    db.supplier.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        paymentCondition: { select: { id: true, name: true } },
        addresses: { where: { isDefault: true }, take: 1 },
      },
      orderBy: [{ companyName: "asc" }, { lastName: "asc" }],
      take: pageSize,
    }),
  ])

  const meta: PaginatedMeta = {
    total,
    page: 1,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }

  const serialized = JSON.parse(JSON.stringify(suppliers)) as Supplier[]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Proveedores</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {total} proveedor{total !== 1 ? "es" : ""} registrado{total !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/proveedores/nuevo" className={cn(buttonVariants())}>
          <PlusIcon className="w-4 h-4 mr-1.5" />
          Nuevo proveedor
        </Link>
      </div>

      <SupplierTable initialData={serialized} initialMeta={meta} />
    </div>
  )
}
