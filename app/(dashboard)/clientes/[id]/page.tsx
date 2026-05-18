import { notFound } from "next/navigation"
import Link from "next/link"
import { ChevronLeftIcon } from "lucide-react"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"
import { CustomerDetailClient } from "@/components/customers/customer-detail-client"
import type { Customer } from "@/lib/types/entities"

export default async function ClienteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const db = await getTenantDb()
  const { tenantId } = await getTenantContext()

  const customer = await db.customer.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: {
      category: { select: { id: true, name: true, color: true } },
      priceList: { select: { id: true, name: true } },
      addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] },
      contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
    },
  })

  if (!customer) notFound()

  const serialized = JSON.parse(JSON.stringify(customer)) as Customer

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-3 mb-5">
        <Link
          href="/clientes"
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ChevronLeftIcon className="w-4 h-4" />
          Clientes
        </Link>
      </div>

      <CustomerDetailClient customer={serialized} />
    </div>
  )
}
