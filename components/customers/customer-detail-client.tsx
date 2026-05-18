"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  PencilIcon,
  TrashIcon,
  PlusIcon,
  MapPinIcon,
  UserIcon,
  PhoneIcon,
  MailIcon,
  GlobeIcon,
  StarIcon,
} from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { AddressForm } from "@/components/customers/address-form"
import { ContactForm } from "@/components/customers/contact-form"
import { VAT_CONDITION_LABELS } from "@/lib/validations/customer"
import type { Customer, CustomerAddress, CustomerContact } from "@/lib/types/entities"

interface CustomerDetailClientProps {
  customer: Customer
}

const ADDRESS_TYPE_LABELS: Record<string, string> = {
  FISCAL: "Fiscal",
  DELIVERY: "Entrega",
  BILLING: "Facturación",
  OTHER: "Otro",
}

function formatCurrency(val: string | number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
  }).format(Number(val))
}

function getDisplayName(c: Customer): string {
  if (c.type === "COMPANY") return c.companyName ?? "-"
  return [c.firstName, c.lastName].filter(Boolean).join(" ") || "-"
}

export function CustomerDetailClient({ customer }: CustomerDetailClientProps) {
  const router = useRouter()
  const [addresses, setAddresses] = useState<CustomerAddress[]>(customer.addresses ?? [])
  const [contacts, setContacts] = useState<CustomerContact[]>(customer.contacts ?? [])
  const [addressDialog, setAddressDialog] = useState<{ open: boolean; address?: CustomerAddress }>({ open: false })
  const [contactDialog, setContactDialog] = useState<{ open: boolean; contact?: CustomerContact }>({ open: false })

  const balance = Number(customer.currentBalance)

  async function deleteAddress(id: string) {
    if (!confirm("¿Eliminar esta dirección?")) return
    const res = await fetch(`/api/customers/${customer.id}/addresses/${id}`, { method: "DELETE" })
    if (!res.ok) { toast.error("No se pudo eliminar la dirección"); return }
    setAddresses((prev) => prev.filter((a) => a.id !== id))
    toast.success("Dirección eliminada")
  }

  async function deleteContact(id: string) {
    if (!confirm("¿Eliminar este contacto?")) return
    const res = await fetch(`/api/customers/${customer.id}/contacts/${id}`, { method: "DELETE" })
    if (!res.ok) { toast.error("No se pudo eliminar el contacto"); return }
    setContacts((prev) => prev.filter((c) => c.id !== id))
    toast.success("Contacto eliminado")
  }

  async function deleteCustomer() {
    if (!confirm(`¿Eliminar al cliente "${getDisplayName(customer)}"? Esta acción no se puede deshacer.`)) return
    const res = await fetch(`/api/customers/${customer.id}`, { method: "DELETE" })
    if (!res.ok) { toast.error("No se pudo eliminar el cliente"); return }
    toast.success("Cliente eliminado")
    router.push("/clientes")
  }

  function handleAddressSuccess(addr: CustomerAddress) {
    setAddresses((prev) => {
      const idx = prev.findIndex((a) => a.id === addr.id)
      if (idx >= 0) {
        const updated = [...prev]
        updated[idx] = addr
        return updated
      }
      return [...prev, addr]
    })
    setAddressDialog({ open: false })
  }

  function handleContactSuccess(contact: CustomerContact) {
    setContacts((prev) => {
      const idx = prev.findIndex((c) => c.id === contact.id)
      if (idx >= 0) {
        const updated = [...prev]
        updated[idx] = contact
        return updated
      }
      return [...prev, contact]
    })
    setContactDialog({ open: false })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">{getDisplayName(customer)}</h1>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                customer.isActive ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
              }`}
            >
              {customer.isActive ? "Activo" : "Inactivo"}
            </span>
          </div>
          {customer.category && (
            <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full inline-block"
                style={{ backgroundColor: customer.category.color ?? "#d1d5db" }}
              />
              {customer.category.name}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/clientes/${customer.id}/editar`}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            <PencilIcon className="w-4 h-4 mr-1.5" />
            Editar
          </Link>
          <Button
            variant="outline"
            onClick={() => void deleteCustomer()}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
          >
            <TrashIcon className="w-4 h-4 mr-1.5" />
            Eliminar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna principal */}
        <div className="lg:col-span-2 space-y-6">

          {/* Datos identificatorios */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Datos identificatorios</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-400 uppercase font-medium">Tipo</p>
                <p className="mt-0.5 text-gray-900">{customer.type === "COMPANY" ? "Empresa" : "Persona física"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase font-medium">Condición IVA</p>
                <p className="mt-0.5 text-gray-900">
                  {VAT_CONDITION_LABELS[customer.vatCondition as keyof typeof VAT_CONDITION_LABELS] ?? customer.vatCondition}
                </p>
              </div>
              {customer.documentNumber && (
                <div>
                  <p className="text-xs text-gray-400 uppercase font-medium">{customer.documentType}</p>
                  <p className="mt-0.5 text-gray-900 font-mono">{customer.documentNumber}</p>
                </div>
              )}
              {customer.grossIncomeNumber && (
                <div>
                  <p className="text-xs text-gray-400 uppercase font-medium">Ingresos Brutos</p>
                  <p className="mt-0.5 text-gray-900 font-mono">{customer.grossIncomeNumber}</p>
                </div>
              )}
              {customer.phone && (
                <div className="flex items-center gap-2">
                  <PhoneIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400 uppercase font-medium">Teléfono</p>
                    <p className="mt-0.5 text-gray-900">{customer.phone}</p>
                  </div>
                </div>
              )}
              {customer.email && (
                <div className="flex items-center gap-2">
                  <MailIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400 uppercase font-medium">Email</p>
                    <p className="mt-0.5 text-gray-900">{customer.email}</p>
                  </div>
                </div>
              )}
              {customer.website && (
                <div className="flex items-center gap-2">
                  <GlobeIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400 uppercase font-medium">Web</p>
                    <a href={customer.website} target="_blank" rel="noopener noreferrer" className="mt-0.5 text-blue-600 hover:underline">
                      {customer.website}
                    </a>
                  </div>
                </div>
              )}
            </div>
            {customer.notes && (
              <div className="border-t border-gray-100 pt-3">
                <p className="text-xs text-gray-400 uppercase font-medium mb-1">Notas</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{customer.notes}</p>
              </div>
            )}
          </div>

          {/* Direcciones */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <MapPinIcon className="w-4 h-4 text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-900">Direcciones</h2>
                <span className="text-xs text-gray-400">({addresses.length})</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAddressDialog({ open: true })}
              >
                <PlusIcon className="w-3.5 h-3.5" />
                Agregar
              </Button>
            </div>

            {addresses.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Sin direcciones registradas</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {addresses.map((addr) => (
                  <li key={addr.id} className="flex items-start justify-between px-5 py-3">
                    <div className="text-sm">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                          {ADDRESS_TYPE_LABELS[addr.type] ?? addr.type}
                        </span>
                        {addr.isDefault && (
                          <span className="inline-flex items-center gap-0.5 text-xs text-amber-600">
                            <StarIcon className="w-3 h-3 fill-amber-400 text-amber-400" />
                            Principal
                          </span>
                        )}
                      </div>
                      <p className="text-gray-900 mt-0.5">
                        {addr.street}{addr.number ? ` ${addr.number}` : ""}
                        {addr.floor ? `, Piso ${addr.floor}` : ""}
                        {addr.apartment ? ` Dpto ${addr.apartment}` : ""}
                      </p>
                      <p className="text-gray-500">
                        {[addr.city, addr.state, addr.postalCode].filter(Boolean).join(", ")}
                        {addr.country && addr.country !== "Argentina" ? ` — ${addr.country}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 ml-3">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setAddressDialog({ open: true, address: addr })}
                      >
                        <PencilIcon className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => void deleteAddress(addr.id)}
                        className="text-red-400 hover:text-red-600 hover:bg-red-50"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Contactos */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-900">Contactos</h2>
                <span className="text-xs text-gray-400">({contacts.length})</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setContactDialog({ open: true })}
              >
                <PlusIcon className="w-3.5 h-3.5" />
                Agregar
              </Button>
            </div>

            {contacts.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Sin contactos registrados</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {contacts.map((c) => (
                  <li key={c.id} className="flex items-start justify-between px-5 py-3">
                    <div className="text-sm">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{c.name}</p>
                        {c.isPrimary && (
                          <span className="inline-flex items-center gap-0.5 text-xs text-amber-600">
                            <StarIcon className="w-3 h-3 fill-amber-400 text-amber-400" />
                            Principal
                          </span>
                        )}
                      </div>
                      {c.role && <p className="text-gray-500">{c.role}</p>}
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                        {c.phone && <span className="text-gray-500">{c.phone}</span>}
                        {c.mobile && <span className="text-gray-500">{c.mobile}</span>}
                        {c.email && <span className="text-gray-500">{c.email}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-3">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setContactDialog({ open: true, contact: c })}
                      >
                        <PencilIcon className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => void deleteContact(c.id)}
                        className="text-red-400 hover:text-red-600 hover:bg-red-50"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Columna lateral */}
        <div className="space-y-6">
          {/* Saldo CC */}
          <div className={`bg-white rounded-xl border p-5 ${
            balance > 0 ? "border-red-200 bg-red-50" : balance < 0 ? "border-green-200 bg-green-50" : "border-gray-200"
          }`}>
            <p className="text-xs text-gray-500 uppercase font-medium">Saldo Cuenta Corriente</p>
            <p className={`text-2xl font-bold mt-1 ${
              balance > 0 ? "text-red-600" : balance < 0 ? "text-green-600" : "text-gray-900"
            }`}>
              {formatCurrency(customer.currentBalance)}
            </p>
            {balance > 0 && <p className="text-xs text-red-500 mt-0.5">Saldo deudor</p>}
            {balance < 0 && <p className="text-xs text-green-600 mt-0.5">Saldo a favor</p>}
            {customer.creditLimit && (
              <p className="text-xs text-gray-400 mt-1">
                Límite: {formatCurrency(customer.creditLimit)}
              </p>
            )}
          </div>

          {/* Acciones rápidas */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Acciones</h2>
            <Link
              href={`/facturacion?customerId=${customer.id}`}
              className={cn(buttonVariants({ variant: "outline" }), "w-full justify-start")}
            >
              Ver facturas
            </Link>
            <Link
              href={`/facturacion/nueva?customerId=${customer.id}`}
              className={cn(buttonVariants({ variant: "outline" }), "w-full justify-start")}
            >
              Nueva factura
            </Link>
          </div>

          {/* Metadata */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2 text-xs text-gray-400">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">Info</h2>
            <p>Creado: {new Date(customer.createdAt).toLocaleDateString("es-AR")}</p>
            <p>Actualizado: {new Date(customer.updatedAt).toLocaleDateString("es-AR")}</p>
            <p className="font-mono break-all">{customer.id}</p>
          </div>
        </div>
      </div>

      {/* Modal: Dirección */}
      {addressDialog.open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={(e) => { if (e.target === e.currentTarget) setAddressDialog({ open: false }) }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">
              {addressDialog.address ? "Editar dirección" : "Nueva dirección"}
            </h3>
            <AddressForm
              customerId={customer.id}
              address={addressDialog.address}
              onSuccess={handleAddressSuccess}
              onCancel={() => setAddressDialog({ open: false })}
            />
          </div>
        </div>
      )}

      {/* Modal: Contacto */}
      {contactDialog.open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={(e) => { if (e.target === e.currentTarget) setContactDialog({ open: false }) }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">
              {contactDialog.contact ? "Editar contacto" : "Nuevo contacto"}
            </h3>
            <ContactForm
              customerId={customer.id}
              contact={contactDialog.contact}
              onSuccess={handleContactSuccess}
              onCancel={() => setContactDialog({ open: false })}
            />
          </div>
        </div>
      )}
    </div>
  )
}
