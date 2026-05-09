import Link from "next/link";
import {
  CircleUserRound,
  KeyRound,
  MessageCircleMore,
  SearchCode,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { redirectIfAuthenticated } from "@/lib/auth";
import { shopperLoginAction, shopperRegisterAction } from "@/app/acceso/actions";
import { SubmitButton } from "@/components/ui/submit-button";

type AccessPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AccessPage({ searchParams }: AccessPageProps) {
  await redirectIfAuthenticated();
  const params = searchParams ? await searchParams : undefined;
  const mode = params?.mode === "register" ? "register" : "login";
  const error = typeof params?.error === "string" ? params.error : "";
  const status = typeof params?.status === "string" ? params.status : "";

  return (
    <main className="auth-shell">
      <section className="auth-layout">
        <article className="auth-showcase auth-showcase-shopper">
          <div className="stack-md">
            <div className="auth-brand">
              <span className="auth-brand-mark">US</span>
              <div>
                <p className="eyebrow">Acceso comprador</p>
                <strong>Cuenta usershop</strong>
              </div>
            </div>

            <div className="stack-sm">
              <h1>Compra rápido sin tocar nada interno del negocio</h1>
              <p className="muted">
                Tu cuenta sirve para entrar directo a la tienda, guardar tu identidad de compra y
                generar pedidos sin ver paneles, dashboards ni configuración.
              </p>
            </div>
          </div>

          <div className="auth-feature-list">
            <article className="auth-feature-card">
              <SearchCode size={18} />
              <div>
                <strong>Búsqueda por código o nombre</strong>
                <p>Encuentra productos rápido y filtra por categoría sin perder tiempo.</p>
              </div>
            </article>

            <article className="auth-feature-card">
              <ShoppingBag size={18} />
              <div>
                <strong>Carrito y generación de compra</strong>
                <p>Arma tu pedido y envíalo por WhatsApp desde una vista simple y directa.</p>
              </div>
            </article>

            <article className="auth-feature-card">
              <Sparkles size={18} />
              <div>
                <strong>Ofertas y destacados</strong>
                <p>Accede a productos destacados sin mezclar información interna del catálogo.</p>
              </div>
            </article>
          </div>
        </article>

        <section className="auth-panel">
          <div className="stack-sm">
            <p className="eyebrow">Cuenta usershop</p>
            <h2>{mode === "register" ? "Crea tu cuenta" : "Inicia sesión"}</h2>
            <p className="muted">
              {mode === "register"
                ? "Regístrate como comprador para entrar a la tienda y generar pedidos."
                : "Entra con tu cuenta de comprador para seguir armando tu pedido."}
            </p>
          </div>

          <div className="auth-tab-row">
            <Link
              className={`auth-tab ${mode === "login" ? "is-active" : ""}`}
              href="/acceso?mode=login"
            >
              Iniciar sesión
            </Link>
            <Link
              className={`auth-tab ${mode === "register" ? "is-active" : ""}`}
              href="/acceso?mode=register"
            >
              Crear cuenta
            </Link>
          </div>

          {mode === "register" ? (
            <form action={shopperRegisterAction} className="stack-md">
              <label className="field">
                <span>Nombre</span>
                <input name="name" placeholder="Tu nombre o razón comercial" required />
              </label>

              <label className="field">
                <span>Correo</span>
                <input name="email" placeholder="cliente@correo.com" required type="email" />
              </label>

              <label className="field">
                <span>Teléfono</span>
                <div className="auth-password-wrap">
                  <MessageCircleMore size={18} />
                  <input name="phone" placeholder="999 999 999" required type="tel" />
                </div>
              </label>

              <label className="field">
                <span>Contraseña</span>
                <div className="auth-password-wrap">
                  <KeyRound size={18} />
                  <input name="password" placeholder="Mínimo 6 caracteres" required type="password" />
                </div>
              </label>

              <label className="field">
                <span>Confirmar contraseña</span>
                <div className="auth-password-wrap">
                  <CircleUserRound size={18} />
                  <input
                    name="confirmPassword"
                    placeholder="Repite tu contraseña"
                    required
                    type="password"
                  />
                </div>
              </label>

              {error ? <p className="error-text auth-error">{error}</p> : null}
              {status ? <p className="success-text auth-success">{status}</p> : null}

              <SubmitButton pendingLabel="Creando cuenta..." className="auth-submit">
                Crear cuenta usershop
              </SubmitButton>
            </form>
          ) : (
            <form action={shopperLoginAction} className="stack-md">
              <label className="field">
                <span>Correo</span>
                <input name="email" placeholder="cliente@correo.com" required type="email" />
              </label>

              <label className="field">
                <span>Contraseña</span>
                <div className="auth-password-wrap">
                  <KeyRound size={18} />
                  <input name="password" placeholder="Tu contraseña" required type="password" />
                </div>
              </label>

              {error ? <p className="error-text auth-error">{error}</p> : null}
              {status ? <p className="success-text auth-success">{status}</p> : null}

              <SubmitButton pendingLabel="Ingresando..." className="auth-submit">
                Entrar como comprador
              </SubmitButton>
            </form>
          )}

          <div className="auth-footer">
            <div className="auth-note">
              <span>Acceso para clientes</span>
              <strong>La administración sigue separada y protegida.</strong>
            </div>

            <div className="auth-inline-actions">
              <Link className="button button-ghost" href="/">
                Volver a la tienda
              </Link>
              <Link className="button button-secondary" href="/login">
                Ingreso admin
              </Link>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
