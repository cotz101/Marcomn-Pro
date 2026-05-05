const fs = require('fs');
const path = 'src/index.css';
let content = fs.readFileSync(path, 'utf8');

// 1. Remove all main-grid, sidebar visibility, and fab/bottom-nav media queries
// We'll do this by searching for the patterns and removing the blocks.
// This is a bit complex with regex, so we'll do a few passes.

// Remove common blocks that keep reappearing
const blocksToRemove = [
    /\/\* Grid Breakpoints \*\/[\s\S]*?\n\n/g,
    /@media \(min-width: 1024px\) and \(max-width: 1199px\) \{[\s\S]*?\n\}/g,
    /@media \(min-width: 768px\) and \(max-width: 1023px\) \{[\s\S]*?\n\}/g,
    /@media \(max-width: 767px\) \{[\s\S]*?\n\}/g,
    /@media \(min-width: 768px\) \{\s*\.bottom-nav-mobile, \.fab-btn \{[\s\S]*?\}\s*\}/g,
    /\/\* Tablet Landscape \(Approx 1024px\) \*\/[\s\S]*?\n\n/g
];

blocksToRemove.forEach(re => {
    content = content.replace(re, '');
});

// 2. Define the CLEAN master media query block
const masterBreakpoints = `
/* ============================================================
   MASTER RESPONSIVE GRID & VISIBILITY LOCK
   ============================================================ */

/* Desktop Base (>1200px) */
.main-grid {
  display: grid;
  grid-template-columns: 225px 1fr 300px;
  gap: 24px;
  margin: 24px auto;
  align-items: start;
  width: 100%;
}

/* Tablet Landscape (1024px - 1199px) */
@media (min-width: 1024px) and (max-width: 1199px) {
  .main-grid {
    grid-template-columns: 225px 1fr !important;
    max-width: 1024px;
  }
  .sidebar-right {
    display: none !important;
  }
  .sidebar-left {
    display: block !important;
  }
}

/* Tablet Vertical (768px - 1023px) */
@media (min-width: 768px) and (max-width: 1023px) {
  .main-grid {
    grid-template-columns: 1fr !important;
    max-width: 768px;
  }
  .sidebar-left, .sidebar-right {
    display: none !important;
  }
}

/* Mobile View (<767px) */
@media (max-width: 767px) {
  .main-grid {
    grid-template-columns: 1fr !important;
    margin: 12px auto;
  }
  .sidebar-left, .sidebar-right {
    display: none !important;
  }
}

/* GLOBAL VISIBILITY LOCK (ENFORCED AT END) */
@media (min-width: 768px) {
  .bottom-nav-mobile, .fab-btn {
    display: none !important;
  }
}
@media (max-width: 767px) {
  .bottom-nav-mobile, .fab-btn {
    display: flex !important;
  }
}
`;

// Insert the master block after the .app-container block (around line 210)
content = content.replace(/\.app-container \{[\s\S]*?\}/, (match) => match + masterBreakpoints);

// Also fix the body background while we are here
content = content.replace(/body \{[\s\S]*?\}/, `body {
  background-color: #F4F4F4 !important;
  color: var(--text-primary);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  transition: background-color 0.3s, color 0.3s;
  overflow-y: scroll;
}`);

fs.writeFileSync(path, content);
console.log('CSS Overhaul Complete');
