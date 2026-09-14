const fs = require('fs');
let content = fs.readFileSync('src/app/admin/quotes/page.tsx', 'utf8');

const newGetStatusBadge = `function getStatusBadge(status: string) {
  let style: React.CSSProperties = {
    padding: "4px 8px",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: 600,
    display: "inline-block",
    whiteSpace: "nowrap"
  };
  let label = "Nuevo";

  if (status === "PENDING") {
    style = { ...style, background: "#fef3c7", color: "#b45309", border: "1px solid #fde68a" };
    label = "Nuevo";
  } else if (status === "IN_REVIEW") {
    style = { ...style, background: "#e0e7ff", color: "#3730a3", border: "1px solid #c7d2fe" };
    label = "En revisión";
  } else if (status === "RESPONDED") {
    style = { ...style, background: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0" };
    label = "Respondido";
  } else if (status === "CLOSED") {
    style = { ...style, background: "#f3f4f6", color: "#4b5563", border: "1px solid #e5e7eb" };
    label = "Cerrado";
  } else if (status === "ERP_REGISTERED") {
    style = { ...style, background: "#dbeafe", color: "#1e40af", border: "1px solid #bfdbfe" };
    label = "Registrada ERP";
  } else if (status === "ERROR") {
    style = { ...style, background: "#fee2e2", color: "#b91c1c", border: "1px solid #fecaca" };
    label = "Con error";
  }

  return <span style={style}>{label}</span>;
}`;

content = content.replace(
  /function getStatusBadge\(status: string\) \{[\s\S]*?return \([\s\S]*?\);\n\}/,
  newGetStatusBadge
);

const oldAsesor = `                  <td data-label="Asesor">
                    {quote.assignedToName ? (
                      <strong style={{ fontSize: "13px", color: "#2320da" }}>{quote.assignedToName}</strong>
                    ) : (
                      <span className="muted" style={{ fontStyle: "italic", fontSize: "12px" }}>Sin asignar</span>
                    )}
                  </td>`;

const newAsesor = `                  <td data-label="Asesor">
                    {quote.assignedToName ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "#e0e7ff", color: "#3730a3", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: "bold" }}>
                          {quote.assignedToName.charAt(0).toUpperCase()}
                        </div>
                        <strong style={{ fontSize: "13px", color: "#111827" }}>{quote.assignedToName}</strong>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", opacity: 0.6 }}>
                        <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ fontSize: "14px" }}>👤</span>
                        </div>
                        <span style={{ fontStyle: "italic", fontSize: "12px", color: "#6b7280" }}>Sin asignar</span>
                      </div>
                    )}
                  </td>`;

content = content.replace(oldAsesor, newAsesor);

fs.writeFileSync('src/app/admin/quotes/page.tsx', content);
