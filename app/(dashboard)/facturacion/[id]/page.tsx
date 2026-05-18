import { notFound } from "next/navigation"
import Link from "next/link"
import { ChevronLeftIcon } from "lucide-react"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"
import { InvoiceDetail } from "@/components/invoices/invoice-detail"
import { InvoicePrintButton } from "@/components/invoices/invoice-print-button"

export default async function FacturaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const db = await getTenantDb()
  const { tenantId } = await getTenantContext()

  const invoice = await db.invoice.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: {
      customer: true,
      pointOfSale: {
        include: {
          branch: { select: { name: true, address: true, city: true } },
        },
      },
      paymentCondition: { select: { id: true, name: true, days: true } },
      items: {
        include: {
          product: { select: { id: true, name: true, internalCode: true } },
          taxRate: { select: { id: true, name: true, rate: true } },
        },
        orderBy: { order: "asc" },
      },
      taxes: {
        include: {
          taxRate: { select: { id: true, name: true, rate: true } },
        },
      },
    },
  })

  if (!invoice) notFound()

  // Fetch tenant config for the invoice header
  const tenantConfig = await db.tenantConfig.findFirst()

  const serializedInvoice = JSON.parse(JSON.stringify(invoice))
  const serializedConfig = tenantConfig ? JSON.parse(JSON.stringify(tenantConfig)) : null

  return (
    <div className="space-y-4">
      {/* Nav */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/facturacion"
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ChevronLeftIcon className="w-4 h-4" />
            Facturación
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-medium text-gray-900 font-mono">
            {invoice.fullNumber}
          </span>
        </div>
        <InvoicePrintButton />
      </div>

      <InvoiceDetail invoice={serializedInvoice} tenantConfig={serializedConfig} />
    </div>
  )
}
