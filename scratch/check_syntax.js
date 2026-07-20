const fs = require('fs');

const code = fs.readFileSync('app/(protected)/admin/finance/page.jsx', 'utf8');

function checkBrackets(text) {
  let braces = 0;
  let brackets = 0;
  let parens = 0;
  let inString = null; // " or ' or `
  let isEscaped = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (isEscaped) {
      isEscaped = false;
      continue;
    }
    if (char === '\\') {
      isEscaped = true;
      continue;
    }
    if (inString) {
      if (char === inString) {
        inString = null;
      }
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      inString = char;
      continue;
    }

    if (char === '{') braces++;
    else if (char === '}') braces--;
    else if (char === '[') brackets++;
    else if (char === ']') brackets--;
    else if (char === '(') parens++;
    else if (char === ')') parens--;

    if (braces < 0 || brackets < 0 || parens < 0) {
      console.log(`Mismatch found at index ${i} around character: "${text.substring(Math.max(0, i-30), i+30)}": braces=${braces}, brackets=${brackets}, parens=${parens}`);
      return;
    }
  }
  console.log(`Scan completed: braces=${braces}, brackets=${brackets}, parens=${parens}`);
}

checkBrackets(code);
