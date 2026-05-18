/**
 * lib/format.ts
 *
 * Helpers de formateo para moneda, fechas y números en el ERP.
 * Orientado al mercado argentino (es-AR, ARS).
 */

export const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(amount)

export const formatDate = (date: Date | string): string =>
  new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date))

export const formatDateTime = (date: Date | string): string =>
  new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date))

export const formatNumber = (n: number): string =>
  new Intl.NumberFormat("es-AR").format(n)

/**
 * Abrevia montos grandes para gráficos y cards:
 *   1_500_000 → "1.5M"
 *   450_000   → "450K"
 *   999       → "999"
 */
export const abbreviateAmount = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return formatNumber(n)
}
