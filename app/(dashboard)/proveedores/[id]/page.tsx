import { notFound } from "next/navigation"
import Link from "next/link"
import {
  ChevronLeftIcon,
  PencilIcon,
  MapPinIcon,
  UserIcon,
  PhoneIcon,
  MailIcon,
  GlobeIcon,
  StarIcon,
} from "lucide-react"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { VAT_CONDITION_LABELS } from "@/lib/validations/supplier"
import type { Supplier } from "@/lib/types/entities"

const ADDRESS_TYPE_LABELS: Record<string, string> = {
  FISCAL: "Fiscal",
  DELIVERY: "Entrega",
  BILLING: "Facturación",
  OTHER: "Otro",
}

function getDisplayName(s: Supplier): string {
  if (s.type === "COMPANY") return s.companyName ?? "-"
  return [s.firstName, s.lastName].filter(Boolean).join(" ") || "-"
}

export default async function ProveedorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const db = await getTenantDb()
  const { tenantId } = await getTenantContext()

  const supplier = await db.supplier.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: {
      paymentCondition: { select: { id: true, name: true } },
      addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] },
      contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
    },
  })

  if (!supplier) notFound()

  const s = JSON.parse(JSON.stringify(supplier)) as Supplier

  const displayName = getDisplayName(s)

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-3 mb-5">
        <Link
          href="/proveedores"
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ChevronLeftIcon className="w-4 h-4" />
          Proveedores
        </Link>
      </div>

      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">{displayName}</h1>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  s.isActive ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
                }`}
              >
                {s.isActive ? "Activo" : "Inactivo"}
              </span>
            </div>
            {s.paymentCondition && (
              <p className="text-sm text-gray-500 mt-0.5">{s.paymentCondition.name}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/proveedores/${s.id}/editar`}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              <PencilIcon className="w-4 h-4 mr-1.5" />
              Editar
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <h2 className="text-sm font-semibold text-gray-900">Datos identificatorios</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-400 uppercase font-medium">Tipo</p>
                  <p className="mt-0.5 text-gray-900">{s.type === "COMPANY" ? "Empresa" : "Persona física"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase font-medium">Condición IVA</p>
                  <p className="mt-0.5 text-gray-900">
                    {VAT_CONDITION_LABELS[s.vatCondition as keyof typeof VAT_CONDITION_LABELS] ?? s.vatCondition}
                  </p>
                </div>
                {s.paymentCondition && (
                  <div>
                    <p className="text-xs text-gray-400 uppercase font-medium">Condición de pago</p>
                    <p className="mt-0.5 text-gray-900">{s.paymentCondition.name}</p>
                  </div>
                )}
                {s.documentNumber && (
                  <div>
                    <p className="text-xs text-gray-400 uppercase font-medium">{s.documentType}</p>
                    <p className="mt-0.5 text-gray-900 font-mono">{s.documentNumber}</p>
                  </div>
                )}
                {s.phone && (
                  <div className="flex items-center gap-2">
                    <PhoneIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-400 uppercase font-medium">Teléfono</p>
                      <p className="mt-0.5 text-gray-900">{s.phone}</p>
                    </div>
                  </div>
                )}
                {s.email && (
                  <div className="flex items-center gap-2">
                    <MailIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-400 uppercase font-medium">Email</p>
                      <p className="mt-0.5 text-gray-900">{s.email}</p>
                    </div>
                  </div>
                )}
                {s.website && (
                  <div className="flex items-center gap-2">
                    <GlobeIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-400 uppercase font-medium">Web</p>
                      <a
                        href={s.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-0.5 text-blue-600 hover:underline"
                      >
                        {s.website}
                      </a>
                    </div>
                  </div>
                )}
              </div>
              {s.notes && (
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-xs text-gray-400 uppercase font-medium mb-1">Notas</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{s.notes}</p>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <MapPinIcon className="w-4 h-4 text-gray-400" />
                  <h2 className="text-sm font-semibold text-gray-900">Direcciones</h2>
                  <span className="text-xs text-gray-400">({(s.addresses ?? []).length})</span>
                </div>
              </div>

              {(s.addresses ?? []).length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Sin direcciones registradas</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {(s.addresses ?? []).map((addr) => (
                    <li key={addr.id} className="px-5 py-3">
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
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <UserIcon className="w-4 h-4 text-gray-400" />
                  <h2 className="text-sm font-semibold text-gray-900">Contactos</h2>
                  <span className="text-xs text-gray-400">({(s.contacts ?? []).length})</span>
                </div>
              </div>

              {(s.contacts ?? []).length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Sin contactos registrados</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {(s.contacts ?? []).map((c) => (
                    <li key={c.id} className="px-5 py-3">
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
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2 text-xs text-gray-400">
              <h2 className="text-sm font-semibold text-gray-700 mb-2">Info</h2>
              <p>Creado: {new Date(s.createdAt).toLocaleDateString("es-AR")}</p>
              <p>Actualizado: {new Date(s.updatedAt).toLocaleDateString("es-AR")}</p>
              <p className="font-mono break-all">{s.id}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
