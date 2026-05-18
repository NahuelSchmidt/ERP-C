"use client"

/**
 * components/products/stock-movement-form.tsx
 *
 * Formulario para registrar ajustes manuales de stock.
 * Tipos permitidos: ADJUSTMENT, LOSS, RETURN, INVENTORY_COUNT.
 */

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  STOCK_MOVEMENT_TYPE_LABELS,
  MANUAL_MOVEMENT_TYPES,
} from "@/lib/validations/stock-movement"

// ---------------------------------------------------------------------------
// Local schema (subset of createStockMovementSchema)
// ---------------------------------------------------------------------------

const formSchema = z.object({
  productId: z.string().min(1),
  warehouseId: z.string().min(1, "Seleccioná un depósito"),
  type: z.enum(["ADJUSTMENT", "LOSS", "RETURN", "INVENTORY_COUNT"]),
  quantity: z.number().positive("La cantidad debe ser mayor a cero"),
  unitCost: z.number().nonnegative().optional(),
  reason: z.string().max(255).optional(),
  notes: z.string().max(1000).optional(),
})

type FormValues = z.infer<typeof formSchema>

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Warehouse {
  id: string
  name: string
  branch?: { name: string }
}

interface StockMovementFormProps {
  productId: string
  productName: string
  warehouses: Warehouse[]
  onSuccess?: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StockMovementForm({
  productId,
  productName,
  warehouses,
  onSuccess,
}: StockMovementFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      productId,
      type: "ADJUSTMENT",
      quantity: 1,
    },
  })

  const onSubmit = async (data: FormValues) => {
    try {
      const res = await fetch("/api/stock/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      const json = (await res.json()) as { error?: string }

      if (!res.ok) {
        toast.error(json.error ?? "Error al registrar el movimiento")
        return
      }

      toast.success("Movimiento de stock registrado correctamente")
      reset({ productId, type: "ADJUSTMENT", quantity: 1 })
      onSuccess?.()
    } catch {
      toast.error("Error de conexión. Por favor, intentá de nuevo.")
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <input type="hidden" {...register("productId")} />

      <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-sm text-blue-800">
        Producto: <strong>{productName}</strong>
      </div>

      {/* Tipo de movimiento */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">
          Tipo de movimiento <span className="text-red-500">*</span>
        </label>
        <select
          {...register("type")}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {MANUAL_MOVEMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {STOCK_MOVEMENT_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        {errors.type && (
          <p className="text-xs text-red-600">{errors.type.message}</p>
        )}
      </div>

      {/* Depósito */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">
          Depósito <span className="text-red-500">*</span>
        </label>
        <select
          {...register("warehouseId")}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="">Seleccionar depósito...</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.branch ? `${w.branch.name} — ` : ""}{w.name}
            </option>
          ))}
        </select>
        {errors.warehouseId && (
          <p className="text-xs text-red-600">{errors.warehouseId.message}</p>
        )}
      </div>

      {/* Cantidad */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">
          Cantidad <span className="text-red-500">*</span>
        </label>
        <Input
          type="number"
          step="0.01"
          min="0.01"
          {...register("quantity", { valueAsNumber: true })}
          placeholder="1"
        />
        {errors.quantity && (
          <p className="text-xs text-red-600">{errors.quantity.message}</p>
        )}
      </div>

      {/* Costo unitario (opcional) */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">
          Costo unitario{" "}
          <span className="text-gray-400 font-normal">(opcional)</span>
        </label>
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
            $
          </span>
          <Input
            type="number"
            step="0.01"
            min="0"
            {...register("unitCost", { valueAsNumber: true })}
            placeholder="0.00"
            className="pl-6"
          />
        </div>
      </div>

      {/* Motivo */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">Motivo</label>
        <Input
          {...register("reason")}
          placeholder="Ej: Ajuste por inventario físico"
        />
      </div>

      {/* Notas */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">Notas</label>
        <textarea
          {...register("notes")}
          rows={2}
          placeholder="Notas adicionales..."
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-none"
        />
      </div>

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? "Registrando..." : "Registrar movimiento"}
      </Button>
    </form>
  )
}
