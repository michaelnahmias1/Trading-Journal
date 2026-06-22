"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({
  href,
  children,
  variant = "top",
  icon,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "top" | "tab";
  icon?: string;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");

  if (variant === "tab") {
    return (
      <Link
        href={href}
        prefetch
        className={`flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] transition-colors ${
          active ? "text-accent" : "text-muted"
        }`}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d={icon} />
        </svg>
        {children}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      prefetch
      className={`px-3 py-1.5 rounded-md transition-colors ${
        active ? "bg-surface-2 text-text" : "text-muted hover:text-text"
      }`}
    >
      {children}
    </Link>
  );
}
