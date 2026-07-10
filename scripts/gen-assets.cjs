/* DEAD ZONE — AI asset generator (Gemini).
   Παράγει pixel-art sprites/textures με το Gemini image model και τα
   γράφει στο assets/ ως PNG overrides (δες Assets.OVERRIDE_KEYS).

   Χρήση:
     GEMINI_API_KEY=... node scripts/gen-assets.cjs [enemies|weapons|textures|all]

   Απαιτεί playwright για το post-processing (chroma-key, τεμάχισμα,
   resize). Αν δεν είναι στο project, δώσε NODE_PATH σε node_modules
   που το περιέχει. Το κλειδί ΔΕΝ αποθηκεύεται πουθενά. */

const fs = require('fs');
const path = require('path');

const KEY = process.env.GEMINI_API_KEY;
if (!KEY) { console.error('Set GEMINI_API_KEY'); process.exit(1); }

const MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image';
const ROOT = path.resolve(__dirname, '..');
const RAW = path.join(ROOT, '.genraw');
const OUT = path.join(ROOT, 'assets');

const STYLE =
  'Retro 90s DOOM-style pixel art for an FPS video game. Chunky pixels, ' +
  'hard black outlines, dark gritty sci-fi palette. Solid pure magenta ' +
  'background (#FF00FF) everywhere outside the subject. No text, no labels, ' +
  'no grid lines, no watermark.';

const ENEMIES = {
  shambler: 'A rotten green cyber-zombie space crew member in a torn grey jumpsuit, one glowing red eye, a crude metal left arm.',
  spitter: 'A bloated yellow-green mutant with a huge gaping toothy mouth dripping glowing green acid.',
  drone: 'A small hovering security drone: dark metal sphere with a single glowing red camera lens and tiny thrusters underneath.',
  heavy: 'A hulking armored cyborg soldier in heavy grey plate armor with a large orange-lit arm-mounted cannon.',
  warden: 'An elite cyborg prison warden in heavy ORANGE armor plates, bigger and meaner than a normal soldier, with an arm cannon.',
  boss: 'A colossal rogue AI avatar: a floating mechanical skull with glowing purple eyes, purple energy veins, thick cables hanging beneath it like tentacles.',
};
const enemyPrompt = d =>
  `${STYLE} Sprite sheet: ONE single horizontal row with exactly 4 poses of the SAME character, separated by wide gaps of pure magenta: (1) walking, left leg forward, (2) walking, right leg forward, (3) attacking, (4) standing idle. Full body, facing the viewer. ${d}`;

const WEAPONS = {
  pistol: 'a compact semi-automatic pistol',
  smg: 'a boxy compact submachine gun',
  shotgun: 'a pump-action combat shotgun with a wooden pump',
  handcannon: 'a massive heavy revolver hand cannon',
  rifle: 'a futuristic pulse rifle with glowing cyan energy coils',
  railgun: 'a long twin-rail electromagnetic railgun with glowing cyan coils between the rails',
  incinerator: 'an industrial flamethrower with an orange fuel gauge and a wide nozzle',
  arccaster: 'a tesla lightning gun with two metal prongs and blue electric arcs between them',
  launcher: 'a heavy plasma launcher with a fat glowing cyan energy cylinder on top',
};
const weaponPrompt = d =>
  `${STYLE} First-person view FPS weapon, like the DOOM shotgun viewmodel: ${d}, held in two gloved hands, seen from directly behind the weapon, barrel pointing away from the camera towards the top-center of the image, hands and forearms visible at the bottom. One single weapon, centered.`;

