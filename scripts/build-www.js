/* Αντιγράφει τα στατικά αρχεία του παιχνιδιού στο www/ που περιμένει
   ο Capacitor. Cross-platform (χωρίς shell), τρέχει και σε CI και τοπικά. */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dest = path.join(root, 'www');

const ENTRIES = ['index.html', 'js'];

function rmrf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

function copy(src, dst) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const name of fs.readdirSync(src)) copy(path.join(src, name), path.join(dst, name));
  } else {
    fs.copyFileSync(src, dst);
  }
}

rmrf(dest);
fs.mkdirSync(dest, { recursive: true });
for (const e of ENTRIES) {
  const src = path.join(root, e);
  if (!fs.existsSync(src)) {
    console.error('Λείπει:', e);
    process.exit(1);
  }
  copy(src, path.join(dest, e));
}

console.log('www/ έτοιμο:', ENTRIES.join(', '));
