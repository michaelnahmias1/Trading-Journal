import Link from "next/link";
import { redirect } from "next/navigation";
import { RegisterSW } from "@/components/RegisterSW";
import { createClient } from "@/lib/supabase/server";
import { NavLink } from "./nav-link";

const NAV = [
  { href: "/dashboard", label: "לוח בקרה", icon: "M3 13h2l2 5 4-12 3 8 2-4h3" },
  { href: "/trades", label: "עסקאות", icon: "M4 6h16M4 12h16M4 18h10" },
  { href: "/setups", label: "סטאפים", icon: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" },
  { href: "/settings", label: "הגדרות", icon: "M12 9a3 3 0 100 6 3 3 0 000-6zM3 12h2m14 0h2M12 3v2m0 14v2" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen flex flex-col">
      <RegisterSW />
      <header className="border-b border-border bg-surface sticky top-0 z-20" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="font-semibold">
              יומן&nbsp;מסחר
            </Link>
            <nav className="hidden md:flex items-center gap-1 text-sm">
              {NAV.map((n) => (
                <NavLink key={n.href} href={n.href}>
                  {n.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted hidden sm:inline">{user.email}</span>
            <form action="/auth/signout" method="post">
              <button className="text-muted hover:text-text">התנתקות</button>
            </form>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 pb-24 md:pb-6">{children}</main>

      {/* App-style bottom tab bar on mobile. */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-surface/95 backdrop-blur border-t border-border"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid grid-cols-4">
          {NAV.map((n) => (
            <NavLink key={n.href} href={n.href} variant="tab" icon={n.icon}>
              {n.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
