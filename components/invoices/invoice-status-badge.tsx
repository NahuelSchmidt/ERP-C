/**
 * components/invoices/invoice-status-badge.tsx
 *
 * Badge de estado de comprobante con colores semánticos.
 * Server/Client compatible — no usa hooks, es un componente puro.
 */

import { cn } from "@/lib/utils"
import type { InvoiceStatus } from "@/lib/validations/invoice"
import { INVOICE_STATUS_LABELS } from "@/lib/validations/invoice"

interface InvoiceStatusBadgeProps {
  status: InvoiceStatus
  className?: string
}

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-700 ring-gray-200",
  ISSUED: "bg-blue-50 text-blue-700 ring-blue-200",
  CANCELLED: "bg-red-50 text-red-700 ring-red-200",
  PAID: "bg-green-50 text-green-700 ring-green-200",
  PARTIAL: "bg-amber-50 text-amber-700 ring-amber-200",
}

export function InvoiceStatusBadge({ status, className }: InvoiceStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        STATUS_STYLES[status],
        className
      )}
    >
      {INVOICE_STATUS_LABELS[status]}
    </span>
  )
}
