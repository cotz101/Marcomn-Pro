const fs = require('fs');

const code = fs.readFileSync('app/(protected)/admin/finance/page.jsx', 'utf8');

function checkTags(text) {
  let cleanText = text
    .replace(/\/\*[\s\S]*?\*\//g, '') // strip block comments
    .replace(/\/\/.*/g, '');          // strip line comments

  const tagRegex = /<(\/?[a-zA-Z0-9_\.\$]+)([^>]*?)>/g;
  let match;
  const stack = [];
  const lines = text.split('\n');

  function getLineNumber(index) {
    let currentChars = 0;
    for (let l = 0; l < lines.length; l++) {
      currentChars += lines[l].length + 1; // +1 for newline
      if (currentChars >= index) {
        return l + 1;
      }
    }
    return lines.length;
  }

  while ((match = tagRegex.exec(cleanText)) !== null) {
    const fullTag = match[0];
    const tagName = match[1];
    let rest = match[2];
    
    // Ignore comparisons like: if (a < b)
    if (rest.trim() === '' && !tagName.startsWith('/') && !/^[a-zA-Z]/.test(tagName)) {
      continue;
    }

    const currentLine = getLineNumber(match.index);

    // Is it self-closing?
    const isSelfClosing = rest.trim().endsWith('/') || tagName === 'img' || tagName === 'input' || tagName === 'br' || tagName === 'hr';

    if (isSelfClosing) {
      console.log(`Self-closing tag: <${tagName} /> at line ${currentLine}`);
      continue;
    }

    if (tagName.startsWith('/')) {
      const closingName = tagName.substring(1);
      if (stack.length === 0) {
        console.log(`Error: Extra closing tag </${closingName}> at line ${currentLine}`);
        continue;
      }
      const last = stack.pop();
      if (last.name !== closingName) {
        console.log(`Error: Mismatch: Opened <${last.name}> at line ${last.line}, closed with </${closingName}> at line ${currentLine}`);
      } else {
        console.log(`Closed: </${closingName}> at line ${currentLine} (matched line ${last.line})`);
      }
    } else {
      console.log(`Opened: <${tagName}> at line ${currentLine}`);
      stack.push({ name: tagName, line: currentLine });
    }
  }

  if (stack.length > 0) {
    console.log("Unclosed tags remaining on stack:");
    for (const item of stack) {
      console.log(`  <${item.name}> opened at line ${item.line}`);
    }
  } else {
    console.log("All tags are perfectly balanced!");
  }
}

checkTags(code);