const TEXTURES = {
  hull: 'grey-blue spaceship interior wall made of metal panels with rivets and seams',
  hullBlood: 'grey-blue spaceship metal wall panels with a large dried dark-red blood splatter running down',
  vent: 'dark metal industrial ventilation grille wall with horizontal slats',
  tech: 'spaceship tech wall with a small green computer screen, blinking status lights and hanging cables',
  door: 'heavy metal sliding blast door with yellow and black hazard stripes across the middle and a central seam',
  elevator: 'metal elevator door bathed in green light with a large green downward arrow symbol',
  core: 'dark wall overgrown with glowing purple AI neural cables and pulsing nodes',
};
const texPrompt = d =>
  `Retro 90s DOOM-style pixel art texture for an FPS game: seamless tileable SQUARE wall texture. ${d}. Chunky pixels, hard edges, dark gritty palette. The texture fills the entire image edge to edge with no border. No text, no watermark.`;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function generate(name, prompt) {
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ['IMAGE'] },
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body) });
    if (res.status === 429 || res.status >= 500) {
      console.log(`  ${name}: HTTP ${res.status}, retry σε 30s…`);
      await sleep(30000);
      continue;
    }
    if (!res.ok) throw new Error(`${name}: HTTP ${res.status} ${await res.text()}`);
    const data = await res.json();
    const part = (data.candidates?.[0]?.content?.parts || [])
      .find(p => p.inlineData);
    if (!part) throw new Error(`${name}: no image in response`);
    const buf = Buffer.from(part.inlineData.data, 'base64');
    fs.writeFileSync(path.join(RAW, name + '.img'), buf);
    console.log(`  ${name}: OK (${(buf.length / 1024) | 0} KB)`);
    return;
  }
  throw new Error(`${name}: εξαντλήθηκαν οι προσπάθειες`);
}

/* Post-processing μέσα σε headless chromium (canvas):
   chroma-key, τεμάχισμα λωρίδας σε frames, autocrop, resize. */
async function processAll(jobs) {
  const { chromium } = require('playwright');
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium',
  });
  const page = await browser.newPage();
  await page.goto('about:blank');

  page.on('console', m => { if (m.type() === 'error') console.log('  [proc]', m.text()); });

  const results = await page.evaluate(async (jobs) => {
    function load(dataUrl) {
      return new Promise((ok, err) => {
        const im = new Image();
        im.onload = () => ok(im);
        im.onerror = err;
        im.src = dataUrl;
      });
    }
    function toCanvas(im) {
      const c = document.createElement('canvas');
      c.width = im.width; c.height = im.height;
      c.getContext('2d').drawImage(im, 0, 0);
      return c;
    }
    function chromaKey(c) {
      const ctx = c.getContext('2d');
      const d = ctx.getImageData(0, 0, c.width, c.height);
      const px = d.data;
      for (let i = 0; i < px.length; i += 4) {
        const r = px[i], g = px[i + 1], b = px[i + 2];
        // μωβ/ματζέντα (με ανοχή για JPEG artifacts)
        if (Math.min(r, b) - g > 40 && r > 90 && b > 90) px[i + 3] = 0;
      }
      ctx.putImageData(d, 0, 0);
      return c;
    }
    function columnsOccupancy(c) {
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      const occ = new Array(c.width).fill(0);
      for (let x = 0; x < c.width; x++) {
        for (let y = 0; y < c.height; y++) {
          if (d[(y * c.width + x) * 4 + 3] > 30) occ[x]++;
        }
      }
      return occ;
    }
    function bbox(c) {
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let x0 = c.width, x1 = 0, y0 = c.height, y1 = 0;
      for (let y = 0; y < c.height; y++) {
        for (let x = 0; x < c.width; x++) {
          if (d[(y * c.width + x) * 4 + 3] > 30) {
            if (x < x0) x0 = x; if (x > x1) x1 = x;
            if (y < y0) y0 = y; if (y > y1) y1 = y;
          }
        }
      }
      return x1 > x0 ? { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 } : null;
    }
    function crop(c, r) {
      const o = document.createElement('canvas');
      o.width = r.w; o.height = r.h;
      o.getContext('2d').drawImage(c, r.x0, r.y0, r.w, r.h, 0, 0, r.w, r.h);
      return o;
    }
    function resize(c, w, h) {
      const o = document.createElement('canvas');
      o.width = w; o.height = h;
      const ctx = o.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(c, 0, 0, w, h);
      return o;
    }
    /* Τεμαχίζει οριζόντια λωρίδα σε ≤n frames με βάση κενές στήλες. */
    function splitRow(c, n) {
      const occ = columnsOccupancy(c);
      const segs = [];
      let start = -1;
      for (let x = 0; x <= occ.length; x++) {
        const filled = x < occ.length && occ[x] > 2;
        if (filled && start < 0) start = x;
        if (!filled && start >= 0) {
          segs.push([start, x - 1]);
          start = -1;
        }
      }
      // συγχώνευση πολύ μικρών segments με το γειτονικό (θόρυβος)
      const min = c.width * 0.03;
      const merged = [];
      for (const s of segs) {
        if (merged.length && s[0] - merged[merged.length - 1][1] < c.width * 0.01) {
          merged[merged.length - 1][1] = s[1];
        } else merged.push(s);
      }
      const big = merged.filter(s => s[1] - s[0] > min);
      return big.slice(0, n).map(([a, b]) => {
        const sub = crop(c, { x0: a, y0: 0, w: b - a + 1, h: c.height });
        const r = bbox(sub);
        return r ? crop(sub, r) : sub;
      });
    }

    const out = {};
    for (const job of jobs) {
      const img = await load(job.dataUrl);
      let c = toCanvas(img);
      if (job.kind === 'enemy') {
        c = chromaKey(c);
        const frames = splitRow(c, 4);
        const names = ['walk1', 'walk2', 'attack'];
        for (let i = 0; i < names.length && i < frames.length; i++) {
          const f = frames[i];
          const h = 128, w = Math.max(8, Math.round(f.width * h / f.height));
          out[`enemy_${job.name}_${names[i]}`] = resize(f, w, h).toDataURL('image/png');
        }
      } else if (job.kind === 'weapon') {
        c = chromaKey(c);
        const r = bbox(c);
        if (r) c = crop(c, r);
        const w = 84, h = Math.max(8, Math.round(c.height * w / c.width));
        out[`weapon_${job.name}_idle`] = resize(c, w, Math.min(h, 64)).toDataURL('image/png');
      } else if (job.kind === 'tex') {
        // κεντραρισμένο τετράγωνο → 64x64
        const s = Math.min(c.width, c.height);
        const sq = crop(c, { x0: (c.width - s) / 2, y0: (c.height - s) / 2, w: s, h: s });
        out[`tex_${job.name}`] = resize(sq, 64, 64).toDataURL('image/png');
      }
    }
    return out;
  }, jobs);

  await browser.close();
  return results;
}

