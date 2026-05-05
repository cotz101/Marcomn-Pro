
const fs = require('fs');
const path = require('path');

const cssPath = path.join('c:', 'Users', 'cotz', '.gemini', 'antigravity', 'scratch', 'MarComn', 'src', 'index.css');
let cssContent = fs.readFileSync(cssPath, 'utf8');

// Ensure .app-container is properly centered and max-width 1128px
// (Checked manually, looks okay)

// Fix .header-nav-center alignment (should be flex-start to anchor to column start)
cssContent = cssContent.replace(
  /\.header-nav-center \{([\s\S]*?)justify-content: center;/g,
  '.header-nav-center {$1justify-content: flex-start;'
);

// Ensure .sub-nav-links-wrapper is flex-start
cssContent = cssContent.replace(
  /\.sub-nav-links-wrapper \{([\s\S]*?)grid-column: 2;/g,
  '.sub-nav-links-wrapper {$1grid-column: 2;\n  justify-content: flex-start;'
);

// Double check the tablet rule for sub-nav
// (Already checked, looks okay: @media (max-width: 1023px) { .sub-nav-content { grid-template-columns: 1fr; } })

fs.writeFileSync(cssPath, cssContent);
console.log('Alignment fixes applied.');
