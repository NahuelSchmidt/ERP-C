"use client"

import { useEffect, useState, use } from "react"
import Link from "next/link"
import { ChevronLeftIcon } from "lucide-react"
import { toast } from "sonner"
import { Button, buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  PURCHASE_ORDER_STATUS_LABELS,
} from "@/lib/validations/purchase-order"
import { formatCurrency, formatDate } from "@/lib/format"

interface PurchaseOrderItem {
  id: string
  description: string
  quantity: number | string
  unitPrice: number | string
  taxPercent: number | string
  subtotal: number | string
  taxAmount: number | string
  total: number | string
  order: number
  product: { id: string; name: string; internalCode: string | null } | null
  taxRate: { id: string; name: string; rate: number | string } | null
}

interface PurchaseOrder {
  id: string
  number: string
  date: string
  expectedDelivery: string | null
  status: string
  subtotal: number | string
  taxAmount: number | string
  total: number | string
  currency: string
  notes: string | null
  supplier: {
    id: string
    companyName: string | null
    firstName: string | null
    lastName: string | null
    documentNumber: string | null
    email: string | null
    phone: string | null
  }
  items: PurchaseOrderItem[]
}

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  SENT: "bg-blue-50 text-blue-700",
  PARTIAL: "bg-amber-50 text-amber-700",
  RECEIVED: "bg-green-50 text-green-700",
  CANCELLED: "bg-red-50 text-red-600",
}

function getSupplierName(s: PurchaseOrder["supplier"]) {
  return (
    (s.companyName ?? [s.firstName, s.lastName].filter(Boolean).join(" ")) ||
    "—"
  )
}

export default function OrdenCompraPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [order, setOrder] = useState<PurchaseOrder | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isActing, setIsActing] = useState(false)

  async function loadOrder() {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/purchase-orders/${id}`)
      if (!res.ok) throw new Error()
      const json = (await res.json()) as { data: PurchaseOrder }
      setOrder(json.data)
    } catch {
      toast.error("Error al cargar la orden de compra")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadOrder()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function handleAction(endpoint: string, successMsg: string) {
    setIsActing(true)
    try {
      const res = await fetch(`/api/purchase-orders/${id}/${endpoint}`, {
        method: "POST",
      })
      if (!res.ok) {
        const err = (await res.json()) as { error: string }
        throw new Error(err.error)
      }
      toast.success(successMsg)
      void loadOrder()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error en la operación")
    } finally {
      setIsActing(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-5 w-24" />
        <div className="space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="space-y-4">
        <Link href="/compras" className="flex items-center gap-1 text-sm text-gray-500 w-fit">
          <ChevronLeftIcon className="w-4 h-4" />
          Compras
        </Link>
        <p className="text-gray-500">Orden de compra no encontrada.</p>
      </div>
    )
  }

  const isDraft = order.status === "DRAFT"
  const isSentOrPartial = order.status === "SENT" || order.status === "PARTIAL"
  const isTerminal = order.status === "CANCELLED" || order.status === "RECEIVED"

  return (
    <div className="space-y-5">
      <Link
        href="/compras"
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 transition-colors w-fit"
      >
        <ChevronLeftIcon className="w-4 h-4" />
        Compras
      </Link>

      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{order.number}</h1>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[order.status] ?? "bg-gray-100 text-gray-500"}`}
            >
              {PURCHASE_ORDER_STATUS_LABELS[
                order.status as keyof typeof PURCHASE_ORDER_STATUS_LABELS
              ] ?? order.status}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {formatDate(order.date)}
            {order.expectedDelivery && (
              <span className="ml-2 text-gray-400">
                · Entrega: {formatDate(order.expectedDelivery)}
              </span>
            )}
          </p>
        </div>

        {/* Acciones */}
        {!isTerminal && (
          <div className="flex items-center gap-2 flex-wrap">
            {isDraft && (
              <>
                <Button
                  onClick={() => void handleAction("send", "Orden enviada al proveedor")}
                  disabled={isActing}
                >
                  Enviar al proveedor
                </Button>
                <Link
                  href={`/compras/${id}/editar`}
                  className={buttonVariants({ variant: "outline" })}
                >
                  Editar
                </Link>
              </>
            )}
            {isSentOrPartial && (
              <Link
                href={`/compras/${id}/recepcion`}
                className={buttonVariants()}
              >
                Registrar recepción
              </Link>
            )}
            {!isTerminal && (
              <Button
                variant="outline"
                onClick={() => void handleAction("cancel", "Orden cancelada")}
                disabled={isActing}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                Cancelar orden
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Proveedor */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Proveedor</h2>
          <dl className="space-y-2">
            <div>
              <dt className="text-xs text-gray-400 uppercase font-medium">Nombre</dt>
              <dd className="text-sm text-gray-900 mt-0.5">
                {getSupplierName(order.supplier)}
              </dd>
            </div>
            {order.supplier.documentNumber && (
              <div>
                <dt className="text-xs text-gray-400 uppercase font-medium">CUIT</dt>
                <dd className="text-sm text-gray-900 mt-0.5">
                  {order.supplier.documentNumber}
                </dd>
              </div>
            )}
            {order.supplier.phone && (
              <div>
                <dt className="text-xs text-gray-400 uppercase font-medium">Teléfono</dt>
                <dd className="text-sm text-gray-900 mt-0.5">{order.supplier.phone}</dd>
              </div>
            )}
            {order.supplier.email && (
              <div>
                <dt className="text-xs text-gray-400 uppercase font-medium">Email</dt>
                <dd className="text-sm text-gray-900 mt-0.5">{order.supplier.email}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Totales */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Totales</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Subtotal</dt>
              <dd className="font-mono text-gray-900">
                {formatCurrency(Number(order.subtotal))}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">IVA</dt>
              <dd className="font-mono text-gray-900">
                {formatCurrency(Number(order.taxAmount))}
              </dd>
            </div>
            <div className="flex justify-between font-semibold text-base pt-1.5 border-t border-gray-200 mt-1.5">
              <dt>Total</dt>
              <dd className="font-mono">{formatCurrency(Number(order.total))}</dd>
            </div>
          </dl>
        </div>

        {/* Notas */}
        {order.notes && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2">
            <h2 className="text-sm font-semibold text-gray-700">Notas</h2>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{order.notes}</p>
          </div>
        )}
      </div>

      {/* Ítems */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-700">
            Ítems ({order.items.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                  Descripción
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                  Producto
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                  Cantidad
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                  Precio unit.
                </th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                  IVA%
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 text-gray-900">{item.description}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {item.product
                      ? `${item.product.internalCode ? `[${item.product.internalCode}] ` : ""}${item.product.name}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-900">
                    {Number(item.quantity).toLocaleString("es-AR")}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-900">
                    {formatCurrency(Number(item.unitPrice))}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-500">
                    {item.taxRate
                      ? item.taxRate.name
                      : Number(item.taxPercent) > 0
                        ? `${(Number(item.taxPercent) * 100).toFixed(1)}%`
                        : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-medium text-gray-900">
                    {formatCurrency(Number(item.total))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
