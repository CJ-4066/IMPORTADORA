import { prisma } from "@/lib/prisma";
import { Save, Webhook, Bot } from "lucide-react";
import { saveSettingsAction, toggleBotAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function ConfiguracionPage() {
  const settings = await prisma.storeSettings.findFirst() || {
    botMasterSwitch: true,
    n8nWebhookUrl: "",
  };

  return (
    <div style={{ padding: "24px", maxWidth: "800px", margin: "0 auto" }}>
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ margin: "0 0 8px 0", fontSize: "24px" }}>Configuración de Mensajería</h1>
        <p style={{ margin: 0, color: "var(--text-muted)" }}>Ajustes globales para el centro de soporte y automatizaciones.</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        <div style={{ background: "var(--surface-bg)", border: "1px solid var(--border-color)", borderRadius: "8px", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-color)", background: "var(--bg-alt)", display: "flex", alignItems: "center", gap: "12px" }}>
            <Bot color="var(--text-muted)" size={20} />
            <h2 style={{ margin: 0, fontSize: "16px", color: "var(--text)" }}>Control Principal de Bots</h2>
          </div>
          <div style={{ padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ flex: 1, paddingRight: "24px" }}>
                <h3 style={{ margin: "0 0 4px 0", fontSize: "15px", color: "var(--text)" }}>Activar automatizaciones (Master Switch)</h3>
                <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)" }}>
                  Si apagas este interruptor, ningún flujo de n8n se ejecutará. Útil para modo "Manual Total" o emergencias.
                </p>
              </div>
              <form action={toggleBotAction}>
                <input type="hidden" name="currentState" value={settings.botMasterSwitch ? "true" : "false"} />
                <button type="submit" style={{ 
                  background: settings.botMasterSwitch ? "#22c55e" : "var(--bg-alt)", 
                  border: "1px solid var(--border-color)", 
                  color: settings.botMasterSwitch ? "#fff" : "var(--text)", 
                  padding: "8px 16px", 
                  borderRadius: "6px", 
                  cursor: "pointer", 
                  fontWeight: 600,
                  transition: "all 0.2s"
                }}>
                  {settings.botMasterSwitch ? "ON (Activo)" : "OFF (Apagado)"}
                </button>
              </form>
            </div>
          </div>
        </div>

        <form action={saveSettingsAction}>
          <div style={{ background: "var(--surface-bg)", border: "1px solid var(--border-color)", borderRadius: "8px", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-color)", background: "var(--bg-alt)", display: "flex", alignItems: "center", gap: "12px" }}>
              <Webhook color="var(--text-muted)" size={20} />
              <h2 style={{ margin: 0, fontSize: "16px", color: "var(--text)" }}>Integración con n8n</h2>
            </div>
            <div style={{ padding: "24px" }}>
              <div>
                <label style={{ display: "block", fontSize: "14px", fontWeight: 500, color: "var(--text)", marginBottom: "8px" }}>
                  URL del Webhook de n8n (Production)
                </label>
                <input 
                  type="url" 
                  name="n8nWebhookUrl"
                  defaultValue={settings.n8nWebhookUrl || ""}
                  placeholder="https://n8n.tudominio.com/webhook/..."
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border-color)", borderRadius: "6px", background: "var(--bg)", color: "var(--text)", fontFamily: "monospace", fontSize: "14px" }}
                />
                <p style={{ margin: "8px 0 0 0", fontSize: "13px", color: "var(--text-muted)" }}>
                  Esta es la URL base a la que el sistema enviará los payloads entrantes de WhatsApp.
                </p>
              </div>
            </div>
            <div style={{ padding: "16px 24px", background: "var(--bg-alt)", borderTop: "1px solid var(--border-color)", display: "flex", justifyContent: "flex-end" }}>
              <button type="submit" style={{ background: "var(--primary)", color: "#fff", border: "none", padding: "10px 16px", borderRadius: "6px", display: "flex", alignItems: "center", gap: "8px", fontWeight: 500, cursor: "pointer" }}>
                <Save size={16} /> Guardar Cambios
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
