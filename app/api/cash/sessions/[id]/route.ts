/**
 * app/api/cash/sessions/[id]/route.ts
 *
 * GET /api/cash/sessions/:id — Detalle de sesión con movimientos del día
 */

import { NextRequest, NextResponse } from "next/server"
import { getTenantDb } from "@/lib/get-tenant-db"

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const db = await getTenantDb()
    const { id } = await params

    const session = await db.cashSession.findUnique({
      where: { id },
      include: {
        cashRegister: {
          select: {
            id: true,
            name: true,
            currentBalance: true,
            branch: { select: { id: true, name: true } },
          },
        },
        payments: {
          where: { status: { not: "CANCELLED" } },
          include: {
            customer: {
              select: { id: true, companyName: true, firstName: true, lastName: true },
            },
            supplier: {
              select: { id: true, companyName: true },
            },
            items: {
              include: {
                paymentMethod: { select: { id: true, name: true, type: true } },
              },
            },
          },
          orderBy: { date: "desc" },
        },
      },
    })

    if (!session) {
      return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 })
    }

    // Calcular resumen por medio de pago
    const summaryByMethod: Record<
      string,
      { name: string; type: string; total: number; count: number }
    > = {}

    for (const payment of session.payments) {
      for (const item of payment.items) {
        const key = item.paymentMethod.id
        if (!summaryByMethod[key]) {
          summaryByMethod[key] = {
            name: item.paymentMethod.name,
            type: item.paymentMethod.type,
            total: 0,
            count: 0,
          }
        }
        const amount =
          payment.direction === "CUSTOMER"
            ? Number(item.amount)
            : -Number(item.amount)
        summaryByMethod[key].total += amount
        summaryByMethod[key].count += 1
      }
    }

    const totalCollected = session.payments
      .filter((p: { direction: string }) => p.direction === "CUSTOMER")
      .reduce((acc: number, p: { total: unknown }) => acc + Number(p.total), 0)

    const totalPaid = session.payments
      .filter((p: { direction: string }) => p.direction === "SUPPLIER")
      .reduce((acc: number, p: { total: unknown }) => acc + Number(p.total), 0)

    return NextResponse.json({
      data: session,
      meta: {
        totalCollected,
        totalPaid,
        netTotal: totalCollected - totalPaid,
        paymentCount: session.payments.length,
        summaryByMethod: Object.values(summaryByMethod),
      },
    })
  } catch (error) {
    console.error("[GET /api/cash/sessions/:id]", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
