/**
 * route.ts — NextAuth catch-all handler
 *
 * Delega todos los requests de autenticación (GET y POST) a los handlers
 * generados por NextAuth en `lib/auth.ts`.
 *
 * Rutas manejadas automáticamente por NextAuth:
 *   GET  /api/auth/session
 *   GET  /api/auth/csrf
 *   GET  /api/auth/providers
 *   GET  /api/auth/callback/:provider
 *   GET  /api/auth/signout
 *   POST /api/auth/signin/:provider
 *   POST /api/auth/signout
 */

import { handlers } from "@/lib/auth"

export const { GET, POST } = handlers
