/**
 * auth.ts
 *
 * Configuración de NextAuth v5 (next-auth@beta) para el ERP multi-tenant.
 *
 * Flujo de autenticación:
 *   1. El usuario envía email + password + tenantSlug desde /login
 *   2. `authorize` busca el User global en el schema "public" por email
 *   3. Valida la contraseña con bcryptjs
 *   4. Busca el TenantUser activo para el tenant indicado (o el primero activo)
 *   5. Carga el Tenant para obtener dbSchema y slug
 *   6. Retorna el objeto de usuario enriquecido con datos de tenant
 *
 * El JWT callback propaga tenantId, tenantSlug, tenantDbSchema y roleId al token.
 * El session callback los expone en session.user para el cliente y el middleware.
 */

import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { compare } from "bcryptjs"
import prisma from "@/lib/prisma"
import { z } from "zod"

// ---------------------------------------------------------------------------
// Schema de validación de credenciales (Zod v4)
// ---------------------------------------------------------------------------
const credentialsSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Contraseña requerida"),
  tenantSlug: z.string().optional(),
})

// ---------------------------------------------------------------------------
// Configuración principal de NextAuth
// ---------------------------------------------------------------------------
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "usuario@empresa.com" },
        password: { label: "Contraseña", type: "password" },
        tenantSlug: { label: "Empresa (slug)", type: "text" },
      },

      async authorize(credentials) {
        // 1. Validar el shape de las credenciales
        const parsed = credentialsSchema.safeParse(credentials)
        if (!parsed.success) return null

        const { email, password, tenantSlug } = parsed.data

        // 2. Buscar el usuario global en el schema "public"
        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase().trim() },
        })

        if (!user || !user.isActive || user.deletedAt) return null

        // 3. Verificar contraseña
        const isValid = await compare(password, user.passwordHash)
        if (!isValid) return null

        // 4. Buscar la membresía del usuario en el tenant indicado
        //    Si no se indica tenantSlug, tomamos el primer tenant activo del usuario
        let tenantUser
        if (tenantSlug) {
          const tenant = await prisma.tenant.findUnique({
            where: { slug: tenantSlug },
          })
          if (!tenant || tenant.deletedAt) return null

          tenantUser = await prisma.tenantUser.findUnique({
            where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
            include: { tenant: true },
          })
        } else {
          tenantUser = await prisma.tenantUser.findFirst({
            where: { userId: user.id, isActive: true },
            include: { tenant: true },
            orderBy: { createdAt: "asc" },
          })
        }

        if (!tenantUser || !tenantUser.isActive) return null
        if (!tenantUser.tenant || tenantUser.tenant.deletedAt) return null
        if (
          tenantUser.tenant.status === "SUSPENDED" ||
          tenantUser.tenant.status === "CANCELLED"
        ) {
          return null
        }

        // 5. Actualizar lastLoginAt de forma no bloqueante
        prisma.user
          .update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          })
          .catch(() => {/* ignorar error de actualización de audit */})

        // 6. Retornar objeto de usuario enriquecido
        return {
          id: user.id,
          email: user.email,
          name:
            [user.firstName, user.lastName].filter(Boolean).join(" ") ||
            user.email,
          image: user.avatarUrl ?? null,
          // Datos de tenant — propagados al JWT en el callback jwt
          tenantId: tenantUser.tenantId,
          tenantSlug: tenantUser.tenant.slug,
          tenantDbSchema: tenantUser.tenant.dbSchema,
          roleId: tenantUser.roleId,
        }
      },
    }),
  ],

  // --------------------------------------------------------------------------
  // Callbacks
  // --------------------------------------------------------------------------
  callbacks: {
    /**
     * jwt: Se ejecuta al crear/renovar el JWT.
     * Copiamos los datos de tenant del user (disponible sólo en el primer login)
     * al token para que persistan entre requests.
     */
    async jwt({ token, user }) {
      if (user) {
        // `user` solo está disponible en el primer sign-in
        const u = user as typeof user & {
          tenantId: string
          tenantSlug: string
          tenantDbSchema: string
          roleId: string
        }
        token.tenantId = u.tenantId
        token.tenantSlug = u.tenantSlug
        token.tenantDbSchema = u.tenantDbSchema
        token.roleId = u.roleId
      }
      return token
    },

    /**
     * session: Expone los datos del JWT en la sesión accesible desde el cliente
     * y desde `auth()` en Server Components / Route Handlers.
     */
    async session({ session, token }) {
      if (token) {
        session.user.tenantId = token.tenantId as string
        session.user.tenantSlug = token.tenantSlug as string
        session.user.tenantDbSchema = token.tenantDbSchema as string
        session.user.roleId = token.roleId as string
        // Asegurar que el ID del usuario esté disponible en la sesión
        session.user.id = token.sub as string
      }
      return session
    },
  },

  // --------------------------------------------------------------------------
  // Páginas personalizadas
  // --------------------------------------------------------------------------
  pages: {
    signIn: "/login",
    error: "/login", // Los errores de auth redirigen al login con ?error=...
  },

  // --------------------------------------------------------------------------
  // Sesión basada en JWT (sin DB de sesiones)
  // --------------------------------------------------------------------------
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 horas — típico de jornada laboral
  },

  // Deshabilitar debug en producción
  debug: process.env.NODE_ENV === "development",
})
