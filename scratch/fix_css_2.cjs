const fs = require('fs');
const path = 'src/index.css';
let lines = fs.readFileSync(path, 'utf8').split(/\r?\n/);

// Remove the specific lines 354-357 (indices 353-356)
// We check the content to be sure
if (lines[353] && lines[353].includes('justify-content: flex-end;')) {
    lines.splice(353, 4);
    fs.writeFileSync(path, lines.join('\n'));
    console.log('Successfully removed stray lines');
} else {
    console.log('Pattern not found at expected lines, searching...');
    const idx = lines.findIndex(l => l.includes('justify-content: flex-end;'));
    if (idx !== -1) {
        lines.splice(idx, 4);
        fs.writeFileSync(path, lines.join('\n'));
        console.log('Successfully removed stray lines at index ' + idx);
    }
}
