/**
 * app/api/suppliers/route.ts
 *
 * GET  /api/suppliers — Lista paginada de proveedores con búsqueda y filtros
 * POST /api/suppliers — Crear nuevo proveedor
 */

import { NextRequest, NextResponse } from "next/server"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"
import { createSupplierSchema } from "@/lib/validations/supplier"
import { z } from "zod"

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  isActive: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === "true" ? true : v === "false" ? false : undefined)),
  vatCondition: z.string().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const db = await getTenantDb()
    const { tenantId } = await getTenantContext()

    const { searchParams } = req.nextUrl
    const queryResult = listQuerySchema.safeParse(Object.fromEntries(searchParams))

    if (!queryResult.success) {
      return NextResponse.json(
        { error: "Parámetros de consulta inválidos", details: queryResult.error.flatten() },
        { status: 400 }
      )
    }

    const { page, pageSize, search, isActive, vatCondition } = queryResult.data

    const where = {
      tenantId,
      deletedAt: null,
      ...(isActive !== undefined && { isActive }),
      ...(vatCondition && { vatCondition: vatCondition as "RESPONSABLE_INSCRIPTO" | "MONOTRIBUTISTA" | "CONSUMIDOR_FINAL" | "EXENTO" }),
      ...(search && {
        OR: [
          { companyName: { contains: search, mode: "insensitive" as const } },
          { firstName: { contains: search, mode: "insensitive" as const } },
          { lastName: { contains: search, mode: "insensitive" as const } },
          { documentNumber: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
          { phone: { contains: search, mode: "insensitive" as const } },
        ],
      }),
    }

    const [total, suppliers] = await Promise.all([
      db.supplier.count({ where }),
      db.supplier.findMany({
        where,
        include: {
          paymentCondition: { select: { id: true, name: true } },
          addresses: {
            where: { isDefault: true },
            take: 1,
          },
        },
        orderBy: [{ companyName: "asc" }, { lastName: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    return NextResponse.json({
      data: suppliers,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error) {
    console.error("[GET /api/suppliers]", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = await getTenantDb()
    const { tenantId, userId } = await getTenantContext()

    const body: unknown = await req.json()
    const result = createSupplierSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: result.error.flatten() },
        { status: 422 }
      )
    }

    const data = result.data

    const supplier = await db.supplier.create({
      data: {
        tenantId,
        type: data.type,
        firstName: data.firstName ?? null,
        lastName: data.lastName ?? null,
        companyName: data.companyName ?? null,
        documentType: data.documentType,
        documentNumber: data.documentNumber ?? null,
        vatCondition: data.vatCondition,
        paymentConditionId: data.paymentConditionId ?? null,
        creditLimit: data.creditLimit ?? null,
        phone: data.phone ?? null,
        email: data.email ?? null,
        website: data.website ?? null,
        notes: data.notes ?? null,
        isActive: data.isActive,
        createdById: userId ?? null,
        updatedById: userId ?? null,
      },
      include: {
        paymentCondition: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json({ data: supplier }, { status: 201 })
  } catch (error) {
    console.error("[POST /api/suppliers]", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
