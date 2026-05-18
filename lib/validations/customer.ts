/**
 * lib/validations/customer.ts
 *
 * Zod schemas para validación de Clientes, Direcciones y Contactos.
 * Usados tanto en API Routes (server) como en formularios (client con zodResolver).
 */

import { z } from "zod"

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const PersonTypeEnum = z.enum(["INDIVIDUAL", "COMPANY"])
export const DocumentTypeEnum = z.enum(["CUIT", "CUIL", "DNI", "PASSPORT", "OTHER"])
export const VatConditionEnum = z.enum([
  "RESPONSABLE_INSCRIPTO",
  "MONOTRIBUTISTA",
  "CONSUMIDOR_FINAL",
  "EXENTO",
])
export const AddressTypeEnum = z.enum(["FISCAL", "DELIVERY", "BILLING", "OTHER"])

// ---------------------------------------------------------------------------
// Labels en español
// ---------------------------------------------------------------------------

export const PERSON_TYPE_LABELS: Record<z.infer<typeof PersonTypeEnum>, string> = {
  INDIVIDUAL: "Persona Física",
  COMPANY: "Empresa",
}

export const DOCUMENT_TYPE_LABELS: Record<z.infer<typeof DocumentTypeEnum>, string> = {
  CUIT: "CUIT",
  CUIL: "CUIL",
  DNI: "DNI",
  PASSPORT: "Pasaporte",
  OTHER: "Otro",
}

export const VAT_CONDITION_LABELS: Record<z.infer<typeof VatConditionEnum>, string> = {
  RESPONSABLE_INSCRIPTO: "Responsable Inscripto",
  MONOTRIBUTISTA: "Monotributista",
  CONSUMIDOR_FINAL: "Consumidor Final",
  EXENTO: "Exento",
}

export const ADDRESS_TYPE_LABELS: Record<z.infer<typeof AddressTypeEnum>, string> = {
  FISCAL: "Fiscal",
  DELIVERY: "Entrega",
  BILLING: "Cobranza",
  OTHER: "Otra",
}

// ---------------------------------------------------------------------------
// Customer schemas
// ---------------------------------------------------------------------------

const baseCustomerSchema = z.object({
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
  vatCondition: VatConditionEnum.default("CONSUMIDOR_FINAL"),
  grossIncomeNumber: z
    .string()
    .max(30)
    .optional()
    .nullable()
    .transform((v) => (v === "" ? null : v)),
  creditLimit: z
    .union([z.number().nonnegative(), z.nan()])
    .optional()
    .nullable()
    .transform((v) => (v == null || Number.isNaN(v) ? null : v)),
  categoryId: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v === "" ? null : v)),
  priceListId: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v === "" ? null : v)),
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

export const createCustomerSchema = baseCustomerSchema.superRefine((data, ctx) => {
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

export const updateCustomerSchema = baseCustomerSchema.partial()

// ---------------------------------------------------------------------------
// Address schema
// ---------------------------------------------------------------------------

export const createAddressSchema = z.object({
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
  notes: z
    .string()
    .max(500)
    .optional()
    .nullable()
    .transform((v) => (v === "" ? null : v)),
})

export const updateAddressSchema = createAddressSchema.partial()

// ---------------------------------------------------------------------------
// Contact schema
// ---------------------------------------------------------------------------

export const createContactSchema = z.object({
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
  notes: z
    .string()
    .max(500)
    .optional()
    .nullable()
    .transform((v) => (v === "" ? null : v)),
})

export const updateContactSchema = createContactSchema.partial()

// ---------------------------------------------------------------------------
// Customer category schema
// ---------------------------------------------------------------------------

export const createCategorySchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(100),
  color: z.string().max(20).optional().nullable().default("#6366f1"),
  isActive: z.boolean().default(true),
})

export const updateCategorySchema = createCategorySchema.partial()

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>
export type CreateAddressInput = z.infer<typeof createAddressSchema>
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>
export type CreateContactInput = z.infer<typeof createContactSchema>
export type UpdateContactInput = z.infer<typeof updateContactSchema>
export type CreateCategoryInput = z.infer<typeof createCategorySchema>
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>
