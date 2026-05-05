import os

file_path = r'c:\Users\cotz\.gemini\antigravity\scratch\MarComn\src\index.css'
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Fix body background (line 82 is index 81)
if 'background-color: var(--bg-color);' in lines[81]:
    lines[81] = lines[81].replace('background-color: var(--bg-color);', 'background-color: #F4F4F4 !important;')

# Remove stray lines (370-373 are indices 369-372)
# We check if they match to avoid double-deletion or wrong deletion
if 'justify-content: flex-end;' in lines[369]:
    # We remove them from back to front to keep indices stable
    del lines[369:373]

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("Replacement complete.")
