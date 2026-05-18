/**
 * app/api/products/route.ts
 *
 * GET  /api/products  — Listado paginado con filtros
 * POST /api/products  — Crear producto
 */

import { NextRequest, NextResponse } from "next/server"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"
import { createProductSchema } from "@/lib/validations/product"

// ---------------------------------------------------------------------------
// GET /api/products
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  try {
    const db = await getTenantDb()
    const { tenantId } = await getTenantContext()

    const { searchParams } = req.nextUrl
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)))
    const skip = (page - 1) * limit

    const search = searchParams.get("search") ?? ""
    const categoryId = searchParams.get("categoryId")
    const status = searchParams.get("status")
    const lowStock = searchParams.get("lowStock") === "true"

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {
      tenantId,
      deletedAt: null,
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { internalCode: { contains: search, mode: "insensitive" } },
        { barcode: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
      ]
    }

    if (categoryId) where.categoryId = categoryId
    if (status) where.status = status

    const [total, products] = await Promise.all([
      db.product.count({ where }),
      db.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: "asc" },
        include: {
          category: { select: { id: true, name: true } },
          unit: { select: { id: true, name: true, abbreviation: true } },
          stocks: {
            select: {
              quantity: true,
              reservedQuantity: true,
              warehouse: { select: { id: true, name: true } },
            },
          },
          images: {
            where: { isPrimary: true },
            select: { url: true },
            take: 1,
          },
        },
      }),
    ])

    // Enrich with total stock and low stock flag
    const enriched = products.map((p) => {
      const totalStock = p.stocks.reduce(
        (acc: number, s: { quantity: { toNumber: () => number } }) =>
          acc + s.quantity.toNumber(),
        0
      )
      const isLowStock =
        p.trackStock &&
        p.minStock != null &&
        totalStock < p.minStock.toNumber()

      return { ...p, totalStock, isLowStock }
    })

    // Filter low stock after enrichment if requested
    const data = lowStock ? enriched.filter((p) => p.isLowStock) : enriched

    return NextResponse.json({
      data,
      meta: {
        total: lowStock ? data.length : total,
        page,
        limit,
        totalPages: Math.ceil((lowStock ? data.length : total) / limit),
      },
    })
  } catch (error) {
    console.error("[GET /api/products]", error)
    return NextResponse.json(
      { error: "Error al obtener los productos" },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// POST /api/products
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const db = await getTenantDb()
    const { tenantId, userId } = await getTenantContext()

    const body: unknown = await req.json()
    const parsed = createProductSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const {
      categoryId,
      unitId,
      internalCode,
      barcode,
      sku,
      name,
      description,
      trackStock,
      trackBatches,
      trackSerials,
      allowNegative,
      minStock,
      maxStock,
      reorderPoint,
      costPrice,
      defaultMargin,
      weight,
      weightUnit,
      status,
      notes,
    } = parsed.data

    const product = await db.product.create({
      data: {
        tenantId,
        categoryId: categoryId ?? null,
        unitId: unitId ?? null,
        internalCode: internalCode ?? null,
        barcode: barcode ?? null,
        sku: sku ?? null,
        name,
        description: description ?? null,
        trackStock,
        trackBatches,
        trackSerials,
        allowNegative,
        minStock: minStock ?? null,
        maxStock: maxStock ?? null,
        reorderPoint: reorderPoint ?? null,
        costPrice,
        averageCost: costPrice,
        lastCost: costPrice,
        defaultMargin,
        weight: weight ?? null,
        weightUnit: weightUnit ?? "kg",
        status,
        notes: notes ?? null,
        createdById: userId,
        updatedById: userId,
      },
      include: {
        category: { select: { id: true, name: true } },
        unit: { select: { id: true, name: true, abbreviation: true } },
      },
    })

    return NextResponse.json({ data: product }, { status: 201 })
  } catch (error: unknown) {
    console.error("[POST /api/products]", error)

    if (
      error instanceof Error &&
      error.message.includes("Unique constraint")
    ) {
      return NextResponse.json(
        { error: "Ya existe un producto con ese código o código de barras" },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: "Error al crear el producto" },
      { status: 500 }
    )
  }
}
