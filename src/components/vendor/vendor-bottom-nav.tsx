import Link from "next/link";

const navItems = [
  { href: "/vendedor/hoy", label: "Hoy" },
  { href: "/vendedor/perfil", label: "Perfil" },
];

export function VendorBottomNav() {
  return (
    <nav className="sticky bottom-0 z-10 border-t border-[var(--border)] bg-white/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center justify-around gap-3 text-sm font-semibold text-[var(--muted-foreground)]">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-full px-4 py-2 transition hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)]"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

