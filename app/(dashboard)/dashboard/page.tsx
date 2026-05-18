/**
 * app/(dashboard)/dashboard/page.tsx
 *
 * Página principal del dashboard — placeholder hasta implementar los KPIs reales.
 * Se ejecuta como Server Component, con acceso a la sesión via auth().
 */

import { auth } from "@/lib/auth"

export default async function DashboardPage() {
  const session = await auth()

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Bienvenido,{" "}
          <span className="font-medium text-gray-700">{session?.user.name}</span>
        </p>
      </div>

      {/* Cards de KPIs — placeholder */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Ventas del mes", value: "$0,00", change: "+0%" },
          { label: "Cobros pendientes", value: "$0,00", change: "0 facturas" },
          { label: "Pagos pendientes", value: "$0,00", change: "0 facturas" },
          { label: "Productos bajo stock", value: "0", change: "alertas" },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="bg-white rounded-xl border border-gray-200 p-5"
          >
            <p className="text-sm text-gray-500">{kpi.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{kpi.value}</p>
            <p className="text-xs text-gray-400 mt-1">{kpi.change}</p>
          </div>
        ))}
      </div>

      {/* Mensaje informativo */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <svg
            className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <p className="text-sm font-medium text-blue-800">
              Sistema en configuración inicial
            </p>
            <p className="text-sm text-blue-600 mt-0.5">
              Los módulos del ERP están siendo implementados. Accedé al menú lateral
              para explorar las secciones disponibles.
            </p>
            <p className="text-xs text-blue-500 mt-2">
              Tenant: <code className="bg-blue-100 px-1.5 py-0.5 rounded text-blue-700">{session?.user.tenantSlug}</code>
              {" · "}
              Schema: <code className="bg-blue-100 px-1.5 py-0.5 rounded text-blue-700">{session?.user.tenantDbSchema}</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
