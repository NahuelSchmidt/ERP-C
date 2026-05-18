/**
 * app/api/customers/[id]/addresses/[addressId]/route.ts
 *
 * PATCH  /api/customers/:id/addresses/:addressId — Actualizar dirección
 * DELETE /api/customers/:id/addresses/:addressId — Eliminar dirección
 */

import { NextRequest, NextResponse } from "next/server"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"
import { updateAddressSchema } from "@/lib/validations/customer"

type RouteParams = { params: Promise<{ id: string; addressId: string }> }

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: customerId, addressId } = await params
    const db = await getTenantDb()
    const { tenantId } = await getTenantContext()

    // Verify customer belongs to tenant
    const customer = await db.customer.findFirst({
      where: { id: customerId, tenantId, deletedAt: null },
    })
    if (!customer) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 })
    }

    const address = await db.customerAddress.findFirst({
      where: { id: addressId, customerId },
    })
    if (!address) {
      return NextResponse.json({ error: "Dirección no encontrada" }, { status: 404 })
    }

    const body: unknown = await req.json()
    const result = updateAddressSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: result.error.flatten() },
        { status: 422 }
      )
    }

    const data = result.data

    // If setting as default, unset others
    if (data.isDefault) {
      await db.customerAddress.updateMany({
        where: { customerId, id: { not: addressId } },
        data: { isDefault: false },
      })
    }

    const updated = await db.customerAddress.update({
      where: { id: addressId },
      data: {
        ...(data.type !== undefined && { type: data.type }),
        ...(data.street !== undefined && { street: data.street }),
        ...(data.number !== undefined && { number: data.number }),
        ...(data.floor !== undefined && { floor: data.floor }),
        ...(data.apartment !== undefined && { apartment: data.apartment }),
        ...(data.city !== undefined && { city: data.city }),
        ...(data.state !== undefined && { state: data.state }),
        ...(data.postalCode !== undefined && { postalCode: data.postalCode }),
        ...(data.country !== undefined && { country: data.country }),
        ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error("[PATCH /api/customers/:id/addresses/:addressId]", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id: customerId, addressId } = await params
    const db = await getTenantDb()
    const { tenantId } = await getTenantContext()

    // Verify customer belongs to tenant
    const customer = await db.customer.findFirst({
      where: { id: customerId, tenantId, deletedAt: null },
    })
    if (!customer) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 })
    }

    const address = await db.customerAddress.findFirst({
      where: { id: addressId, customerId },
    })
    if (!address) {
      return NextResponse.json({ error: "Dirección no encontrada" }, { status: 404 })
    }

    await db.customerAddress.delete({ where: { id: addressId } })

    // If deleted was default, set the first remaining as default
    if (address.isDefault) {
      const first = await db.customerAddress.findFirst({
        where: { customerId },
        orderBy: { createdAt: "asc" },
      })
      if (first) {
        await db.customerAddress.update({
          where: { id: first.id },
          data: { isDefault: true },
        })
      }
    }

    return NextResponse.json({ data: { success: true } })
  } catch (error) {
    console.error("[DELETE /api/customers/:id/addresses/:addressId]", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
