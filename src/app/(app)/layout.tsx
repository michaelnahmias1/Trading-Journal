import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NavLink } from "./nav-link";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border bg-surface">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="font-semibold">
              Trading&nbsp;Journal
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <NavLink href="/dashboard">Dashboard</NavLink>
              <NavLink href="/trades">Trades</NavLink>
              <NavLink href="/setups">Setups</NavLink>
              <NavLink href="/settings">Settings</NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted hidden sm:inline">{user.email}</span>
            <form action="/auth/signout" method="post">
              <button className="text-muted hover:text-text">Sign out</button>
            </form>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
