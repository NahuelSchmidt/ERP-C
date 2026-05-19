"use client"

import { Suspense, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"

const loginSchema = z.object({
  email: z
    .string()
    .min(1, "El email es requerido")
    .email("Ingresá un email válido"),
  password: z.string().min(1, "La contraseña es requerida"),
  tenantSlug: z.string(),
})

type LoginFormInput = z.input<typeof loginSchema>
type LoginFormOutput = z.output<typeof loginSchema>

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard"
  const errorParam = searchParams.get("error")

  const [serverError, setServerError] = useState<string | null>(
    errorParam === "CredentialsSignin"
      ? "Email, contraseña o empresa incorrectos."
      : errorParam && errorParam !== "undefined"
        ? "Ocurrió un error al iniciar sesión. Intentá nuevamente."
        : null
  )
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormInput, unknown, LoginFormOutput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      tenantSlug: "",
    },
  })

  const onSubmit = async (data: LoginFormOutput) => {
    setIsLoading(true)
    setServerError(null)

    try {
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        tenantSlug: data.tenantSlug,
        redirect: false,
        callbackUrl,
      })

      if (result?.error) {
        setServerError("Email, contraseña o empresa incorrectos.")
        return
      }

      if (result?.ok) {
        router.push(callbackUrl)
        router.refresh()
      }
    } catch {
      setServerError("Error de conexión. Verificá tu acceso a internet.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      {serverError && (
        <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2">
          <svg
            className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
          <p className="text-sm text-red-700">{serverError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 mb-1.5"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="usuario@empresa.com"
            {...register("email")}
            className={`w-full px-3.5 py-2.5 rounded-lg border text-sm transition-colors outline-none
              ${errors.email
                ? "border-red-400 bg-red-50 focus:border-red-500 focus:ring-2 focus:ring-red-200"
                : "border-gray-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              }`}
          />
          {errors.email && (
            <p className="mt-1.5 text-xs text-red-600">{errors.email.message}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700 mb-1.5"
          >
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            {...register("password")}
            className={`w-full px-3.5 py-2.5 rounded-lg border text-sm transition-colors outline-none
              ${errors.password
                ? "border-red-400 bg-red-50 focus:border-red-500 focus:ring-2 focus:ring-red-200"
                : "border-gray-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              }`}
          />
          {errors.password && (
            <p className="mt-1.5 text-xs text-red-600">{errors.password.message}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="tenantSlug"
            className="block text-sm font-medium text-gray-700 mb-1.5"
          >
            Empresa{" "}
            <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <input
            id="tenantSlug"
            type="text"
            autoComplete="organization"
            placeholder="mi-empresa"
            {...register("tenantSlug")}
            className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 bg-white text-sm
              transition-colors outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          <p className="mt-1.5 text-xs text-gray-400">
            Si tenés acceso a más de una empresa, ingresá su identificador.
          </p>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white
            bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
            disabled:opacity-60 disabled:cursor-not-allowed transition-colors outline-none mt-2"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="animate-spin h-4 w-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                />
              </svg>
              Ingresando...
            </span>
          ) : (
            "Ingresar"
          )}
        </button>
      </form>
    </>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 mb-4">
            <svg
              className="w-9 h-9 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">ERP PYMES</h1>
          <p className="mt-1 text-sm text-gray-500">
            Sistema de gestión empresarial
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            Iniciá sesión
          </h2>
          <Suspense fallback={<div className="h-64 flex items-center justify-center"><div className="animate-spin h-6 w-6 border-2 border-blue-500 rounded-full border-t-transparent" /></div>}>
            <LoginForm />
          </Suspense>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          ERP Multi-tenant para PYMES · Argentina
        </p>
      </div>
    </div>
  )
}
