/**
 * lib/services/payment.service.ts
 *
 * Lógica de negocio para el módulo de Caja y Tesorería.
 *
 * Responsabilidades:
 *   - Registrar cobros a clientes y pagos a proveedores
 *   - Actualizar saldos de cuenta corriente del cliente/proveedor
 *   - Vincular pagos con facturas (InvoicePaymentLink)
 *   - Abrir y cerrar sesiones de caja con arqueo
 *   - Actualizar saldo de la caja al registrar movimientos
 *
 * Todas las operaciones críticas se ejecutan en transacciones Prisma
 * para garantizar consistencia.
 */

import { Decimal } from "@prisma/client/runtime/client"
import type { PaymentItemInput } from "@/lib/validations/payment"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RecordCustomerPaymentParams {
  cashSessionId?: string
  customerId: string
  total: number
  items: PaymentItemInput[]
  invoiceLinks?: Array<{ invoiceId: string; amount: number }>
  reference?: string
  notes?: string
  userId: string
}

export interface RecordSupplierPaymentParams {
  cashSessionId?: string
  supplierId: string
  total: number
  items: PaymentItemInput[]
  reference?: string
  notes?: string
  userId: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Formatea Decimal de Prisma a número JS. */
function toNumber(d: Decimal | number | null | undefined): number {
  if (d == null) return 0
  return typeof d === "number" ? d : d.toNumber()
}

// ---------------------------------------------------------------------------
// Payment Service
// ---------------------------------------------------------------------------

/**
 * Registra un cobro a un cliente.
 *
 * Efectos en la base de datos (dentro de una transacción):
 *   1. Crea el registro Payment con sus PaymentItems.
 *   2. Si se proveen invoiceLinks, crea los InvoicePaymentLink y actualiza
 *      el estado/balance de cada Invoice.
 *   3. Actualiza el currentBalance del Customer (descuenta lo cobrado).
 *   4. Si hay cashSessionId, actualiza el currentBalance de la CashRegister.
 */
export async function recordCustomerPayment(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  data: RecordCustomerPaymentParams
) {
  return db.$transaction(async (tx: typeof db) => {
    // 1. Crear el Payment
    const payment = await tx.payment.create({
      data: {
        tenantId: (await tx.customer.findUnique({
          where: { id: data.customerId },
          select: { tenantId: true },
        }))!.tenantId,
        cashSessionId: data.cashSessionId ?? null,
        direction: "CUSTOMER",
        customerId: data.customerId,
        total: new Decimal(data.total),
        reference: data.reference ?? null,
        notes: data.notes ?? null,
        status: "COMPLETED",
        createdById: data.userId,
        items: {
          create: data.items.map((item) => ({
            paymentMethodId: item.paymentMethodId,
            amount: new Decimal(item.amount),
            cardBrand: item.cardBrand ?? null,
            cardLastFour: item.cardLastFour ?? null,
            cardInstallments: item.cardInstallments ?? null,
            posTerminalRef: item.posTerminalRef ?? null,
            bankRef: item.bankRef ?? null,
            checkId: item.checkId ?? null,
          })),
        },
      },
      include: {
        items: true,
        customer: true,
      },
    })

    // 2. Vincular con facturas y actualizar saldo de cada una
    if (data.invoiceLinks && data.invoiceLinks.length > 0) {
      for (const link of data.invoiceLinks) {
        await tx.invoicePaymentLink.create({
          data: {
            invoiceId: link.invoiceId,
            paymentId: payment.id,
            amount: new Decimal(link.amount),
          },
        })

        // Sumar lo pagado en esta factura y actualizar estado si queda saldada
        const invoice = await tx.invoice.findUnique({
          where: { id: link.invoiceId },
          select: { id: true, total: true, paidAmount: true },
        })
        if (invoice) {
          const newPaid = toNumber(invoice.paidAmount) + link.amount
          const invoiceTotal = toNumber(invoice.total)
          const newStatus =
            newPaid >= invoiceTotal - 0.01
              ? "PAID"
              : newPaid > 0
              ? "PARTIAL"
              : undefined

          await tx.invoice.update({
            where: { id: link.invoiceId },
            data: {
              paidAmount: new Decimal(newPaid),
              ...(newStatus ? { status: newStatus } : {}),
            },
          })
        }
      }
    }

    // 3. Actualizar currentBalance del cliente (restar lo cobrado — deuda)
    await tx.customer.update({
      where: { id: data.customerId },
      data: {
        currentBalance: {
          decrement: new Decimal(data.total),
        },
      },
    })

    // 4. Actualizar saldo de caja si hay sesión
    if (data.cashSessionId) {
      const session = await tx.cashSession.findUnique({
        where: { id: data.cashSessionId },
        select: { cashRegisterId: true },
      })
      if (session) {
        // Solo sumar el efectivo y otros medios que aumentan el saldo físico
        // (excluir cuenta corriente pura)
        const cashItems = data.items.filter(
          (item) => item.paymentMethodId // todos por ahora — en producción filtrar por tipo
        )
        const cashTotal = cashItems.reduce((acc, i) => acc + i.amount, 0)

        await tx.cashRegister.update({
          where: { id: session.cashRegisterId },
          data: {
            currentBalance: {
              increment: new Decimal(cashTotal),
            },
          },
        })
      }
    }

    return payment
  })
}

/**
 * Registra un pago a un proveedor.
 *
 * Efectos similares a recordCustomerPayment pero en dirección opuesta:
 *   1. Crea Payment con direction=SUPPLIER.
 *   2. Actualiza currentBalance del Supplier (decrementa deuda hacia proveedor).
 *   3. Actualiza saldo de caja si hay sesión (decrementa).
 */
export async function recordSupplierPayment(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  data: RecordSupplierPaymentParams
) {
  return db.$transaction(async (tx: typeof db) => {
    const supplierTenant = await tx.supplier.findUnique({
      where: { id: data.supplierId },
      select: { tenantId: true },
    })
    if (!supplierTenant) throw new Error("Proveedor no encontrado")

    const payment = await tx.payment.create({
      data: {
        tenantId: supplierTenant.tenantId,
        cashSessionId: data.cashSessionId ?? null,
        direction: "SUPPLIER",
        supplierId: data.supplierId,
        total: new Decimal(data.total),
        reference: data.reference ?? null,
        notes: data.notes ?? null,
        status: "COMPLETED",
        createdById: data.userId,
        items: {
          create: data.items.map((item) => ({
            paymentMethodId: item.paymentMethodId,
            amount: new Decimal(item.amount),
            cardBrand: item.cardBrand ?? null,
            cardLastFour: item.cardLastFour ?? null,
            cardInstallments: item.cardInstallments ?? null,
            posTerminalRef: item.posTerminalRef ?? null,
            bankRef: item.bankRef ?? null,
            checkId: item.checkId ?? null,
          })),
        },
      },
      include: { items: true },
    })

    // Actualizar saldo del proveedor
    await tx.supplier.update({
      where: { id: data.supplierId },
      data: {
        currentBalance: {
          decrement: new Decimal(data.total),
        },
      },
    })

    // Decrementar saldo de caja
    if (data.cashSessionId) {
      const session = await tx.cashSession.findUnique({
        where: { id: data.cashSessionId },
        select: { cashRegisterId: true },
      })
      if (session) {
        await tx.cashRegister.update({
          where: { id: session.cashRegisterId },
          data: {
            currentBalance: {
              decrement: new Decimal(data.total),
            },
          },
        })
      }
    }

    return payment
  })
}

/**
 * Abre una sesión de caja.
 *
 * Valida que no exista otra sesión OPEN para la misma caja antes de crear.
 */
export async function openCashSession(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  cashRegisterId: string,
  openingBalance: number,
  userId: string
) {
  // Verificar que no haya sesión abierta
  const existingSession = await db.cashSession.findFirst({
    where: { cashRegisterId, status: "OPEN" },
  })
  if (existingSession) {
    throw new Error(
      "Ya existe una sesión abierta para esta caja. Cerrala antes de abrir una nueva."
    )
  }

  // Verificar que la caja existe y está activa
  const cashRegister = await db.cashRegister.findUnique({
    where: { id: cashRegisterId },
  })
  if (!cashRegister || !cashRegister.isActive) {
    throw new Error("La caja no existe o no está activa")
  }

  // Crear sesión y actualizar saldo inicial de la caja
  return db.$transaction(async (tx: typeof db) => {
    const session = await tx.cashSession.create({
      data: {
        cashRegisterId,
        userId,
        openingBalance: new Decimal(openingBalance),
        status: "OPEN",
      },
      include: {
        cashRegister: true,
      },
    })

    // Sincronizar saldo de la caja con el saldo de apertura
    await tx.cashRegister.update({
      where: { id: cashRegisterId },
      data: { currentBalance: new Decimal(openingBalance) },
    })

    return session
  })
}

/**
 * Cierra una sesión de caja con arqueo.
 *
 * Calcula el saldo esperado (apertura + ingresos - egresos) y la diferencia
 * con el saldo real declarado por el operador.
 */
export async function closeCashSession(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  sessionId: string,
  closingBalance: number,
  notes?: string
) {
  const session = await db.cashSession.findUnique({
    where: { id: sessionId },
    include: {
      payments: {
        where: { status: "COMPLETED" },
        include: {
          items: {
            include: { paymentMethod: true },
          },
        },
      },
    },
  })

  if (!session) throw new Error("Sesión no encontrada")
  if (session.status === "CLOSED") throw new Error("La sesión ya fue cerrada")

  // Calcular saldo esperado
  // Solo medios físicos (CASH, DEBIT_CARD, CREDIT_CARD, CHECK, MERCADO_PAGO)
  // Excluir CURRENT_ACCOUNT y BANK_TRANSFER (no generan movimiento físico de caja)
  const PHYSICAL_METHODS = new Set([
    "CASH",
    "DEBIT_CARD",
    "CREDIT_CARD",
    "MERCADO_PAGO",
    "CHECK",
    "OTHER",
  ])

  let totalIncome = 0
  let totalExpense = 0

  for (const payment of session.payments) {
    const physicalAmount = payment.items
      .filter((item: { paymentMethod: { type: string } }) =>
        PHYSICAL_METHODS.has(item.paymentMethod.type)
      )
      .reduce((acc: number, item: { amount: Decimal }) => acc + toNumber(item.amount), 0)

    if (payment.direction === "CUSTOMER") {
      totalIncome += physicalAmount
    } else if (payment.direction === "SUPPLIER") {
      totalExpense += physicalAmount
    }
  }

  const openingBal = toNumber(session.openingBalance)
  const expectedBalance = openingBal + totalIncome - totalExpense
  const difference = closingBalance - expectedBalance

  return db.cashSession.update({
    where: { id: sessionId },
    data: {
      closedAt: new Date(),
      closingBalance: new Decimal(closingBalance),
      expectedBalance: new Decimal(expectedBalance),
      difference: new Decimal(difference),
      status: "CLOSED",
      notes: notes ?? null,
    },
    include: {
      cashRegister: true,
    },
  })
}
