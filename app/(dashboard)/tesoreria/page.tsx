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
  type: string
  amount: number | string
  status: string
  reference: string | null
  customer: { companyName: string | null; firstName: string | null; lastName: string | null } | null
}

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  COBRO: "Cobro",
  PAGO: "Pago",
  TRANSFERENCIA: "Transferencia",
  AJUSTE: "Ajuste",
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmado",
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
  if (!payment.customer) return "—"
  return (
    payment.customer.companyName ??
    [payment.customer.firstName, payment.customer.lastName].filter(Boolean).join(" ") ??
    "—"
  )
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
        <h1 className="text-2xl font-bold text-gray-900">Tesorería</h1>
        <p className="text-sm text-gray-500 mt-0.5">Cajas y pagos</p>
      </div>

      {/* Cajas */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Cajas registradoras</h2>
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
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
            <p className="text-sm">No hay cajas configuradas</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {registers.map((reg) => (
              <div
                key={reg.id}
                className={`bg-white rounded-xl border p-5 ${
                  reg.currentSession ? "border-green-200" : "border-gray-200"
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{reg.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          reg.currentSession ? "bg-green-500" : "bg-gray-300"
                        }`}
                      />
                      <p className="text-xs text-gray-500">
                        {reg.currentSession ? "Sesión abierta" : "Sin sesión activa"}
                      </p>
                    </div>
                  </div>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(reg.currentBalance)}
                </p>
                {reg.currentSession && (
                  <p className="text-xs text-gray-400 mt-1">
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
          <h2 className="text-base font-semibold text-gray-900">Últimos movimientos</h2>
          <Link href="/tesoreria/pagos/nuevo" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Nuevo pago
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {isLoading ? (
            <div className="divide-y divide-gray-100">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-4 py-3">
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </div>
          ) : payments.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">
              Sin movimientos registrados
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Cliente / Ref.</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Monto</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payments.map((pay) => (
                  <tr key={pay.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(pay.date)}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {PAYMENT_TYPE_LABELS[pay.type] ?? pay.type}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {getPayeeName(pay)}
                      {pay.reference && (
                        <span className="ml-1 text-gray-400 text-xs">· {pay.reference}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium text-gray-900">
                      {formatCurrency(pay.amount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          pay.status === "CONFIRMED"
                            ? "bg-green-50 text-green-700"
                            : pay.status === "CANCELLED"
                            ? "bg-red-50 text-red-600"
                            : "bg-amber-50 text-amber-700"
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
