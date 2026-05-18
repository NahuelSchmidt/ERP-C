/**
 * lib/validations/payment.ts
 *
 * Zod schemas para validación de Cobros/Pagos, Caja, Cheques y Cuentas Bancarias.
 * Usados en API Routes (server) y formularios (client con zodResolver).
 */

import { z } from "zod"

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const PaymentMethodTypeEnum = z.enum([
  "CASH",
  "DEBIT_CARD",
  "CREDIT_CARD",
  "BANK_TRANSFER",
  "CHECK",
  "MERCADO_PAGO",
  "CURRENT_ACCOUNT",
  "OTHER",
])

export const PaymentDirectionEnum = z.enum(["CUSTOMER", "SUPPLIER", "INTERNAL"])
export const PaymentStatusEnum = z.enum(["PENDING", "COMPLETED", "CANCELLED"])
export const CheckTypeEnum = z.enum(["OWN", "THIRD_PARTY"])
export const CheckStatusEnum = z.enum([
  "IN_WALLET",
  "DEPOSITED",
  "ENDORSED",
  "REJECTED",
  "CANCELLED",
])
export const BankAccountTypeEnum = z.enum(["CHECKING", "SAVINGS", "OTHER"])
export const CashSessionStatusEnum = z.enum(["OPEN", "CLOSED"])

// ---------------------------------------------------------------------------
// Labels en español
// ---------------------------------------------------------------------------

export const PAYMENT_METHOD_TYPE_LABELS: Record<
  z.infer<typeof PaymentMethodTypeEnum>,
  string
> = {
  CASH: "Efectivo",
  DEBIT_CARD: "Tarjeta de Débito",
  CREDIT_CARD: "Tarjeta de Crédito",
  BANK_TRANSFER: "Transferencia Bancaria",
  CHECK: "Cheque",
  MERCADO_PAGO: "Mercado Pago",
  CURRENT_ACCOUNT: "Cuenta Corriente",
  OTHER: "Otro",
}

export const PAYMENT_DIRECTION_LABELS: Record<
  z.infer<typeof PaymentDirectionEnum>,
  string
> = {
  CUSTOMER: "Cobro a cliente",
  SUPPLIER: "Pago a proveedor",
  INTERNAL: "Interno",
}

export const PAYMENT_STATUS_LABELS: Record<
  z.infer<typeof PaymentStatusEnum>,
  string
> = {
  PENDING: "Pendiente",
  COMPLETED: "Completado",
  CANCELLED: "Anulado",
}

export const CHECK_TYPE_LABELS: Record<z.infer<typeof CheckTypeEnum>, string> =
  {
    OWN: "Cheque Propio",
    THIRD_PARTY: "Cheque de Tercero",
  }

export const CHECK_STATUS_LABELS: Record<
  z.infer<typeof CheckStatusEnum>,
  string
> = {
  IN_WALLET: "En Cartera",
  DEPOSITED: "Depositado",
  ENDORSED: "Endosado",
  REJECTED: "Rechazado",
  CANCELLED: "Anulado",
}

export const BANK_ACCOUNT_TYPE_LABELS: Record<
  z.infer<typeof BankAccountTypeEnum>,
  string
> = {
  CHECKING: "Cuenta Corriente",
  SAVINGS: "Caja de Ahorro",
  OTHER: "Otra",
}

// ---------------------------------------------------------------------------
// PaymentItem schema
// ---------------------------------------------------------------------------

export const paymentItemSchema = z.object({
  paymentMethodId: z.string().min(1, "Seleccione un medio de pago"),
  amount: z.number({ error: "Monto inválido" }).positive("El monto debe ser mayor a 0"),
  cardBrand: z.string().max(50).optional(),
  cardLastFour: z.string().length(4, "Debe tener exactamente 4 dígitos").optional(),
  cardInstallments: z.number().int().positive().optional(),
  posTerminalRef: z.string().max(100).optional(),
  bankRef: z.string().max(200).optional(),
  checkId: z.string().optional(),
})

// ---------------------------------------------------------------------------
// Payment schemas
// ---------------------------------------------------------------------------

export const createPaymentSchema = z
  .object({
    cashSessionId: z.string().optional(),
    direction: PaymentDirectionEnum,
    customerId: z.string().optional(),
    supplierId: z.string().optional(),
    date: z.string().datetime().optional(),
    total: z.number({ error: "Total inválido" }).positive("El total debe ser mayor a 0"),
    items: z.array(paymentItemSchema).min(1, "Agregue al menos un medio de pago"),
    invoiceLinks: z
      .array(
        z.object({
          invoiceId: z.string(),
          amount: z.number().positive("El monto debe ser mayor a 0"),
        })
      )
      .optional(),
    reference: z.string().max(200).optional(),
    notes: z.string().max(2000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.direction === "CUSTOMER" && !data.customerId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Seleccione un cliente para cobros",
        path: ["customerId"],
      })
    }
    if (data.direction === "SUPPLIER" && !data.supplierId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Seleccione un proveedor para pagos",
        path: ["supplierId"],
      })
    }
    // Validate items sum equals total
    const itemsTotal = data.items.reduce((acc, item) => acc + item.amount, 0)
    const diff = Math.abs(itemsTotal - data.total)
    if (diff > 0.01) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `La suma de medios de pago ($${itemsTotal.toFixed(2)}) no coincide con el total ($${data.total.toFixed(2)})`,
        path: ["items"],
      })
    }
  })

