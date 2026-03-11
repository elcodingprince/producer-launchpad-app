const fs = require('fs');
let content = fs.readFileSync('app/components/LicenseFileAssignment.tsx', 'utf8');

// Replace "highlight" with "magic" inside FileTypeBadge types
content = content.replace(/tint: 'highlight'/g, "tint: 'magic'");
content = content.replace(/tint: "info" \| "highlight" \| "warning" \| "success" \| "critical"/g, 'tint: "info" | "magic" | "warning" | "success" | "critical"');
content = content.replace(/tint: "info" \| "highlight" \| "warning"/g, 'tint: "info" | "magic" | "warning"');

fs.writeFileSync('app/components/LicenseFileAssignment.tsx', content);
