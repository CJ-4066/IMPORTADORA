const fs = require('fs');
let content = fs.readFileSync('src/components/admin/messages/MessageBubble.tsx', 'utf8');

content = content.replace(
  /\{senderName\}/,
  `{senderName} {isBot && <span style={{ marginLeft: "4px", background: "#dcfce7", color: "#15803d", padding: "2px 4px", borderRadius: "4px", fontSize: "9px" }}>🤖 n8n Auto</span>}`
);

fs.writeFileSync('src/components/admin/messages/MessageBubble.tsx', content);
