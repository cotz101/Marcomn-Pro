const fs = require('fs');
const path = require('path');

const cssPath = 'c:\\Users\\cotz\\.gemini\\antigravity\\scratch\\MarComn\\src\\index.css';

let content = fs.readFileSync(cssPath, 'utf8');

// Replace the messy block around line 202
const messyBlockRegex = /\.app-container \{[^]*?\.main-grid \{[^]*?\}/;
const newLayoutBlock = `.app-container {
  max-width: 1128px;
  margin: 0 auto;
  width: 100%;
  padding: 0 16px;
  box-sizing: border-box;
}

.main-grid {
  display: grid;
  grid-template-columns: 225px 1fr 300px;
  gap: 24px;
  margin-top: 24px;
  align-items: start;
}`;

content = content.replace(messyBlockRegex, newLayoutBlock);

// Replace header-content and surrounding classes
const headerContentRegex = /\.header-content \{[^]*?\.header-right \{[^]*?\}/;
const newHeaderBlock = `.header-content {
  display: grid;
  grid-template-columns: 225px 1fr 300px;
  gap: 24px;
  align-items: center;
  height: 64px;
}

.header-nav-center {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
}

.header-left {
  display: flex;
  align-items: center;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: flex-end;
}`;

content = content.replace(headerContentRegex, newHeaderBlock);

fs.writeFileSync(cssPath, content);
console.log('CSS updated successfully via Node.js');
