/**
 * components/reports/top-list.tsx
 *
 * Lista de items con barra de progreso relativa al máximo del conjunto.
 * Usada para Top Productos y Top Clientes en el dashboard.
 */

import { cn } from "@/lib/utils"

interface TopListItem {
  name: string
  value: number
  subtitle?: string
}

interface TopListProps {
  title: string
  items: TopListItem[]
  formatValue: (v: number) => string
  emptyMessage?: string
  className?: string
}

export function TopList({
  title,
  items,
  formatValue,
  emptyMessage = "Sin datos en el período",
  className,
}: TopListProps) {
  const maxValue = items.length > 0 ? Math.max(...items.map((i) => i.value)) : 1

  return (
    <div className={cn("bg-card rounded-2xl border border-border p-5", className)}>
      <h3 className="text-sm font-bold text-foreground mb-4">{title}</h3>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">{emptyMessage}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item, index) => {
            const percent = maxValue > 0 ? (item.value / maxValue) * 100 : 0
            return (
              <li key={index}>
                <div className="flex items-center justify-between mb-1 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-muted-foreground w-5 flex-shrink-0">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                      {item.subtitle && (
                        <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-foreground flex-shrink-0">
                    {formatValue(item.value)}
                  </span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-foreground rounded-full transition-all duration-500"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
