import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"
import { ProductListClient } from "@/components/products/product-list-client"

export default async function ProductosPage() {
  const db = await getTenantDb()
  const { tenantId } = await getTenantContext()

  const limit = 20

  const products = await db.product.findMany({
    where: { tenantId, deletedAt: null },
    include: {
      category: { select: { id: true, name: true } },
      unit: { select: { id: true, name: true, abbreviation: true } },
      stocks: {
        select: {
          quantity: true,
          warehouse: { select: { id: true, name: true } },
        },
      },
      images: {
        where: { isPrimary: true },
        select: { url: true },
        take: 1,
      },
    },
    orderBy: { name: "asc" },
    take: limit,
  })

  const total = await db.product.count({ where: { tenantId, deletedAt: null } })

  const enriched = products.map((p) => {
    const totalStock = p.stocks.reduce((acc, s) => acc + Number(s.quantity), 0)
    const isLowStock =
      p.trackStock && p.minStock != null && totalStock < Number(p.minStock)
    return {
      ...p,
      costPrice: Number(p.costPrice),
      defaultMargin: Number(p.defaultMargin),
      minStock: p.minStock != null ? Number(p.minStock) : null,
      stocks: p.stocks.map((s) => ({ ...s, quantity: Number(s.quantity) })),
      totalStock,
      isLowStock,
    }
  })

  const serialized = JSON.parse(JSON.stringify(enriched))

  const meta = {
    total,
    page: 1,
    limit,
    totalPages: Math.ceil(total / limit),
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Productos</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {total} producto{total !== 1 ? "s" : ""} registrado{total !== 1 ? "s" : ""}
        </p>
      </div>

      <ProductListClient initialProducts={serialized} initialMeta={meta} />
    </div>
  )
}
