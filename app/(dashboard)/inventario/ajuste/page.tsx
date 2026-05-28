"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ChevronLeftIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  createStockMovementSchema,
  MANUAL_MOVEMENT_TYPES,
  STOCK_MOVEMENT_TYPE_LABELS,
} from "@/lib/validations/stock-movement"
import { z } from "zod"

type FormValues = z.input<typeof createStockMovementSchema>

interface Product {
  id: string
  name: string
  internalCode: string | null
  sku: string | null
}

interface Warehouse {
  id: string
  name: string
}

export default function AjusteStockPage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(createStockMovementSchema),
    defaultValues: {
      productId: "",
      warehouseId: "",
      type: "ADJUSTMENT",
      quantity: 1,
      unitCost: undefined,
      reason: "",
      notes: "",
    },
  })

  useEffect(() => {
    void (async () => {
      setIsLoadingData(true)
      try {
        const [prodRes, whRes] = await Promise.all([
          fetch("/api/products?limit=300"),
          fetch("/api/warehouses"),
        ])
        if (prodRes.ok)
          setProducts(((await prodRes.json()) as { data: Product[] }).data)
        if (whRes.ok)
          setWarehouses(((await whRes.json()) as { data: Warehouse[] }).data)
      } catch {
        toast.error("Error al cargar los datos")
      } finally {
        setIsLoadingData(false)
      }
    })()
  }, [])

  async function onSubmit(values: FormValues) {
    setIsSubmitting(true)
    try {
      const body = {
        ...values,
        reason: values.reason || null,
        notes: values.notes || null,
        unitCost: values.unitCost ?? null,
        date: new Date().toISOString(),
      }
      const res = await fetch("/api/stock/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = (await res.json()) as { error: string }
        throw new Error(err.error)
      }
      toast.success("Movimiento de stock registrado")
      router.push("/inventario")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al registrar el movimiento")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoadingData) {
    return (
      <div className="space-y-5">
        <div className="h-5 w-24 bg-gray-100 rounded animate-pulse" />
        <div className="h-80 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <Link
        href="/inventario"
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 transition-colors w-fit"
      >
        <ChevronLeftIcon className="w-4 h-4" />
        Inventario
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Registrar ajuste de stock</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Ingresá un movimiento manual de entrada, salida o ajuste de inventario
        </p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-lg space-y-5">
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          {/* Producto */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500 uppercase">
              Producto <span className="text-red-500">*</span>
            </label>
            <select
              {...form.register("productId")}
              className="w-full h-9 rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <option value="">Seleccionar producto...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.internalCode ? `[${p.internalCode}] ` : ""}
                  {p.name}
                </option>
              ))}
            </select>
            {form.formState.errors.productId && (
              <p className="text-xs text-red-500">
                {form.formState.errors.productId.message}
              </p>
            )}
          </div>

          {/* Depósito */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500 uppercase">
              Depósito <span className="text-red-500">*</span>
            </label>
            <select
              {...form.register("warehouseId")}
              className="w-full h-9 rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <option value="">Seleccionar depósito...</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
            {form.formState.errors.warehouseId && (
              <p className="text-xs text-red-500">
                {form.formState.errors.warehouseId.message}
              </p>
            )}
          </div>

          {/* Tipo de movimiento */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500 uppercase">
              Tipo de movimiento <span className="text-red-500">*</span>
            </label>
            <select
              {...form.register("type")}
              className="w-full h-9 rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {MANUAL_MOVEMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {STOCK_MOVEMENT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            {form.formState.errors.type && (
              <p className="text-xs text-red-500">{form.formState.errors.type.message}</p>
            )}
          </div>

          {/* Cantidad */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500 uppercase">
              Cantidad <span className="text-red-500">*</span>
            </label>
            <Input
              type="number"
              step="0.0001"
              min="0.0001"
              {...form.register("quantity", { valueAsNumber: true })}
              placeholder="1"
            />
            <p className="text-xs text-gray-400">
              Ingresá siempre un valor positivo. El tipo de movimiento determina si es entrada o
              salida.
            </p>
            {form.formState.errors.quantity && (
              <p className="text-xs text-red-500">
                {form.formState.errors.quantity.message}
              </p>
            )}
          </div>

          {/* Costo unitario (opcional) */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500 uppercase">
              Costo unitario (opcional)
            </label>
            <Input
              type="number"
              step="0.01"
              min="0"
              {...form.register("unitCost", {
                setValueAs: (v) => (v === "" || v == null ? undefined : Number(v)),
              })}
              placeholder="0.00"
            />
          </div>

          {/* Motivo */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500 uppercase">Motivo</label>
            <Input
              {...form.register("reason")}
              placeholder="Ej: Ajuste por inventario físico"
              maxLength={255}
            />
          </div>

          {/* Notas */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500 uppercase">Notas</label>
            <textarea
              {...form.register("notes")}
              rows={2}
              placeholder="Observaciones adicionales..."
              maxLength={1000}
              className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Link
            href="/inventario"
            className="inline-flex items-center justify-center rounded-lg border border-input bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </Link>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Registrando..." : "Registrar movimiento"}
          </Button>
        </div>
      </form>
    </div>
  )
}
