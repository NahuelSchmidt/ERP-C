"use client"

import { PrinterIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

export function InvoicePrintButton() {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => window.print()}
      className="print:hidden"
    >
      <PrinterIcon className="w-4 h-4 mr-1.5" />
      Imprimir
    </Button>
  )
}
