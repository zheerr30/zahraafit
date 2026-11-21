"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "@/components/ui/Brand";
import { cn } from "@/components/ui/cn";

const NAV = [
  { href: "/", label: "الرئيسية" },
  { href: "/atlas", label: "الأطلس التشريحي" },
  { href: "/exercises", label: "مكتبة التمارين" },
  { href: "/projects", label: "الرسوم المحفوظة" },
  { href: "/library", label: "مكتبة العضلات" },
  { href: "/setup", label: "الإعدادات" },
  { href: "/credits", label: "المصادر والترخيص" },
];

export function AppHeader() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Brand />
        <nav aria-label="التنقل الرئيسي" className="scroll-thin -mx-2 flex flex-1 items-center gap-1 overflow-x-auto px-2">
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
          className="hidden h-9 items-center whitespace-nowrap rounded-lg bg-accent px-3.5 text-sm font-medium text-white hover:bg-[#f06d3a] sm:inline-flex"
        >
          فتح الاستوديو
        </Link>
      </div>
    </header>
  );
}

/** Site-wide footer carrying the CC BY-SA 4.0 credit for the anatomical models. */
export function AppFooter() {
  return (
    <footer className="border-t border-line px-4 py-6 text-center text-xs leading-relaxed text-muted">
      <p>
        النموذج التشريحي: Z-Anatomy (مبني على BodyParts3D © DBCLS)، ونسب الهيكل الأنثوي من open-anatomy-3d. الرخصة{" "}
        <a href="https://creativecommons.org/licenses/by-sa/4.0/" className="text-accent-2 hover:underline" target="_blank" rel="noreferrer">
          CC BY-SA 4.0
        </a>
        .{" "}
        <Link href="/credits" className="text-accent-2 hover:underline">
          المصادر الكاملة
        </Link>
      </p>
      <p className="mt-1">للتعليم والتوضيح فقط، وليست صالحة للتشخيص أو القرارات الطبية.</p>
    </footer>
  );
}
