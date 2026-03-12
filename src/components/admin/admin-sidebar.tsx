"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/clientes", label: "Clientes" },
  { href: "/admin/zonas", label: "Zonas" },
  { href: "/admin/vendedores", label: "Vendedores" },
  { href: "/admin/plan-semanal", label: "Plan semanal" },
  { href: "/admin/visitas", label: "Visitas" },
  { href: "/admin/sync", label: "Sync" },
];

function getLinkClass(isActive: boolean) {
  return isActive
    ? "bg-white text-[var(--foreground)] shadow-[0_10px_24px_rgba(15,23,42,0.08)]"
    : "text-[var(--muted-foreground)] transition hover:bg-white hover:text-[var(--foreground)]";
}

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <>
      <div className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-4 lg:hidden">
        <div className="mb-3">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--primary)]">Fiambrieria</p>
          <h1 className="mt-1 text-xl font-semibold text-[var(--foreground)]">Panel admin</h1>
        </div>

        <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {items.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium ${getLinkClass(isActive)}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <aside className="hidden w-64 shrink-0 border-r border-[var(--border)] bg-[var(--surface)] px-5 py-6 lg:block">
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--primary)]">Fiambrieria</p>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">Panel admin</h1>
        </div>

        <nav className="space-y-2">
          {items.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-2xl px-4 py-3 text-sm font-medium ${getLinkClass(isActive)}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
