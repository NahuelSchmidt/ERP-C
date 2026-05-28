import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { SidebarNav, ConfigNavLink } from "@/components/sidebar-nav"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  const userName = session.user.name ?? session.user.email ?? "Usuario"
  const userInitials = userName
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <div className="min-h-screen flex bg-[#fafafa]">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-[#0a0a0a] flex flex-col">
        {/* Logo */}
        <div className="h-16 flex items-center px-5 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-[#0a0a0a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white tracking-tight truncate">ERP PYMES</p>
              <p className="text-xs text-white/40 truncate">{session.user.tenantSlug}</p>
            </div>
          </div>
        </div>

        {/* Navegación */}
        <SidebarNav />

        {/* Bottom section */}
        <div className="border-t border-white/[0.08] py-4 px-3">
          <div className="mb-1">
            <ConfigNavLink />
          </div>

          {/* Usuario */}
          <div className="flex items-center gap-3 px-3 py-2 mt-1">
            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-white">{userInitials}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white/80 truncate">{userName}</p>
              <p className="text-xs text-white/35 truncate">{session.user.email}</p>
            </div>
            <form action="/api/auth/signout" method="POST">
              <button
                type="submit"
                title="Cerrar sesión"
                className="text-white/25 hover:text-white/60 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Área principal */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-border flex items-center px-6 gap-4 flex-shrink-0">
          <div className="flex-1" />
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary text-xs font-medium text-muted-foreground">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {session.user.tenantSlug}
          </div>
        </header>

        {/* Contenido */}
        <main className="flex-1 overflow-y-auto p-6 bg-[#fafafa]">
          {children}
        </main>
      </div>
    </div>
  )
}
