/**
 * app/api/customers/[id]/contacts/route.ts
 *
 * GET  /api/customers/:id/contacts — Listar contactos del cliente
 * POST /api/customers/:id/contacts — Agregar nuevo contacto
 */

import { NextRequest, NextResponse } from "next/server"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"
import { createContactSchema } from "@/lib/validations/customer"

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id: customerId } = await params
    const db = await getTenantDb()
    const { tenantId } = await getTenantContext()

    const customer = await db.customer.findFirst({
      where: { id: customerId, tenantId, deletedAt: null },
    })
    if (!customer) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 })
    }

    const contacts = await db.customerContact.findMany({
      where: { customerId },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    })

    return NextResponse.json({ data: contacts })
  } catch (error) {
    console.error("[GET /api/customers/:id/contacts]", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: customerId } = await params
    const db = await getTenantDb()
    const { tenantId } = await getTenantContext()

    const customer = await db.customer.findFirst({
      where: { id: customerId, tenantId, deletedAt: null },
    })
    if (!customer) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 })
    }

    const body: unknown = await req.json()
    const result = createContactSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: result.error.flatten() },
        { status: 422 }
      )
    }

    const data = result.data

    // If primary, unset others
    if (data.isPrimary) {
      await db.customerContact.updateMany({
        where: { customerId },
        data: { isPrimary: false },
      })
    }

    // First contact is primary automatically
    const existingCount = await db.customerContact.count({ where: { customerId } })

    const contact = await db.customerContact.create({
      data: {
        customerId,
        name: data.name,
        role: data.role ?? null,
        phone: data.phone ?? null,
        mobile: data.mobile ?? null,
        email: data.email ?? null,
        isPrimary: data.isPrimary || existingCount === 0,
        notes: data.notes ?? null,
      },
    })

    return NextResponse.json({ data: contact }, { status: 201 })
  } catch (error) {
    console.error("[POST /api/customers/:id/contacts]", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
