const fs = require('fs');
let content = fs.readFileSync('prisma/schema.prisma', 'utf8');

content = content.replace(
  /model Conversation \{([\s\S]*?)messages\s+ChatMessage\[\]/g,
  `model Conversation {$1messages                  ChatMessage[]\n  automationExecutions      AutomationExecution[]`
);

fs.writeFileSync('prisma/schema.prisma', content);
