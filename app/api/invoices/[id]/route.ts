/**
 * app/api/invoices/[id]/route.ts
 *
 * GET    /api/invoices/:id  — Detalle completo de comprobante
 * PATCH  /api/invoices/:id  — Actualizar borrador
 * DELETE /api/invoices/:id  — Soft delete (solo borradores)
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"
import { updateInvoiceSchema } from "@/lib/validations/invoice"
import { calculateInvoiceTotals } from "@/lib/services/invoice.service"
import { Decimal } from "@prisma/client/runtime/client"

type Params = { params: Promise<{ id: string }> }

// ---------------------------------------------------------------------------
// GET — Detalle completo
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const { tenantId } = await getTenantContext()
    const db = await getTenantDb()
    const { id } = await params

    const invoice = await db.invoice.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        items: {
          include: { taxRate: true, product: { select: { id: true, name: true, internalCode: true } } },
          orderBy: { order: "asc" },
        },
        taxes: { include: { taxRate: true } },
        customer: {
          include: {
            addresses: { where: { type: "FISCAL" } },
            contacts: { where: { isPrimary: true } },
          },
        },
        pointOfSale: { include: { branch: true } },
        paymentCondition: true,
        salesperson: true,
        originInvoice: {
          select: { id: true, fullNumber: true, voucherType: true, date: true },
        },
        derivedInvoices: {
          where: { deletedAt: null },
          select: { id: true, fullNumber: true, voucherType: true, status: true, date: true },
        },
        saleOrder: { select: { id: true, number: true, status: true } },
        paymentLinks: {
          include: {
            payment: {
              select: { id: true, date: true, total: true, status: true, direction: true },
            },
          },
        },
      },
    })

    if (!invoice) {
      return NextResponse.json({ error: "Comprobante no encontrado" }, { status: 404 })
    }

    return NextResponse.json({ data: invoice })
  } catch (err) {
    console.error("[GET /api/invoices/:id]", err)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// PATCH — Actualizar borrador
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const { tenantId } = await getTenantContext()
    const db = await getTenantDb()
    const { id } = await params

    const invoice = await db.invoice.findFirst({
      where: { id, tenantId, deletedAt: null },
    })

    if (!invoice) {
      return NextResponse.json({ error: "Comprobante no encontrado" }, { status: 404 })
    }
    if (invoice.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Solo se pueden editar comprobantes en borrador" },
        { status: 409 }
      )
    }

    const body = await req.json()
    const parsed = updateInvoiceSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 422 }
      )
    }

    const data = parsed.data

    // Si se actualizan ítems, recalcular totales
    let totalsData: Partial<Parameters<typeof db.invoice.update>[0]["data"]> = {}
    if (data.items) {
      const taxRateIds = [
        ...new Set(data.items.map((i) => i.taxRateId).filter(Boolean) as string[]),
      ]
      const taxRatesDb = taxRateIds.length
        ? await db.taxRate.findMany({ where: { id: { in: taxRateIds } } })
        : []
      const taxRateMap = new Map<string, number>(
        taxRatesDb.map((t) => [t.id, Number(t.rate)])
      )
      const totals = calculateInvoiceTotals(
        data.items,
        data.discountPercent ?? Number(invoice.discountPercent),
        taxRateMap
      )

      totalsData = {
        subtotal: new Decimal(totals.subtotal),
        discountAmount: new Decimal(totals.globalDiscountAmount),
        taxableBase: new Decimal(totals.taxableBase),
        taxAmount: new Decimal(totals.taxAmount),
        total: new Decimal(totals.total),
      }
    }

    const updated = await db.$transaction(async (tx) => {
      // Eliminar ítems e impuestos existentes si se envían nuevos
      if (data.items) {
        await tx.invoiceItem.deleteMany({ where: { invoiceId: id } })
        await tx.invoiceTax.deleteMany({ where: { invoiceId: id } })
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateData: any = {
          ...(data.pointOfSaleId && { pointOfSaleId: data.pointOfSaleId }),
          ...(data.voucherType && { voucherType: data.voucherType }),
          ...(data.customerId !== undefined && { customerId: data.customerId ?? null }),
          ...(data.date && { date: new Date(data.date) }),
          ...(data.dueDate !== undefined && {
            dueDate: data.dueDate ? new Date(data.dueDate) : null,
          }),
          ...(data.paymentConditionId !== undefined && {
            paymentConditionId: data.paymentConditionId ?? null,
          }),
          ...(data.salespersonId !== undefined && {
            salespersonId: data.salespersonId ?? null,
          }),
          ...(data.discountPercent !== undefined && {
            discountPercent: new Decimal(data.discountPercent),
          }),
          ...(data.currency && { currency: data.currency }),
          ...(data.exchangeRate !== undefined && {
            exchangeRate: new Decimal(data.exchangeRate),
          }),
          ...(data.notes !== undefined && { notes: data.notes ?? null }),
          ...(data.internalNotes !== undefined && {
            internalNotes: data.internalNotes ?? null,
          }),
          ...(data.cae !== undefined && { cae: data.cae ?? null }),
          ...totalsData,
          updatedById: session.user.id,
          // Crear nuevos ítems si se enviaron
          ...(data.items && {
            items: {
              create: data.items.map((item, idx) => {
                const disc =
                  Math.round(item.quantity * item.unitPrice * (item.discountPercent / 100) * 100) /
                  100
                const sub = Math.round((item.quantity * item.unitPrice - disc) * 100) / 100
                const taxP = 0
                return {
                  productId: item.productId ?? null,
                  description: item.description,
                  quantity: new Decimal(item.quantity),
                  unitPrice: new Decimal(item.unitPrice),
                  discountPercent: new Decimal(item.discountPercent),
                  discountAmount: new Decimal(disc),
                  taxRateId: item.taxRateId ?? null,
                  taxPercent: new Decimal(taxP),
                  taxAmount: new Decimal(0),
                  subtotal: new Decimal(sub),
                  total: new Decimal(sub),
                  order: item.order ?? idx,
                }
              }),
            },
          }),
        }

      const result = await tx.invoice.update({
        where: { id },
        data: updateData,
        include: {
          items: true,
          taxes: true,
          pointOfSale: true,
          customer: true,
        },
      })

      return result
    })

    return NextResponse.json({ data: updated })
  } catch (err) {
    console.error("[PATCH /api/invoices/:id]", err)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// DELETE — Soft delete (solo borradores)
// ---------------------------------------------------------------------------

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const { tenantId } = await getTenantContext()
    const db = await getTenantDb()
    const { id } = await params

    const invoice = await db.invoice.findFirst({
      where: { id, tenantId, deletedAt: null },
    })

    if (!invoice) {
      return NextResponse.json({ error: "Comprobante no encontrado" }, { status: 404 })
    }
    if (invoice.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Solo se pueden eliminar comprobantes en borrador" },
        { status: 409 }
      )
    }

    await db.invoice.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: session.user.id },
    })

    return NextResponse.json({ data: { success: true } })
  } catch (err) {
    console.error("[DELETE /api/invoices/:id]", err)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
