"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ChevronLeftIcon, PlusIcon, TrashIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  createPurchaseOrderSchema,
} from "@/lib/validations/purchase-order"
import { z } from "zod"

type CreatePurchaseOrderInput = z.input<typeof createPurchaseOrderSchema>
import { formatCurrency } from "@/lib/format"

interface Supplier {
  id: string
  companyName: string | null
  firstName: string | null
  lastName: string | null
}

interface Product {
  id: string
  name: string
  internalCode: string | null
}

interface TaxRate {
  id: string
  name: string
  rate: number
}

function getSupplierName(s: Supplier) {
  return (
    (s.companyName ?? [s.firstName, s.lastName].filter(Boolean).join(" ")) ||
    "—"
  )
}

export default function NuevaOrdenPage() {
  const router = useRouter()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [taxRates, setTaxRates] = useState<TaxRate[]>([])
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<CreatePurchaseOrderInput>({
    resolver: zodResolver(createPurchaseOrderSchema),
    defaultValues: {
      supplierId: "",
      date: new Date().toISOString().slice(0, 10),
      expectedDelivery: "",
      currency: "ARS",
      exchangeRate: 1,
      notes: "",
      items: [
        { description: "", quantity: 1, unitPrice: 0, taxPercent: 0, order: 0 },
      ],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  })

  const watchedItems = form.watch("items")

  const totals = watchedItems.reduce(
    (acc, item) => {
      const sub =
        Math.round((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0) * 100) / 100
      const taxAmt =
        Math.round(sub * (Number(item.taxPercent) || 0) * 100) / 100
      acc.subtotal += sub
      acc.taxAmount += taxAmt
      return acc
    },
    { subtotal: 0, taxAmount: 0 }
  )
  totals.subtotal = Math.round(totals.subtotal * 100) / 100
  totals.taxAmount = Math.round(totals.taxAmount * 100) / 100
  const totalFinal = Math.round((totals.subtotal + totals.taxAmount) * 100) / 100

  useEffect(() => {
    void (async () => {
      setIsLoadingData(true)
      try {
        const [suppRes, prodRes, taxRes] = await Promise.all([
          fetch("/api/suppliers?limit=300"),
          fetch("/api/products?limit=300"),
          fetch("/api/tax-rates"),
        ])
        if (suppRes.ok)
          setSuppliers(((await suppRes.json()) as { data: Supplier[] }).data)
        if (prodRes.ok)
          setProducts(((await prodRes.json()) as { data: Product[] }).data)
        if (taxRes.ok)
          setTaxRates(
            ((await taxRes.json()) as { data: TaxRate[] }).data.map((t) => ({
              ...t,
              rate: Number(t.rate),
            }))
          )
      } catch {
        toast.error("Error al cargar datos del formulario")
      } finally {
        setIsLoadingData(false)
      }
    })()
  }, [])

  async function onSubmit(values: CreatePurchaseOrderInput) {
    setIsSubmitting(true)
    try {
      const body = {
        ...values,
        date: values.date ? new Date(values.date).toISOString() : undefined,
        expectedDelivery: values.expectedDelivery
          ? new Date(values.expectedDelivery).toISOString()
          : undefined,
        notes: values.notes || undefined,
        items: values.items.map((item, idx) => ({ ...item, order: idx })),
      }
      const res = await fetch("/api/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = (await res.json()) as { error: string }
        throw new Error(err.error)
      }
      const { data } = (await res.json()) as { data: { id: string } }
      toast.success("Orden de compra creada")
      router.push(`/compras/${data.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al crear la orden")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoadingData) {
    return (
      <div className="space-y-5">
        <div className="h-6 w-32 bg-gray-100 rounded animate-pulse" />
        <div className="h-96 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <Link
        href="/compras"
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 transition-colors w-fit"
      >
        <ChevronLeftIcon className="w-4 h-4" />
        Compras
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nueva orden de compra</h1>
        <p className="text-sm text-gray-500 mt-0.5">Se guardará como borrador</p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        {/* Datos generales */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Datos generales</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500 uppercase">
                Proveedor <span className="text-red-500">*</span>
              </label>
              <select
                {...form.register("supplierId")}
                className="w-full h-9 rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <option value="">Seleccionar proveedor...</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {getSupplierName(s)}
                  </option>
                ))}
              </select>
              {form.formState.errors.supplierId && (
                <p className="text-xs text-red-500">
                  {form.formState.errors.supplierId.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500 uppercase">Fecha</label>
              <Input type="date" {...form.register("date")} />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500 uppercase">
                Entrega esperada
              </label>
              <Input type="date" {...form.register("expectedDelivery")} />
            </div>
          </div>

          <div className="mt-4 space-y-1.5">
            <label className="text-xs font-medium text-gray-500 uppercase">Notas</label>
            <textarea
              {...form.register("notes")}
              rows={2}
              placeholder="Notas u observaciones..."
              className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 resize-none"
            />
          </div>
        </div>

        {/* Ítems */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-700">Ítems</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                append({
                  description: "",
                  quantity: 1,
                  unitPrice: 0,
                  taxPercent: 0,
                  order: fields.length,
                })
              }
            >
              <PlusIcon className="w-3.5 h-3.5 mr-1" />
              Agregar ítem
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase w-44">
                    Producto
                  </th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase">
                    Descripción
                  </th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase w-24">
                    Cantidad
                  </th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase w-32">
                    Precio unit.
                  </th>
                  <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase w-32">
                    IVA
                  </th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase w-28">
                    Total
                  </th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {fields.map((field, idx) => {
                  const item = watchedItems[idx]
                  const sub =
                    Math.round(
                      (Number(item?.quantity) || 0) * (Number(item?.unitPrice) || 0) * 100
                    ) / 100
                  const taxPct = Number(item?.taxPercent) || 0
                  const taxAmt = Math.round(sub * taxPct * 100) / 100
                  const lineTotal = Math.round((sub + taxAmt) * 100) / 100
                  const currentTaxRateId = form.watch(`items.${idx}.taxRateId`) ?? ""

                  return (
                    <tr key={field.id} className="group">
                      <td className="px-3 py-2">
                        <select
                          value={form.watch(`items.${idx}.productId`) ?? ""}
                          onChange={(e) => {
                            const productId = e.target.value
                            const product = products.find((p) => p.id === productId)
                            form.setValue(`items.${idx}.productId`, productId || undefined)
                            if (product && !form.getValues(`items.${idx}.description`)) {
                              form.setValue(`items.${idx}.description`, product.name)
                            }
                          }}
                          className="w-full h-8 rounded-md border border-input bg-white px-2 text-xs outline-none focus-visible:border-ring"
                        >
                          <option value="">Sin producto</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.internalCode ? `[${p.internalCode}] ` : ""}
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          {...form.register(`items.${idx}.description`)}
                          placeholder="Descripción"
                          className="h-8 text-xs"
                        />
                        {form.formState.errors.items?.[idx]?.description && (
                          <p className="text-xs text-red-500 mt-0.5">
                            {form.formState.errors.items[idx].description?.message}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          step="0.0001"
                          min="0.0001"
                          {...form.register(`items.${idx}.quantity`, {
                            valueAsNumber: true,
                          })}
                          className="h-8 text-xs text-right"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          {...form.register(`items.${idx}.unitPrice`, {
                            valueAsNumber: true,
                          })}
                          className="h-8 text-xs text-right"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={currentTaxRateId}
                          onChange={(e) => {
                            const rateId = e.target.value
                            const rate = taxRates.find((t) => t.id === rateId)
                            form.setValue(
                              `items.${idx}.taxRateId`,
                              rateId || undefined
                            )
                            form.setValue(
                              `items.${idx}.taxPercent`,
                              rate ? Number(rate.rate) : 0
                            )
                          }}
                          className="w-full h-8 rounded-md border border-input bg-white px-2 text-xs outline-none"
                        >
                          <option value="">Sin IVA (0%)</option>
                          {taxRates.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name} ({(Number(t.rate) * 100).toFixed(1)}%)
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-gray-900">
                        {formatCurrency(lineTotal)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => remove(idx)}
                          disabled={fields.length === 1}
                          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 disabled:opacity-0 transition-opacity"
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {form.formState.errors.items?.root && (
            <p className="px-5 py-2 text-xs text-red-500">
              {form.formState.errors.items.root.message}
            </p>
          )}

          {/* Totales */}
          <div className="flex justify-end px-5 py-4 border-t border-gray-200 bg-gray-50">
            <div className="space-y-1.5 text-sm min-w-52">
              <div className="flex justify-between gap-8">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-mono text-gray-900">
                  {formatCurrency(totals.subtotal)}
                </span>
              </div>
              <div className="flex justify-between gap-8">
                <span className="text-gray-500">IVA</span>
                <span className="font-mono text-gray-900">
                  {formatCurrency(totals.taxAmount)}
                </span>
              </div>
              <div className="flex justify-between gap-8 font-semibold text-base pt-1.5 border-t border-gray-200">
                <span>Total</span>
                <span className="font-mono">{formatCurrency(totalFinal)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center justify-end gap-3">
          <Link
            href="/compras"
            className="inline-flex items-center justify-center rounded-lg border border-input bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </Link>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Guardando..." : "Guardar borrador"}
          </Button>
        </div>
      </form>
    </div>
  )
}
