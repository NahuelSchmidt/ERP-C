import Link from "next/link"
import { PlusIcon } from "lucide-react"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"
import { CustomerTable } from "@/components/customers/customer-table"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Customer, PaginatedMeta } from "@/lib/types/entities"

export default async function ClientesPage() {
  const db = await getTenantDb()
  const { tenantId } = await getTenantContext()

  const pageSize = 20

  const [total, customers] = await Promise.all([
    db.customer.count({ where: { tenantId, deletedAt: null } }),
    db.customer.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        category: { select: { id: true, name: true, color: true } },
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

  const serialized = JSON.parse(JSON.stringify(customers)) as Customer[]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {total} cliente{total !== 1 ? "s" : ""} registrado{total !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/clientes/nuevo" className={cn(buttonVariants())}>
          <PlusIcon className="w-4 h-4 mr-1.5" />
          Nuevo cliente
        </Link>
      </div>

      <CustomerTable initialData={serialized} initialMeta={meta} />
    </div>
  )
}
