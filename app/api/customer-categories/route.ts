/**
 * app/api/customer-categories/route.ts
 *
 * GET  /api/customer-categories — Listar categorías de clientes
 * POST /api/customer-categories — Crear categoría
 */

import { NextRequest, NextResponse } from "next/server"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"
import { createCategorySchema } from "@/lib/validations/customer"

export async function GET(_req: NextRequest) {
  try {
    const db = await getTenantDb()
    const { tenantId } = await getTenantContext()

    const categories = await db.customerCategory.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
      include: {
        _count: { select: { customers: true } },
      },
    })

    return NextResponse.json({ data: categories })
  } catch (error) {
    console.error("[GET /api/customer-categories]", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = await getTenantDb()
    const { tenantId } = await getTenantContext()

    const body: unknown = await req.json()
    const result = createCategorySchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: result.error.flatten() },
        { status: 422 }
      )
    }

    const data = result.data

    const category = await db.customerCategory.create({
      data: {
        tenantId,
        name: data.name,
        color: data.color ?? "#6366f1",
        isActive: data.isActive,
      },
    })

    return NextResponse.json({ data: category }, { status: 201 })
  } catch (error) {
    console.error("[POST /api/customer-categories]", error)
    // Handle unique constraint
    if (
      error instanceof Error &&
      error.message.includes("Unique constraint")
    ) {
      return NextResponse.json(
        { error: "Ya existe una categoría con ese nombre" },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
