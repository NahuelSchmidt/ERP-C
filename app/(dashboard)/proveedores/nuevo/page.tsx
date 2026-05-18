import Link from "next/link"
import { ChevronLeftIcon } from "lucide-react"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"
import { SupplierForm } from "@/components/suppliers/supplier-form"

interface PaymentCondition {
  id: string
  name: string
  days: number
  isDefault: boolean
}

export default async function NuevoProveedorPage() {
  const db = await getTenantDb()
  const { tenantId } = await getTenantContext()

  const paymentConditions = await db.paymentCondition.findMany({
    where: { tenantId, isActive: true },
    orderBy: { name: "asc" },
  })

  const serialized = JSON.parse(JSON.stringify(paymentConditions)) as PaymentCondition[]

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
        <span className="text-sm text-gray-900 font-medium">Nuevo proveedor</span>
      </div>

      <h1 className="text-2xl font-bold text-gray-900">Nuevo proveedor</h1>

      <SupplierForm paymentConditions={serialized} />
    </div>
  )
}
