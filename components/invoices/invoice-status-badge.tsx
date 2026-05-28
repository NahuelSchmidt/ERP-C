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
  DRAFT: "bg-secondary text-muted-foreground ring-border",
  ISSUED: "bg-blue-50 text-blue-700 ring-blue-100",
  CANCELLED: "bg-red-50 text-red-600 ring-red-100",
  PAID: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  PARTIAL: "bg-amber-50 text-amber-700 ring-amber-100",
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
