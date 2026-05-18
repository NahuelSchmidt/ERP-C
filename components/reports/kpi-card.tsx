/**
 * components/reports/kpi-card.tsx
 *
 * Tarjeta de KPI reutilizable para el dashboard.
 * Muestra un indicador clave con ícono, valor, tendencia y variante visual.
 */

import { cn } from "@/lib/utils"

interface Trend {
  value: number   // Porcentaje de variación: +12.5, -3.2
  label: string   // Texto descriptivo: "vs ayer", "vs mes anterior"
}

export interface KpiCardProps {
  title: string
  value: string        // Valor ya formateado: "$1.234.567,89" | "42"
  subtitle?: string    // Texto secundario debajo del valor
  trend?: Trend
  icon: React.ReactNode
  variant?: "default" | "warning" | "danger"
  loading?: boolean
}

/** Skeletons mientras cargan los datos */
export function KpiCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="h-4 w-28 bg-gray-200 rounded" />
        <div className="w-9 h-9 bg-gray-100 rounded-lg" />
      </div>
      <div className="h-8 w-36 bg-gray-200 rounded mb-2" />
      <div className="h-3 w-24 bg-gray-100 rounded" />
    </div>
  )
}

export function KpiCard({
  title,
  value,
  subtitle,
  trend,
  icon,
  variant = "default",
  loading = false,
}: KpiCardProps) {
  if (loading) return <KpiCardSkeleton />

  const iconBg = {
    default: "bg-blue-50 text-blue-600",
    warning: "bg-amber-50 text-amber-600",
    danger: "bg-red-50 text-red-600",
  }[variant]

  const trendColor =
    trend && trend.value > 0
      ? "text-emerald-600"
      : trend && trend.value < 0
      ? "text-red-500"
      : "text-gray-400"

  const trendIcon =
    trend && trend.value > 0
      ? "↑"
      : trend && trend.value < 0
      ? "↓"
      : "→"

  return (
    <div
      className={cn(
        "bg-white rounded-xl border p-5 transition-shadow hover:shadow-sm",
        variant === "warning" && "border-amber-200",
        variant === "danger" && "border-red-200",
        variant === "default" && "border-gray-200"
      )}
    >
      {/* Encabezado: título + ícono */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", iconBg)}>
          {icon}
        </div>
      </div>

      {/* Valor principal */}
      <p className="text-2xl font-bold text-gray-900 tracking-tight">{value}</p>

      {/* Subtítulo */}
      {subtitle && (
        <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
      )}

      {/* Tendencia */}
      {trend && (
        <div className={cn("flex items-center gap-1 mt-2 text-xs font-medium", trendColor)}>
          <span>{trendIcon}</span>
          <span>
            {trend.value > 0 ? "+" : ""}
            {trend.value.toFixed(1)}%
          </span>
          <span className="text-gray-400 font-normal">{trend.label}</span>
        </div>
      )}
    </div>
  )
}
