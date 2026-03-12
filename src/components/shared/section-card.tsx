import type { ReactNode } from "react";

export function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-[var(--border)] bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
      <header className="mb-4">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">{title}</h2>
        {subtitle ? (
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">{subtitle}</p>
        ) : null}
      </header>
      {children}
    </section>
  );
}

