import { auth, signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { SidebarNav } from "@/components/sidebar-nav";
import { Separator } from "@/components/ui/separator";
import { Scale, FolderOpen, MessageSquare, LogOut, Search } from "lucide-react";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const navItems = [
    { href: "/dashboard", label: "Casos", icon: <FolderOpen className="h-4 w-4" />, exact: true },
    { href: "/dashboard/chat", label: "Chat libre", icon: <MessageSquare className="h-4 w-4" /> },
    { href: "/dashboard/corpus", label: "Corpus legal", icon: <Search className="h-4 w-4" /> },
  ];

  const email = session?.user?.email ?? "—";
  const initial = email.charAt(0).toUpperCase();

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="flex w-64 flex-col border-r bg-card/50">
        {/* Branding */}
        <div className="border-b px-5 py-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-soft">
              <Scale className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight">Fiscal</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Análisis SAT/TFJA
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
          <div className="text-eyebrow px-3 py-2">Navegación</div>
          <SidebarNav items={navItems} />
        </div>

        <Separator />

        {/* User */}
        <div className="p-3">
          <div className="flex items-center gap-3 rounded-md px-2 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-foreground">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium" title={email}>
                {email}
              </div>
              <div className="text-[10px] text-muted-foreground">Administrador</div>
            </div>
          </div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
            className="mt-1"
          >
            <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground hover:text-foreground" type="submit">
              <LogOut className="h-3.5 w-3.5" />
              Cerrar sesión
            </Button>
          </form>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
