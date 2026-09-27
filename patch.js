const fs = require('fs');
const content = fs.readFileSync('src/components/UnifiedCanvas.tsx', 'utf8');
const patched = content.replace(
  /const pr = p\.r \?\? 0;/g, 
  "// temp"
);
// wait, I don't need to patch. The error was fork/exec argument list too long.
