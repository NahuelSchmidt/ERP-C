"use client"

/**
 * components/reports/sales-chart.tsx
 *
 * Gráfico de área de ventas usando Recharts.
 * Client Component porque Recharts requiere el DOM.
 *
 * Props:
 *   data   — serie temporal { date, total, count }[]
 *   title  — título del gráfico (opcional)
 *   height — altura del contenedor (default: 300)
 */

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { formatCurrency, abbreviateAmount } from "@/lib/format"

interface DataPoint {
  date: string
  total: number
  count: number
  avgTicket?: number
}

interface SalesChartProps {
  data: DataPoint[]
  title?: string
  height?: number
}

// Tooltip personalizado
function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number; payload: DataPoint }>
  label?: string
}) {
  if (!active || !payload?.length) return null

  const point = payload[0].payload
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      <p className="text-blue-600 font-bold">{formatCurrency(point.total)}</p>
      <p className="text-gray-400 text-xs mt-0.5">
        {point.count} {point.count === 1 ? "factura" : "facturas"}
      </p>
      {point.avgTicket && point.avgTicket > 0 && (
        <p className="text-gray-400 text-xs">
          Ticket promedio: {formatCurrency(point.avgTicket)}
        </p>
      )}
    </div>
  )
}

/** Formatea las fechas del eje X según el formato: "15/05" o "May" */
function formatXAxis(dateStr: string): string {
  // Puede ser "YYYY-MM-DD" o "YYYY-MM"
  const parts = dateStr.split("-")
  if (parts.length === 2) {
    // Agrupación mensual
    const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
    return months[parseInt(parts[1], 10) - 1] ?? dateStr
  }
  // Agrupación diaria/semanal: mostrar día/mes
  const d = new Date(dateStr + "T00:00:00")
  return `${d.getDate()}/${d.getMonth() + 1}`
}

export function SalesChart({ data, title, height = 300 }: SalesChartProps) {
  if (!data.length) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        {title && <h3 className="text-sm font-semibold text-gray-700 mb-4">{title}</h3>}
        <div
          className="flex items-center justify-center text-gray-400 text-sm"
          style={{ height }}
        >
          Sin datos para el período seleccionado
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      {title && (
        <h3 className="text-sm font-semibold text-gray-700 mb-4">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(221 83% 53%)" stopOpacity={0.15} />
              <stop offset="95%" stopColor="hsl(221 83% 53%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatXAxis}
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={(v: number) => abbreviateAmount(v)}
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="total"
            stroke="hsl(221 83% 53%)"
            strokeWidth={2}
            fill="url(#salesGradient)"
            dot={false}
            activeDot={{ r: 4, fill: "hsl(221 83% 53%)", strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
