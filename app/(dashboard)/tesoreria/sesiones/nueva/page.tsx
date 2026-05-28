"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ChevronLeftIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { openCashSessionSchema, type OpenCashSessionInput } from "@/lib/validations/payment"

interface CashRegister {
  id: string
  name: string
  isActive: boolean
}

function AbrirSesionForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedRegisterId = searchParams.get("registerId") ?? ""

  const [registers, setRegisters] = useState<CashRegister[]>([])
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<OpenCashSessionInput>({
    resolver: zodResolver(openCashSessionSchema),
    defaultValues: {
      cashRegisterId: preselectedRegisterId,
      openingBalance: 0,
    },
  })

  useEffect(() => {
    void (async () => {
      setIsLoadingData(true)
      try {
        const res = await fetch("/api/cash/registers")
        if (res.ok) {
          const json = (await res.json()) as { data: CashRegister[] }
          setRegisters(json.data.filter((r) => r.isActive))
        }
      } catch {
        toast.error("Error al cargar las cajas")
      } finally {
        setIsLoadingData(false)
      }
    })()
  }, [])

  async function onSubmit(values: OpenCashSessionInput) {
    setIsSubmitting(true)
    try {
      const res = await fetch("/api/cash/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      if (!res.ok) {
        const err = (await res.json()) as { error: string }
        throw new Error(err.error)
      }
      toast.success("Sesión de caja abierta")
      router.push("/tesoreria")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al abrir la sesión")
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedRegister = registers.find(
    (r) => r.id === form.watch("cashRegisterId")
  )

  return (
    <div className="space-y-5">
      <Link
        href="/tesoreria"
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 transition-colors w-fit"
      >
        <ChevronLeftIcon className="w-4 h-4" />
        Tesorería
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Abrir sesión de caja</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Registrá el saldo inicial para comenzar la jornada
        </p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-md space-y-5">
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          {/* Selector de caja */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500 uppercase">
              Caja registradora <span className="text-red-500">*</span>
            </label>
            {isLoadingData ? (
              <div className="h-9 bg-gray-100 rounded-lg animate-pulse" />
            ) : preselectedRegisterId && selectedRegister ? (
              <div className="h-9 rounded-lg border border-input bg-gray-50 px-3 flex items-center text-sm text-gray-700">
                {selectedRegister.name}
              </div>
            ) : (
              <select
                {...form.register("cashRegisterId")}
                className="w-full h-9 rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <option value="">Seleccionar caja...</option>
                {registers.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            )}
            {form.formState.errors.cashRegisterId && (
              <p className="text-xs text-red-500">
                {form.formState.errors.cashRegisterId.message}
              </p>
            )}
          </div>

          {/* Saldo de apertura */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500 uppercase">
              Saldo de apertura
            </label>
            <Input
              type="number"
              step="0.01"
              min="0"
              {...form.register("openingBalance", { valueAsNumber: true })}
              placeholder="0.00"
            />
            {form.formState.errors.openingBalance && (
              <p className="text-xs text-red-500">
                {form.formState.errors.openingBalance.message}
              </p>
            )}
            <p className="text-xs text-gray-400">
              Ingresá el efectivo disponible al iniciar la jornada
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Link
            href="/tesoreria"
            className="inline-flex items-center justify-center rounded-lg border border-input bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </Link>
          <Button type="submit" disabled={isSubmitting || isLoadingData}>
            {isSubmitting ? "Abriendo..." : "Abrir caja"}
          </Button>
        </div>
      </form>
    </div>
  )
}

export default function NuevaSesionPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-5">
          <div className="h-5 w-24 bg-gray-100 rounded animate-pulse" />
          <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
        </div>
      }
    >
      <AbrirSesionForm />
    </Suspense>
  )
}
