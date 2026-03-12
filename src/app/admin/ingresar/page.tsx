import Link from "next/link";

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <section className="w-full max-w-lg rounded-[32px] border border-[var(--border)] bg-white px-6 py-8 shadow-[0_26px_70px_rgba(15,23,42,0.10)] sm:px-8">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--primary)]">
          Acceso admin
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Panel operativo</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
          Ingreso separado para administracion. Luego conectamos auth real con Supabase.
        </p>

        <form className="mt-8 space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Email</span>
            <input
              type="email"
              placeholder="admin@fiambrieria.com"
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-4 outline-none transition focus:border-[var(--primary)]"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Clave</span>
            <input
              type="password"
              placeholder="••••••••"
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-4 outline-none transition focus:border-[var(--primary)]"
            />
          </label>

          <Link
            href="/admin"
            className="block rounded-2xl bg-[var(--primary)] px-5 py-4 text-center text-base font-semibold text-white transition hover:bg-[var(--primary-strong)]"
          >
            Entrar al panel
          </Link>
        </form>
      </section>
    </main>
  );
}

