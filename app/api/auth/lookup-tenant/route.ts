import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET(req: NextRequest) {
  try {
    const email = req.nextUrl.searchParams.get("email")?.toLowerCase().trim()

    if (!email) {
      return NextResponse.json({ tenants: [] })
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, isActive: true, deletedAt: true },
    })

    if (!user || !user.isActive || user.deletedAt) {
      return NextResponse.json({ tenants: [] })
    }

    const tenantUsers = await prisma.tenantUser.findMany({
      where: {
        userId: user.id,
        isActive: true,
        tenant: {
          deletedAt: null,
          status: { notIn: ["SUSPENDED", "CANCELLED"] },
        },
      },
      include: {
        tenant: { select: { slug: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    })

    const tenants = tenantUsers.map((tu) => ({
      slug: tu.tenant.slug,
      name: tu.tenant.name,
    }))

    return NextResponse.json({ tenants })
  } catch {
    return NextResponse.json({ tenants: [] })
  }
}
