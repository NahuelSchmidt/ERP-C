import Link from "next/link"
import { ChevronLeftIcon } from "lucide-react"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"
import { ProductForm } from "@/components/products/product-form"

export default async function NuevoProductoPage() {
  const db = await getTenantDb()
  const { tenantId } = await getTenantContext()

  const [categories, units] = await Promise.all([
    db.productCategory.findMany({
      where: { tenantId, deletedAt: null, isActive: true },
      orderBy: { name: "asc" },
    }),
    db.unitOfMeasure.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: "asc" },
    }),
  ])

  const serialized = {
    categories: JSON.parse(JSON.stringify(categories)),
    units: JSON.parse(JSON.stringify(units)),
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link
          href="/productos"
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ChevronLeftIcon className="w-4 h-4" />
          Productos
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm text-gray-900 font-medium">Nuevo producto</span>
      </div>

      <h1 className="text-2xl font-bold text-gray-900">Nuevo producto</h1>

      <ProductForm categories={serialized.categories} units={serialized.units} />
    </div>
  )
}
