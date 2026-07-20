const { execSync } = require('child_process');
const fs = require('fs');
try {
  const diff = execSync('git diff "app/(protected)/admin/finance/page.jsx"', { encoding: 'utf8' });
  fs.writeFileSync('scratch/diff_result.txt', diff, 'utf8');
  console.log("Diff written to scratch/diff_result.txt successfully.");
} catch (err) {
  console.error(err);
}
