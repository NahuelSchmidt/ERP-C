/**
 * app/api/suppliers/[id]/addresses/route.ts
 *
 * GET  /api/suppliers/:id/addresses — Listar direcciones del proveedor
 * POST /api/suppliers/:id/addresses — Agregar nueva dirección
 */

import { NextRequest, NextResponse } from "next/server"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"
import { createSupplierAddressSchema } from "@/lib/validations/supplier"

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id: supplierId } = await params
    const db = await getTenantDb()
    const { tenantId } = await getTenantContext()

    const supplier = await db.supplier.findFirst({
      where: { id: supplierId, tenantId, deletedAt: null },
    })
    if (!supplier) {
      return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 })
    }

    const addresses = await db.supplierAddress.findMany({
      where: { supplierId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    })

    return NextResponse.json({ data: addresses })
  } catch (error) {
    console.error("[GET /api/suppliers/:id/addresses]", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: supplierId } = await params
    const db = await getTenantDb()
    const { tenantId } = await getTenantContext()

    const supplier = await db.supplier.findFirst({
      where: { id: supplierId, tenantId, deletedAt: null },
    })
    if (!supplier) {
      return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 })
    }

    const body: unknown = await req.json()
    const result = createSupplierAddressSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: result.error.flatten() },
        { status: 422 }
      )
    }

    const data = result.data

    if (data.isDefault) {
      await db.supplierAddress.updateMany({
        where: { supplierId },
        data: { isDefault: false },
      })
    }

    const existingCount = await db.supplierAddress.count({ where: { supplierId } })

    const address = await db.supplierAddress.create({
      data: {
        supplierId,
        type: data.type,
        street: data.street,
        number: data.number ?? null,
        floor: data.floor ?? null,
        apartment: data.apartment ?? null,
        city: data.city ?? null,
        state: data.state ?? null,
        postalCode: data.postalCode ?? null,
        country: data.country,
        isDefault: data.isDefault || existingCount === 0,
      },
    })

    return NextResponse.json({ data: address }, { status: 201 })
  } catch (error) {
    console.error("[POST /api/suppliers/:id/addresses]", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
