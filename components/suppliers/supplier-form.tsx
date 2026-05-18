"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { z } from "zod"
import { ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  createSupplierSchema,
  type CreateSupplierInput,
  PERSON_TYPE_LABELS,
  DOCUMENT_TYPE_LABELS,
  VAT_CONDITION_LABELS,
} from "@/lib/validations/supplier"
import type { Supplier } from "@/lib/types/entities"

interface PaymentCondition {
  id: string
  name: string
  days: number
  isDefault: boolean
}

interface SupplierFormProps {
  supplier?: Supplier
  paymentConditions: PaymentCondition[]
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

export function SupplierForm({ supplier, paymentConditions }: SupplierFormProps) {
  const router = useRouter()
  const isEditing = Boolean(supplier)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof createSupplierSchema>, unknown, CreateSupplierInput>({
    resolver: zodResolver(createSupplierSchema),
    defaultValues: {
      type: supplier?.type ?? "COMPANY",
      firstName: supplier?.firstName ?? "",
      lastName: supplier?.lastName ?? "",
      companyName: supplier?.companyName ?? "",
      documentType: supplier?.documentType ?? "CUIT",
      documentNumber: supplier?.documentNumber ?? "",
      vatCondition: supplier?.vatCondition ?? "RESPONSABLE_INSCRIPTO",
      paymentConditionId: supplier?.paymentConditionId ?? "",
      creditLimit: supplier?.creditLimit ? Number(supplier.creditLimit) : undefined,
      phone: supplier?.phone ?? "",
      email: supplier?.email ?? "",
      website: supplier?.website ?? "",
      notes: supplier?.notes ?? "",
      isActive: supplier?.isActive ?? true,
    },
  })

  const personType = watch("type")

  async function onSubmit(data: CreateSupplierInput) {
    try {
      const url = isEditing
        ? `/api/suppliers/${supplier!.id}`
        : "/api/suppliers"

      const res = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      const json = await res.json() as { data?: Supplier; error?: string; details?: unknown }

      if (!res.ok) {
        toast.error(json.error ?? "Error al guardar el proveedor")
        return
      }

      toast.success(isEditing ? "Proveedor actualizado correctamente" : "Proveedor creado correctamente")
      router.push(`/proveedores/${json.data!.id}`)
      router.refresh()
    } catch {
      toast.error("Error de conexión")
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Tipo de proveedor</h2>

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

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Datos identificatorios</h2>

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

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Condición de pago</h2>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Condición de pago</label>
          <select
            {...register("paymentConditionId")}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <option value="">Sin condición</option>
            {paymentConditions.map((pc) => (
              <option key={pc.id} value={pc.id}>
                {pc.name}
              </option>
            ))}
          </select>
        </div>
      </div>

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

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Notas</h2>
        <Textarea
          {...register("notes")}
          placeholder="Observaciones generales del proveedor..."
          rows={3}
        />
      </div>

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
                Dejá en blanco para sin límite
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                {...register("isActive")}
                className="h-4 w-4 rounded border-gray-300"
              />
              <label htmlFor="isActive" className="text-sm text-gray-700">
                Proveedor activo
              </label>
            </div>
          </div>
        )}
      </div>

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
              ? "Actualizar proveedor"
              : "Crear proveedor"}
        </Button>
      </div>
    </form>
  )
}