(async () => {
  const what = process.argv[2] || 'all';
  fs.mkdirSync(RAW, { recursive: true });
  fs.mkdirSync(OUT, { recursive: true });

  const gen = [];
  if (what === 'all' || what === 'enemies') {
    for (const [n, d] of Object.entries(ENEMIES)) gen.push(['e_' + n, enemyPrompt(d)]);
  }
  if (what === 'all' || what === 'weapons') {
    for (const [n, d] of Object.entries(WEAPONS)) gen.push(['w_' + n, weaponPrompt(d)]);
  }
  if (what === 'all' || what === 'textures') {
    for (const [n, d] of Object.entries(TEXTURES)) gen.push(['t_' + n, texPrompt(d)]);
  }

  console.log(`Παραγωγή ${gen.length} εικόνων με ${MODEL}…`);
  for (const [name, prompt] of gen) {
    if (fs.existsSync(path.join(RAW, name + '.img'))) {
      console.log(`  ${name}: υπάρχει ήδη, skip`);
      continue;
    }
    await generate(name, prompt);
    await sleep(6000); // rate limit
  }

  console.log('Post-processing…');
  const jobs = [];
  for (const f of fs.readdirSync(RAW)) {
    if (!f.endsWith('.img')) continue;
    const name = f.slice(0, -4);
    const buf = fs.readFileSync(path.join(RAW, f));
    const dataUrl = 'data:image/png;base64,' + buf.toString('base64');
    if (name.startsWith('e_')) jobs.push({ kind: 'enemy', name: name.slice(2), dataUrl });
    else if (name.startsWith('w_')) jobs.push({ kind: 'weapon', name: name.slice(2), dataUrl });
    else if (name.startsWith('t_')) jobs.push({ kind: 'tex', name: name.slice(2), dataUrl });
  }
  const results = await processAll(jobs);
  let count = 0;
  for (const [key, dataUrl] of Object.entries(results)) {
    const b64 = dataUrl.split(',')[1];
    fs.writeFileSync(path.join(OUT, key + '.png'), Buffer.from(b64, 'base64'));
    count++;
  }
  console.log(`Γράφτηκαν ${count} PNG στο assets/`);
})().catch(e => { console.error(e); process.exit(1); });
