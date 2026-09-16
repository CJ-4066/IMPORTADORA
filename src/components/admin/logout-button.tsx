"use client";

import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/admin/actions";

export function LogoutButton() {
  return (
    <form action={logoutAction} style={{ margin: 0 }}>
      <button 
        aria-label="Cerrar sesión"
        type="submit"
        className="icon-button admin-shell-icon-button admin-shell-logout-button"
        title="Cerrar sesión"
      >
        <LogOut size={18} />
      </button>
    </form>
  );
}
