/**
 * lib/types/entities.ts
 *
 * Tipos TypeScript que reflejan las entidades devueltas por las APIs.
 * Son independientes de Prisma Client para no importar el cliente en código cliente.
 */

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

export type PersonType = "INDIVIDUAL" | "COMPANY"
export type DocumentType = "CUIT" | "CUIL" | "DNI" | "PASSPORT" | "OTHER"
export type VatCondition =
  | "RESPONSABLE_INSCRIPTO"
  | "MONOTRIBUTISTA"
  | "CONSUMIDOR_FINAL"
  | "EXENTO"
export type AddressType = "FISCAL" | "DELIVERY" | "BILLING" | "OTHER"

// ---------------------------------------------------------------------------
// Customer Category
// ---------------------------------------------------------------------------

export interface CustomerCategory {
  id: string
  tenantId: string
  name: string
  color: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  _count?: { customers: number }
}

// ---------------------------------------------------------------------------
// Customer Address
// ---------------------------------------------------------------------------

export interface CustomerAddress {
  id: string
  customerId: string
  type: AddressType
  street: string
  number: string | null
  floor: string | null
  apartment: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  country: string
  isDefault: boolean
  notes: string | null
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// Customer Contact
// ---------------------------------------------------------------------------

export interface CustomerContact {
  id: string
  customerId: string
  name: string
  role: string | null
  phone: string | null
  mobile: string | null
  email: string | null
  isPrimary: boolean
  notes: string | null
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// Customer
// ---------------------------------------------------------------------------

export interface Customer {
  id: string
  tenantId: string
  categoryId: string | null
  priceListId: string | null
  type: PersonType
  firstName: string | null
  lastName: string | null
  companyName: string | null
  documentType: DocumentType
  documentNumber: string | null
  vatCondition: VatCondition
  grossIncomeNumber: string | null
  creditLimit: string | null // Decimal serialized as string
  currentBalance: string
  phone: string | null
  email: string | null
  website: string | null
  notes: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  createdById: string | null
  updatedById: string | null
  category?: Pick<CustomerCategory, "id" | "name" | "color"> | null
  priceList?: { id: string; name: string } | null
  addresses?: CustomerAddress[]
  contacts?: CustomerContact[]
}

// ---------------------------------------------------------------------------
// Supplier Address
// ---------------------------------------------------------------------------

export interface SupplierAddress {
  id: string
  supplierId: string
  type: AddressType
  street: string
  number: string | null
  floor: string | null
  apartment: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  country: string
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// Supplier Contact
// ---------------------------------------------------------------------------

export interface SupplierContact {
  id: string
  supplierId: string
  name: string
  role: string | null
  phone: string | null
  mobile: string | null
  email: string | null
  isPrimary: boolean
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// Supplier
// ---------------------------------------------------------------------------

export interface Supplier {
  id: string
  tenantId: string
  type: PersonType
  firstName: string | null
  lastName: string | null
  companyName: string | null
  documentType: DocumentType
  documentNumber: string | null
  vatCondition: VatCondition
  paymentConditionId: string | null
  currentBalance: string
  creditLimit: string | null
  phone: string | null
  email: string | null
  website: string | null
  notes: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  createdById: string | null
  updatedById: string | null
  paymentCondition?: { id: string; name: string } | null
  addresses?: SupplierAddress[]
  contacts?: SupplierContact[]
}

// ---------------------------------------------------------------------------
// API response wrapper types
// ---------------------------------------------------------------------------

export interface PaginatedMeta {
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface ApiListResponse<T> {
  data: T[]
  meta: PaginatedMeta
}

export interface ApiItemResponse<T> {
  data: T
}
