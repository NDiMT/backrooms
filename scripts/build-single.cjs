/* Χτίζει το DEEPER σε ΕΝΑ αυτόνομο HTML αρχείο (dist/deeper-single.html):
   scripts inline, fonts + PNG sprites ως data URIs. Χρήσιμο για
   itch.io/portal δοκιμές και για hosting χωρίς static assets. */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p));
const b64 = (p, mime) => `data:${mime};base64,${read(p).toString('base64')}`;

let html = read('index.html').toString();

// fonts → data URIs
for (const f of fs.readdirSync(path.join(root, 'fonts'))) {
  html = html.replaceAll(`url('fonts/${f}')`, `url('${b64('fonts/' + f, 'font/woff2')}')`);
}

// PNG overrides → window.__ASSET_DATA (τα διαβάζει το assets.js)
const data = {};
for (const f of fs.readdirSync(path.join(root, 'assets'))) {
  if (!f.endsWith('.png')) continue;
  data[f.replace(/\.png$/, '')] = b64('assets/' + f, 'image/png');
}
const inject = `<script>window.__ASSET_DATA = ${JSON.stringify(data)};</script>`;

// scripts → inline (με τη σειρά των tags)
html = html.replace(/<script src="(js\/[\w.-]+\.js)"><\/script>/g,
  (_, src) => `<script>\n${read(src).toString()}\n</script>`);

// το __ASSET_DATA πρέπει να προηγείται όλων των scripts
html = html.replace('<script>', inject + '\n<script>');

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist', 'deeper-single.html');
fs.writeFileSync(out, html);
console.log('OK:', out, Math.round(html.length / 1024) + 'KB');
