/**
 * app/api/suppliers/[id]/route.ts
 *
 * GET   /api/suppliers/:id — Detalle completo del proveedor
 * PATCH /api/suppliers/:id — Actualizar proveedor
 * DELETE /api/suppliers/:id — Soft delete del proveedor
 */

import { NextRequest, NextResponse } from "next/server"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"
import { updateSupplierSchema } from "@/lib/validations/supplier"

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const db = await getTenantDb()
    const { tenantId } = await getTenantContext()

    const supplier = await db.supplier.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        paymentCondition: { select: { id: true, name: true } },
        addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] },
        contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      },
    })

    if (!supplier) {
      return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 })
    }

    return NextResponse.json({ data: supplier })
  } catch (error) {
    console.error("[GET /api/suppliers/:id]", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const db = await getTenantDb()
    const { tenantId, userId } = await getTenantContext()

    const existing = await db.supplier.findFirst({
      where: { id, tenantId, deletedAt: null },
    })
    if (!existing) {
      return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 })
    }

    const body: unknown = await req.json()
    const result = updateSupplierSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: result.error.flatten() },
        { status: 422 }
      )
    }

    const data = result.data

    const supplier = await db.supplier.update({
      where: { id },
      data: {
        ...(data.type !== undefined && { type: data.type }),
        ...(data.firstName !== undefined && { firstName: data.firstName }),
        ...(data.lastName !== undefined && { lastName: data.lastName }),
        ...(data.companyName !== undefined && { companyName: data.companyName }),
        ...(data.documentType !== undefined && { documentType: data.documentType }),
        ...(data.documentNumber !== undefined && { documentNumber: data.documentNumber }),
        ...(data.vatCondition !== undefined && { vatCondition: data.vatCondition }),
        ...(data.paymentConditionId !== undefined && { paymentConditionId: data.paymentConditionId }),
        ...(data.creditLimit !== undefined && { creditLimit: data.creditLimit }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.website !== undefined && { website: data.website }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        updatedById: userId ?? null,
      },
      include: {
        paymentCondition: { select: { id: true, name: true } },
        addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] },
        contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      },
    })

    return NextResponse.json({ data: supplier })
  } catch (error) {
    console.error("[PATCH /api/suppliers/:id]", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const db = await getTenantDb()
    const { tenantId, userId } = await getTenantContext()

    const existing = await db.supplier.findFirst({
      where: { id, tenantId, deletedAt: null },
    })
    if (!existing) {
      return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 })
    }

    await db.supplier.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
        updatedById: userId ?? null,
      },
    })

    return NextResponse.json({ data: { success: true } })
  } catch (error) {
    console.error("[DELETE /api/suppliers/:id]", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
