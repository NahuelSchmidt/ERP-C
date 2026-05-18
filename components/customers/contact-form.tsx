"use client"

/**
 * components/customers/contact-form.tsx
 *
 * Formulario para agregar/editar un contacto de cliente.
 */

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  createContactSchema,
  type CreateContactInput,
} from "@/lib/validations/customer"
import type { CustomerContact } from "@/lib/types/entities"

interface ContactFormProps {
  customerId: string
  contact?: CustomerContact
  onSuccess: (contact: CustomerContact) => void
  onCancel: () => void
}

export function ContactForm({ customerId, contact, onSuccess, onCancel }: ContactFormProps) {
  const isEditing = Boolean(contact)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof createContactSchema>, unknown, CreateContactInput>({
    resolver: zodResolver(createContactSchema),
    defaultValues: {
      name: contact?.name ?? "",
      role: contact?.role ?? "",
      phone: contact?.phone ?? "",
      mobile: contact?.mobile ?? "",
      email: contact?.email ?? "",
      isPrimary: contact?.isPrimary ?? false,
      notes: contact?.notes ?? "",
    },
  })

  async function onSubmit(data: CreateContactInput) {
    try {
      const url = isEditing
        ? `/api/customers/${customerId}/contacts/${contact!.id}`
        : `/api/customers/${customerId}/contacts`

      const res = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      const json = await res.json() as { data?: CustomerContact; error?: string }

      if (!res.ok) {
        toast.error(json.error ?? "Error al guardar el contacto")
        return
      }

      toast.success(isEditing ? "Contacto actualizado" : "Contacto agregado")
      onSuccess(json.data!)
    } catch {
      toast.error("Error de conexión")
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Nombre */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">Nombre *</label>
        <Input {...register("name")} placeholder="Juan García" />
        {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
      </div>

      {/* Cargo */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">Cargo / Área</label>
        <Input {...register("role")} placeholder="Gerente de Compras" />
      </div>

      {/* Teléfono y celular */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Teléfono</label>
          <Input {...register("phone")} placeholder="011-4321-1234" type="tel" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Celular</label>
          <Input {...register("mobile")} placeholder="11 1234-5678" type="tel" />
        </div>
      </div>

      {/* Email */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">Email</label>
        <Input {...register("email")} placeholder="juan@empresa.com" type="email" />
        {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
      </div>

      {/* Contacto principal */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isPrimary"
          {...register("isPrimary")}
          className="h-4 w-4 rounded border-gray-300"
        />
        <label htmlFor="isPrimary" className="text-sm text-gray-700">
          Contacto principal
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
