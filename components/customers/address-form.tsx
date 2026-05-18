"use client"

/**
 * components/customers/address-form.tsx
 *
 * Formulario para agregar/editar una dirección de cliente.
 * Se muestra dentro de un Dialog.
 */

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  createAddressSchema,
  type CreateAddressInput,
  ADDRESS_TYPE_LABELS,
} from "@/lib/validations/customer"
import type { CustomerAddress } from "@/lib/types/entities"

interface AddressFormProps {
  customerId: string
  address?: CustomerAddress
  onSuccess: (address: CustomerAddress) => void
  onCancel: () => void
}

const ADDRESS_TYPES = Object.entries(ADDRESS_TYPE_LABELS) as [
  keyof typeof ADDRESS_TYPE_LABELS,
  string,
][]

export function AddressForm({ customerId, address, onSuccess, onCancel }: AddressFormProps) {
  const isEditing = Boolean(address)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof createAddressSchema>, unknown, CreateAddressInput>({
    resolver: zodResolver(createAddressSchema),
    defaultValues: {
      type: address?.type ?? "FISCAL",
      street: address?.street ?? "",
      number: address?.number ?? "",
      floor: address?.floor ?? "",
      apartment: address?.apartment ?? "",
      city: address?.city ?? "",
      state: address?.state ?? "",
      postalCode: address?.postalCode ?? "",
      country: address?.country ?? "Argentina",
      isDefault: address?.isDefault ?? false,
      notes: address?.notes ?? "",
    },
  })

  async function onSubmit(data: CreateAddressInput) {
    try {
      const url = isEditing
        ? `/api/customers/${customerId}/addresses/${address!.id}`
        : `/api/customers/${customerId}/addresses`

      const res = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      const json = await res.json() as { data?: CustomerAddress; error?: string }

      if (!res.ok) {
        toast.error(json.error ?? "Error al guardar la dirección")
        return
      }

      toast.success(isEditing ? "Dirección actualizada" : "Dirección agregada")
      onSuccess(json.data!)
    } catch {
      toast.error("Error de conexión")
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Tipo */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">Tipo de dirección</label>
        <select
          {...register("type")}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {ADDRESS_TYPES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {errors.type && <p className="text-xs text-red-500">{errors.type.message}</p>}
      </div>

      {/* Calle y número */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 space-y-1">
          <label className="text-sm font-medium text-gray-700">Calle *</label>
          <Input {...register("street")} placeholder="Av. Corrientes" />
          {errors.street && <p className="text-xs text-red-500">{errors.street.message}</p>}
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Número</label>
          <Input {...register("number")} placeholder="1234" />
        </div>
      </div>

      {/* Piso y departamento */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Piso</label>
          <Input {...register("floor")} placeholder="3" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Departamento</label>
          <Input {...register("apartment")} placeholder="A" />
        </div>
      </div>

      {/* Ciudad, provincia */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Ciudad</label>
          <Input {...register("city")} placeholder="Buenos Aires" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Provincia</label>
          <Input {...register("state")} placeholder="CABA" />
        </div>
      </div>

      {/* Código postal y país */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Código postal</label>
          <Input {...register("postalCode")} placeholder="C1043" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">País</label>
          <Input {...register("country")} placeholder="Argentina" />
        </div>
      </div>

      {/* Dirección principal */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isDefault"
          {...register("isDefault")}
          className="h-4 w-4 rounded border-gray-300"
        />
        <label htmlFor="isDefault" className="text-sm text-gray-700">
          Establecer como dirección principal
        </label>
      </div>

      {/* Notas */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">Notas (opcional)</label>
        <Input {...register("notes")} placeholder="Observaciones adicionales" />
      </div>

      {/* Acciones */}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Guardando..." : isEditing ? "Actualizar" : "Agregar"}
        </Button>
      </div>
    </form>
  )
}
