/**
 * app/api/units/route.ts
 *
 * GET  /api/units — Listado de unidades de medida
 * POST /api/units — Crear unidad de medida
 */

import { NextRequest, NextResponse } from "next/server"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"
import { createUnitSchema } from "@/lib/validations/product"

// ---------------------------------------------------------------------------
// GET /api/units
// ---------------------------------------------------------------------------
export async function GET(_req: NextRequest) {
  try {
    const db = await getTenantDb()
    const { tenantId } = await getTenantContext()

    const units = await db.unitOfMeasure.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ isBase: "desc" }, { name: "asc" }],
    })

    return NextResponse.json({ data: units })
  } catch (error) {
    console.error("[GET /api/units]", error)
    return NextResponse.json(
      { error: "Error al obtener las unidades de medida" },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// POST /api/units
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const db = await getTenantDb()
    const { tenantId } = await getTenantContext()

    const body: unknown = await req.json()
    const parsed = createUnitSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const unit = await db.unitOfMeasure.create({
      data: { tenantId, ...parsed.data },
    })

    return NextResponse.json({ data: unit }, { status: 201 })
  } catch (error: unknown) {
    console.error("[POST /api/units]", error)

    if (
      error instanceof Error &&
      error.message.includes("Unique constraint")
    ) {
      return NextResponse.json(
        { error: "Ya existe una unidad con ese nombre" },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: "Error al crear la unidad de medida" },
      { status: 500 }
    )
  }
}
