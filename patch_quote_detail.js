const fs = require('fs');
let content = fs.readFileSync('src/app/admin/quotes/[id]/page.tsx', 'utf8');

content = content.replace(
  /import \{ QuoteCustomerMessage \} from "@\/components\/admin\/quote-customer-message";\nimport \{ QuoteStatusNotesEditor \} from "@\/components\/admin\/quote-status-notes-editor";/,
  `import { QuoteConversationPanel } from "@/components/admin/quote-conversation-panel";`
);

const oldSidebar = `{/* Right Side: Status and notes interactive sidebar */}
        <div style={{ flex: "1 1 320px", maxWidth: "420px", position: "sticky", top: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
          {quote.note && (
            <QuoteCustomerMessage
              key={quote.id}
              customerName={quote.customerName}
              customerPhone={quote.customerPhone ?? ""}
              customerMessage={quote.note}
              pdfLink={pdfLink}
              quoteNumber={quote.quoteNumber}
            />
          )}
          <QuoteStatusNotesEditor
            quoteId={quote.id}
            initialStatus={quote.status}
            initialAdminNotes={quote.adminNotes}
            assignedToName={quote.assignedToName}
            assignedToEmail={quote.assignedToEmail}
          />
        </div>`;

const newSidebar = `{/* Right Side: Conversation and Status Sidebar */}
        <div style={{ flex: "1 1 320px", maxWidth: "420px", position: "sticky", top: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
          <QuoteConversationPanel
            quoteId={quote.id}
            initialStatus={quote.status}
            initialAdminNotes={quote.adminNotes}
            assignedToName={quote.assignedToName}
            assignedToEmail={quote.assignedToEmail}
            customerName={quote.customerName}
            customerPhone={quote.customerPhone ?? ""}
            customerMessage={quote.note}
            pdfLink={pdfLink}
            quoteNumber={quote.quoteNumber}
          />
        </div>`;

content = content.replace(oldSidebar, newSidebar);
fs.writeFileSync('src/app/admin/quotes/[id]/page.tsx', content);
