import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, Edit2, Trash2, FileText } from "lucide-react";
import { createTemplateAction, deleteTemplateAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function PlantillasPage() {
  const templates = await prisma.messageTemplate.findMany({
    orderBy: { name: 'asc' },
  });

  return (
    <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ margin: "0 0 8px 0", fontSize: "24px" }}>Plantillas de Respuesta</h1>
          <p style={{ margin: 0, color: "var(--text-muted)" }}>Respuestas rápidas para enviar por el centro de mensajes.</p>
        </div>
        <form action={createTemplateAction}>
          <button type="submit" style={{ background: "var(--primary)", color: "#fff", border: "none", padding: "10px 16px", borderRadius: "6px", display: "flex", alignItems: "center", gap: "8px", fontWeight: 500, cursor: "pointer" }}>
            <Plus size={16} /> Crear Plantilla de Prueba
          </button>
        </form>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "24px" }}>
        {templates.map((tpl) => (
          <div key={tpl.id} style={{ background: "var(--surface-bg)", border: "1px solid var(--border-color)", borderRadius: "8px", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "16px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", color: "var(--text)" }}>{tpl.name}</h3>
                {tpl.category && (
                  <span style={{ display: "inline-block", marginTop: "8px", padding: "2px 8px", background: "var(--bg-alt)", border: "1px solid var(--border-color)", color: "var(--text-muted)", fontSize: "11px", borderRadius: "999px", textTransform: "uppercase", fontWeight: 600 }}>
                    {tpl.category}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <form action={deleteTemplateAction}>
                  <input type="hidden" name="id" value={tpl.id} />
                  <button type="submit" style={{ background: "transparent", border: "none", cursor: "pointer", color: "#ef4444", padding: "4px" }}>
                    <Trash2 size={16} />
                  </button>
                </form>
              </div>
            </div>
            <div style={{ padding: "16px", flex: 1 }}>
              <p style={{ margin: 0, fontSize: "14px", color: "var(--text)", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                {tpl.content}
              </p>
            </div>
            <div style={{ padding: "12px 16px", background: "var(--bg-alt)", borderTop: "1px solid var(--border-color)", borderRadius: "0 0 8px 8px", display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-muted)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: tpl.isActive ? "#22c55e" : "#94a3b8" }} />
                {tpl.isActive ? "Activa" : "Inactiva"}
              </span>
              <span>Actualizada: {format(tpl.updatedAt, "dd MMM", { locale: es })}</span>
            </div>
          </div>
        ))}
        
        {templates.length === 0 && (
          <div style={{ gridColumn: "1 / -1", border: "2px dashed var(--border-color)", borderRadius: "8px", padding: "64px 24px", textAlign: "center" }}>
            <div style={{ color: "var(--text-muted)", marginBottom: "16px" }}><FileText size={48} style={{ opacity: 0.3, margin: "0 auto" }}/></div>
            <p style={{ margin: "0 0 8px 0", color: "var(--text)", fontSize: "16px", fontWeight: 500 }}>No tienes plantillas creadas.</p>
            <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "14px" }}>Haz clic en "Crear Plantilla de Prueba" para comenzar.</p>
          </div>
        )}
      </div>
    </div>
  );
}
