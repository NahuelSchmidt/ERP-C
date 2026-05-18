/**
 * lib/validations/supplier.ts
 *
 * Zod schemas para validación de Proveedores, Direcciones y Contactos.
 */

import { z } from "zod"
import {
  PersonTypeEnum,
  DocumentTypeEnum,
  VatConditionEnum,
  AddressTypeEnum,
} from "./customer"

// Re-export shared enums and labels from customer validation
export {
  PersonTypeEnum,
  DocumentTypeEnum,
  VatConditionEnum,
  AddressTypeEnum,
  PERSON_TYPE_LABELS,
  DOCUMENT_TYPE_LABELS,
  VAT_CONDITION_LABELS,
  ADDRESS_TYPE_LABELS,
} from "./customer"

// ---------------------------------------------------------------------------
// Supplier schemas
// ---------------------------------------------------------------------------

const baseSupplierSchema = z.object({
  type: PersonTypeEnum.default("COMPANY"),
  firstName: z.string().max(100).optional().nullable(),
  lastName: z.string().max(100).optional().nullable(),
  companyName: z.string().max(200).optional().nullable(),
  documentType: DocumentTypeEnum.default("CUIT"),
  documentNumber: z
    .string()
    .max(30)
    .optional()
    .nullable()
    .transform((v) => (v === "" ? null : v)),
  vatCondition: VatConditionEnum.default("RESPONSABLE_INSCRIPTO"),
  paymentConditionId: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v === "" ? null : v)),
  creditLimit: z
    .union([z.number().nonnegative(), z.nan()])
    .optional()
    .nullable()
    .transform((v) => (v == null || Number.isNaN(v) ? null : v)),
  phone: z
    .string()
    .max(30)
    .optional()
    .nullable()
    .transform((v) => (v === "" ? null : v)),
  email: z
    .string()
    .email("Email inválido")
    .max(254)
    .optional()
    .nullable()
    .transform((v) => (v === "" ? null : v)),
  website: z
    .string()
    .max(254)
    .optional()
    .nullable()
    .transform((v) => (v === "" ? null : v)),
  notes: z
    .string()
    .max(2000)
    .optional()
    .nullable()
    .transform((v) => (v === "" ? null : v)),
  isActive: z.boolean().default(true),
})

export const createSupplierSchema = baseSupplierSchema.superRefine((data, ctx) => {
  if (data.type === "COMPANY" && !data.companyName?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "La razón social es requerida para empresas",
      path: ["companyName"],
    })
  }
  if (data.type === "INDIVIDUAL" && !data.firstName?.trim() && !data.lastName?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "El nombre o apellido es requerido para personas físicas",
      path: ["firstName"],
    })
  }
})

export const updateSupplierSchema = baseSupplierSchema.partial()

// ---------------------------------------------------------------------------
// Supplier address schema
// ---------------------------------------------------------------------------

export const createSupplierAddressSchema = z.object({
  type: AddressTypeEnum.default("FISCAL"),
  street: z.string().min(1, "La calle es requerida").max(200),
  number: z
    .string()
    .max(20)
    .optional()
    .nullable()
    .transform((v) => (v === "" ? null : v)),
  floor: z
    .string()
    .max(10)
    .optional()
    .nullable()
    .transform((v) => (v === "" ? null : v)),
  apartment: z
    .string()
    .max(10)
    .optional()
    .nullable()
    .transform((v) => (v === "" ? null : v)),
  city: z
    .string()
    .max(100)
    .optional()
    .nullable()
    .transform((v) => (v === "" ? null : v)),
  state: z
    .string()
    .max(100)
    .optional()
    .nullable()
    .transform((v) => (v === "" ? null : v)),
  postalCode: z
    .string()
    .max(20)
    .optional()
    .nullable()
    .transform((v) => (v === "" ? null : v)),
  country: z.string().max(100).default("Argentina"),
  isDefault: z.boolean().default(false),
})

export const updateSupplierAddressSchema = createSupplierAddressSchema.partial()

// ---------------------------------------------------------------------------
// Supplier contact schema
// ---------------------------------------------------------------------------

export const createSupplierContactSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(150),
  role: z
    .string()
    .max(100)
    .optional()
    .nullable()
    .transform((v) => (v === "" ? null : v)),
  phone: z
    .string()
    .max(30)
    .optional()
    .nullable()
    .transform((v) => (v === "" ? null : v)),
  mobile: z
    .string()
    .max(30)
    .optional()
    .nullable()
    .transform((v) => (v === "" ? null : v)),
  email: z
    .string()
    .email("Email inválido")
    .max(254)
    .optional()
    .nullable()
    .transform((v) => (v === "" ? null : v)),
  isPrimary: z.boolean().default(false),
})

export const updateSupplierContactSchema = createSupplierContactSchema.partial()

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>
export type CreateSupplierAddressInput = z.infer<typeof createSupplierAddressSchema>
export type UpdateSupplierAddressInput = z.infer<typeof updateSupplierAddressSchema>
export type CreateSupplierContactInput = z.infer<typeof createSupplierContactSchema>
export type UpdateSupplierContactInput = z.infer<typeof updateSupplierContactSchema>
