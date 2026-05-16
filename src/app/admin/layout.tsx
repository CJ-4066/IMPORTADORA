import Link from "next/link";
import { ShieldCheck, Store, LogOut } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { logoutAction } from "@/app/admin/actions";
import { AdminNav } from "@/components/admin/admin-nav";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireAdmin();

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-main">
          <div className="admin-profile-card">
            <span className="admin-profile-badge">
              <ShieldCheck size={18} />
            </span>
            <div className="admin-profile-body">
              <div className="stack-xs">
                <p className="eyebrow">Sesión activa</p>
                <h2>{session.name}</h2>
              </div>
              <div className="admin-profile-actions">
                <Link className="button button-secondary button-chip" href="/">
                  <Store size={16} />
                  Ver catálogo
                </Link>
                <form action={logoutAction}>
                  <button className="button button-ghost button-chip" type="submit">
                    <LogOut size={16} />
                    Cerrar sesión
                  </button>
                </form>
              </div>
            </div>
          </div>

          <AdminNav />
        </div>
      </aside>

      <section className="admin-content">{children}</section>
    </main>
  );
}
