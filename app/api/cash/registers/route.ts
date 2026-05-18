/**
 * app/api/cash/registers/route.ts
 *
 * GET  /api/cash/registers — Lista de cajas del tenant
 * POST /api/cash/registers — Crear nueva caja
 */

import { NextRequest, NextResponse } from "next/server"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"
import { createCashRegisterSchema } from "@/lib/validations/payment"
import { z } from "zod"

const listQuerySchema = z.object({
  branchId: z.string().optional(),
  isActive: z
    .enum(["true", "false"])
    .optional()
    .transform((v) =>
      v === "true" ? true : v === "false" ? false : undefined
    ),
})

export async function GET(req: NextRequest) {
  try {
    const db = await getTenantDb()
    const { tenantId } = await getTenantContext()

    const queryResult = listQuerySchema.safeParse(
      Object.fromEntries(req.nextUrl.searchParams)
    )
    if (!queryResult.success) {
      return NextResponse.json(
        { error: "Parámetros inválidos", details: queryResult.error.flatten() },
        { status: 400 }
      )
    }

    const { branchId, isActive } = queryResult.data

    const registers = await db.cashRegister.findMany({
      where: {
        tenantId,
        ...(branchId ? { branchId } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
      include: {
        branch: { select: { id: true, name: true } },
        sessions: {
          where: { status: "OPEN" },
          take: 1,
          orderBy: { openedAt: "desc" },
          select: {
            id: true,
            status: true,
            openedAt: true,
            openingBalance: true,
            userId: true,
          },
        },
      },
      orderBy: { name: "asc" },
    })

    return NextResponse.json({ data: registers })
  } catch (error) {
    console.error("[GET /api/cash/registers]", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = await getTenantDb()
    const { tenantId, userId } = await getTenantContext()

    const body: unknown = await req.json()
    const result = createCashRegisterSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: result.error.flatten() },
        { status: 422 }
      )
    }

    const { branchId, name, isActive } = result.data

    // Verificar que la sucursal existe y pertenece al tenant
    const branch = await db.branch.findFirst({
      where: { id: branchId, tenantId },
    })
    if (!branch) {
      return NextResponse.json(
        { error: "Sucursal no encontrada" },
        { status: 404 }
      )
    }

    const register = await db.cashRegister.create({
      data: {
        tenantId,
        branchId,
        name,
        isActive,
        currentBalance: 0,
      },
      include: {
        branch: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json({ data: register }, { status: 201 })
  } catch (error) {
    console.error("[POST /api/cash/registers]", error)
    if (
      error instanceof Error &&
      error.message.includes("Unique constraint")
    ) {
      return NextResponse.json(
        { error: "Ya existe una caja con ese nombre en la sucursal" },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
