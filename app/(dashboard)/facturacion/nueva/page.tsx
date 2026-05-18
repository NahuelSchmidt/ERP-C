import Link from "next/link"
import { ChevronLeftIcon } from "lucide-react"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"
import { InvoiceForm } from "@/components/invoices/invoice-form"

export default async function NuevaFacturaPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>
}) {
  const { customerId } = await searchParams
  const db = await getTenantDb()
  const { tenantId } = await getTenantContext()

  const [pointsOfSaleRaw, paymentConditionsRaw, taxRatesRaw, customersRaw] = await Promise.all([
    db.pointOfSale.findMany({
      where: { tenantId, isActive: true },
      orderBy: { number: "asc" },
      select: { id: true, number: true, name: true },
    }),
    db.paymentCondition.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, days: true },
    }),
    db.taxRate.findMany({
      where: { tenantId, isActive: true },
      orderBy: { rate: "asc" },
      select: { id: true, name: true, rate: true },
    }),
    db.customer.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, companyName: true, firstName: true, lastName: true },
      orderBy: [{ companyName: "asc" }, { lastName: "asc" }],
      take: 300,
    }),
  ])

  const taxRates = taxRatesRaw.map((t) => ({ ...t, rate: Number(t.rate) }))
  const customers = JSON.parse(JSON.stringify(customersRaw)) as typeof customersRaw

  return (
    <div className="space-y-5">
      <Link
        href="/facturacion"
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 transition-colors w-fit"
      >
        <ChevronLeftIcon className="w-4 h-4" />
        Facturación
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nuevo comprobante</h1>
        <p className="text-sm text-gray-500 mt-0.5">Se guardará como borrador</p>
      </div>

      <InvoiceForm
        pointsOfSale={pointsOfSaleRaw}
        paymentConditions={paymentConditionsRaw}
        taxRates={taxRates}
        customers={customers}
        defaultCustomerId={customerId}
      />
    </div>
  )
}
