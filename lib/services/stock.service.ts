/**
 * lib/services/stock.service.ts
 *
 * Servicio de lógica de negocio para movimientos de stock.
 *
 * Garantiza consistencia mediante transacciones Prisma:
 *   1. Obtiene el stock actual del producto en el depósito.
 *   2. Calcula el nuevo stock.
 *   3. Valida que no quede negativo si allowNegative=false.
 *   4. Actualiza Stock, crea StockMovement y recalcula averageCost del Product.
 */

import { Decimal } from "@prisma/client/runtime/client"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Tipos de movimiento que representan una SALIDA (reducen el stock). */
const EXIT_TYPES = new Set([
  "SALE",
  "TRANSFER_OUT",
  "LOSS",
])

/** Tipos de movimiento que representan una ENTRADA (aumentan el stock). */
const ENTRY_TYPES = new Set([
  "PURCHASE",
  "TRANSFER_IN",
  "RETURN",
])

export interface CreateStockMovementParams {
  tenantId: string
  productId: string
  warehouseId: string
  type: string
  /** Cantidad siempre positiva; el servicio aplica el signo según el tipo. */
  quantity: number
  unitCost?: number | null
  reason?: string | null
  notes?: string | null
  referenceType?: string | null
  referenceId?: string | null
  date?: Date
  createdById?: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDecimal(value: number | string | Decimal | null | undefined): Decimal {
  if (value === null || value === undefined) return new Decimal(0)
  if (value instanceof Decimal) return value
  return new Decimal(value)
}

// ---------------------------------------------------------------------------
// Main service function
// ---------------------------------------------------------------------------

/**
 * Crea un movimiento de stock de forma atómica.
 *
 * @param db  Cliente Prisma ya configurado para el tenant (via getTenantDb())
 * @param params  Parámetros del movimiento
 * @returns  El StockMovement creado con datos del producto y depósito
 * @throws  Error si el stock resultante sería negativo y allowNegative=false
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createStockMovement(db: any, params: CreateStockMovementParams) {
  const {
    tenantId,
    productId,
    warehouseId,
    type,
    quantity,
    unitCost,
    reason,
    notes,
    referenceType,
    referenceId,
    date,
    createdById,
  } = params

  return db.$transaction(async (tx: typeof db) => {
    // ------------------------------------------------------------------
    // 1. Obtener producto y validar que existe
    // ------------------------------------------------------------------
    const product = await tx.product.findFirst({
      where: { id: productId, deletedAt: null },
      select: {
        id: true,
        name: true,
        trackStock: true,
        allowNegative: true,
        averageCost: true,
        lastCost: true,
      },
    })

    if (!product) {
      throw new Error("Producto no encontrado")
    }

    // ------------------------------------------------------------------
    // 2. Obtener o crear registro de Stock
    // ------------------------------------------------------------------
    let stockRecord = await tx.stock.findUnique({
      where: { productId_warehouseId: { productId, warehouseId } },
    })

    if (!stockRecord) {
      stockRecord = await tx.stock.create({
        data: { productId, warehouseId, quantity: 0, reservedQuantity: 0 },
      })
    }

    const currentStock = toDecimal(stockRecord.quantity)

    // ------------------------------------------------------------------
    // 3. Determinar signo del movimiento y calcular nuevo stock
    // ------------------------------------------------------------------
    let delta: Decimal

    if (EXIT_TYPES.has(type)) {
      delta = toDecimal(quantity).neg()
    } else if (ENTRY_TYPES.has(type)) {
      delta = toDecimal(quantity)
    } else {
      // ADJUSTMENT, INVENTORY_COUNT: la quantity puede representar el nuevo total
      // Para ADJUSTMENT y INVENTORY_COUNT usamos la cantidad como delta directo
      delta = toDecimal(quantity)
    }

    const newStock = currentStock.plus(delta)

    // ------------------------------------------------------------------
    // 4. Validar stock negativo
    // ------------------------------------------------------------------
    if (!product.allowNegative && newStock.lessThan(0)) {
      throw new Error(
        `Stock insuficiente para "${product.name}". ` +
          `Stock actual: ${currentStock.toFixed(4)}, ` +
          `movimiento: ${delta.toFixed(4)}, ` +
          `resultado: ${newStock.toFixed(4)}`
      )
    }

    // ------------------------------------------------------------------
    // 5. Actualizar Stock
    // ------------------------------------------------------------------
    await tx.stock.update({
      where: { productId_warehouseId: { productId, warehouseId } },
      data: { quantity: newStock },
    })

    // ------------------------------------------------------------------
    // 6. Recalcular averageCost y lastCost si es entrada con costo
    // ------------------------------------------------------------------
    const productUpdateData: Record<string, Decimal> = {}

    if (ENTRY_TYPES.has(type) && unitCost != null && unitCost > 0) {
      const incomingCost = toDecimal(unitCost)
      const incomingQty = toDecimal(quantity)

      // Costo promedio ponderado: (stockAnterior * costoAnterior + cantEntrada * costoEntrada) / nuevoTotal
      const prevAverage = toDecimal(product.averageCost)
      const prevStock = currentStock.lessThan(0)
        ? new Decimal(0)
        : currentStock

      const numerator = prevStock
        .times(prevAverage)
        .plus(incomingQty.times(incomingCost))
      const denominator = prevStock.plus(incomingQty)

      if (denominator.greaterThan(0)) {
        productUpdateData.averageCost = numerator.dividedBy(denominator)
      }

      productUpdateData.lastCost = incomingCost
    }

    if (Object.keys(productUpdateData).length > 0) {
      await tx.product.update({
        where: { id: productId },
        data: productUpdateData,
      })
    }

    // ------------------------------------------------------------------
    // 7. Crear StockMovement
    // ------------------------------------------------------------------
    const movement = await tx.stockMovement.create({
      data: {
        tenantId,
        productId,
        warehouseId,
        type,
        quantity: delta,
        previousStock: currentStock,
        newStock,
        unitCost: unitCost != null ? toDecimal(unitCost) : null,
        referenceType: referenceType ?? null,
        referenceId: referenceId ?? null,
        reason: reason ?? null,
        notes: notes ?? null,
        date: date ?? new Date(),
        createdById: createdById ?? null,
      },
      include: {
        product: { select: { id: true, name: true, internalCode: true } },
        warehouse: { select: { id: true, name: true } },
      },
    })

    return movement
  })
}

/**
 * Calcula el stock total de un producto sumando todos sus depósitos.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getTotalStock(db: any, productId: string): Promise<Decimal> {
  const stocks = await db.stock.findMany({
    where: { productId },
    select: { quantity: true },
  })

  return stocks.reduce(
    (acc: Decimal, s: { quantity: string | number | Decimal }) => acc.plus(toDecimal(s.quantity)),
    new Decimal(0)
  )
}
