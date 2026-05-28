"use client"

import { useEffect, useState, use } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ChevronLeftIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { closeCashSessionSchema, type CloseCashSessionInput } from "@/lib/validations/payment"
import { formatCurrency, formatDateTime } from "@/lib/format"

interface Payment {
  id: string
  date: string
  direction: string
  total: number | string
  status: string
  customer: { companyName: string | null; firstName: string | null; lastName: string | null } | null
  supplier: { companyName: string | null } | null
}

interface CashSession {
  id: string
  status: string
  openedAt: string
  closedAt: string | null
  openingBalance: number | string
  closingBalance: number | string | null
  cashRegister: {
    id: string
    name: string
    branch: { name: string } | null
  }
  payments: Payment[]
}

interface SessionMeta {
  totalCollected: number
  totalPaid: number
  netTotal: number
  paymentCount: number
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

function getPayeeName(pay: Payment) {
  if (pay.customer) {
    return (
      (pay.customer.companyName ??
        [pay.customer.firstName, pay.customer.lastName].filter(Boolean).join(" ")) ||
      "—"
    )
  }
  if (pay.supplier) return pay.supplier.companyName ?? "—"
  return "—"
}

export default function SesionCajaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [session, setSession] = useState<CashSession | null>(null)
  const [meta, setMeta] = useState<SessionMeta | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showCloseForm, setShowCloseForm] = useState(false)
  const [isClosing, setIsClosing] = useState(false)

  const closeForm = useForm<CloseCashSessionInput>({
    resolver: zodResolver(closeCashSessionSchema),
    defaultValues: { closingBalance: 0, notes: "" },
  })

  async function loadSession() {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/cash/sessions/${id}`)
      if (!res.ok) throw new Error()
      const json = (await res.json()) as { data: CashSession; meta: SessionMeta }
      setSession(json.data)
      setMeta(json.meta)
      if (json.meta) {
        closeForm.setValue("closingBalance", json.meta.netTotal + Number(json.data.openingBalance))
      }
    } catch {
      toast.error("Error al cargar la sesión")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadSession()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function onCloseSubmit(values: CloseCashSessionInput) {
    setIsClosing(true)
    try {
      const res = await fetch(`/api/cash/sessions/${id}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      if (!res.ok) {
        const err = (await res.json()) as { error: string }
        throw new Error(err.error)
      }
      toast.success("Sesión cerrada correctamente")
      void loadSession()
      setShowCloseForm(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cerrar la sesión")
    } finally {
      setIsClosing(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-5 w-24" />
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="space-y-4">
        <Link href="/tesoreria" className="flex items-center gap-1 text-sm text-gray-500 w-fit">
          <ChevronLeftIcon className="w-4 h-4" />
          Tesorería
        </Link>
        <p className="text-gray-500">Sesión no encontrada.</p>
      </div>
    )
  }

  const isOpen = session.status === "OPEN"

  return (
    <div className="space-y-5">
      <Link
        href="/tesoreria"
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 transition-colors w-fit"
      >
        <ChevronLeftIcon className="w-4 h-4" />
        Tesorería
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              {session.cashRegister.name}
            </h1>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isOpen ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"}`}
            >
              {isOpen ? "Abierta" : "Cerrada"}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            Apertura: {formatDateTime(session.openedAt)}
            {session.closedAt && (
              <span className="ml-2 text-gray-400">
                · Cierre: {formatDateTime(session.closedAt)}
              </span>
            )}
          </p>
        </div>
        {isOpen && !showCloseForm && (
          <Button
            variant="outline"
            onClick={() => setShowCloseForm(true)}
          >
            Cerrar sesión
          </Button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase font-medium">Apertura</p>
          <p className="text-xl font-bold text-gray-900 mt-1">
            {formatCurrency(Number(session.openingBalance))}
          </p>
        </div>
        {meta && (
          <>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 uppercase font-medium">Cobrado</p>
              <p className="text-xl font-bold text-green-600 mt-1">
                {formatCurrency(meta.totalCollected)}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 uppercase font-medium">Pagado</p>
              <p className="text-xl font-bold text-red-600 mt-1">
                {formatCurrency(meta.totalPaid)}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 uppercase font-medium">Neto</p>
              <p className="text-xl font-bold text-gray-900 mt-1">
                {formatCurrency(meta.netTotal + Number(session.openingBalance))}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Formulario de cierre */}
      {showCloseForm && (
        <div className="bg-white rounded-xl border border-amber-200 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Cerrar sesión</h2>
          <form onSubmit={closeForm.handleSubmit(onCloseSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500 uppercase">
                  Saldo de cierre (conteo físico)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  {...closeForm.register("closingBalance", { valueAsNumber: true })}
                />
                {closeForm.formState.errors.closingBalance && (
                  <p className="text-xs text-red-500">
                    {closeForm.formState.errors.closingBalance.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500 uppercase">Notas</label>
                <Input
                  {...closeForm.register("notes")}
                  placeholder="Observaciones del cierre..."
                />
              </div>
            </div>
            <div className="flex items-center gap-3 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCloseForm(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isClosing}>
                {isClosing ? "Cerrando..." : "Confirmar cierre"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Movimientos */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-700">
            Movimientos ({session.payments.length})
          </h2>
        </div>
        {session.payments.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">
            Sin movimientos en esta sesión
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Referencia</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Monto</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {session.payments.map((pay) => (
                <tr key={pay.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {formatDateTime(pay.date)}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {DIRECTION_LABELS[pay.direction] ?? pay.direction}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{getPayeeName(pay)}</td>
                  <td
                    className={`px-4 py-3 text-right font-mono font-medium ${pay.direction === "CUSTOMER" ? "text-green-700" : "text-red-600"}`}
                  >
                    {pay.direction === "SUPPLIER" ? "- " : ""}
                    {formatCurrency(Number(pay.total))}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
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
  )
}
