"use client"

import { Suspense, useState, useCallback } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
const emailSchema = z.object({
  email: z
    .string()
    .min(1, "El email es requerido")
    .email("Ingresá un email válido"),
})

const passwordSchema = z.object({
  password: z.string().min(1, "La contraseña es requerida"),
})

type EmailFormInput = z.input<typeof emailSchema>
type PasswordFormInput = z.input<typeof passwordSchema>

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Tenant = { slug: string; name: string }
type Step = "email" | "tenant-select" | "password"

// ---------------------------------------------------------------------------
// Spinner
// ---------------------------------------------------------------------------
function Spinner() {
  return (
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
  )
}

// ---------------------------------------------------------------------------
// Error banner
// ---------------------------------------------------------------------------
function ErrorBanner({ message }: { message: string }) {
  return (
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
      <p className="text-sm text-red-700">{message}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main form
// ---------------------------------------------------------------------------
function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard"
  const errorParam = searchParams.get("error")

  // Multi-step state
  const [step, setStep] = useState<Step>("email")
  const [selectedEmail, setSelectedEmail] = useState("")
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null)

  // Pre-fetch cache: keyed by email so onBlur doesn't re-fetch the same email
  const [prefetchCache, setPrefetchCache] = useState<
    Record<string, Tenant[] | "loading">
  >({})

  const [lookupLoading, setLookupLoading] = useState(false)
  const [signInLoading, setSignInLoading] = useState(false)
  const [error, setError] = useState<string | null>(
    errorParam === "CredentialsSignin"
      ? "Email o contraseña incorrectos."
      : errorParam && errorParam !== "undefined"
        ? "Ocurrió un error al iniciar sesión. Intentá nuevamente."
        : null
  )

  // Email form
  const {
    register: registerEmail,
    handleSubmit: handleSubmitEmail,
    getValues: getEmailValues,
    formState: { errors: emailErrors },
  } = useForm<EmailFormInput>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  })

  // Password form
  const {
    register: registerPassword,
    handleSubmit: handleSubmitPassword,
    formState: { errors: passwordErrors },
  } = useForm<PasswordFormInput>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: "" },
  })

  // -------------------------------------------------------------------------
  // Fetch tenants for an email (returns the list or null on error)
  // -------------------------------------------------------------------------
  const fetchTenants = useCallback(
    async (email: string): Promise<Tenant[] | null> => {
      try {
        const res = await fetch(
          `/api/auth/lookup-tenant?email=${encodeURIComponent(email)}`
        )
        if (!res.ok) return null
        const data = (await res.json()) as { tenants: Tenant[] }
        return data.tenants
      } catch {
        return null
      }
    },
    []
  )

  // -------------------------------------------------------------------------
  // onBlur on email: pre-fetch to warm the cache
  // -------------------------------------------------------------------------
  const handleEmailBlur = useCallback(async () => {
    const email = getEmailValues("email").toLowerCase().trim()
    if (!email || prefetchCache[email]) return
    setPrefetchCache((prev) => ({ ...prev, [email]: "loading" }))
    const result = await fetchTenants(email)
    if (result !== null) {
      setPrefetchCache((prev) => ({ ...prev, [email]: result }))
    } else {
      setPrefetchCache((prev) => {
        const next = { ...prev }
        delete next[email]
        return next
      })
    }
  }, [getEmailValues, prefetchCache, fetchTenants])

  // -------------------------------------------------------------------------
  // Step 1 submit: resolve tenants and advance
  // -------------------------------------------------------------------------
  const onEmailSubmit = useCallback(
    async (data: EmailFormInput) => {
      setError(null)
      const email = data.email.toLowerCase().trim()

      setLookupLoading(true)
      let resolvedTenants: Tenant[] | null

      const cached = prefetchCache[email]
      if (Array.isArray(cached)) {
        resolvedTenants = cached
      } else {
        resolvedTenants = await fetchTenants(email)
      }
      setLookupLoading(false)

      if (!resolvedTenants || resolvedTenants.length === 0) {
        setError("No encontramos una cuenta con ese email.")
        return
      }

      setSelectedEmail(email)
      setTenants(resolvedTenants)

      if (resolvedTenants.length === 1) {
        setSelectedTenant(resolvedTenants[0])
        setStep("password")
      } else {
        setSelectedTenant(null)
        setStep("tenant-select")
      }
    },
    [prefetchCache, fetchTenants]
  )

  // -------------------------------------------------------------------------
  // Step 2 (tenant select): confirm selection
  // -------------------------------------------------------------------------
  const [pendingTenantSlug, setPendingTenantSlug] = useState("")

  const onTenantSelect = () => {
    const tenant = tenants.find((t) => t.slug === pendingTenantSlug)
    if (!tenant) return
    setSelectedTenant(tenant)
    setStep("password")
  }

  // -------------------------------------------------------------------------
  // Step 3 submit: sign in
  // -------------------------------------------------------------------------
  const onPasswordSubmit = useCallback(
    async (data: PasswordFormInput) => {
      setError(null)
      setSignInLoading(true)

      try {
        const result = await signIn("credentials", {
          email: selectedEmail,
          password: data.password,
          tenantSlug: selectedTenant?.slug ?? "",
          redirect: false,
          callbackUrl,
        })

        if (result?.error) {
          setError("Email o contraseña incorrectos.")
          return
        }

        if (result?.ok) {
          router.push(callbackUrl)
          router.refresh()
        }
      } catch {
        setError("Error de conexión. Verificá tu acceso a internet.")
      } finally {
        setSignInLoading(false)
      }
    },
    [selectedEmail, selectedTenant, callbackUrl, router]
  )

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <>
      {error && <ErrorBanner message={error} />}

      {/* ── Step 1: Email ─────────────────────────────────────────────── */}
      {step === "email" && (
        <form
          onSubmit={handleSubmitEmail(onEmailSubmit)}
          noValidate
          className="space-y-5"
        >
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
              autoFocus
              placeholder="usuario@empresa.com"
              {...registerEmail("email", {
                onBlur: handleEmailBlur,
              })}
              className={`w-full px-3.5 py-2.5 rounded-lg border text-sm transition-colors outline-none
                ${
                  emailErrors.email
                    ? "border-red-400 bg-red-50 focus:border-red-500 focus:ring-2 focus:ring-red-200"
                    : "border-gray-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                }`}
            />
            {emailErrors.email && (
              <p className="mt-1.5 text-xs text-red-600">
                {emailErrors.email.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={lookupLoading}
            className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white
              bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
              disabled:opacity-60 disabled:cursor-not-allowed transition-colors outline-none mt-2"
          >
            {lookupLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Spinner />
                Buscando...
              </span>
            ) : (
              "Continuar"
            )}
          </button>
        </form>
      )}

      {/* ── Step 2: Tenant selector ────────────────────────────────────── */}
      {step === "tenant-select" && (
        <div className="space-y-5">
          <div className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3.5 py-2.5 border border-gray-200">
            {selectedEmail}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Seleccioná tu empresa
            </label>
            <div className="space-y-2">
              {tenants.map((tenant) => (
                <label
                  key={tenant.slug}
                  className={`flex items-center gap-3 px-3.5 py-3 rounded-lg border cursor-pointer transition-colors
                    ${
                      pendingTenantSlug === tenant.slug
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                >
                  <input
                    type="radio"
                    name="tenant"
                    value={tenant.slug}
                    checked={pendingTenantSlug === tenant.slug}
                    onChange={() => setPendingTenantSlug(tenant.slug)}
                    className="text-blue-600"
                  />
                  <span className="text-sm font-medium text-gray-800">
                    {tenant.name}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep("email")}
              className="flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold text-gray-600
                bg-gray-100 hover:bg-gray-200 transition-colors outline-none"
            >
              Volver
            </button>
            <button
              type="button"
              onClick={onTenantSelect}
              disabled={!pendingTenantSlug}
              className="flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold text-white
                bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                disabled:opacity-60 disabled:cursor-not-allowed transition-colors outline-none"
            >
              Seleccionar
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Password ──────────────────────────────────────────── */}
      {step === "password" && (
        <form
          onSubmit={handleSubmitPassword(onPasswordSubmit)}
          noValidate
          className="space-y-5"
        >
          <div>
            <p className="text-sm text-gray-500 mb-0.5">Email</p>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-800">
                {selectedEmail}
              </p>
              <button
                type="button"
                onClick={() => {
                  setStep("email")
                  setError(null)
                }}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                Cambiar
              </button>
            </div>
          </div>

          {selectedTenant && tenants.length > 1 && (
            <div>
              <p className="text-sm text-gray-500 mb-0.5">Empresa</p>
              <p className="text-sm font-medium text-gray-800">
                {selectedTenant.name}
              </p>
            </div>
          )}

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
              autoFocus
              placeholder="••••••••"
              {...registerPassword("password")}
              className={`w-full px-3.5 py-2.5 rounded-lg border text-sm transition-colors outline-none
                ${
                  passwordErrors.password
                    ? "border-red-400 bg-red-50 focus:border-red-500 focus:ring-2 focus:ring-red-200"
                    : "border-gray-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                }`}
            />
            {passwordErrors.password && (
              <p className="mt-1.5 text-xs text-red-600">
                {passwordErrors.password.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={signInLoading}
            className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white
              bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
              disabled:opacity-60 disabled:cursor-not-allowed transition-colors outline-none mt-2"
          >
            {signInLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Spinner />
                Ingresando...
              </span>
            ) : (
              "Ingresar"
            )}
          </button>
        </form>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Page shell
// ---------------------------------------------------------------------------
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
          <Suspense
            fallback={
              <div className="h-64 flex items-center justify-center">
                <div className="animate-spin h-6 w-6 border-2 border-blue-500 rounded-full border-t-transparent" />
              </div>
            }
          >
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
