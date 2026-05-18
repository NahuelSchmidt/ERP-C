/**
 * app/api/suppliers/[id]/addresses/[addressId]/route.ts
 *
 * PATCH  /api/suppliers/:id/addresses/:addressId — Actualizar dirección
 * DELETE /api/suppliers/:id/addresses/:addressId — Eliminar dirección
 */

import { NextRequest, NextResponse } from "next/server"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"
import { updateSupplierAddressSchema } from "@/lib/validations/supplier"

type RouteParams = { params: Promise<{ id: string; addressId: string }> }

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: supplierId, addressId } = await params
    const db = await getTenantDb()
    const { tenantId } = await getTenantContext()

    const supplier = await db.supplier.findFirst({
      where: { id: supplierId, tenantId, deletedAt: null },
    })
    if (!supplier) {
      return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 })
    }

    const address = await db.supplierAddress.findFirst({
      where: { id: addressId, supplierId },
    })
    if (!address) {
      return NextResponse.json({ error: "Dirección no encontrada" }, { status: 404 })
    }

    const body: unknown = await req.json()
    const result = updateSupplierAddressSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: result.error.flatten() },
        { status: 422 }
      )
    }

    const data = result.data

    if (data.isDefault) {
      await db.supplierAddress.updateMany({
        where: { supplierId, id: { not: addressId } },
        data: { isDefault: false },
      })
    }

    const updated = await db.supplierAddress.update({
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
      },
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error("[PATCH /api/suppliers/:id/addresses/:addressId]", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id: supplierId, addressId } = await params
    const db = await getTenantDb()
    const { tenantId } = await getTenantContext()

    const supplier = await db.supplier.findFirst({
      where: { id: supplierId, tenantId, deletedAt: null },
    })
    if (!supplier) {
      return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 })
    }

    const address = await db.supplierAddress.findFirst({
      where: { id: addressId, supplierId },
    })
    if (!address) {
      return NextResponse.json({ error: "Dirección no encontrada" }, { status: 404 })
    }

    await db.supplierAddress.delete({ where: { id: addressId } })

    if (address.isDefault) {
      const first = await db.supplierAddress.findFirst({
        where: { supplierId },
        orderBy: { createdAt: "asc" },
      })
      if (first) {
        await db.supplierAddress.update({
          where: { id: first.id },
          data: { isDefault: true },
        })
      }
    }

    return NextResponse.json({ data: { success: true } })
  } catch (error) {
    console.error("[DELETE /api/suppliers/:id/addresses/:addressId]", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
