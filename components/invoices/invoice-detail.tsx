/**
 * components/invoices/invoice-detail.tsx
 *
 * Vista de un comprobante con aspecto de documento impreso AFIP.
 * Incluye header de empresa, datos del cliente, número de comprobante
 * al centro (estilo AFIP), tabla de ítems y pie de totales.
 *
 * Es un Server Component — recibe los datos ya resueltos.
 */

import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge"
import { VOUCHER_TYPE_LABELS } from "@/lib/validations/invoice"
import type { VoucherType, InvoiceStatus } from "@/lib/validations/invoice"

// ---------------------------------------------------------------------------
// Types (subconjunto del modelo para no depender de Prisma directamente)
// ---------------------------------------------------------------------------

interface TaxRate {
  id: string
  name: string
  rate: string | number
}

interface InvoiceItemDetail {
  id: string
  description: string
  quantity: string | number
  unitPrice: string | number
  discountPercent: string | number
  discountAmount: string | number
  taxPercent: string | number
  taxAmount: string | number
  subtotal: string | number
  total: string | number
  order: number
  product?: { id: string; name: string; internalCode?: string | null } | null
  taxRate?: TaxRate | null
}

interface InvoiceTaxDetail {
  id: string
  taxRateId: string
  base: string | number
  amount: string | number
  taxRate: TaxRate
}

interface CustomerDetail {
  id: string
  companyName?: string | null
  firstName?: string | null
  lastName?: string | null
  documentType: string
  documentNumber?: string | null
  vatCondition: string
  email?: string | null
  phone?: string | null
  addresses?: { street: string; number?: string | null; city?: string | null; state?: string | null }[]
}

interface PointOfSaleDetail {
  number: number
  name: string
  address?: string | null
  branch?: { name: string; address?: string | null; city?: string | null } | null
}

interface TenantConfigSnapshot {
  companyName: string
  documentNumber?: string | null
  vatCondition?: string | null
  address?: string | null
  city?: string | null
  phone?: string | null
  email?: string | null
  logoUrl?: string | null
}

interface InvoiceDetailData {
  id: string
  fullNumber: string
  voucherType: VoucherType
  number: number
  date: Date | string
  dueDate?: Date | string | null
  status: InvoiceStatus
  currency: string
  subtotal: string | number
  discountPercent: string | number
  discountAmount: string | number
  taxableBase: string | number
  taxAmount: string | number
  total: string | number
  paidAmount: string | number
  cae?: string | null
  caeExpiry?: Date | string | null
  notes?: string | null
  items: InvoiceItemDetail[]
  taxes: InvoiceTaxDetail[]
  customer?: CustomerDetail | null
  customerSnapshot?: Record<string, unknown> | null
  pointOfSale: PointOfSaleDetail
  paymentCondition?: { name: string; days: number } | null
}

interface InvoiceDetailProps {
  invoice: InvoiceDetailData
  tenantConfig?: TenantConfigSnapshot | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(value: string | number, currency = "ARS"): string {
  const n = typeof value === "string" ? parseFloat(value) : value
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(n)
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "-"
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date))
}

function formatPercent(value: string | number): string {
  const n = typeof value === "string" ? parseFloat(value) : value
  return `${(n * 100).toFixed(0)}%`
}

function getCustomerName(customer: CustomerDetail | null | undefined): string {
  if (!customer) return "Consumidor Final"
  if (customer.companyName) return customer.companyName
  return [customer.firstName, customer.lastName].filter(Boolean).join(" ") || "Sin nombre"
}

