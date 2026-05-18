/**
 * lib/validations/stock-movement.ts
 *
 * Schemas Zod para movimientos de stock.
 */

import { z } from "zod"

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const StockMovementTypeEnum = z.enum([
  "PURCHASE",
  "SALE",
  "ADJUSTMENT",
  "TRANSFER_IN",
  "TRANSFER_OUT",
  "LOSS",
  "RETURN",
  "INVENTORY_COUNT",
])

export type StockMovementType = z.infer<typeof StockMovementTypeEnum>

export const STOCK_MOVEMENT_TYPE_LABELS: Record<StockMovementType, string> = {
  PURCHASE: "Compra",
  SALE: "Venta",
  ADJUSTMENT: "Ajuste",
  TRANSFER_IN: "Transferencia entrada",
  TRANSFER_OUT: "Transferencia salida",
  LOSS: "Merma",
  RETURN: "Devolución",
  INVENTORY_COUNT: "Conteo de inventario",
}

// Manual movement types (user can create these manually)
export const MANUAL_MOVEMENT_TYPES: StockMovementType[] = [
  "ADJUSTMENT",
  "LOSS",
  "RETURN",
  "INVENTORY_COUNT",
]

// ---------------------------------------------------------------------------
// createStockMovementSchema
// ---------------------------------------------------------------------------

export const createStockMovementSchema = z
  .object({
    productId: z.string().cuid({ message: "Producto inválido" }),
    warehouseId: z.string().cuid({ message: "Depósito inválido" }),
    type: StockMovementTypeEnum,
    /**
     * Cantidad positiva. Si el tipo es salida (SALE, TRANSFER_OUT, LOSS),
     * el servicio lo convierte a negativo internamente.
     */
    quantity: z
      .number()
      .positive("La cantidad debe ser mayor a cero"),
    unitCost: z.number().nonnegative().optional().nullable(),
    reason: z.string().max(255).optional().nullable(),
    notes: z.string().max(1000).optional().nullable(),
    referenceType: z.string().max(50).optional().nullable(),
    referenceId: z.string().max(100).optional().nullable(),
    date: z.coerce.date().optional(),
  })
