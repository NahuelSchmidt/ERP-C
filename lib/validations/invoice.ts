/**
 * lib/validations/invoice.ts
 *
 * Zod schemas para el módulo de Facturación.
 * Usados tanto en la API (server) como en los formularios (client) para
 * garantizar validaciones consistentes en ambos lados.
 */

import { z } from "zod"

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const VOUCHER_TYPES = [
  "FACTURA_A",
  "FACTURA_B",
  "FACTURA_C",
  "NOTA_CREDITO_A",
  "NOTA_CREDITO_B",
  "NOTA_CREDITO_C",
  "NOTA_DEBITO_A",
  "NOTA_DEBITO_B",
  "NOTA_DEBITO_C",
  "REMITO",
  "PRESUPUESTO",
  "ORDEN_COMPRA",
  "RECIBO",
] as const

export type VoucherType = (typeof VOUCHER_TYPES)[number]

export const INVOICE_STATUSES = ["DRAFT", "ISSUED", "CANCELLED", "PAID", "PARTIAL"] as const
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export const VOUCHER_TYPE_LABELS: Record<VoucherType, string> = {
  FACTURA_A: "Factura A",
  FACTURA_B: "Factura B",
  FACTURA_C: "Factura C",
  NOTA_CREDITO_A: "Nota de Crédito A",
  NOTA_CREDITO_B: "Nota de Crédito B",
  NOTA_CREDITO_C: "Nota de Crédito C",
  NOTA_DEBITO_A: "Nota de Débito A",
  NOTA_DEBITO_B: "Nota de Débito B",
  NOTA_DEBITO_C: "Nota de Débito C",
  REMITO: "Remito",
  PRESUPUESTO: "Presupuesto",
  ORDEN_COMPRA: "Orden de Compra",
  RECIBO: "Recibo",
}

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: "Borrador",
  ISSUED: "Emitida",
  CANCELLED: "Anulada",
  PAID: "Cobrada",
  PARTIAL: "Cobro parcial",
}

// ---------------------------------------------------------------------------
// Item schema
// ---------------------------------------------------------------------------

export const invoiceItemSchema = z.object({
  productId: z.string().optional(),
  description: z.string().min(1, "La descripción es obligatoria"),
  quantity: z.number({ error: "Cantidad inválida" }).positive("Debe ser mayor a 0"),
  unitPrice: z.number({ error: "Precio inválido" }).min(0, "No puede ser negativo"),
  discountPercent: z
    .number({ error: "Descuento inválido" })
    .min(0)
    .max(100)
    .default(0),
  taxRateId: z.string().optional(),
  order: z.number().int().default(0),
})

export type InvoiceItemInput = z.infer<typeof invoiceItemSchema>

// ---------------------------------------------------------------------------
// Create / Update schemas
// ---------------------------------------------------------------------------

export const createInvoiceSchema = z.object({
  pointOfSaleId: z.string().min(1, "El punto de venta es obligatorio"),
  voucherType: z.enum(VOUCHER_TYPES, {
    error: "Tipo de comprobante inválido",
  }),
  customerId: z.string().optional(),
  date: z.string().optional(),
  dueDate: z.string().optional(),
  paymentConditionId: z.string().optional(),
  salespersonId: z.string().optional(),
  originInvoiceId: z.string().optional(),
  saleOrderId: z.string().optional(),
  discountPercent: z
    .number({ error: "Descuento inválido" })
    .min(0)
    .max(100)
    .default(0),
  currency: z.string().default("ARS"),
  exchangeRate: z.number().positive().default(1),
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
  cae: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1, "Debe incluir al menos un ítem"),
})

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>

export const updateInvoiceSchema = createInvoiceSchema.partial().extend({
  // Al actualizar, los ítems son opcionales en el schema pero si se envían
  // se reemplazan completos
  items: z.array(invoiceItemSchema).optional(),
})

export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>

// ---------------------------------------------------------------------------
// List / filter schemas
// ---------------------------------------------------------------------------

export const invoiceListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  status: z.enum(INVOICE_STATUSES).optional(),
  voucherType: z.enum(VOUCHER_TYPES).optional(),
  customerId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  pointOfSaleId: z.string().optional(),
})

export type InvoiceListQuery = z.infer<typeof invoiceListQuerySchema>

// ---------------------------------------------------------------------------
// PointOfSale schemas
// ---------------------------------------------------------------------------

export const createPointOfSaleSchema = z.object({
  branchId: z.string().optional(),
  number: z.number().int().positive("El número debe ser positivo"),
  name: z.string().min(1, "El nombre es obligatorio"),
  address: z.string().optional(),
  isActive: z.boolean().default(true),
})

export type CreatePointOfSaleInput = z.infer<typeof createPointOfSaleSchema>

// ---------------------------------------------------------------------------
// TaxRate schemas
// ---------------------------------------------------------------------------

export const TAX_TYPES = ["IVA", "PERCEPCION_IVA", "PERCEPCION_IIBB", "MUNICIPAL", "OTHER"] as const

export const createTaxRateSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  type: z.enum(TAX_TYPES),
  rate: z
    .number({ error: "Alícuota inválida" })
    .min(0)
    .max(1, "La tasa debe ser entre 0 y 1 (ej: 0.21 para 21%)"),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
})

export type CreateTaxRateInput = z.infer<typeof createTaxRateSchema>

// ---------------------------------------------------------------------------
// PaymentCondition schemas
// ---------------------------------------------------------------------------

export const createPaymentConditionSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  days: z.number().int().min(0).default(0),
  description: z.string().optional(),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
})

export type CreatePaymentConditionInput = z.infer<typeof createPaymentConditionSchema>
