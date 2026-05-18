"use client"

/**
 * components/customers/customer-form.tsx
 *
 * Formulario completo de cliente con React Hook Form + Zod.
 * Soporta creación y edición. Maneja campos condicionales por tipo (INDIVIDUAL/COMPANY).
 */

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { z } from "zod"
import { ChevronDown, ChevronUp, PlusIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  createCustomerSchema,
  type CreateCustomerInput,
  PERSON_TYPE_LABELS,
  DOCUMENT_TYPE_LABELS,
  VAT_CONDITION_LABELS,
} from "@/lib/validations/customer"
import type { Customer, CustomerCategory } from "@/lib/types/entities"

interface CustomerFormProps {
  customer?: Customer
  categories: CustomerCategory[]
  onCategoryCreated?: (category: CustomerCategory) => void
}

const PERSON_TYPES = Object.entries(PERSON_TYPE_LABELS) as [
  keyof typeof PERSON_TYPE_LABELS,
  string,
][]

const DOCUMENT_TYPES = Object.entries(DOCUMENT_TYPE_LABELS) as [
  keyof typeof DOCUMENT_TYPE_LABELS,
  string,
][]

const VAT_CONDITIONS = Object.entries(VAT_CONDITION_LABELS) as [
  keyof typeof VAT_CONDITION_LABELS,
  string,
][]

