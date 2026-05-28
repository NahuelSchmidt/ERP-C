"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { buttonVariants } from "@/components/ui/button"

interface CashRegister {
  id: string
  name: string
  isActive: boolean
  currentBalance: number | string
  currentSession: {
    id: string
    status: string
    openingBalance: number | string
    openedAt: string
  } | null
}

interface Payment {
  id: string
  date: string
  direction: string
  total: number | string
  status: string
  reference: string | null
  customer: { companyName: string | null; firstName: string | null; lastName: string | null } | null
  supplier: { companyName: string | null } | null
}

const DIRECTION_LABELS: Record<string, string> = {
  CUSTOMER: "Cobro",
  SUPPLIER: "Pago",
  INTERNAL: "Interno",
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  COMPLETED: "Completado",
  CANCELLED: "Anulado",
}

function formatCurrency(val: number | string): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(Number(val))
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date))
}

function getPayeeName(payment: Payment): string {
  if (payment.customer) {
    return (
      payment.customer.companyName ??
      ([payment.customer.firstName, payment.customer.lastName].filter(Boolean).join(" ") || "—")
    )
  }
  if (payment.supplier) {
    return payment.supplier.companyName ?? "—"
  }
  return "—"
}

export default function TesoreriaPage() {
  const [registers, setRegisters] = useState<CashRegister[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      setIsLoading(true)
      try {
        const [regRes, payRes] = await Promise.all([
          fetch("/api/cash/registers"),
          fetch("/api/payments?limit=20"),
        ])

        if (regRes.ok) {
          const json = await regRes.json() as { data: CashRegister[] }
          setRegisters(json.data)
        }
        if (payRes.ok) {
          const json = await payRes.json() as { data: Payment[] }
          setPayments(json.data)
        }
      } catch {
        toast.error("Error al cargar datos de tesorería")
      } finally {
        setIsLoading(false)
      }
    })()
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-foreground">Tesorería</h1>
        <p className="text-sm text-muted-foreground mt-1">Cajas y pagos</p>
      </div>

      {/* Cajas */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground">Cajas registradoras</h2>
          <Link href="/configuracion" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Configurar
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        ) : registers.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border p-8 text-center text-muted-foreground">
            <p className="text-sm">No hay cajas configuradas</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {registers.map((reg) => (
              <div
                key={reg.id}
                className={`bg-card rounded-2xl border p-5 hover:shadow-sm transition-all ${
                  reg.currentSession ? "border-emerald-200" : "border-border"
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-foreground text-sm">{reg.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          reg.currentSession ? "bg-emerald-500" : "bg-muted-foreground/30"
                        }`}
                      />
                      <p className="text-xs text-muted-foreground">
                        {reg.currentSession ? "Sesión abierta" : "Sin sesión activa"}
                      </p>
                    </div>
                  </div>
                </div>
                <p className="text-3xl font-black tracking-tight text-foreground">
                  {formatCurrency(reg.currentBalance)}
                </p>
                {reg.currentSession && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Abierta: {formatDate(reg.currentSession.openedAt)}
                  </p>
                )}
                <div className="mt-3 flex gap-2">
                  {reg.currentSession ? (
                    <Link
                      href={`/tesoreria/sesiones/${reg.currentSession.id}`}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      Ver sesión
                    </Link>
                  ) : (
                    <Link
                      href={`/tesoreria/sesiones/nueva?registerId=${reg.id}`}
                      className={buttonVariants({ size: "sm" })}
                    >
                      Abrir caja
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Últimos pagos */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground">Últimos movimientos</h2>
          <Link href="/tesoreria/pagos/nuevo" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Nuevo pago
          </Link>
        </div>

        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          {isLoading ? (
            <div>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-4 py-3 border-b border-border/60">
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </div>
          ) : payments.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              Sin movimientos registrados
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Fecha</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Tipo</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Cliente / Ref.</th>
                  <th className="text-right px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Monto</th>
                  <th className="text-center px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Estado</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((pay) => (
                  <tr key={pay.id} className="hover:bg-muted/30 transition-colors border-b border-border/60 last:border-0">
                    <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(pay.date)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-foreground">
                      {DIRECTION_LABELS[pay.direction] ?? pay.direction}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      {getPayeeName(pay)}
                      {pay.reference && (
                        <span className="ml-1 text-muted-foreground text-xs">· {pay.reference}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium text-foreground">
                      {formatCurrency(pay.total)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          pay.status === "CONFIRMED"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                            : pay.status === "CANCELLED"
                            ? "bg-red-50 text-red-600 border border-red-100"
                            : "bg-amber-50 text-amber-700 border border-amber-100"
                        }`}
                      >
                        {STATUS_LABELS[pay.status] ?? pay.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
