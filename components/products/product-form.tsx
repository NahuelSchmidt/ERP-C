"use client"

/**
 * components/products/product-form.tsx
 *
 * Formulario de producto con tres secciones:
 *   1. Info General
 *   2. Control de Inventario (condicional según trackStock)
 *   3. Costos y Precio
 *
 * Usado tanto en /productos/new como en /productos/:id/edit
 */

import { useEffect, useMemo } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  createProductSchema,
  type CreateProductInput,
  PRODUCT_STATUS_LABELS,
} from "@/lib/validations/product"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Category {
  id: string
  name: string
  children?: Category[]
}

interface Unit {
  id: string
  name: string
  abbreviation: string
}

interface ProductFormProps {
  defaultValues?: Partial<CreateProductInput>
  productId?: string // if editing
  categories: Category[]
  units: Unit[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function flattenCategories(
  cats: Category[],
  depth = 0
): Array<{ id: string; label: string }> {
  return cats.flatMap((c) => [
    { id: c.id, label: `${"  ".repeat(depth)}${c.name}` },
    ...flattenCategories(c.children ?? [], depth + 1),
  ])
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProductForm({
  defaultValues,
  productId,
  categories,
  units,
}: ProductFormProps) {
  const router = useRouter()
  const isEditing = !!productId

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof createProductSchema>, unknown, CreateProductInput>({
    resolver: zodResolver(createProductSchema),
    defaultValues: {
      trackStock: true,
      trackBatches: false,
      trackSerials: false,
      allowNegative: false,
      status: "ACTIVE",
      defaultMargin: 0,
      costPrice: 0,
      weightUnit: "kg",
      ...defaultValues,
    },
  })

  const trackStock = watch("trackStock")
  const costPrice = watch("costPrice") ?? 0
  const defaultMargin = watch("defaultMargin") ?? 0
  const minStock = watch("minStock")

  // Precio de venta calculado en tiempo real
  const listPrice = useMemo(() => {
    const c = Number(costPrice) || 0
    const m = Number(defaultMargin) || 0
    return c * (1 + m)
  }, [costPrice, defaultMargin])

  // Reset stock fields when trackStock is toggled off
  useEffect(() => {
    if (!trackStock) {
      setValue("minStock", null)
      setValue("maxStock", null)
      setValue("reorderPoint", null)
    }
  }, [trackStock, setValue])

  const onSubmit = async (data: CreateProductInput) => {
    try {
      const url = isEditing ? `/api/products/${productId}` : "/api/products"
      const method = isEditing ? "PATCH" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      const json = (await res.json()) as { error?: string }

      if (!res.ok) {
        toast.error(json.error ?? "Error al guardar el producto")
        return
      }

      toast.success(isEditing ? "Producto actualizado" : "Producto creado")
      router.push("/productos")
      router.refresh()
    } catch {
      toast.error("Error de conexión. Por favor, intentá de nuevo.")
    }
  }

  const flatCats = useMemo(() => flattenCategories(categories), [categories])

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* ------------------------------------------------------------------ */}
      {/* SECCIÓN 1 — Info General                                            */}
      {/* ------------------------------------------------------------------ */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <h2 className="text-base font-semibold text-gray-900">Información general</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Nombre */}
          <div className="lg:col-span-2 space-y-1">
            <label className="text-sm font-medium text-gray-700">
              Nombre <span className="text-red-500">*</span>
            </label>
            <Input
              {...register("name")}
              placeholder="Ej: Tornillo M6 x 20mm"
              aria-invalid={!!errors.name}
            />
            {errors.name && (
              <p className="text-xs text-red-600">{errors.name.message}</p>
            )}
          </div>

          {/* Estado */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Estado</label>
            <select
              {...register("status")}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {Object.entries(PRODUCT_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Código interno */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">
              Código interno
            </label>
            <Input
              {...register("internalCode")}
              placeholder="Ej: PROD-001"
            />
          </div>

          {/* SKU */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">SKU</label>
            <Input {...register("sku")} placeholder="Ej: SKU-12345" />
          </div>

          {/* Código de barras */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">
              Código de barras
            </label>
            <Input
              {...register("barcode")}
              placeholder="EAN13 / Code128"
            />
          </div>

          {/* Categoría */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">
              Categoría
            </label>
            <select
              {...register("categoryId")}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">Sin categoría</option>
              {flatCats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Unidad de medida */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">
              Unidad de medida
            </label>
            <select
              {...register("unitId")}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">Unidad (por defecto)</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.abbreviation})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Descripción */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">
            Descripción
          </label>
          <textarea
            {...register("description")}
            rows={3}
            placeholder="Descripción opcional del producto..."
            className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-none"
          />
        </div>

        {/* Notas */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Notas internas</label>
          <textarea
            {...register("notes")}
            rows={2}
            placeholder="Notas internas (no visible al cliente)..."
            className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-none"
          />
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* SECCIÓN 2 — Control de Inventario                                   */}
      {/* ------------------------------------------------------------------ */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <h2 className="text-base font-semibold text-gray-900">Control de stock</h2>

        {/* Toggles */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              { field: "trackStock", label: "Controlar stock" },
              { field: "trackBatches", label: "Lotes y vencimientos" },
              { field: "trackSerials", label: "Números de serie" },
              { field: "allowNegative", label: "Permitir stock negativo" },
            ] as const
          ).map(({ field, label }) => (
            <Controller
              key={field}
              name={field}
              control={control}
              render={({ field: { value, onChange } }) => (
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <Checkbox
                    checked={value as boolean}
                    onCheckedChange={onChange}
                  />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              )}
            />
          ))}
        </div>

        {/* Campos condicionales de stock */}
        {trackStock && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 pt-2 border-t border-gray-100">
            {/* Stock mínimo */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                Stock mínimo
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                {...register("minStock", { valueAsNumber: true })}
                placeholder="0"
              />
              {errors.minStock && (
                <p className="text-xs text-red-600">{String(errors.minStock.message)}</p>
              )}
            </div>

            {/* Stock máximo */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                Stock máximo
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                {...register("maxStock", { valueAsNumber: true })}
                placeholder="0"
              />
            </div>

            {/* Punto de reorden */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                Punto de reorden
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                {...register("reorderPoint", { valueAsNumber: true })}
                placeholder="0"
              />
            </div>

            {/* Vista previa de alerta */}
            {minStock != null && Number(minStock) > 0 && (
              <div className="sm:col-span-3">
                <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
                  <svg
                    className="w-4 h-4 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  Se enviará una alerta cuando el stock sea menor a{" "}
                  <strong>{Number(minStock).toFixed(2)} unidades</strong>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Atributos físicos */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2 border-t border-gray-100">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Peso</label>
            <div className="flex gap-2">
              <Input
                type="number"
                step="0.001"
                min="0"
                {...register("weight", { valueAsNumber: true })}
                placeholder="0.000"
              />
              <select
                {...register("weightUnit")}
                className="h-8 w-24 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring"
              >
                <option value="kg">kg</option>
                <option value="g">g</option>
                <option value="lb">lb</option>
                <option value="oz">oz</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* SECCIÓN 3 — Costos y Precio                                         */}
      {/* ------------------------------------------------------------------ */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <h2 className="text-base font-semibold text-gray-900">Costos y precio</h2>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {/* Costo de compra */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">
              Costo de compra
            </label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                $
              </span>
              <Input
                type="number"
                step="0.01"
                min="0"
                {...register("costPrice", { valueAsNumber: true })}
                placeholder="0.00"
                className="pl-6"
              />
            </div>
            {errors.costPrice && (
              <p className="text-xs text-red-600">{errors.costPrice.message}</p>
            )}
          </div>

          {/* Margen */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">
              Margen de ganancia (%)
            </label>
            <div className="relative">
              <Input
                type="number"
                step="0.1"
                min="0"
                max="1000"
                {...register("defaultMargin", {
                  valueAsNumber: true,
                  setValueAs: (v) => {
                    const n = parseFloat(v)
                    return isNaN(n) ? 0 : n / 100
                  },
                })}
                placeholder="30"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                %
              </span>
            </div>
          </div>

          {/* Precio de venta calculado */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">
              Precio lista (calculado)
            </label>
            <div className="h-8 flex items-center px-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm font-medium text-gray-900">
              {new Intl.NumberFormat("es-AR", {
                style: "currency",
                currency: "ARS",
              }).format(listPrice)}
            </div>
            {defaultMargin > 0 && (
              <p className="text-xs text-gray-400">
                Margen:{" "}
                {(Number(defaultMargin) * 100).toFixed(1)}%
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Footer con acciones                                                 */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? "Guardando..."
            : isEditing
              ? "Guardar cambios"
              : "Crear producto"}
        </Button>
      </div>
    </form>
  )
}