const VAT_CONDITION_LABELS: Record<string, string> = {
  RESPONSABLE_INSCRIPTO: "Responsable Inscripto",
  MONOTRIBUTISTA: "Monotributista",
  CONSUMIDOR_FINAL: "Consumidor Final",
  EXENTO: "Exento",
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  CUIT: "CUIT",
  CUIL: "CUIL",
  DNI: "DNI",
  PASSPORT: "Pasaporte",
  OTHER: "Documento",
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InvoiceDetail({ invoice, tenantConfig }: InvoiceDetailProps) {
  const posNumber = invoice.pointOfSale.number.toString().padStart(4, "0")
  const docNumber =
    invoice.status === "DRAFT"
      ? "BORRADOR"
      : invoice.number.toString().padStart(8, "0")

  const customerData =
    (invoice.customerSnapshot as CustomerDetail | null) ?? invoice.customer

  return (
    <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden max-w-4xl mx-auto print:shadow-none print:border-none">
      {/* Estado badge — solo en pantalla */}
      <div className="flex justify-end px-6 pt-4 print:hidden">
        <InvoiceStatusBadge status={invoice.status} />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Header: Empresa | Tipo de comprobante | Número                      */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-3 border-b border-gray-300 print:border-black">
        {/* Datos de la empresa */}
        <div className="col-span-1 p-6 border-r border-gray-300 print:border-black">
          {tenantConfig?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenantConfig.logoUrl}
              alt="Logo empresa"
              className="h-12 w-auto object-contain mb-3"
            />
          ) : (
            <div className="h-12 w-12 rounded bg-blue-600 flex items-center justify-center mb-3">
              <span className="text-white font-bold text-lg">
                {(tenantConfig?.companyName ?? "E")[0]}
              </span>
            </div>
          )}
          <p className="font-bold text-sm text-gray-900">{tenantConfig?.companyName ?? "Empresa"}</p>
          {tenantConfig?.documentNumber && (
            <p className="text-xs text-gray-600 mt-0.5">CUIT: {tenantConfig.documentNumber}</p>
          )}
          {tenantConfig?.vatCondition && (
            <p className="text-xs text-gray-600">
              {VAT_CONDITION_LABELS[tenantConfig.vatCondition] ?? tenantConfig.vatCondition}
            </p>
          )}
          {tenantConfig?.address && (
            <p className="text-xs text-gray-500 mt-1">{tenantConfig.address}</p>
          )}
          {tenantConfig?.city && (
            <p className="text-xs text-gray-500">{tenantConfig.city}</p>
          )}
          {(tenantConfig?.phone || tenantConfig?.email) && (
            <p className="text-xs text-gray-500 mt-1">
              {[tenantConfig.phone, tenantConfig.email].filter(Boolean).join(" | ")}
            </p>
          )}
        </div>

        {/* Tipo de comprobante — centro */}
        <div className="col-span-1 p-6 flex flex-col items-center justify-center border-r border-gray-300 print:border-black">
          <p className="text-4xl font-black text-gray-800 border-4 border-gray-800 w-14 h-14 flex items-center justify-center rounded">
            {invoice.voucherType.includes("_A") ? "A" :
             invoice.voucherType.includes("_B") ? "B" :
             invoice.voucherType.includes("_C") ? "C" :
             invoice.voucherType === "REMITO" ? "R" :
             invoice.voucherType === "PRESUPUESTO" ? "P" :
             invoice.voucherType === "RECIBO" ? "X" :
             invoice.voucherType === "ORDEN_COMPRA" ? "O" : "-"}
          </p>
          <p className="text-sm font-semibold text-gray-700 mt-2 text-center">
            {VOUCHER_TYPE_LABELS[invoice.voucherType]}
          </p>
          <p className="text-xs text-gray-500 mt-1">Cod. {invoice.pointOfSale.number}</p>
        </div>

        {/* Número de comprobante */}
        <div className="col-span-1 p-6">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Comprobante N°
          </p>
          <p className="text-2xl font-bold text-gray-900 mt-1 font-mono">
            {posNumber}-{docNumber}
          </p>
          <div className="mt-3 space-y-1">
            <div className="flex gap-2 text-xs">
              <span className="text-gray-500 w-20">Fecha:</span>
              <span className="font-medium text-gray-900">{formatDate(invoice.date)}</span>
            </div>
            {invoice.dueDate && (
              <div className="flex gap-2 text-xs">
                <span className="text-gray-500 w-20">Vencimiento:</span>
                <span className="font-medium text-gray-900">{formatDate(invoice.dueDate)}</span>
              </div>
            )}
            {invoice.paymentCondition && (
              <div className="flex gap-2 text-xs">
                <span className="text-gray-500 w-20">Condición:</span>
                <span className="font-medium text-gray-900">{invoice.paymentCondition.name}</span>
              </div>
            )}
            {invoice.cae && (
              <div className="mt-2 pt-2 border-t border-gray-200">
                <p className="text-xs text-gray-500">CAE: <span className="font-mono font-medium text-gray-900">{invoice.cae}</span></p>
                {invoice.caeExpiry && (
                  <p className="text-xs text-gray-500">Vto CAE: {formatDate(invoice.caeExpiry)}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Datos del cliente                                                    */}
      {/* ------------------------------------------------------------------ */}
      <div className="p-6 border-b border-gray-200 bg-gray-50">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Receptor
            </p>
            <p className="font-semibold text-gray-900 text-sm">
              {getCustomerName(customerData as CustomerDetail)}
            </p>
            {customerData?.documentNumber && (
              <p className="text-sm text-gray-600">
                {DOCUMENT_TYPE_LABELS[customerData.documentType] ?? "Doc"}: {customerData.documentNumber}
              </p>
            )}
            {customerData?.vatCondition && (
              <p className="text-sm text-gray-600">
                {VAT_CONDITION_LABELS[customerData.vatCondition] ?? customerData.vatCondition}
              </p>
            )}
          </div>
          <div>
            {customerData?.email && (
              <p className="text-sm text-gray-600">{customerData.email}</p>
            )}
            {customerData?.phone && (
              <p className="text-sm text-gray-600">{customerData.phone}</p>
            )}
            {(customerData as CustomerDetail)?.addresses?.[0] && (
              <p className="text-sm text-gray-600">
                {(customerData as CustomerDetail).addresses![0].street}
                {(customerData as CustomerDetail).addresses![0].number
                  ? ` ${(customerData as CustomerDetail).addresses![0].number}`
                  : ""}
                {(customerData as CustomerDetail).addresses![0].city
                  ? `, ${(customerData as CustomerDetail).addresses![0].city}`
                  : ""}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Tabla de ítems                                                       */}
      {/* ------------------------------------------------------------------ */}
      <div className="p-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-gray-300">
              <th className="text-left py-2 pr-3 text-xs font-semibold text-gray-500 uppercase">
                Descripción
              </th>
              <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase w-20">
                Cant.
              </th>
              <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase w-28">
                P. Unit.
              </th>
              <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase w-24">
                Desc.
              </th>
              <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase w-20">
                IVA
              </th>
              <th className="text-right py-2 pl-3 text-xs font-semibold text-gray-500 uppercase w-28">
                Subtotal
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {invoice.items
              .sort((a, b) => a.order - b.order)
              .map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="py-2.5 pr-3">
                    <p className="font-medium text-gray-900">{item.description}</p>
                    {item.product?.internalCode && (
                      <p className="text-xs text-gray-400">Cód: {item.product.internalCode}</p>
                    )}
                  </td>
                  <td className="text-right py-2.5 px-3 text-gray-700 font-mono">
                    {Number(item.quantity).toFixed(2)}
                  </td>
                  <td className="text-right py-2.5 px-3 text-gray-700 font-mono">
                    {formatCurrency(item.unitPrice, invoice.currency)}
                  </td>
                  <td className="text-right py-2.5 px-3 text-gray-500 font-mono">
                    {Number(item.discountPercent) > 0
                      ? `${(Number(item.discountPercent) * 100).toFixed(0)}%`
                      : "-"}
                  </td>
                  <td className="text-right py-2.5 px-3 text-gray-500 font-mono">
                    {Number(item.taxPercent) > 0
                      ? `${(Number(item.taxPercent) * 100).toFixed(0)}%`
                      : "-"}
                  </td>
                  <td className="text-right py-2.5 pl-3 font-medium text-gray-900 font-mono">
                    {formatCurrency(item.subtotal, invoice.currency)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Pie: totales                                                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="border-t border-gray-200 px-6 py-4">
        <div className="flex justify-end">
          <div className="w-64 space-y-1.5">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal neto</span>
              <span className="font-mono">{formatCurrency(invoice.subtotal, invoice.currency)}</span>
            </div>

            {Number(invoice.discountAmount) > 0 && (
              <div className="flex justify-between text-sm text-gray-600">
                <span>Descuento ({formatPercent(invoice.discountPercent)})</span>
                <span className="font-mono text-red-600">
                  -{formatCurrency(invoice.discountAmount, invoice.currency)}
                </span>
              </div>
            )}

            {Number(invoice.discountAmount) > 0 && (
              <div className="flex justify-between text-sm text-gray-600">
                <span>Base gravada</span>
                <span className="font-mono">{formatCurrency(invoice.taxableBase, invoice.currency)}</span>
              </div>
            )}

            {invoice.taxes.map((tax) => (
              <div key={tax.id} className="flex justify-between text-sm text-gray-600">
                <span>{tax.taxRate.name}</span>
                <span className="font-mono">{formatCurrency(tax.amount, invoice.currency)}</span>
              </div>
            ))}

            <div className="border-t border-gray-300 pt-2 mt-2">
              <div className="flex justify-between text-base font-bold text-gray-900">
                <span>TOTAL {invoice.currency}</span>
                <span className="font-mono text-lg">
                  {formatCurrency(invoice.total, invoice.currency)}
                </span>
              </div>
            </div>

            {Number(invoice.paidAmount) > 0 && (
              <>
                <div className="flex justify-between text-sm text-green-600">
                  <span>Pagado</span>
                  <span className="font-mono">{formatCurrency(invoice.paidAmount, invoice.currency)}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold text-gray-700">
                  <span>Saldo pendiente</span>
                  <span className="font-mono">
                    {formatCurrency(
                      Number(invoice.total) - Number(invoice.paidAmount),
                      invoice.currency
                    )}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Notas */}
      {invoice.notes && (
        <div className="border-t border-gray-200 px-6 py-4">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Observaciones</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{invoice.notes}</p>
        </div>
      )}

      {/* Pie de firma */}
      <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-xs text-gray-400">
              {invoice.pointOfSale.branch?.name ?? invoice.pointOfSale.name}
              {invoice.pointOfSale.branch?.city ? ` — ${invoice.pointOfSale.branch.city}` : ""}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">Documento no válido como factura</p>
            {invoice.status !== "ISSUED" && invoice.status !== "PAID" && (
              <p className="text-xs font-semibold text-red-500">
                {invoice.status === "DRAFT"
                  ? "BORRADOR — No emitido"
                  : invoice.status === "CANCELLED"
                  ? "ANULADO"
                  : ""}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
