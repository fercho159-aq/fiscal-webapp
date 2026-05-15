import { auth, signOut } from "@/lib/auth";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Scale, FolderOpen, MessageSquare, LogOut, Search } from "lucide-react";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r bg-card flex flex-col">
        <div className="p-4 border-b flex items-center gap-2">
          <Scale className="h-5 w-5 text-primary" />
          <span className="font-semibold">Fiscal</span>
        </div>

        <nav className="flex-1 p-2 space-y-1">
          <NavLink href="/dashboard" icon={<FolderOpen className="h-4 w-4" />}>
            Casos
          </NavLink>
          <NavLink href="/dashboard/chat" icon={<MessageSquare className="h-4 w-4" />}>
            Chat libre
          </NavLink>
          <NavLink href="/dashboard/corpus" icon={<Search className="h-4 w-4" />}>
            Corpus legal
          </NavLink>
        </nav>

        <div className="p-2 border-t">
          <div className="px-3 py-2 text-xs text-muted-foreground truncate">
            {session?.user?.email}
          </div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <Button variant="ghost" size="sm" className="w-full justify-start" type="submit">
              <LogOut className="h-4 w-4" />
              Salir
            </Button>
          </form>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}

function NavLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors"
    >
      {icon}
      {children}
    </Link>
  );
}
