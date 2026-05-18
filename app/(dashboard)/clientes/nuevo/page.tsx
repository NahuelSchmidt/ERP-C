import Link from "next/link"
import { ChevronLeftIcon } from "lucide-react"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"
import { CustomerForm } from "@/components/customers/customer-form"
import type { CustomerCategory } from "@/lib/types/entities"

export default async function NuevoClientePage() {
  const db = await getTenantDb()
  const { tenantId } = await getTenantContext()

  const categories = await db.customerCategory.findMany({
    where: { tenantId, isActive: true },
    orderBy: { name: "asc" },
  })

  const serialized = JSON.parse(JSON.stringify(categories)) as CustomerCategory[]

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link
          href="/clientes"
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ChevronLeftIcon className="w-4 h-4" />
          Clientes
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm text-gray-900 font-medium">Nuevo cliente</span>
      </div>

      <h1 className="text-2xl font-bold text-gray-900">Nuevo cliente</h1>

      <CustomerForm categories={serialized} />
    </div>
  )
}
