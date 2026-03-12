import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen px-6 py-10 text-[var(--foreground)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 lg:gap-16">
        <section className="grid gap-8 rounded-[32px] border border-[var(--border)] bg-white/85 p-8 shadow-[0_24px_80px_rgba(31,41,55,0.08)] lg:grid-cols-[1.3fr_0.9fr] lg:p-12">
          <div className="space-y-6">
            <p className="text-sm font-bold uppercase tracking-[0.26em] text-[var(--primary)]">
              MVP Fiambrieria
            </p>
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
              Gestion de visitas semanales para vendedores, con panel admin y base lista para Supabase.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-[var(--muted-foreground)]">
              Esta base inicial separa claramente la experiencia del vendedor de la operacion admin.
              Primero validamos flujo y pantallas, despues conectamos autenticacion y datos reales.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row">
              <Link
                href="/vendedor/ingresar"
                className="rounded-full bg-[var(--primary)] px-6 py-4 text-center text-sm font-semibold text-white transition hover:bg-[var(--primary-strong)]"
              >
                Probar flujo vendedor
              </Link>
              <Link
                href="/admin/ingresar"
                className="rounded-full border border-[var(--border)] bg-[var(--surface-alt)] px-6 py-4 text-center text-sm font-semibold transition hover:bg-white"
              >
                Ver panel admin
              </Link>
            </div>
          </div>

          <div className="rounded-[28px] bg-[var(--surface)] p-6">
            <h2 className="text-lg font-semibold">Lo que ya queda armado en esta base</h2>
            <ul className="mt-5 space-y-3 text-sm leading-7 text-[var(--muted-foreground)]">
              <li>Login separado para vendedor y admin</li>
              <li>Ruta diaria del vendedor con detalle de cliente</li>
              <li>Cierre de visita con estados del MVP</li>
              <li>Dashboard admin con clientes, zonas, vendedores, plan y sync</li>
              <li>Estructura lista para conectar Supabase y despues desplegar en Vercel</li>
            </ul>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          {[
            {
              title: "Vendedor",
              description: "Flujo muy simple: hoy, cliente, cerrar visita, perfil.",
            },
            {
              title: "Admin",
              description: "Vista operativa: clientes, zonas, vendedores, visitas y sync.",
            },
            {
              title: "Siguiente paso",
              description: "Conectar Supabase, auth real y permisos por rol.",
            },
          ].map((item) => (
            <article
              key={item.title}
              className="rounded-[28px] border border-[var(--border)] bg-white/85 p-6 shadow-[0_14px_40px_rgba(31,41,55,0.06)]"
            >
              <h3 className="text-xl font-semibold">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">{item.description}</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