export const updatePaymentStatusSchema = z.object({
  status: PaymentStatusEnum,
})

// ---------------------------------------------------------------------------
// CashRegister schemas
// ---------------------------------------------------------------------------

export const createCashRegisterSchema = z.object({
  branchId: z.string().min(1, "Seleccione una sucursal"),
  name: z.string().min(1, "El nombre es requerido").max(100),
  isActive: z.boolean().default(true),
})

export const updateCashRegisterSchema = createCashRegisterSchema.partial()

// ---------------------------------------------------------------------------
// CashSession schemas
// ---------------------------------------------------------------------------

export const openCashSessionSchema = z.object({
  cashRegisterId: z.string().min(1, "Seleccione una caja"),
  openingBalance: z
    .number({ error: "Saldo inicial inválido" })
    .nonnegative("El saldo inicial no puede ser negativo"),
})

export const closeCashSessionSchema = z.object({
  closingBalance: z
    .number({ error: "Saldo final inválido" })
    .nonnegative("El saldo final no puede ser negativo"),
  notes: z.string().max(2000).optional(),
})

// ---------------------------------------------------------------------------
// PaymentMethod schemas
// ---------------------------------------------------------------------------

export const createPaymentMethodSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(100),
  type: PaymentMethodTypeEnum,
  surchargePercent: z
    .number()
    .nonnegative("El recargo no puede ser negativo")
    .max(100, "El recargo no puede superar el 100%")
    .default(0),
  isActive: z.boolean().default(true),
  order: z.number().int().nonnegative().default(0),
})

export const updatePaymentMethodSchema = createPaymentMethodSchema.partial()

// ---------------------------------------------------------------------------
// Check schemas
// ---------------------------------------------------------------------------

export const createCheckSchema = z.object({
  type: CheckTypeEnum,
  number: z.string().min(1, "El número de cheque es requerido").max(50),
  bankName: z.string().min(1, "El banco es requerido").max(150),
  bankBranch: z.string().max(100).optional(),
  accountNumber: z.string().max(50).optional(),
  amount: z
    .number({ error: "Monto inválido" })
    .positive("El monto debe ser mayor a 0"),
  issueDate: z.string().datetime(),
  dueDate: z.string().datetime(),
  customerId: z.string().optional(),
  drawerName: z.string().max(200).optional(),
  supplierId: z.string().optional(),
  notes: z.string().max(2000).optional(),
})

export const updateCheckSchema = z.object({
  status: CheckStatusEnum.optional(),
  endorsedTo: z.string().max(200).optional(),
  rejectedReason: z.string().max(500).optional(),
  bankAccountId: z.string().optional(),
  notes: z.string().max(2000).optional(),
})

export const depositCheckSchema = z.object({
  bankAccountId: z.string().min(1, "Seleccione una cuenta bancaria"),
  depositDate: z.string().datetime().optional(),
  reference: z.string().max(200).optional(),
})

export const endorseCheckSchema = z.object({
  endorsedTo: z.string().min(1, "Ingrese a quién se endosa").max(200),
  endorseDate: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
})

// ---------------------------------------------------------------------------
// BankAccount schemas
// ---------------------------------------------------------------------------

export const createBankAccountSchema = z.object({
  bankName: z.string().min(1, "El banco es requerido").max(150),
  accountType: BankAccountTypeEnum.default("CHECKING"),
  accountNumber: z.string().max(50).optional(),
  cbu: z
    .string()
    .max(22)
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  alias: z.string().max(100).optional(),
  currency: z.string().max(10).default("ARS"),
  currentBalance: z
    .number({ error: "Saldo inválido" })
    .default(0),
  isActive: z.boolean().default(true),
  notes: z.string().max(2000).optional(),
})

export const updateBankAccountSchema = createBankAccountSchema.partial()

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type PaymentItemInput = z.infer<typeof paymentItemSchema>
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>
export type CreateCashRegisterInput = z.infer<typeof createCashRegisterSchema>
export type UpdateCashRegisterInput = z.infer<typeof updateCashRegisterSchema>
export type OpenCashSessionInput = z.infer<typeof openCashSessionSchema>
export type CloseCashSessionInput = z.infer<typeof closeCashSessionSchema>
export type CreatePaymentMethodInput = z.infer<typeof createPaymentMethodSchema>
export type UpdatePaymentMethodInput = z.infer<typeof updatePaymentMethodSchema>
export type CreateCheckInput = z.infer<typeof createCheckSchema>
export type UpdateCheckInput = z.infer<typeof updateCheckSchema>
export type DepositCheckInput = z.infer<typeof depositCheckSchema>
export type EndorseCheckInput = z.infer<typeof endorseCheckSchema>
export type CreateBankAccountInput = z.infer<typeof createBankAccountSchema>
export type UpdateBankAccountInput = z.infer<typeof updateBankAccountSchema>
