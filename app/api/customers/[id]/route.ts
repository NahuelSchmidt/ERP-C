/**
 * app/api/customers/[id]/route.ts
 *
 * GET   /api/customers/:id — Detalle completo del cliente
 * PATCH /api/customers/:id — Actualizar cliente
 * DELETE /api/customers/:id — Soft delete del cliente
 */

import { NextRequest, NextResponse } from "next/server"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"
import { updateCustomerSchema } from "@/lib/validations/customer"

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const db = await getTenantDb()
    const { tenantId } = await getTenantContext()

    const customer = await db.customer.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        category: { select: { id: true, name: true, color: true } },
        priceList: { select: { id: true, name: true } },
        addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] },
        contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      },
    })

    if (!customer) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 })
    }

    return NextResponse.json({ data: customer })
  } catch (error) {
    console.error("[GET /api/customers/:id]", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const db = await getTenantDb()
    const { tenantId, userId } = await getTenantContext()

    // Verify ownership
    const existing = await db.customer.findFirst({
      where: { id, tenantId, deletedAt: null },
    })
    if (!existing) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 })
    }

    const body: unknown = await req.json()
    const result = updateCustomerSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: result.error.flatten() },
        { status: 422 }
      )
    }

    const data = result.data

    const customer = await db.customer.update({
      where: { id },
      data: {
        ...(data.type !== undefined && { type: data.type }),
        ...(data.firstName !== undefined && { firstName: data.firstName }),
        ...(data.lastName !== undefined && { lastName: data.lastName }),
        ...(data.companyName !== undefined && { companyName: data.companyName }),
        ...(data.documentType !== undefined && { documentType: data.documentType }),
        ...(data.documentNumber !== undefined && { documentNumber: data.documentNumber }),
        ...(data.vatCondition !== undefined && { vatCondition: data.vatCondition }),
        ...(data.grossIncomeNumber !== undefined && { grossIncomeNumber: data.grossIncomeNumber }),
        ...(data.creditLimit !== undefined && { creditLimit: data.creditLimit }),
        ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
        ...(data.priceListId !== undefined && { priceListId: data.priceListId }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.website !== undefined && { website: data.website }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        updatedById: userId ?? null,
      },
      include: {
        category: { select: { id: true, name: true, color: true } },
        priceList: { select: { id: true, name: true } },
        addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] },
        contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      },
    })

    return NextResponse.json({ data: customer })
  } catch (error) {
    console.error("[PATCH /api/customers/:id]", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const db = await getTenantDb()
    const { tenantId, userId } = await getTenantContext()

    const existing = await db.customer.findFirst({
      where: { id, tenantId, deletedAt: null },
    })
    if (!existing) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 })
    }

    await db.customer.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
        updatedById: userId ?? null,
      },
    })

    return NextResponse.json({ data: { success: true } })
  } catch (error) {
    console.error("[DELETE /api/customers/:id]", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
