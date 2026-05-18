/**
 * next-auth.d.ts
 *
 * Augmentación de tipos de NextAuth para el sistema ERP multi-tenant.
 *
 * Extiende Session["user"] y JWT para incluir los campos de tenant
 * propagados durante el proceso de autenticación.
 */

import { DefaultSession, DefaultJWT } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      /** ID del usuario global (schema public) */
      id: string
      /** ID del tenant al que pertenece esta sesión */
      tenantId: string
      /** Slug legible del tenant (ej: "empresa-sa") */
      tenantSlug: string
      /** Nombre del PG schema del tenant (ej: "tenant_abc123") */
      tenantDbSchema: string
      /** ID del rol del usuario dentro del tenant */
      roleId: string
    } & DefaultSession["user"]
  }

  interface User {
    /** ID del tenant al que pertenece esta sesión */
    tenantId: string
    /** Slug legible del tenant (ej: "empresa-sa") */
    tenantSlug: string
    /** Nombre del PG schema del tenant (ej: "tenant_abc123") */
    tenantDbSchema: string
    /** ID del rol del usuario dentro del tenant */
    roleId: string
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    /** ID del tenant al que pertenece este token */
    tenantId: string
    /** Slug legible del tenant (ej: "empresa-sa") */
    tenantSlug: string
    /** Nombre del PG schema del tenant (ej: "tenant_abc123") */
    tenantDbSchema: string
    /** ID del rol del usuario dentro del tenant */
    roleId: string
  }
}
