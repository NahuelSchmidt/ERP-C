/**
 * lib/validations/product.ts
 *
 * Schemas Zod para validación de Productos, Categorías, Unidades de Medida
 * y Depósitos.
 */

import { z } from "zod"

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const ProductStatusEnum = z.enum(["ACTIVE", "INACTIVE", "DISCONTINUED"])
export type ProductStatus = z.infer<typeof ProductStatusEnum>

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  ACTIVE: "Activo",
  INACTIVE: "Inactivo",
  DISCONTINUED: "Descontinuado",
}

// ---------------------------------------------------------------------------
// Product schemas
// ---------------------------------------------------------------------------

export const createProductSchema = z.object({
  categoryId: z.preprocess((v) => (v === "" ? null : v), z.string().cuid().optional().nullable()),
  unitId: z.preprocess((v) => (v === "" ? null : v), z.string().cuid().optional().nullable()),
  internalCode: z.string().max(50).optional().nullable(),
  barcode: z.string().max(50).optional().nullable(),
  sku: z.string().max(50).optional().nullable(),
  name: z.string().min(1, "El nombre es obligatorio").max(255),
  description: z.string().max(2000).optional().nullable(),

  // Control de stock
  trackStock: z.boolean().default(true),
  trackBatches: z.boolean().default(false),
  trackSerials: z.boolean().default(false),
  allowNegative: z.boolean().default(false),
  minStock: z
    .union([z.number().nonnegative(), z.null()])
    .optional()
    .nullable(),
  maxStock: z
    .union([z.number().nonnegative(), z.null()])
    .optional()
    .nullable(),
  reorderPoint: z
    .union([z.number().nonnegative(), z.null()])
    .optional()
    .nullable(),

  // Costos
  costPrice: z.number().nonnegative().default(0),
  defaultMargin: z.number().min(0).max(10).default(0), // 0.30 = 30%

  // Atributos físicos
  weight: z
    .union([z.number().nonnegative(), z.null()])
    .optional()
    .nullable(),
  weightUnit: z.string().max(10).optional().nullable(),

  status: ProductStatusEnum.default("ACTIVE"),
  notes: z.string().max(2000).optional().nullable(),
})

export type CreateProductInput = z.infer<typeof createProductSchema>

export const updateProductSchema = createProductSchema.partial()
export type UpdateProductInput = z.infer<typeof updateProductSchema>

// ---------------------------------------------------------------------------
// ProductCategory schemas
// ---------------------------------------------------------------------------

export const createProductCategorySchema = z.object({
  parentId: z.string().cuid().optional().nullable(),
  name: z.string().min(1, "El nombre es obligatorio").max(100),
  slug: z.string().max(120).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  isActive: z.boolean().default(true),
})

export type CreateProductCategoryInput = z.infer<
  typeof createProductCategorySchema
>

export const updateProductCategorySchema =
  createProductCategorySchema.partial()
export type UpdateProductCategoryInput = z.infer<
  typeof updateProductCategorySchema
>

// ---------------------------------------------------------------------------
// UnitOfMeasure schemas
// ---------------------------------------------------------------------------

export const createUnitSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(100),
  abbreviation: z.string().min(1, "La abreviatura es obligatoria").max(20),
  isBase: z.boolean().default(false),
  isActive: z.boolean().default(true),
})

export type CreateUnitInput = z.infer<typeof createUnitSchema>

// ---------------------------------------------------------------------------
// Warehouse schemas
// ---------------------------------------------------------------------------

export const createWarehouseSchema = z.object({
  branchId: z.string().cuid({ message: "Debe seleccionar una sucursal" }),
  name: z.string().min(1, "El nombre es obligatorio").max(100),
  description: z.string().max(500).optional().nullable(),
  address: z.string().max(255).optional().nullable(),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
})

export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>

export const updateWarehouseSchema = createWarehouseSchema.partial()
export type UpdateWarehouseInput = z.infer<typeof updateWarehouseSchema>
