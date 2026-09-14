import { MessagesWorkspace } from "@/components/admin/messages/MessagesWorkspace";
import { WhatsAppMetaConnect } from "@/components/admin/messages/WhatsAppMetaConnect";

export default function InboxPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="h4" style={{ margin: 0 }}>Bandeja de Entrada</h1>
          <p className="text-muted" style={{ margin: 0, fontSize: '13px' }}>Conversaciones en tiempo real</p>
        </div>
        <div style={{ maxWidth: '400px' }}>
          <WhatsAppMetaConnect />
        </div>
      </div>
      
      <div style={{ flex: 1, minHeight: 0 }}>
        <MessagesWorkspace />
      </div>
    </div>
  );
}
