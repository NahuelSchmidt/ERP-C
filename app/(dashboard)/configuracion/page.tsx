"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { VAT_CONDITION_LABELS, DOCUMENT_TYPE_LABELS } from "@/lib/validations/customer"

interface TenantConfig {
  id: string
  companyName: string
  tradeName: string | null
  documentType: string
  documentNumber: string
  vatCondition: string
  grossIncomeNumber: string | null
  address: string | null
  city: string | null
  state: string | null
  country: string
  postalCode: string | null
  phone: string | null
  email: string | null
  website: string | null
  currency: string
  timezone: string | null
}

const editConfigSchema = z.object({
  companyName: z.string().min(1, "El nombre es obligatorio"),
  tradeName: z.string().optional(),
  documentType: z.enum(["CUIT", "CUIL", "DNI", "PASSPORT", "OTHER"]),
  documentNumber: z.string().min(1, "El documento es obligatorio"),
  vatCondition: z.enum([
    "RESPONSABLE_INSCRIPTO",
    "MONOTRIBUTISTA",
    "CONSUMIDOR_FINAL",
    "EXENTO",
  ]),
  grossIncomeNumber: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().min(1, "El país es obligatorio"),
  postalCode: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  website: z.string().optional(),
  currency: z.string().min(1),
  timezone: z.string().optional(),
})

type EditConfigInput = z.infer<typeof editConfigSchema>

