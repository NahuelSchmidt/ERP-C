import { notFound } from "next/navigation"
import Link from "next/link"
import { ChevronLeftIcon } from "lucide-react"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"
import { CustomerForm } from "@/components/customers/customer-form"
import type { Customer, CustomerCategory } from "@/lib/types/entities"

export default async function EditarClientePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const db = await getTenantDb()
  const { tenantId } = await getTenantContext()

  const [customer, categories] = await Promise.all([
    db.customer.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { category: { select: { id: true, name: true, color: true } } },
    }),
    db.customerCategory.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: "asc" },
    }),
  ])

  if (!customer) notFound()

  const serializedCustomer = JSON.parse(JSON.stringify(customer)) as Customer
  const serializedCategories = JSON.parse(JSON.stringify(categories)) as CustomerCategory[]

  function getDisplayName(c: typeof serializedCustomer) {
    if (c.type === "COMPANY") return c.companyName ?? "Cliente"
    return [c.firstName, c.lastName].filter(Boolean).join(" ") || "Cliente"
  }

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
        <Link
          href={`/clientes/${id}`}
          className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          {getDisplayName(serializedCustomer)}
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm text-gray-900 font-medium">Editar</span>
      </div>

      <h1 className="text-2xl font-bold text-gray-900">Editar cliente</h1>

      <CustomerForm customer={serializedCustomer} categories={serializedCategories} />
    </div>
  )
}
