/**
 * app/api/customers/[id]/contacts/[contactId]/route.ts
 *
 * PATCH  /api/customers/:id/contacts/:contactId — Actualizar contacto
 * DELETE /api/customers/:id/contacts/:contactId — Eliminar contacto
 */

import { NextRequest, NextResponse } from "next/server"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"
import { updateContactSchema } from "@/lib/validations/customer"

type RouteParams = { params: Promise<{ id: string; contactId: string }> }

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: customerId, contactId } = await params
    const db = await getTenantDb()
    const { tenantId } = await getTenantContext()

    const customer = await db.customer.findFirst({
      where: { id: customerId, tenantId, deletedAt: null },
    })
    if (!customer) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 })
    }

    const contact = await db.customerContact.findFirst({
      where: { id: contactId, customerId },
    })
    if (!contact) {
      return NextResponse.json({ error: "Contacto no encontrado" }, { status: 404 })
    }

    const body: unknown = await req.json()
    const result = updateContactSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: result.error.flatten() },
        { status: 422 }
      )
    }

    const data = result.data

    // If setting as primary, unset others
    if (data.isPrimary) {
      await db.customerContact.updateMany({
        where: { customerId, id: { not: contactId } },
        data: { isPrimary: false },
      })
    }

    const updated = await db.customerContact.update({
      where: { id: contactId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.role !== undefined && { role: data.role }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.mobile !== undefined && { mobile: data.mobile }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.isPrimary !== undefined && { isPrimary: data.isPrimary }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error("[PATCH /api/customers/:id/contacts/:contactId]", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id: customerId, contactId } = await params
    const db = await getTenantDb()
    const { tenantId } = await getTenantContext()

    const customer = await db.customer.findFirst({
      where: { id: customerId, tenantId, deletedAt: null },
    })
    if (!customer) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 })
    }

    const contact = await db.customerContact.findFirst({
      where: { id: contactId, customerId },
    })
    if (!contact) {
      return NextResponse.json({ error: "Contacto no encontrado" }, { status: 404 })
    }

    await db.customerContact.delete({ where: { id: contactId } })

    // If deleted was primary, set first remaining as primary
    if (contact.isPrimary) {
      const first = await db.customerContact.findFirst({
        where: { customerId },
        orderBy: { createdAt: "asc" },
      })
      if (first) {
        await db.customerContact.update({
          where: { id: first.id },
          data: { isPrimary: true },
        })
      }
    }

    return NextResponse.json({ data: { success: true } })
  } catch (error) {
    console.error("[DELETE /api/customers/:id/contacts/:contactId]", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
