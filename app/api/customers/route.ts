/**
 * app/api/customers/route.ts
 *
 * GET  /api/customers — Lista paginada de clientes con búsqueda y filtros
 * POST /api/customers — Crear nuevo cliente
 */

import { NextRequest, NextResponse } from "next/server"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"
import { createCustomerSchema } from "@/lib/validations/customer"
import { z } from "zod"

// Query params schema
const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  isActive: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === "true" ? true : v === "false" ? false : undefined)),
  categoryId: z.string().optional(),
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

    const { page, pageSize, search, isActive, categoryId, vatCondition } = queryResult.data

    // Build where clause
    const where = {
      tenantId,
      deletedAt: null,
      ...(isActive !== undefined && { isActive }),
      ...(categoryId && { categoryId }),
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

    const [total, customers] = await Promise.all([
      db.customer.count({ where }),
      db.customer.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, color: true } },
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
      data: customers,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error) {
    console.error("[GET /api/customers]", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = await getTenantDb()
    const { tenantId, userId } = await getTenantContext()

    const body: unknown = await req.json()
    const result = createCustomerSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: result.error.flatten() },
        { status: 422 }
      )
    }

    const data = result.data

    const customer = await db.customer.create({
      data: {
        tenantId,
        type: data.type,
        firstName: data.firstName ?? null,
        lastName: data.lastName ?? null,
        companyName: data.companyName ?? null,
        documentType: data.documentType,
        documentNumber: data.documentNumber ?? null,
        vatCondition: data.vatCondition,
        grossIncomeNumber: data.grossIncomeNumber ?? null,
        creditLimit: data.creditLimit ?? null,
        categoryId: data.categoryId ?? null,
        priceListId: data.priceListId ?? null,
        phone: data.phone ?? null,
        email: data.email ?? null,
        website: data.website ?? null,
        notes: data.notes ?? null,
        isActive: data.isActive,
        createdById: userId ?? null,
        updatedById: userId ?? null,
      },
      include: {
        category: { select: { id: true, name: true, color: true } },
      },
    })

    return NextResponse.json({ data: customer }, { status: 201 })
  } catch (error) {
    console.error("[POST /api/customers]", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