export default function ConfiguracionPage() {
  const [config, setConfig] = useState<TenantConfig | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const form = useForm<EditConfigInput>({
    resolver: zodResolver(editConfigSchema),
  })

  async function loadConfig() {
    setIsLoading(true)
    try {
      const res = await fetch("/api/config")
      if (!res.ok) throw new Error()
      const json = (await res.json()) as { data: TenantConfig }
      setConfig(json.data)
      if (json.data) {
        form.reset({
          companyName: json.data.companyName,
          tradeName: json.data.tradeName ?? "",
          documentType: json.data.documentType as EditConfigInput["documentType"],
          documentNumber: json.data.documentNumber,
          vatCondition: json.data.vatCondition as EditConfigInput["vatCondition"],
          grossIncomeNumber: json.data.grossIncomeNumber ?? "",
          address: json.data.address ?? "",
          city: json.data.city ?? "",
          state: json.data.state ?? "",
          country: json.data.country,
          postalCode: json.data.postalCode ?? "",
          phone: json.data.phone ?? "",
          email: json.data.email ?? "",
          website: json.data.website ?? "",
          currency: json.data.currency,
          timezone: json.data.timezone ?? "",
        })
      }
    } catch {
      toast.error("Error al cargar la configuración")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadConfig()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function onSubmit(values: EditConfigInput) {
    setIsSaving(true)
    try {
      const body = {
        ...values,
        tradeName: values.tradeName || null,
        grossIncomeNumber: values.grossIncomeNumber || null,
        address: values.address || null,
        city: values.city || null,
        state: values.state || null,
        postalCode: values.postalCode || null,
        phone: values.phone || null,
        email: values.email || null,
        website: values.website || null,
        timezone: values.timezone || null,
      }
      const res = await fetch("/api/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = (await res.json()) as { error: string }
        throw new Error(err.error)
      }
      const json = (await res.json()) as { data: TenantConfig }
      setConfig(json.data)
      setIsEditing(false)
      toast.success("Configuración actualizada")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar")
    } finally {
      setIsSaving(false)
    }
  }

  function handleCancelEdit() {
    if (config) {
      form.reset({
        companyName: config.companyName,
        tradeName: config.tradeName ?? "",
        documentType: config.documentType as EditConfigInput["documentType"],
        documentNumber: config.documentNumber,
        vatCondition: config.vatCondition as EditConfigInput["vatCondition"],
        grossIncomeNumber: config.grossIncomeNumber ?? "",
        address: config.address ?? "",
        city: config.city ?? "",
        state: config.state ?? "",
        country: config.country,
        postalCode: config.postalCode ?? "",
        phone: config.phone ?? "",
        email: config.email ?? "",
        website: config.website ?? "",
        currency: config.currency,
        timezone: config.timezone ?? "",
      })
    }
    setIsEditing(false)
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-20" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (!config) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-black tracking-tight text-foreground">Configuración</h1>
        <div className="bg-card rounded-2xl border border-border p-8 text-center text-muted-foreground">
          <p className="text-sm">
            No hay configuración registrada. Ejecutá el seed para inicializar.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">Configuración</h1>
          <p className="text-sm text-muted-foreground mt-1">Datos de la empresa</p>
        </div>
        {!isEditing ? (
          <Button variant="outline" onClick={() => setIsEditing(true)}>
            Editar
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleCancelEdit} disabled={isSaving}>
              Cancelar
            </Button>
            <Button
              onClick={form.handleSubmit(onSubmit)}
              disabled={isSaving}
            >
              {isSaving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        )}
      </div>

      {!isEditing ? (
        /* Modo lectura */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
            <h2 className="text-sm font-bold text-foreground">Datos empresa</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Razón social</dt>
                <dd className="text-sm text-foreground mt-0.5">{config.companyName}</dd>
              </div>
              {config.tradeName && (
                <div>
                  <dt className="text-xs text-muted-foreground uppercase font-bold tracking-wider">
                    Nombre comercial
                  </dt>
                  <dd className="text-sm text-foreground mt-0.5">{config.tradeName}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Documento</dt>
                <dd className="text-sm text-foreground mt-0.5">
                  {DOCUMENT_TYPE_LABELS[
                    config.documentType as keyof typeof DOCUMENT_TYPE_LABELS
                  ] ?? config.documentType}{" "}
                  {config.documentNumber}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Condición IVA</dt>
                <dd className="text-sm text-foreground mt-0.5">
                  {VAT_CONDITION_LABELS[
                    config.vatCondition as keyof typeof VAT_CONDITION_LABELS
                  ] ?? config.vatCondition}
                </dd>
              </div>
              {config.grossIncomeNumber && (
                <div>
                  <dt className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Ing. brutos</dt>
                  <dd className="text-sm text-foreground mt-0.5">{config.grossIncomeNumber}</dd>
                </div>
              )}
            </dl>
          </div>

          <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
            <h2 className="text-sm font-bold text-foreground">Dirección</h2>
            <dl className="space-y-3">
              {[
                ["Calle", config.address],
                ["Ciudad", config.city],
                ["Provincia", config.state],
                ["País", config.country],
                ["Código postal", config.postalCode],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <dt className="text-xs text-muted-foreground uppercase font-bold tracking-wider">{label}</dt>
                  <dd className="text-sm text-foreground mt-0.5">{value ?? "—"}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
            <h2 className="text-sm font-bold text-foreground">Contacto y configuración</h2>
            <dl className="space-y-3">
              {[
                ["Moneda", config.currency],
                ["Zona horaria", config.timezone],
                ["Teléfono", config.phone],
                ["Email", config.email],
                ["Sitio web", config.website],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <dt className="text-xs text-muted-foreground uppercase font-bold tracking-wider">{label}</dt>
                  <dd className="text-sm text-foreground mt-0.5">{value ?? "—"}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      ) : (
        /* Modo edición */
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Datos empresa */}
            <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
              <h2 className="text-sm font-semibold text-gray-700">Datos empresa</h2>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Razón social *
                </label>
                <Input {...form.register("companyName")} />
                {form.formState.errors.companyName && (
                  <p className="text-xs text-red-500">
                    {form.formState.errors.companyName.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Nombre comercial
                </label>
                <Input {...form.register("tradeName")} />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Tipo doc.</label>
                  <select
                    {...form.register("documentType")}
                    className="w-full h-9 rounded-xl border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring"
                  >
                    {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">N° Documento</label>
                  <Input {...form.register("documentNumber")} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Condición IVA
                </label>
                <select
                  {...form.register("vatCondition")}
                  className="w-full h-9 rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-ring"
                >
                  {Object.entries(VAT_CONDITION_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  N° Ing. Brutos
                </label>
                <Input {...form.register("grossIncomeNumber")} />
              </div>
            </div>

            {/* Dirección */}
            <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
              <h2 className="text-sm font-semibold text-gray-700">Dirección</h2>

              {[
                { key: "address" as const, label: "Calle" },
                { key: "city" as const, label: "Ciudad" },
                { key: "state" as const, label: "Provincia" },
                { key: "country" as const, label: "País" },
                { key: "postalCode" as const, label: "Código postal" },
              ].map(({ key, label }) => (
                <div key={key} className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    {label}
                    {key === "country" && " *"}
                  </label>
                  <Input {...form.register(key)} />
                  {form.formState.errors[key] && (
                    <p className="text-xs text-red-500">
                      {form.formState.errors[key]?.message}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Contacto y config */}
            <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
              <h2 className="text-sm font-semibold text-gray-700">Contacto y configuración</h2>

              {[
                { key: "currency" as const, label: "Moneda" },
                { key: "timezone" as const, label: "Zona horaria" },
                { key: "phone" as const, label: "Teléfono" },
                { key: "email" as const, label: "Email" },
                { key: "website" as const, label: "Sitio web" },
              ].map(({ key, label }) => (
                <div key={key} className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    {label}
                  </label>
                  <Input {...form.register(key)} />
                  {form.formState.errors[key] && (
                    <p className="text-xs text-red-500">
                      {form.formState.errors[key]?.message}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </form>
      )}
    </div>
  )
}
