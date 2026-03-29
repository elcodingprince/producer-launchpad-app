/* eslint-env node */
/* eslint-disable no-unused-vars */

const fs = require('fs');
let content = fs.readFileSync('app/components/LicenseFileAssignment.tsx', 'utf8');

// Fix missing "as" props on Text components
content = content.replace(/<Text (?![^>]*as=)/g, '<Text as="span" ');
// Fix <Text style=... 
content = content.replace(/<Text([^>]*?)style=\{([^}]+)\}([^>]*?)>/g, '<div style={$2}><Text$1$3>');
// we need to fix the closing tags for these text blocks that got wrapped in divs.
// Wait regex replace for this is complex. Let's just do targeted replace for the specific lines that have style prop on Text.
