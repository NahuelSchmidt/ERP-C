/**
 * app/api/suppliers/[id]/contacts/[contactId]/route.ts
 *
 * PATCH  /api/suppliers/:id/contacts/:contactId — Actualizar contacto
 * DELETE /api/suppliers/:id/contacts/:contactId — Eliminar contacto
 */

import { NextRequest, NextResponse } from "next/server"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"
import { updateSupplierContactSchema } from "@/lib/validations/supplier"

type RouteParams = { params: Promise<{ id: string; contactId: string }> }

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: supplierId, contactId } = await params
    const db = await getTenantDb()
    const { tenantId } = await getTenantContext()

    const supplier = await db.supplier.findFirst({
      where: { id: supplierId, tenantId, deletedAt: null },
    })
    if (!supplier) {
      return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 })
    }

    const contact = await db.supplierContact.findFirst({
      where: { id: contactId, supplierId },
    })
    if (!contact) {
      return NextResponse.json({ error: "Contacto no encontrado" }, { status: 404 })
    }

    const body: unknown = await req.json()
    const result = updateSupplierContactSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: result.error.flatten() },
        { status: 422 }
      )
    }

    const data = result.data

    if (data.isPrimary) {
      await db.supplierContact.updateMany({
        where: { supplierId, id: { not: contactId } },
        data: { isPrimary: false },
      })
    }

    const updated = await db.supplierContact.update({
      where: { id: contactId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.role !== undefined && { role: data.role }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.mobile !== undefined && { mobile: data.mobile }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.isPrimary !== undefined && { isPrimary: data.isPrimary }),
      },
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error("[PATCH /api/suppliers/:id/contacts/:contactId]", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id: supplierId, contactId } = await params
    const db = await getTenantDb()
    const { tenantId } = await getTenantContext()

    const supplier = await db.supplier.findFirst({
      where: { id: supplierId, tenantId, deletedAt: null },
    })
    if (!supplier) {
      return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 })
    }

    const contact = await db.supplierContact.findFirst({
      where: { id: contactId, supplierId },
    })
    if (!contact) {
      return NextResponse.json({ error: "Contacto no encontrado" }, { status: 404 })
    }

    await db.supplierContact.delete({ where: { id: contactId } })

    if (contact.isPrimary) {
      const first = await db.supplierContact.findFirst({
        where: { supplierId },
        orderBy: { createdAt: "asc" },
      })
      if (first) {
        await db.supplierContact.update({
          where: { id: first.id },
          data: { isPrimary: true },
        })
      }
    }

    return NextResponse.json({ data: { success: true } })
  } catch (error) {
    console.error("[DELETE /api/suppliers/:id/contacts/:contactId]", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
