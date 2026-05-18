"use client"

import { useMemo } from "react"
import { useForm, useFieldArray, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { z } from "zod"
import { PlusIcon, Trash2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  createInvoiceSchema,
  VOUCHER_TYPE_LABELS,
  type CreateInvoiceInput,
} from "@/lib/validations/invoice"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PointOfSale { id: string; number: number; name: string }
interface PaymentCondition { id: string; name: string; days: number }
interface TaxRate { id: string; name: string; rate: number }
interface Customer {
  id: string
  companyName: string | null
  firstName: string | null
  lastName: string | null
}

interface InvoiceFormProps {
  pointsOfSale: PointOfSale[]
  paymentConditions: PaymentCondition[]
  taxRates: TaxRate[]
  customers: Customer[]
  defaultCustomerId?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function r2(n: number) {
  return Math.round(n * 100) / 100
}

function calcTotals(
  items: CreateInvoiceInput["items"],
  globalDiscount: number,
  taxRateMap: Map<string, number>
) {
  const computed = items.map((item) => {
    const qty = Number(item.quantity) || 0
    const price = Number(item.unitPrice) || 0
    const disc = Number(item.discountPercent) || 0
    const discAmt = r2(qty * price * (disc / 100))
    const sub = r2(qty * price - discAmt)
    const taxPct = item.taxRateId ? (taxRateMap.get(item.taxRateId) ?? 0) : 0
    const taxAmt = r2(sub * taxPct)
    return { sub, taxRateId: item.taxRateId, taxPct, taxAmt }
  })

  const subtotal = r2(computed.reduce((a, i) => a + i.sub, 0))
  const gDiscAmt = r2(subtotal * ((Number(globalDiscount) || 0) / 100))
  const taxableBase = r2(subtotal - gDiscAmt)
  const discountFactor = subtotal > 0 ? taxableBase / subtotal : 1

  const taxMap = new Map<string, { rate: number; base: number; amount: number }>()
  for (const item of computed) {
    if (!item.taxRateId || item.taxPct === 0) continue
    const adjBase = r2(item.sub * discountFactor)
    const adjTax = r2(adjBase * item.taxPct)
    const entry = taxMap.get(item.taxRateId)
    if (entry) {
      entry.base = r2(entry.base + adjBase)
      entry.amount = r2(entry.amount + adjTax)
    } else {
      taxMap.set(item.taxRateId, { rate: item.taxPct, base: adjBase, amount: adjTax })
    }
  }

  const taxAmount = r2(Array.from(taxMap.values()).reduce((a, t) => a + t.amount, 0))
  return { subtotal, gDiscAmt, taxableBase, taxAmount, total: r2(taxableBase + taxAmount), taxBreakdown: taxMap }
}

function fmt(val: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(val)
}

function customerName(c: Customer) {
  return c.companyName ?? ([c.firstName, c.lastName].filter(Boolean).join(" ") || "—")
}

const SEL = "h-9 w-full rounded-lg border border-input bg-white px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
const CELL_INPUT = "w-full text-sm outline-none bg-transparent rounded px-1 py-0.5 focus:bg-blue-50 focus:ring-1 focus:ring-blue-100"

const EMPTY_ITEM: CreateInvoiceInput["items"][number] = {
  description: "",
  quantity: 1,
  unitPrice: 0,
  discountPercent: 0,
  order: 0,
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InvoiceForm({
  pointsOfSale,
  paymentConditions,
  taxRates,
  customers,
  defaultCustomerId,
}: InvoiceFormProps) {
  const router = useRouter()

  const taxRateMap = useMemo(
    () => new Map(taxRates.map((t) => [t.id, Number(t.rate)])),
    [taxRates]
  )

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof createInvoiceSchema>, unknown, CreateInvoiceInput>({
    resolver: zodResolver(createInvoiceSchema),
    defaultValues: {
      pointOfSaleId: pointsOfSale[0]?.id ?? "",
      voucherType: "FACTURA_B",
      customerId: defaultCustomerId ?? "",
      date: new Date().toISOString().split("T")[0],
      discountPercent: 0,
      currency: "ARS",
      exchangeRate: 1,
      items: [{ ...EMPTY_ITEM }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: "items" })

  const watchedItems = useWatch({ control, name: "items" }) ?? []
  const globalDiscount = useWatch({ control, name: "discountPercent" }) ?? 0
  const totals = useMemo(
    () => calcTotals(watchedItems as CreateInvoiceInput["items"], globalDiscount as number, taxRateMap),
    [watchedItems, globalDiscount, taxRateMap]
  )

  async function onSubmit(data: CreateInvoiceInput) {
    if (!data.customerId) data.customerId = undefined
    if (!data.paymentConditionId) data.paymentConditionId = undefined
    if (!data.dueDate) data.dueDate = undefined
    data.items = data.items.map((item) => ({
      ...item,
      taxRateId: item.taxRateId || undefined,
    }))

    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const json = await res.json() as { data?: { id: string }; error?: string; message?: string }
      if (!res.ok) throw new Error(json.message ?? json.error ?? "Error al crear el comprobante")
      toast.success("Comprobante guardado como borrador")
      router.push(`/facturacion/${json.data!.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar")
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

      {/* ── Encabezado ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Encabezado</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-700">Punto de venta *</label>
            <select className={cn(SEL, errors.pointOfSaleId && "border-red-400")} {...register("pointOfSaleId")}>
              {pointsOfSale.length === 0
                ? <option value="">Sin puntos de venta activos</option>
                : pointsOfSale.map((p) => (
                  <option key={p.id} value={p.id}>
                    {String(p.number).padStart(4, "0")} — {p.name}
                  </option>
                ))}
            </select>
            {errors.pointOfSaleId && <p className="text-xs text-red-500">{errors.pointOfSaleId.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-700">Tipo de comprobante *</label>
            <select className={cn(SEL, errors.voucherType && "border-red-400")} {...register("voucherType")}>
              {(Object.entries(VOUCHER_TYPE_LABELS) as [string, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            {errors.voucherType && <p className="text-xs text-red-500">{errors.voucherType.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-700">Cliente</label>
            <select className={SEL} {...register("customerId")}>
              <option value="">Consumidor Final</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{customerName(c)}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-700">Fecha</label>
            <Input type="date" {...register("date")} />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-700">Vencimiento</label>
            <Input type="date" {...register("dueDate")} />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-700">Condición de pago</label>
            <select className={SEL} {...register("paymentConditionId")}>
              <option value="">Sin especificar</option>
              {paymentConditions.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

        </div>
      </div>

      {/* ── Ítems ── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Ítems</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase min-w-[220px]">Descripción</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase w-20">Cant.</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase w-32">P. Unitario</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase w-20">Dto. %</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase w-32">IVA</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase w-28">Subtotal</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {fields.map((field, i) => {
                const item = watchedItems[i]
                const qty = Number(item?.quantity) || 0
                const price = Number(item?.unitPrice) || 0
                const disc = Number(item?.discountPercent) || 0
                const sub = r2(qty * price - r2(qty * price * (disc / 100)))
                const hasErr = !!errors.items?.[i]?.description

                return (
                  <tr key={field.id}>
                    <td className="px-4 py-2">
                      <input
                        {...register(`items.${i}.description`)}
                        placeholder="Producto o servicio..."
                        className={cn(CELL_INPUT, hasErr && "ring-1 ring-red-400")}
                      />
                      {hasErr && (
                        <p className="text-xs text-red-500 mt-0.5">{errors.items![i]!.description!.message}</p>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        {...register(`items.${i}.quantity`, { valueAsNumber: true })}
                        type="number" step="0.01" min="0.01"
                        className={cn(CELL_INPUT, "text-right")}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        {...register(`items.${i}.unitPrice`, { valueAsNumber: true })}
                        type="number" step="0.01" min="0"
                        className={cn(CELL_INPUT, "text-right")}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        {...register(`items.${i}.discountPercent`, { valueAsNumber: true })}
                        type="number" step="0.01" min="0" max="100"
                        className={cn(CELL_INPUT, "text-right")}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        {...register(`items.${i}.taxRateId`)}
                        className="w-full text-sm outline-none bg-transparent rounded px-1 py-0.5 focus:bg-blue-50"
                      >
                        <option value="">Sin IVA</option>
                        {taxRates.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-gray-700 tabular-nums">
                      {fmt(sub)}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => remove(i)}
                        disabled={fields.length === 1}
                        className="p-1 text-gray-300 hover:text-red-500 disabled:invisible transition-colors"
                      >
                        <Trash2Icon className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-gray-100 flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ ...EMPTY_ITEM, order: fields.length })}
          >
            <PlusIcon className="w-3.5 h-3.5 mr-1.5" />
            Agregar ítem
          </Button>
          {errors.items && "message" in errors.items && typeof errors.items.message === "string" && (
            <p className="text-xs text-red-500">{errors.items.message}</p>
          )}
        </div>
      </div>

      {/* ── Notas + Totales ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-700">Notas (visibles en el comprobante)</label>
            <Textarea {...register("notes")} rows={3} placeholder="Condiciones, observaciones..." />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-700">Notas internas</label>
            <Textarea {...register("internalNotes")} rows={2} placeholder="Solo uso interno" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3 self-start">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Descuento global</span>
            <div className="flex items-center gap-1.5">
              <input
                {...register("discountPercent", { valueAsNumber: true })}
                type="number" step="0.01" min="0" max="100"
                className="w-16 text-right text-sm border border-gray-200 rounded px-2 py-0.5 outline-none focus:border-ring"
              />
              <span className="text-sm text-gray-400">%</span>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-3 space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span className="font-mono tabular-nums">{fmt(totals.subtotal)}</span>
            </div>
            {totals.gDiscAmt > 0 && (
              <div className="flex justify-between text-gray-500">
                <span>Dto. global</span>
                <span className="font-mono tabular-nums text-red-500">-{fmt(totals.gDiscAmt)}</span>
              </div>
            )}
            {Array.from(totals.taxBreakdown.entries()).map(([rateId, t]) => {
              const rateName = taxRates.find((x) => x.id === rateId)?.name ?? `IVA ${(t.rate * 100).toFixed(0)}%`
              return (
                <div key={rateId} className="flex justify-between text-gray-600">
                  <span>{rateName}</span>
                  <span className="font-mono tabular-nums">{fmt(t.amount)}</span>
                </div>
              )
            })}
            <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-2 text-base">
              <span>Total</span>
              <span className="font-mono tabular-nums">{fmt(totals.total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Acciones ── */}
      <div className="flex items-center justify-end gap-3 pb-6">
        <Button type="button" variant="outline" onClick={() => router.push("/facturacion")}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Guardando..." : "Guardar borrador"}
        </Button>
      </div>

    </form>
  )
}
