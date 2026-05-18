/**
 * lib/services/invoice.service.ts
 *
 * Capa de servicio para el módulo de Facturación.
 * Encapsula la lógica de negocio: numeración con bloqueo optimista,
 * cálculo de totales, creación atómica en transacción y cancelación.
 *
 * Todos los métodos reciben el cliente Prisma del tenant (ya configurado con
 * el search_path correcto) como primer argumento para facilitar la inyección
 * y el testing.
 */

import { Prisma } from "@prisma/client"
import type { CreateInvoiceInput, InvoiceItemInput } from "@/lib/validations/invoice"
import { Decimal } from "@prisma/client/runtime/client"

// Prisma v7 with driver adapters returns DynamicClientExtensionThis which
// is not directly assignable to PrismaClient. Use a loose type for service params.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TenantDb = any

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InvoiceTotals {
  /** Suma de (quantity * unitPrice - discountAmount) por ítem, sin IVA */
  subtotal: number
  /** Descuento global aplicado sobre el subtotal */
  globalDiscountAmount: number
  /** Base imponible = subtotal - globalDiscountAmount */
  taxableBase: number
  /** Suma total de IVA */
  taxAmount: number
  /** Total final = taxableBase + taxAmount */
  total: number
  /** Detalle de impuestos agrupado por taxRateId */
  taxBreakdown: TaxBreakdownItem[]
  /** Ítems con los montos calculados */
  computedItems: ComputedInvoiceItem[]
}

export interface TaxBreakdownItem {
  taxRateId: string
  base: number
  amount: number
  rate: number
}

export interface ComputedInvoiceItem extends InvoiceItemInput {
  discountAmount: number
  subtotal: number
  taxPercent: number
  taxAmount: number
  total: number
}

// ---------------------------------------------------------------------------
// getNextVoucherNumber
// ---------------------------------------------------------------------------

/**
 * Obtiene y reserva el próximo número de comprobante para un punto de venta y
 * tipo de comprobante usando un UPDATE ... RETURNING atómico para evitar
 * race conditions en entornos con alta concurrencia.
 *
 * Si la serie no existe todavía, la crea con currentNumber = 1 y retorna 1.
 */
export async function getNextVoucherNumber(
  db: TenantDb,
  pointOfSaleId: string,
  voucherType: string,
  tenantId: string
): Promise<number> {
  // Intentar actualizar la serie existente de forma atómica
  const result = await db.$queryRaw<{ currentNumber: number }[]>`
    UPDATE "VoucherSeries"
    SET "currentNumber" = "currentNumber" + 1,
        "updatedAt" = NOW()
    WHERE "pointOfSaleId" = ${pointOfSaleId}
      AND "voucherType" = ${voucherType}::"VoucherType"
      AND "tenantId" = ${tenantId}
    RETURNING "currentNumber"
  `

  if (result.length > 0) {
    return Number(result[0].currentNumber)
  }

  // La serie no existe: crearla con el número 1
  await db.voucherSeries.create({
    data: {
      tenantId,
      pointOfSaleId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      voucherType: voucherType as any,
      currentNumber: 1,
    },
  })

  return 1
}

// ---------------------------------------------------------------------------
// calculateInvoiceTotals
// ---------------------------------------------------------------------------

/**
 * Calcula todos los importes de la factura a partir de los ítems y el descuento
 * global. Esta función es pura (sin efectos secundarios) y se puede usar tanto
 * en el servidor como en el cliente para el preview en tiempo real.
 *
 * taxRates es un mapa de taxRateId → rate (number, ej: 0.21)
 * Si un ítem no tiene taxRateId, se asume tasa 0.
 */
export function calculateInvoiceTotals(
  items: InvoiceItemInput[],
  globalDiscountPercent: number,
  taxRates: Map<string, number> = new Map()
): InvoiceTotals {
  const computedItems: ComputedInvoiceItem[] = items.map((item) => {
    const discountAmount = round2(item.quantity * item.unitPrice * (item.discountPercent / 100))
    const subtotal = round2(item.quantity * item.unitPrice - discountAmount)
    const taxPercent = item.taxRateId ? (taxRates.get(item.taxRateId) ?? 0) : 0
    const taxAmount = round2(subtotal * taxPercent)
    const total = round2(subtotal + taxAmount)

    return {
      ...item,
      discountAmount,
      subtotal,
      taxPercent,
      taxAmount,
      total,
    }
  })

  const subtotal = round2(computedItems.reduce((acc, i) => acc + i.subtotal, 0))
  const globalDiscountAmount = round2(subtotal * (globalDiscountPercent / 100))
  const taxableBase = round2(subtotal - globalDiscountAmount)

  // Ajustar la base gravable de cada ítem en proporción al descuento global
  const discountFactor = subtotal > 0 ? taxableBase / subtotal : 1

  // Agrupar IVA por alícuota
  const taxMap = new Map<string, TaxBreakdownItem>()
  for (const item of computedItems) {
    if (!item.taxRateId || item.taxPercent === 0) continue
    const adjustedBase = round2(item.subtotal * discountFactor)
    const adjustedTax = round2(adjustedBase * item.taxPercent)
    if (taxMap.has(item.taxRateId)) {
      const existing = taxMap.get(item.taxRateId)!
      existing.base = round2(existing.base + adjustedBase)
      existing.amount = round2(existing.amount + adjustedTax)
    } else {
      taxMap.set(item.taxRateId, {
        taxRateId: item.taxRateId,
        base: adjustedBase,
        amount: adjustedTax,
        rate: item.taxPercent,
      })
    }
  }

  const taxBreakdown = Array.from(taxMap.values())
  const taxAmount = round2(taxBreakdown.reduce((acc, t) => acc + t.amount, 0))
  const total = round2(taxableBase + taxAmount)

  return {
    subtotal,
    globalDiscountAmount,
    taxableBase,
    taxAmount,
    total,
    taxBreakdown,
    computedItems,
  }
}

