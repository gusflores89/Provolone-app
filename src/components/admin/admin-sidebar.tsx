import Link from "next/link";

const items = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/clientes", label: "Clientes" },
  { href: "/admin/zonas", label: "Zonas" },
  { href: "/admin/vendedores", label: "Vendedores" },
  { href: "/admin/plan-semanal", label: "Plan semanal" },
  { href: "/admin/visitas", label: "Visitas" },
  { href: "/admin/sync", label: "Sync" },
];

export function AdminSidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-[var(--border)] bg-[var(--surface)] px-5 py-6 lg:block">
      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--primary)]">
          Fiambrieria
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
          Panel admin
        </h1>
      </div>

      <nav className="space-y-2">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="block rounded-2xl px-4 py-3 text-sm font-medium text-[var(--muted-foreground)] transition hover:bg-white hover:text-[var(--foreground)]"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

