"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "@/components/ui/Brand";
import { cn } from "@/components/ui/cn";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/projects", label: "Illustrations" },
  { href: "/library", label: "Anatomy library" },
  { href: "/setup", label: "Setup" },
];

export function AppHeader() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Brand />
        <nav aria-label="Main" className="scroll-thin -mx-2 flex flex-1 items-center gap-1 overflow-x-auto px-2">
          {NAV.map((n) => {
            const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition-colors",
                  active ? "bg-panel-2 text-fg" : "text-muted hover:text-fg",
                )}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <Link
          href="/editor?new=1&gender=male"
          className="hidden h-9 items-center rounded-lg bg-accent px-3.5 text-sm font-medium text-white hover:bg-[#f06d3a] sm:inline-flex"
        >
          Open studio
        </Link>
      </div>
    </header>
  );
}
