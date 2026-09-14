import { Handle, Position } from "@xyflow/react";
import { Zap } from "lucide-react";

export function TriggerNode({ data }: { data: any }) {
  return (
    <div style={{
      background: "#fff",
      border: "2px solid #3b82f6", // Blue border for triggers
      borderRadius: "8px",
      padding: "12px",
      minWidth: "180px",
      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
        <div style={{ background: "#eff6ff", color: "#3b82f6", padding: "4px", borderRadius: "4px" }}>
          <Zap size={14} />
        </div>
        <strong style={{ fontSize: "14px" }}>{data.label || "Trigger"}</strong>
      </div>
      <p style={{ margin: 0, fontSize: "12px", color: "#6b7280" }}>
        {data.description || "Inicia el flujo"}
      </p>
      
      {/* Salida únicamente */}
      <Handle 
        type="source" 
        position={Position.Bottom} 
        style={{ background: "#3b82f6", width: "8px", height: "8px" }} 
      />
    </div>
  );
}
