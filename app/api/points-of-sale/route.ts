/**
 * app/api/points-of-sale/route.ts
 *
 * GET  /api/points-of-sale  — Lista puntos de venta del tenant
 * POST /api/points-of-sale  — Crear punto de venta
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"
import { createPointOfSaleSchema } from "@/lib/validations/invoice"

export async function GET(_req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const { tenantId } = await getTenantContext()
    const db = await getTenantDb()

    const pointsOfSale = await db.pointOfSale.findMany({
      where: { tenantId },
      include: { branch: { select: { id: true, name: true, city: true } } },
      orderBy: { number: "asc" },
    })

    return NextResponse.json({ data: pointsOfSale })
  } catch (err) {
    console.error("[GET /api/points-of-sale]", err)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const { tenantId } = await getTenantContext()
    const db = await getTenantDb()

    const body = await req.json()
    const parsed = createPointOfSaleSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 422 }
      )
    }

    // Verificar que el número no esté en uso
    const existing = await db.pointOfSale.findFirst({
      where: { tenantId, number: parsed.data.number },
    })
    if (existing) {
      return NextResponse.json(
        { error: `El punto de venta número ${parsed.data.number} ya existe` },
        { status: 409 }
      )
    }

    const pos = await db.pointOfSale.create({
      data: {
        tenantId,
        ...parsed.data,
      },
    })

    return NextResponse.json({ data: pos }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/points-of-sale]", err)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
