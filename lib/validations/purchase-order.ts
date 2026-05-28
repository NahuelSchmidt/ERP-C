import { z } from "zod"

export const PURCHASE_ORDER_STATUSES = ["DRAFT", "SENT", "PARTIAL", "RECEIVED", "CANCELLED"] as const
export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number]

export const PURCHASE_ORDER_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  DRAFT: "Borrador",
  SENT: "Enviada",
  PARTIAL: "Recepción parcial",
  RECEIVED: "Recibida",
  CANCELLED: "Cancelada",
}

export const purchaseOrderItemSchema = z.object({
  productId: z.string().optional(),
  taxRateId: z.string().optional(),
  description: z.string().min(1, "La descripción es obligatoria"),
  quantity: z.number({ error: "Cantidad inválida" }).positive("Debe ser mayor a 0"),
  unitPrice: z.number({ error: "Precio inválido" }).nonnegative("No puede ser negativo"),
  taxPercent: z.number({ error: "IVA inválido" }).nonnegative().default(0),
  order: z.number().int().nonnegative().default(0),
})

export type PurchaseOrderItemInput = z.infer<typeof purchaseOrderItemSchema>

export const createPurchaseOrderSchema = z.object({
  supplierId: z.string().min(1, "El proveedor es obligatorio"),
  date: z.string().optional(),
  expectedDelivery: z.string().optional(),
  currency: z.string().default("ARS"),
  exchangeRate: z.number().positive().default(1),
  notes: z.string().max(2000).optional(),
  items: z.array(purchaseOrderItemSchema).min(1, "Debe tener al menos un ítem"),
})

export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>

export const updatePurchaseOrderSchema = createPurchaseOrderSchema
  .omit({ items: true })
  .partial()
  .extend({
    items: z.array(purchaseOrderItemSchema).optional(),
  })

export type UpdatePurchaseOrderInput = z.infer<typeof updatePurchaseOrderSchema>

export const purchaseOrderListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  supplierId: z.string().optional(),
  status: z.enum(PURCHASE_ORDER_STATUSES).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
})

export type PurchaseOrderListQuery = z.infer<typeof purchaseOrderListQuerySchema>
