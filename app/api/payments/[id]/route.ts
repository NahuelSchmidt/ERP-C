/**
 * app/api/payments/[id]/route.ts
 *
 * GET    /api/payments/:id — Detalle completo de un cobro/pago
 * DELETE /api/payments/:id — Anular (soft) — solo si status es PENDING
 */

import { NextRequest, NextResponse } from "next/server"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const db = await getTenantDb()
    const { tenantId } = await getTenantContext()
    const { id } = await params

    const payment = await db.payment.findFirst({
      where: { id, tenantId },
      include: {
        customer: {
          select: {
            id: true,
            companyName: true,
            firstName: true,
            lastName: true,
            documentNumber: true,
          },
        },
        supplier: {
          select: { id: true, companyName: true },
        },
        cashSession: {
          select: {
            id: true,
            status: true,
            cashRegister: { select: { id: true, name: true } },
          },
        },
        items: {
          include: {
            paymentMethod: { select: { id: true, name: true, type: true } },
            check: {
              select: {
                id: true,
                number: true,
                bankName: true,
                amount: true,
                dueDate: true,
                status: true,
              },
            },
          },
        },
        invoiceLinks: {
          include: {
            invoice: {
              select: {
                id: true,
                number: true,
                voucherType: true,
                total: true,
                paidAmount: true,
                status: true,
              },
            },
          },
        },
      },
    })

    if (!payment) {
      return NextResponse.json(
        { error: "Cobro/pago no encontrado" },
        { status: 404 }
      )
    }

    return NextResponse.json({ data: payment })
  } catch (error) {
    console.error("[GET /api/payments/:id]", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const db = await getTenantDb()
    const { tenantId } = await getTenantContext()
    const { id } = await params

    const payment = await db.payment.findFirst({
      where: { id, tenantId },
    })

    if (!payment) {
      return NextResponse.json(
        { error: "Cobro/pago no encontrado" },
        { status: 404 }
      )
    }

    if (payment.status !== "PENDING") {
      return NextResponse.json(
        { error: "Solo se pueden anular cobros/pagos en estado Pendiente" },
        { status: 409 }
      )
    }

    const cancelled = await db.payment.update({
      where: { id },
      data: { status: "CANCELLED" },
    })

    return NextResponse.json({ data: cancelled })
  } catch (error) {
    console.error("[DELETE /api/payments/:id]", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
