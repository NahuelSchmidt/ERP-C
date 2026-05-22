/**
 * proxy.ts  (antes middleware.ts — renombrado para Next.js 16)
 *
 * Proxy global de autenticación y propagación de datos de tenant.
 * Corre en Node.js runtime (no Edge), por lo que puede importar
 * módulos Node.js como crypto.
 *
 * Ejecuta en todas las rutas excepto:
 *   - /login              → Página pública de autenticación
 *   - /api/auth/**        → Endpoints de NextAuth
 *   - /api/debug/**       → Endpoint de diagnóstico público
 *   - /_next/static/**   → Assets estáticos de Next.js
 *   - /_next/image/**    → Optimizador de imágenes
 *   - /favicon.ico       → Favicon
 */

import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  if (!req.auth) {
    const loginUrl = new URL("/login", req.url)
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  const requestHeaders = new Headers(req.headers)
  requestHeaders.set("x-tenant-id", req.auth.user.tenantId ?? "")
  requestHeaders.set("x-tenant-schema", req.auth.user.tenantDbSchema ?? "")
  requestHeaders.set("x-user-id", req.auth.user.id ?? "")
  requestHeaders.set("x-role-id", req.auth.user.roleId ?? "")

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
})

export const config = {
  matcher: [
    "/((?!login|api/auth|api/debug|_next/static|_next/image|favicon\\.ico).*)",
  ],
}
