import { notFound } from "next/navigation"
import Link from "next/link"
import { ChevronLeftIcon } from "lucide-react"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"
import { SupplierForm } from "@/components/suppliers/supplier-form"
import type { Supplier } from "@/lib/types/entities"

interface PaymentCondition {
  id: string
  name: string
  days: number
  isDefault: boolean
}

export default async function EditarProveedorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const db = await getTenantDb()
  const { tenantId } = await getTenantContext()

  const [supplier, paymentConditions] = await Promise.all([
    db.supplier.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { paymentCondition: { select: { id: true, name: true } } },
    }),
    db.paymentCondition.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: "asc" },
    }),
  ])

  if (!supplier) notFound()

  const serializedSupplier = JSON.parse(JSON.stringify(supplier)) as Supplier
  const serializedPaymentConditions = JSON.parse(JSON.stringify(paymentConditions)) as PaymentCondition[]

  function getDisplayName(s: typeof serializedSupplier) {
    if (s.type === "COMPANY") return s.companyName ?? "Proveedor"
    return [s.firstName, s.lastName].filter(Boolean).join(" ") || "Proveedor"
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link
          href="/proveedores"
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ChevronLeftIcon className="w-4 h-4" />
          Proveedores
        </Link>
        <span className="text-gray-300">/</span>
        <Link
          href={`/proveedores/${id}`}
          className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          {getDisplayName(serializedSupplier)}
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm text-gray-900 font-medium">Editar</span>
      </div>

      <h1 className="text-2xl font-bold text-gray-900">Editar proveedor</h1>

      <SupplierForm supplier={serializedSupplier} paymentConditions={serializedPaymentConditions} />
    </div>
  )
}
