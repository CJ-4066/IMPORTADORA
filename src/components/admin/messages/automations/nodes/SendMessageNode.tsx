import { Handle, Position } from "@xyflow/react";
import { MessageCircle } from "lucide-react";

export function SendMessageNode({ data }: { data: any }) {
  return (
    <div style={{
      background: "#fff",
      border: "1px solid #d1d5db",
      borderRadius: "8px",
      padding: "12px",
      minWidth: "200px",
      boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.1)",
    }}>
      <Handle 
        type="target" 
        position={Position.Top} 
        style={{ background: "#9ca3af" }} 
      />
      
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
        <div style={{ background: "#f3f4f6", padding: "4px", borderRadius: "4px" }}>
          <MessageCircle size={14} style={{ color: "#4b5563" }} />
        </div>
        <strong style={{ fontSize: "14px" }}>Enviar Mensaje</strong>
      </div>
      
      <div style={{ background: "#f9fafb", padding: "8px", borderRadius: "4px", fontSize: "12px", border: "1px solid #e5e7eb", minHeight: "40px" }}>
        {data.messageContent || "Escribe un mensaje..."}
      </div>

      <Handle 
        type="source" 
        position={Position.Bottom} 
        style={{ background: "#9ca3af" }} 
      />
    </div>
  );
}
