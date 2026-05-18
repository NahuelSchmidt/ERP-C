/**
 * app/api/suppliers/[id]/contacts/route.ts
 *
 * GET  /api/suppliers/:id/contacts — Listar contactos del proveedor
 * POST /api/suppliers/:id/contacts — Agregar nuevo contacto
 */

import { NextRequest, NextResponse } from "next/server"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"
import { createSupplierContactSchema } from "@/lib/validations/supplier"

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

    const contacts = await db.supplierContact.findMany({
      where: { supplierId },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    })

    return NextResponse.json({ data: contacts })
  } catch (error) {
    console.error("[GET /api/suppliers/:id/contacts]", error)
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
    const result = createSupplierContactSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: result.error.flatten() },
        { status: 422 }
      )
    }

    const data = result.data

    if (data.isPrimary) {
      await db.supplierContact.updateMany({
        where: { supplierId },
        data: { isPrimary: false },
      })
    }

    const existingCount = await db.supplierContact.count({ where: { supplierId } })

    const contact = await db.supplierContact.create({
      data: {
        supplierId,
        name: data.name,
        role: data.role ?? null,
        phone: data.phone ?? null,
        mobile: data.mobile ?? null,
        email: data.email ?? null,
        isPrimary: data.isPrimary || existingCount === 0,
      },
    })

    return NextResponse.json({ data: contact }, { status: 201 })
  } catch (error) {
    console.error("[POST /api/suppliers/:id/contacts]", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
