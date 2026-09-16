"use client";

import { Trash2 } from "lucide-react";

type AdminUserDeleteFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  userId: string;
  userName: string;
  compact?: boolean;
};

export function AdminUserDeleteForm({
  action,
  userId,
  userName,
  compact = false,
}: AdminUserDeleteFormProps) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(`¿Eliminar la cuenta de ${userName}? Esta acción no se puede deshacer.`)) {
          event.preventDefault();
        }
      }}
    >
      <input name="userId" type="hidden" value={userId} />
      <button
        aria-label={`Eliminar cuenta de ${userName}`}
        className={compact ? "icon-button danger" : "button button-danger-soft"}
        type="submit"
      >
        <Trash2 size={16} />
        {compact ? null : "Eliminar cuenta"}
      </button>
    </form>
  );
}
