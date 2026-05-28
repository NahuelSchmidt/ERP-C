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

export function KpiCardSkeleton() {
  return (
    <div className="bg-card rounded-2xl border border-border p-5 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="h-4 w-28 bg-muted rounded" />
        <div className="w-9 h-9 bg-muted rounded-lg" />
      </div>
      <div className="h-8 w-36 bg-muted rounded mb-2" />
      <div className="h-3 w-24 bg-muted/60 rounded" />
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
    default: "bg-secondary text-foreground",
    warning: "bg-amber-50 text-amber-600",
    danger: "bg-red-50 text-red-600",
  }[variant]

  const trendColor =
    trend && trend.value > 0
      ? "text-emerald-600"
      : trend && trend.value < 0
      ? "text-red-500"
      : "text-muted-foreground"

  const trendIcon =
    trend && trend.value > 0
      ? "↑"
      : trend && trend.value < 0
      ? "↓"
      : "→"

  return (
    <div
      className={cn(
        "bg-card rounded-2xl border p-5 transition-all hover:shadow-sm",
        variant === "warning" && "border-amber-200",
        variant === "danger" && "border-red-200",
        variant === "default" && "border-border"
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{title}</p>
        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", iconBg)}>
          {icon}
        </div>
      </div>

      <p className="text-3xl font-black tracking-tight text-foreground">{value}</p>

      {subtitle && (
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      )}

      {trend && (
        <div className={cn("flex items-center gap-1 mt-2 text-xs font-medium", trendColor)}>
          <span>{trendIcon}</span>
          <span>
            {trend.value > 0 ? "+" : ""}
            {trend.value.toFixed(1)}%
          </span>
          <span className="text-muted-foreground font-normal">{trend.label}</span>
        </div>
      )}
    </div>
  )
}