export function CustomerForm({
  customer,
  categories,
  onCategoryCreated,
}: CustomerFormProps) {
  const router = useRouter()
  const isEditing = Boolean(customer)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [categoryList, setCategoryList] = useState<CustomerCategory[]>(categories)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [isCreatingCategory, setIsCreatingCategory] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof createCustomerSchema>, unknown, CreateCustomerInput>({
    resolver: zodResolver(createCustomerSchema),
    defaultValues: {
      type: customer?.type ?? "COMPANY",
      firstName: customer?.firstName ?? "",
      lastName: customer?.lastName ?? "",
      companyName: customer?.companyName ?? "",
      documentType: customer?.documentType ?? "CUIT",
      documentNumber: customer?.documentNumber ?? "",
      vatCondition: customer?.vatCondition ?? "CONSUMIDOR_FINAL",
      grossIncomeNumber: customer?.grossIncomeNumber ?? "",
      creditLimit: customer?.creditLimit ? Number(customer.creditLimit) : undefined,
      categoryId: customer?.categoryId ?? "",
      priceListId: customer?.priceListId ?? "",
      phone: customer?.phone ?? "",
      email: customer?.email ?? "",
      website: customer?.website ?? "",
      notes: customer?.notes ?? "",
      isActive: customer?.isActive ?? true,
    },
  })

  const personType = watch("type")

  // Update categories when prop changes (after creating a new one)
  useEffect(() => {
    setCategoryList(categories)
  }, [categories])

  async function handleCreateCategory() {
    if (!newCategoryName.trim()) return
    setIsCreatingCategory(true)
    try {
      const res = await fetch("/api/customer-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCategoryName.trim() }),
      })
      const json = await res.json() as { data?: CustomerCategory; error?: string }
      if (!res.ok) {
        toast.error(json.error ?? "Error al crear la categoría")
        return
      }
      const created = json.data!
      setCategoryList((prev) => [...prev, created])
      setNewCategoryName("")
      toast.success(`Categoría "${created.name}" creada`)
      onCategoryCreated?.(created)
    } catch {
      toast.error("Error de conexión")
    } finally {
      setIsCreatingCategory(false)
    }
  }

  async function onSubmit(data: CreateCustomerInput) {
    try {
      const url = isEditing
        ? `/api/customers/${customer!.id}`
        : "/api/customers"

      const res = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      const json = await res.json() as { data?: Customer; error?: string; details?: unknown }

      if (!res.ok) {
        toast.error(json.error ?? "Error al guardar el cliente")
        return
      }

      toast.success(isEditing ? "Cliente actualizado correctamente" : "Cliente creado correctamente")
      router.push(`/clientes/${json.data!.id}`)
      router.refresh()
    } catch {
      toast.error("Error de conexión")
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* ------------------------------------------------------------------ */}
      {/* Sección: Tipo de persona                                             */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Tipo de cliente</h2>

        <div className="flex gap-3">
          {PERSON_TYPES.map(([value, label]) => (
            <label
              key={value}
              className="flex items-center gap-2 cursor-pointer"
            >
              <input
                type="radio"
                value={value}
                {...register("type")}
                className="h-4 w-4 text-blue-600 border-gray-300"
              />
              <span className="text-sm text-gray-700">{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Sección: Datos identificatorios                                      */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Datos identificatorios</h2>

        {/* Nombre — condicional por tipo */}
        {personType === "COMPANY" ? (
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Razón social *</label>
            <Input
              {...register("companyName")}
              placeholder="Empresa S.A."
            />
            {errors.companyName && (
              <p className="text-xs text-red-500">{errors.companyName.message}</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Nombre *</label>
              <Input {...register("firstName")} placeholder="Juan" />
              {errors.firstName && (
                <p className="text-xs text-red-500">{errors.firstName.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Apellido</label>
              <Input {...register("lastName")} placeholder="García" />
            </div>
          </div>
        )}

        {/* Documento */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Tipo doc.</label>
            <select
              {...register("documentType")}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {DOCUMENT_TYPES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2 space-y-1">
            <label className="text-sm font-medium text-gray-700">Número</label>
            <Input
              {...register("documentNumber")}
              placeholder="30-12345678-9"
            />
          </div>
        </div>

        {/* Condición IVA */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Condición IVA</label>
          <select
            {...register("vatCondition")}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {VAT_CONDITIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Sección: Contacto                                                    */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Contacto</h2>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Teléfono</label>
            <Input {...register("phone")} placeholder="011-4321-1234" type="tel" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Email</label>
            <Input {...register("email")} placeholder="contacto@empresa.com" type="email" />
            {errors.email && (
              <p className="text-xs text-red-500">{errors.email.message}</p>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Sitio web</label>
          <Input {...register("website")} placeholder="https://www.empresa.com" type="url" />
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Sección: Categoría                                                   */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Categorización</h2>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Categoría</label>
          <div className="flex gap-2">
            <select
              {...register("categoryId")}
              className="h-8 flex-1 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <option value="">Sin categoría</option>
              {categoryList
                .filter((c) => c.isActive)
                .map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Crear categoría inline */}
        <div className="flex gap-2 items-center">
          <Input
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="Nueva categoría..."
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                void handleCreateCategory()
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleCreateCategory()}
            disabled={isCreatingCategory || !newCategoryName.trim()}
          >
            <PlusIcon className="w-3.5 h-3.5" />
            Crear
          </Button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Sección: Notas                                                       */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Notas</h2>
        <Textarea
          {...register("notes")}
          placeholder="Observaciones generales del cliente..."
          rows={3}
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Sección avanzada (colapsable)                                        */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-gray-900 hover:bg-gray-50 transition-colors"
        >
          Datos avanzados
          {showAdvanced ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </button>

        {showAdvanced && (
          <div className="px-5 pb-5 space-y-4 border-t border-gray-100 pt-4">
            {/* Ingresos brutos */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                N° Ingresos Brutos
              </label>
              <Input
                {...register("grossIncomeNumber")}
                placeholder="Número de ingresos brutos"
              />
            </div>

            {/* Límite de crédito */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Límite de crédito (ARS)</label>
              <Input
                {...register("creditLimit", { valueAsNumber: true })}
                type="number"
                min={0}
                step={0.01}
                placeholder="0.00"
              />
              <p className="text-xs text-gray-400">
                Déjá en blanco para sin límite
              </p>
            </div>

            {/* Estado activo */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                {...register("isActive")}
                className="h-4 w-4 rounded border-gray-300"
              />
              <label htmlFor="isActive" className="text-sm text-gray-700">
                Cliente activo
              </label>
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Acciones del formulario                                              */}
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
              ? "Actualizar cliente"
              : "Crear cliente"}
        </Button>
      </div>
    </form>
  )
}
