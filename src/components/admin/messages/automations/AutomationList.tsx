"use client";

import { useEffect, useState } from "react";
import { Plus, Play, Pause, AlertTriangle, Clock, Zap } from "lucide-react";
import { useRouter } from "next/navigation";

type AutomationPreview = {
  id: string;
  name: string;
  status: string;
  channel: string;
  updatedAt: string;
  _count: { executions: number };
};

export function AutomationList() {
  const router = useRouter();
  const [automations, setAutomations] = useState<AutomationPreview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/automations")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setAutomations(data);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleCreateNew = async () => {
    try {
      const res = await fetch("/api/admin/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Nueva automatización", channel: "WHATSAPP" }),
      });
      const data = await res.json();
      if (data.id) {
        // Redirigir al Flow Builder
        router.push(`/admin/mensajes/automatizaciones/${data.id}`);
      }
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="automation-list-shell" style={{ padding: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 className="h4" style={{ margin: 0 }}>Automatizaciones</h1>
          <p className="text-muted" style={{ margin: 0, fontSize: "14px" }}>
            Administra los flujos y bots conversacionales
          </p>
        </div>
        <button onClick={handleCreateNew} className="button is-primary">
          <Plus size={16} />
          <span>Nueva automatización</span>
        </button>
      </div>

      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>Cargando automatizaciones...</div>
      ) : automations.length === 0 ? (
        <div style={{ padding: "60px", textAlign: "center", border: "1px dashed #e5e7eb", borderRadius: "8px" }}>
          <Zap size={48} style={{ color: "#9ca3af", marginBottom: "16px" }} />
          <h3 style={{ fontSize: "16px", marginBottom: "8px" }}>Sin automatizaciones</h3>
          <p className="text-muted" style={{ marginBottom: "16px" }}>Comienza creando tu primer flujo conversacional.</p>
          <button onClick={handleCreateNew} className="button is-primary">Empezar ahora</button>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table" style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ padding: "12px 16px" }}>Nombre</th>
                <th style={{ padding: "12px 16px" }}>Canal</th>
                <th style={{ padding: "12px 16px" }}>Estado</th>
                <th style={{ padding: "12px 16px" }}>Última mod.</th>
                <th style={{ padding: "12px 16px" }}>Ejecuciones</th>
              </tr>
            </thead>
            <tbody>
              {automations.map((a) => (
                <tr 
                  key={a.id} 
                  style={{ borderBottom: "1px solid #e5e7eb", cursor: "pointer" }}
                  onClick={() => router.push(`/admin/mensajes/automatizaciones/${a.id}`)}
                >
                  <td style={{ padding: "16px" }}>
                    <strong>{a.name}</strong>
                  </td>
                  <td style={{ padding: "16px" }}>{a.channel}</td>
                  <td style={{ padding: "16px" }}>
                    <span style={{ 
                      padding: "4px 8px", 
                      borderRadius: "4px", 
                      fontSize: "12px", 
                      fontWeight: 600,
                      backgroundColor: a.status === 'ACTIVE' ? '#dcfce7' : '#f3f4f6',
                      color: a.status === 'ACTIVE' ? '#166534' : '#4b5563'
                    }}>
                      {a.status}
                    </span>
                  </td>
                  <td style={{ padding: "16px" }}>{new Date(a.updatedAt).toLocaleDateString()}</td>
                  <td style={{ padding: "16px" }}>{a._count.executions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
