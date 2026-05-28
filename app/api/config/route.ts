/**
 * app/api/config/route.ts
 *
 * GET   /api/config — Configuración del tenant actual
 * PATCH /api/config — Actualizar configuración del tenant
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getTenantDb } from "@/lib/get-tenant-db"
import { z } from "zod"

const updateConfigSchema = z.object({
  companyName: z.string().min(1).optional(),
  tradeName: z.string().optional().nullable(),
  documentType: z.enum(["CUIT", "CUIL", "DNI", "PASSPORT", "OTHER"]).optional(),
  documentNumber: z.string().min(1).optional(),
  vatCondition: z
    .enum(["RESPONSABLE_INSCRIPTO", "MONOTRIBUTISTA", "CONSUMIDOR_FINAL", "EXENTO"])
    .optional(),
  grossIncomeNumber: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  country: z.string().optional(),
  postalCode: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email("Email inválido").optional().nullable(),
  website: z.string().optional().nullable(),
  currency: z.string().optional(),
  timezone: z.string().optional(),
})

// ---------------------------------------------------------------------------
// GET — Configuración del tenant
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const db = await getTenantDb()
    const config = await db.tenantConfig.findFirst()

    return NextResponse.json({ data: config })
  } catch (err) {
    console.error("[GET /api/config]", err)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// PATCH — Actualizar configuración
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const db = await getTenantDb()

    const config = await db.tenantConfig.findFirst()
    if (!config) {
      return NextResponse.json({ error: "Configuración no encontrada" }, { status: 404 })
    }

    const body = await req.json()
    const parsed = updateConfigSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 422 }
      )
    }

    const updated = await db.tenantConfig.update({
      where: { id: config.id },
      data: parsed.data,
    })

    return NextResponse.json({ data: updated })
  } catch (err) {
    console.error("[PATCH /api/config]", err)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
