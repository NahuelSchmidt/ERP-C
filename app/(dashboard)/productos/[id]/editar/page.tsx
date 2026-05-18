import { notFound } from "next/navigation"
import Link from "next/link"
import { ChevronLeftIcon } from "lucide-react"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"
import { ProductForm } from "@/components/products/product-form"
import type { CreateProductInput } from "@/lib/validations/product"

export default async function EditarProductoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const db = await getTenantDb()
  const { tenantId } = await getTenantContext()

  const [product, categories, units] = await Promise.all([
    db.product.findFirst({
      where: { id, tenantId, deletedAt: null },
    }),
    db.productCategory.findMany({
      where: { tenantId, deletedAt: null, isActive: true },
      orderBy: { name: "asc" },
    }),
    db.unitOfMeasure.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: "asc" },
    }),
  ])

  if (!product) notFound()

  const defaultValues: Partial<CreateProductInput> = {
    name: product.name,
    categoryId: product.categoryId ?? undefined,
    unitId: product.unitId ?? undefined,
    internalCode: product.internalCode ?? undefined,
    barcode: product.barcode ?? undefined,
    sku: product.sku ?? undefined,
    description: product.description ?? undefined,
    trackStock: product.trackStock,
    trackBatches: product.trackBatches,
    trackSerials: product.trackSerials,
    allowNegative: product.allowNegative,
    minStock: product.minStock != null ? Number(product.minStock) : undefined,
    maxStock: product.maxStock != null ? Number(product.maxStock) : undefined,
    reorderPoint: product.reorderPoint != null ? Number(product.reorderPoint) : undefined,
    costPrice: Number(product.costPrice),
    defaultMargin: Number(product.defaultMargin),
    weight: product.weight != null ? Number(product.weight) : undefined,
    weightUnit: (product.weightUnit ?? "kg") as CreateProductInput["weightUnit"],
    status: product.status as CreateProductInput["status"],
    notes: product.notes ?? undefined,
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
        <Link
          href={`/productos/${id}`}
          className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          {product.name}
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm text-gray-900 font-medium">Editar</span>
      </div>

      <h1 className="text-2xl font-bold text-gray-900">Editar producto</h1>

      <ProductForm
        productId={id}
        defaultValues={defaultValues}
        categories={JSON.parse(JSON.stringify(categories))}
        units={JSON.parse(JSON.stringify(units))}
      />
    </div>
  )
}
