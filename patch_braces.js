const fs = require('fs');
let content = fs.readFileSync('src/lib/automations/n8n-provider.ts', 'utf8');

// Replace the stray class closing brace
content = content.replace(
  /  \}\n\}\n\n  \/\*\*\n   \* Dispara el webhook/g,
  `  }\n\n  /**\n   * Dispara el webhook`
);

// Append a final closing brace for the class
content = content + "\n}\n";

fs.writeFileSync('src/lib/automations/n8n-provider.ts', content);