// ---------------------------------------------------------------------------
// createInvoice
// ---------------------------------------------------------------------------

/**
 * Crea una factura completa en una transacción:
 * 1. Resuelve las alícuotas de los ítems
 * 2. Calcula todos los totales
 * 3. Crea la Invoice + InvoiceItems + InvoiceTaxes en una sola transacción
 * 4. Snapshot del cliente al momento de creación
 */
export async function createInvoice(
  db: TenantDb,
  data: CreateInvoiceInput & { tenantId: string; createdById?: string }
) {
  // Resolver las alícuotas de todos los ítems que las usen
  const taxRateIds = [...new Set(data.items.map((i) => i.taxRateId).filter(Boolean) as string[])]
  const taxRatesDb = taxRateIds.length
    ? await db.taxRate.findMany({ where: { id: { in: taxRateIds } } })
    : []

  const taxRateMap = new Map<string, number>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    taxRatesDb.map((t: any) => [t.id, Number(t.rate)])
  )

  const totals = calculateInvoiceTotals(data.items, data.discountPercent ?? 0, taxRateMap)

  // Snapshot del cliente
  let customerSnapshot: Record<string, unknown> | null = null
  if (data.customerId) {
    const customer = await db.customer.findUnique({
      where: { id: data.customerId },
      include: {
        addresses: { where: { isDefault: true, type: "FISCAL" } },
      },
    })
    if (customer) {
      customerSnapshot = {
        id: customer.id,
        companyName: customer.companyName,
        firstName: customer.firstName,
        lastName: customer.lastName,
        documentType: customer.documentType,
        documentNumber: customer.documentNumber,
        vatCondition: customer.vatCondition,
        email: customer.email,
        phone: customer.phone,
        fiscalAddress: customer.addresses[0] ?? null,
      }
    }
  }

  // El número en DRAFT es temporal (0) — se asigna el definitivo al emitir
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const invoice = await db.$transaction(async (tx: any) => {
    const created = await tx.invoice.create({
      data: {
        tenantId: data.tenantId,
        pointOfSaleId: data.pointOfSaleId,
        voucherType: data.voucherType,
        number: 0, // placeholder para borradores
        fullNumber: "BORRADOR",
        date: data.date ? new Date(data.date) : new Date(),
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        customerId: data.customerId ?? null,
        customerSnapshot: customerSnapshot ?? Prisma.JsonNull,
        paymentConditionId: data.paymentConditionId ?? null,
        salespersonId: data.salespersonId ?? null,
        originInvoiceId: data.originInvoiceId ?? null,
        saleOrderId: data.saleOrderId ?? null,
        subtotal: new Decimal(totals.subtotal),
        discountPercent: new Decimal(data.discountPercent ?? 0),
        discountAmount: new Decimal(totals.globalDiscountAmount),
        taxableBase: new Decimal(totals.taxableBase),
        taxAmount: new Decimal(totals.taxAmount),
        total: new Decimal(totals.total),
        paidAmount: new Decimal(0),
        currency: data.currency ?? "ARS",
        exchangeRate: new Decimal(data.exchangeRate ?? 1),
        status: "DRAFT",
        cae: data.cae ?? null,
        notes: data.notes ?? null,
        internalNotes: data.internalNotes ?? null,
        createdById: data.createdById ?? null,
        items: {
          create: totals.computedItems.map((item, idx) => ({
            productId: item.productId ?? null,
            description: item.description,
            quantity: new Decimal(item.quantity),
            unitPrice: new Decimal(item.unitPrice),
            discountPercent: new Decimal(item.discountPercent),
            discountAmount: new Decimal(item.discountAmount),
            taxRateId: item.taxRateId ?? null,
            taxPercent: new Decimal(item.taxPercent),
            taxAmount: new Decimal(item.taxAmount),
            subtotal: new Decimal(item.subtotal),
            total: new Decimal(item.total),
            order: item.order ?? idx,
          })),
        },
        taxes: {
          create: totals.taxBreakdown.map((t) => ({
            taxRateId: t.taxRateId,
            base: new Decimal(t.base),
            amount: new Decimal(t.amount),
          })),
        },
      },
      include: {
        items: true,
        taxes: true,
        pointOfSale: true,
        customer: true,
        paymentCondition: true,
      },
    })

    return created
  })

  return invoice
}

