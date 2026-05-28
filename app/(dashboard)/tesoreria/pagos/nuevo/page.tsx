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
import { createPaymentSchema, type CreatePaymentInput } from "@/lib/validations/payment"
import { formatCurrency } from "@/lib/format"

interface Customer {
  id: string
  companyName: string | null
  firstName: string | null
  lastName: string | null
}

interface Supplier {
  id: string
  companyName: string | null
  firstName: string | null
  lastName: string | null
}

interface CashSession {
  id: string
  status: string
  cashRegister: { name: string }
}

interface PaymentMethod {
  id: string
  name: string
  type: string
}

function getPersonName(p: Customer | Supplier) {
  return (
    (p.companyName ?? [p.firstName, (p as Customer).lastName].filter(Boolean).join(" ")) ||
    "—"
  )
}

export default function NuevoPagoPage() {
  const router = useRouter()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [cashSessions, setCashSessions] = useState<CashSession[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<CreatePaymentInput>({
    resolver: zodResolver(createPaymentSchema),
    defaultValues: {
      direction: "CUSTOMER",
      customerId: "",
      supplierId: "",
      date: new Date().toISOString(),
      total: 0,
      items: [{ paymentMethodId: "", amount: 0 }],
      reference: "",
      notes: "",
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  })

  const direction = form.watch("direction")
  const watchedItems = form.watch("items")
  const itemsTotal = watchedItems.reduce((acc, item) => acc + (Number(item.amount) || 0), 0)

  useEffect(() => {
    form.setValue("total", Math.round(itemsTotal * 100) / 100)
  }, [itemsTotal, form])

  useEffect(() => {
    void (async () => {
      setIsLoadingData(true)
      try {
        const [custRes, suppRes, sessRes, pmRes] = await Promise.all([
          fetch("/api/customers?limit=300"),
          fetch("/api/suppliers?limit=300"),
          fetch("/api/cash/sessions?status=OPEN"),
          fetch("/api/payment-methods"),
        ])
        if (custRes.ok)
          setCustomers(((await custRes.json()) as { data: Customer[] }).data)
        if (suppRes.ok)
          setSuppliers(((await suppRes.json()) as { data: Supplier[] }).data)
        if (sessRes.ok)
          setCashSessions(((await sessRes.json()) as { data: CashSession[] }).data)
        if (pmRes.ok)
          setPaymentMethods(((await pmRes.json()) as { data: PaymentMethod[] }).data)
      } catch {
        toast.error("Error al cargar datos del formulario")
      } finally {
        setIsLoadingData(false)
      }
    })()
  }, [])

  async function onSubmit(values: CreatePaymentInput) {
    setIsSubmitting(true)
    try {
      const body = {
        ...values,
        date: new Date().toISOString(),
        customerId: values.direction === "CUSTOMER" ? values.customerId : undefined,
        supplierId: values.direction === "SUPPLIER" ? values.supplierId : undefined,
        cashSessionId: values.cashSessionId || undefined,
        reference: values.reference || undefined,
        notes: values.notes || undefined,
      }
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = (await res.json()) as { error: string }
        throw new Error(err.error)
      }
      toast.success("Pago registrado correctamente")
      router.push("/tesoreria")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al registrar el pago")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoadingData) {
    return (
      <div className="space-y-5">
        <div className="h-5 w-24 bg-gray-100 rounded animate-pulse" />
        <div className="h-96 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <Link
        href="/tesoreria"
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 transition-colors w-fit"
      >
        <ChevronLeftIcon className="w-4 h-4" />
        Tesorería
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Registrar pago / cobro</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Ingresá los detalles del movimiento
        </p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 max-w-2xl">
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Tipo de movimiento</h2>

          {/* Dirección */}
          <div className="flex gap-3">
            {(["CUSTOMER", "SUPPLIER"] as const).map((dir) => (
              <label
                key={dir}
                className={`flex-1 flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${form.watch("direction") === dir ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:bg-gray-50"}`}
              >
                <input
                  type="radio"
                  {...form.register("direction")}
                  value={dir}
                  className="accent-blue-600"
                />
                <span className="text-sm font-medium text-gray-700">
                  {dir === "CUSTOMER" ? "Cobro a cliente" : "Pago a proveedor"}
                </span>
              </label>
            ))}
          </div>

          {/* Cliente o Proveedor */}
          {direction === "CUSTOMER" && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500 uppercase">
                Cliente <span className="text-red-500">*</span>
              </label>
              <select
                {...form.register("customerId")}
                className="w-full h-9 rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <option value="">Seleccionar cliente...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {getPersonName(c)}
                  </option>
                ))}
              </select>
              {form.formState.errors.customerId && (
                <p className="text-xs text-red-500">
                  {form.formState.errors.customerId.message}
                </p>
              )}
            </div>
          )}

          {direction === "SUPPLIER" && (
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
                    {getPersonName(s)}
                  </option>
                ))}
              </select>
              {form.formState.errors.supplierId && (
                <p className="text-xs text-red-500">
                  {form.formState.errors.supplierId.message}
                </p>
              )}
            </div>
          )}

          {/* Sesión de caja */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500 uppercase">
              Sesión de caja
            </label>
            <select
              {...form.register("cashSessionId")}
              className="w-full h-9 rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <option value="">Sin sesión asignada</option>
              {cashSessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.cashRegister.name} — Abierta
                </option>
              ))}
            </select>
          </div>

          {/* Referencia / Notas */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500 uppercase">Referencia</label>
              <Input {...form.register("reference")} placeholder="Ej: Recibo N° 001" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500 uppercase">Notas</label>
              <Input {...form.register("notes")} placeholder="Observaciones..." />
            </div>
          </div>
        </div>

        {/* Medios de pago */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-700">Medios de pago</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ paymentMethodId: "", amount: 0 })}
            >
              <PlusIcon className="w-3.5 h-3.5 mr-1" />
              Agregar
            </Button>
          </div>

          <div className="divide-y divide-gray-100">
            {fields.map((field, idx) => (
              <div key={field.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex-1 space-y-1">
                  <select
                    {...form.register(`items.${idx}.paymentMethodId`)}
                    className="w-full h-9 rounded-lg border border-input bg-white px-2.5 text-sm outline-none"
                  >
                    <option value="">Seleccionar medio...</option>
                    {paymentMethods.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                  {form.formState.errors.items?.[idx]?.paymentMethodId && (
                    <p className="text-xs text-red-500">
                      {form.formState.errors.items[idx].paymentMethodId?.message}
                    </p>
                  )}
                </div>
                <div className="w-36">
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    {...form.register(`items.${idx}.amount`, { valueAsNumber: true })}
                    placeholder="0.00"
                    className="text-right"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  disabled={fields.length === 1}
                  className="text-gray-400 hover:text-red-500 disabled:opacity-30 transition-colors"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {form.formState.errors.items?.root && (
            <p className="px-5 pb-3 text-xs text-red-500">
              {form.formState.errors.items.root.message}
            </p>
          )}

          <div className="flex items-center justify-end px-5 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center gap-4 text-sm font-semibold">
              <span className="text-gray-500">Total</span>
              <span className="font-mono text-gray-900 text-base">
                {formatCurrency(Math.round(itemsTotal * 100) / 100)}
              </span>
            </div>
          </div>
        </div>

        {form.formState.errors.total && (
          <p className="text-xs text-red-500">{form.formState.errors.total.message}</p>
        )}

        <div className="flex items-center justify-end gap-3">
          <Link
            href="/tesoreria"
            className="inline-flex items-center justify-center rounded-lg border border-input bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </Link>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Guardando..." : "Registrar pago"}
          </Button>
        </div>
      </form>
    </div>
  )
}
