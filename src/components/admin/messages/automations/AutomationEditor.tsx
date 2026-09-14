"use client";

import { useEffect, useState, useRef } from "react";
import { ArrowLeft, Save, Play, RefreshCw, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FlowCanvas } from "./FlowCanvas";

interface AutomationEditorProps {
  automationId: string;
}

export function AutomationEditor({ automationId }: AutomationEditorProps) {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mantenemos la ref del flujo para evitar re-renders por cada arrastre del canvas
  const flowDataRef = useRef<{ nodes: any[]; edges: any[] }>({ nodes: [], edges: [] });

  useEffect(() => {
    fetch(`/api/admin/automations/${automationId}`)
      .then((res) => res.json())
      .then((payload) => {
        if (payload.error) {
          setError(payload.error);
        } else {
          setData(payload);
          if (payload.versions?.[0]?.flowDefinition?.nodes) {
            flowDataRef.current = payload.versions[0].flowDefinition;
          }
        }
      })
      .finally(() => setLoading(false));
  }, [automationId]);

  
  const handlePublish = async () => {
    if (!data) return;
    setSaving(true);
    setError(null);
    
    const draftVersion = data.versions[0];
    try {
      // 1. Guardar primero
      await handleSave();
      
      // 2. Publicar
      const res = await fetch(`/api/admin/automations/${automationId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftVersionId: draftVersion.id })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      
      alert("Publicado con éxito");
      
      // Refrescar para cargar la nueva versión borrador
      const fresh = await fetch(`/api/admin/automations/${automationId}`).then(r => r.json());
      setData(fresh);
    } catch (e: any) {
      setError(e.message || "Error al publicar");
    } finally {
      setSaving(false);
    }
  };


  const handleSave = async () => {
    if (!data) return;
    setSaving(true);
    setError(null);
    
    const draftVersion = data.versions[0];

    try {
      const res = await fetch(`/api/admin/automations/${automationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          draftVersionId: draftVersion.id,
          currentVersionNumber: draftVersion.version,
          flowDefinition: flowDataRef.current,
        }),
      });

      const result = await res.json();
      
      if (!res.ok) {
        if (res.status === 409) {
          setError("⚠️ Conflicto de versión: Otro administrador ha modificado este flujo. Refresca la página.");
        } else {
          setError(result.error || "Error al guardar");
        }
      } else {
        const fresh = await fetch(`/api/admin/automations/${automationId}`).then(r => r.json());
        setData(fresh);
      }
    } catch (e) {
      setError("Error de red al intentar guardar.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: "40px", textAlign: "center" }}>Cargando Flow Builder...</div>;
  if (error && !data) return <div style={{ padding: "40px", color: "red" }}>{error}</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center", 
        padding: "12px 24px",
        borderBottom: "1px solid var(--border-color)",
        background: "#fff",
        zIndex: 10
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <Link href="/admin/mensajes/automatizaciones" className="button is-ghost" style={{ padding: "8px" }}>
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h2 style={{ fontSize: "16px", fontWeight: 600, margin: 0 }}>{data.name}</h2>
            <p className="text-muted" style={{ fontSize: "12px", margin: 0 }}>
              Revisión local: {data.versions[0]?.version || 0}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          {error && (
            <span style={{ color: "#ef4444", fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}>
              <AlertTriangle size={14} /> {error}
            </span>
          )}
          <button 
            className="button is-ghost" 
            onClick={handleSave} 
            disabled={saving}
          >
            {saving ? <RefreshCw size={16} className="spin" /> : <Save size={16} />}
            <span>Guardar Borrador</span>
          </button>
          <button className="button is-primary" onClick={handlePublish} disabled={saving}>
            {saving ? <RefreshCw size={16} className="spin" /> : <Play size={16} />}
            <span>Publicar en n8n</span>
          </button>
        </div>
      </div>

      <div style={{ flex: 1, position: "relative" }}>
        <FlowCanvas 
          initialData={data.versions[0]?.flowDefinition} 
          onChange={(newFlow) => { flowDataRef.current = newFlow; }} 
        />
      </div>
    </div>
  );
}