// ---------------------------------------------------------------------------
// issueInvoice
// ---------------------------------------------------------------------------

/**
 * Emite una factura: la pasa de DRAFT a ISSUED asignando número definitivo.
 * Usa bloqueo de la fila (FOR UPDATE) implícito en el UPDATE de VoucherSeries
 * para garantizar unicidad del número.
 */
export async function issueInvoice(
  db: TenantDb,
  invoiceId: string,
  tenantId: string,
  userId?: string
) {
  const invoice = await db.invoice.findFirst({
    where: { id: invoiceId, tenantId, deletedAt: null },
    include: { pointOfSale: true },
  })

  if (!invoice) throw new Error("Factura no encontrada")
  if (invoice.status !== "DRAFT") throw new Error("Solo se pueden emitir facturas en borrador")

  const number = await getNextVoucherNumber(
    db,
    invoice.pointOfSaleId,
    invoice.voucherType,
    tenantId
  )

  const posNumber = invoice.pointOfSale.number.toString().padStart(4, "0")
  const docNumber = number.toString().padStart(8, "0")
  const fullNumber = `${posNumber}-${docNumber}`

  const updated = await db.invoice.update({
    where: { id: invoiceId },
    data: {
      number,
      fullNumber,
      status: "ISSUED",
      updatedById: userId ?? null,
    },
    include: {
      items: true,
      taxes: true,
      pointOfSale: true,
      customer: true,
      paymentCondition: true,
    },
  })

  return updated
}

// ---------------------------------------------------------------------------
// cancelInvoice
// ---------------------------------------------------------------------------

/**
 * Cancela una factura si está en estado DRAFT o ISSUED y no tiene pagos
 * vinculados con importe mayor a 0.
 */
export async function cancelInvoice(
  db: TenantDb,
  invoiceId: string,
  tenantId: string,
  userId?: string
): Promise<void> {
  const invoice = await db.invoice.findFirst({
    where: { id: invoiceId, tenantId, deletedAt: null },
    include: { paymentLinks: true },
  })

  if (!invoice) throw new Error("Factura no encontrada")
  if (invoice.status === "CANCELLED") throw new Error("La factura ya está anulada")
  if (invoice.status === "PAID") throw new Error("No se puede anular una factura cobrada")

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalPaid = invoice.paymentLinks.reduce((acc: number, l: any) => acc + Number(l.amount), 0)
  if (totalPaid > 0) throw new Error("No se puede anular una factura con pagos registrados")

  await db.invoice.update({
    where: { id: invoiceId },
    data: {
      status: "CANCELLED",
      updatedById: userId ?? null,
    },
  })
}

// ---------------------------------------------------------------------------
// duplicateInvoice
// ---------------------------------------------------------------------------

/**
 * Duplica una factura como nuevo borrador, copiando todos los ítems.
 * No copia el número, la fecha de emisión ni el estado.
 */
export async function duplicateInvoice(
  db: TenantDb,
  invoiceId: string,
  tenantId: string,
  userId?: string
) {
  const source = await db.invoice.findFirst({
    where: { id: invoiceId, tenantId, deletedAt: null },
    include: {
      items: true,
      taxes: true,
    },
  })

  if (!source) throw new Error("Factura no encontrada")

  const duplicate = await db.invoice.create({
    data: {
      tenantId: source.tenantId,
      pointOfSaleId: source.pointOfSaleId,
      voucherType: source.voucherType,
      number: 0,
      fullNumber: "BORRADOR",
      date: new Date(),
      dueDate: source.dueDate ?? undefined,
      customerId: source.customerId ?? null,
      customerSnapshot: source.customerSnapshot ?? undefined,
      paymentConditionId: source.paymentConditionId ?? null,
      salespersonId: source.salespersonId ?? null,
      subtotal: source.subtotal,
      discountPercent: source.discountPercent,
      discountAmount: source.discountAmount,
      taxableBase: source.taxableBase,
      taxAmount: source.taxAmount,
      total: source.total,
      paidAmount: new Decimal(0),
      currency: source.currency,
      exchangeRate: source.exchangeRate,
      status: "DRAFT",
      notes: source.notes ?? null,
      internalNotes: source.internalNotes ?? null,
      createdById: userId ?? null,
      items: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        create: source.items.map((item: any) => ({
          productId: item.productId ?? null,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountPercent: item.discountPercent,
          discountAmount: item.discountAmount,
          taxRateId: item.taxRateId ?? null,
          taxPercent: item.taxPercent,
          taxAmount: item.taxAmount,
          subtotal: item.subtotal,
          total: item.total,
          order: item.order,
        })),
      },
      taxes: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        create: source.taxes.map((t: any) => ({
          taxRateId: t.taxRateId,
          base: t.base,
          amount: t.amount,
        })),
      },
    },
    include: {
      items: true,
      taxes: true,
      pointOfSale: true,
      customer: true,
    },
  })

  return duplicate
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
