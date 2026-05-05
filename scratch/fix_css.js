const fs = require('fs');
const path = 'src/index.css';

let content = fs.readFileSync(path, 'utf8');
let lines = content.split(/\r?\n/);

// Fix body background
// We look for the exact line
lines = lines.map(line => {
  if (line.includes('background-color: var(--bg-color);')) {
    return line.replace('background-color: var(--bg-color);', 'background-color: #F4F4F4 !important;');
  }
  return line;
});

// Fix stray lines
// We look for the specific block
const startIndex = lines.findIndex(l => l.includes('justify-content: flex-end;') && l.includes('370') === false); // avoid matching line numbers if present (though they aren't)
if (startIndex !== -1) {
  lines.splice(startIndex, 4);
}

fs.writeFileSync(path, lines.join('\n'));
console.log('CSS Fixed');
