import Link from "next/link";
import { KeyRound, LayoutDashboard, PackageSearch, ShieldCheck } from "lucide-react";
import { redirectIfAuthenticated } from "@/lib/auth";
import { loginAction } from "@/app/login/actions";
import { SubmitButton } from "@/components/ui/submit-button";

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  await redirectIfAuthenticated();
  const params = searchParams ? await searchParams : undefined;
  const error = typeof params?.error === "string" ? params.error : "";

  return (
    <main className="auth-shell">
      <section className="auth-layout">
        <article className="auth-showcase">
          <div className="stack-md">
            <div className="auth-brand">
              <span className="auth-brand-mark">IC</span>
              <div>
                <p className="eyebrow">Acceso administrativo</p>
                <strong>Importaciones Super</strong>
              </div>
            </div>

            <div className="stack-sm">
              <h1>Controla el catálogo sin volver compleja la operación</h1>
              <p className="muted">
                Administra precios, stock, visibilidad y productos destacados desde una vista hecha
                para trabajar rápido.
              </p>
            </div>
          </div>

          <div className="auth-feature-list">
            <article className="auth-feature-card">
              <PackageSearch size={18} />
              <div>
                <strong>Búsqueda por código o nombre</strong>
                <p>Encuentra SKU rápidamente aunque el catálogo crezca a miles de productos.</p>
              </div>
            </article>

            <article className="auth-feature-card">
              <LayoutDashboard size={18} />
              <div>
                <strong>Precios por unidad y mayor</strong>
                <p>Una sola interfaz para ajustar reglas comerciales sin tocar el frontend público.</p>
              </div>
            </article>

            <article className="auth-feature-card">
              <ShieldCheck size={18} />
              <div>
                <strong>Ingreso seguro para el equipo</strong>
                <p>Sesión protegida y panel separado para que el catálogo siga limpio y rápido.</p>
              </div>
            </article>
          </div>
        </article>

        <section className="auth-panel">
          <div className="stack-sm">
            <p className="eyebrow">Iniciar sesión</p>
            <h2>Entra al panel</h2>
            <p className="muted">
              Usa tu correo y contraseña para gestionar productos, stock y configuración general.
            </p>
          </div>

          <form action={loginAction} className="stack-md">
            <label className="field">
              <span>Correo</span>
              <input name="email" placeholder="admin@empresa.com" required type="email" />
            </label>

            <label className="field">
              <span>Contraseña</span>
              <div className="auth-password-wrap">
                <KeyRound size={18} />
                <input name="password" placeholder="Tu contraseña" required type="password" />
              </div>
            </label>

            {error ? <p className="error-text auth-error">{error}</p> : null}

            <SubmitButton pendingLabel="Ingresando..." className="auth-submit">
              Entrar al panel
            </SubmitButton>
          </form>

          <div className="auth-footer">
            <div className="auth-note">
              <span>Acceso interno</span>
              <strong>Panel exclusivo para administración</strong>
            </div>
            <div className="auth-inline-actions">
              <Link className="button button-ghost" href="/">
                Volver al catálogo
              </Link>
              <Link className="button button-secondary" href="/acceso">
                Acceso comprador
              </Link>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
