/**
 * app/api/product-categories/route.ts
 *
 * GET  /api/product-categories — Árbol jerárquico de categorías
 * POST /api/product-categories — Crear categoría
 */

import { NextRequest, NextResponse } from "next/server"
import { getTenantDb, getTenantContext } from "@/lib/get-tenant-db"
import { createProductCategorySchema } from "@/lib/validations/product"

// ---------------------------------------------------------------------------
// Helper: build tree from flat list
// ---------------------------------------------------------------------------
interface CategoryNode {
  id: string
  tenantId: string
  parentId: string | null
  name: string
  slug: string | null
  description: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
  children: CategoryNode[]
  _count?: { products: number }
}

function buildTree(
  items: CategoryNode[],
  parentId: string | null = null
): CategoryNode[] {
  return items
    .filter((item) => item.parentId === parentId)
    .map((item) => ({
      ...item,
      children: buildTree(items, item.id),
    }))
}

// ---------------------------------------------------------------------------
// GET /api/product-categories
// ---------------------------------------------------------------------------
export async function GET(_req: NextRequest) {
  try {
    const db = await getTenantDb()
    const { tenantId } = await getTenantContext()

    const categories = await db.productCategory.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { name: "asc" },
      include: {
        _count: { select: { products: true } },
      },
    })

    const tree = buildTree(categories as CategoryNode[])

    return NextResponse.json({ data: tree })
  } catch (error) {
    console.error("[GET /api/product-categories]", error)
    return NextResponse.json(
      { error: "Error al obtener las categorías" },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// POST /api/product-categories
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const db = await getTenantDb()
    const { tenantId } = await getTenantContext()

    const body: unknown = await req.json()
    const parsed = createProductCategorySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { parentId, name, slug, description, isActive } = parsed.data

    // Auto-generate slug if not provided
    const finalSlug =
      slug ??
      name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")

    const category = await db.productCategory.create({
      data: {
        tenantId,
        parentId: parentId ?? null,
        name,
        slug: finalSlug,
        description: description ?? null,
        isActive,
      },
    })

    return NextResponse.json({ data: category }, { status: 201 })
  } catch (error: unknown) {
    console.error("[POST /api/product-categories]", error)

    if (
      error instanceof Error &&
      error.message.includes("Unique constraint")
    ) {
      return NextResponse.json(
        { error: "Ya existe una categoría con ese nombre en el mismo nivel" },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: "Error al crear la categoría" },
      { status: 500 }
    )
  }
}
