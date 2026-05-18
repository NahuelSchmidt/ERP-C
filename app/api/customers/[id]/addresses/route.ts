/**
 * app/api/customers/[id]/addresses/route.ts
 *
 * GET  /api/customers/:id/addresses — Listar direcciones del cliente
 * POST /api/customers/:id/addresses — Agregar nueva dirección
 */

import { NextRequest, NextResponse } from "next/server"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"
import { createAddressSchema } from "@/lib/validations/customer"

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id: customerId } = await params
    const db = await getTenantDb()
    const { tenantId } = await getTenantContext()

    // Verify customer belongs to tenant
    const customer = await db.customer.findFirst({
      where: { id: customerId, tenantId, deletedAt: null },
    })
    if (!customer) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 })
    }

    const addresses = await db.customerAddress.findMany({
      where: { customerId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    })

    return NextResponse.json({ data: addresses })
  } catch (error) {
    console.error("[GET /api/customers/:id/addresses]", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: customerId } = await params
    const db = await getTenantDb()
    const { tenantId } = await getTenantContext()

    // Verify customer belongs to tenant
    const customer = await db.customer.findFirst({
      where: { id: customerId, tenantId, deletedAt: null },
    })
    if (!customer) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 })
    }

    const body: unknown = await req.json()
    const result = createAddressSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: result.error.flatten() },
        { status: 422 }
      )
    }

    const data = result.data

    // If this is the default address, unset others
    if (data.isDefault) {
      await db.customerAddress.updateMany({
        where: { customerId },
        data: { isDefault: false },
      })
    }

    // If no addresses yet, set as default automatically
    const existingCount = await db.customerAddress.count({ where: { customerId } })

    const address = await db.customerAddress.create({
      data: {
        customerId,
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
        notes: data.notes ?? null,
      },
    })

    return NextResponse.json({ data: address }, { status: 201 })
  } catch (error) {
    console.error("[POST /api/customers/:id/addresses]", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
