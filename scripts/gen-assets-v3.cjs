/* DEAD ZONE v3 — καθαρό PixelLab pipeline, μηδενική Gemini «κληρονομιά».
   Τα όπλα χρησιμοποιούν τα παλιά renders ΜΟΝΟ ως σκελετό σύνθεσης POV σε
   πολύ χαμηλό init_image_strength (100): το PixelLab κρατά τη στάση
   (χέρια κάτω, κάννη προς τα πάνω) αλλά σχεδιάζει εντελώς νέο όπλο από
   την περιγραφή. Όλα τα υπόλοιπα (faces, τοίχοι, δάπεδα/οροφές, statusbar,
   φόντο μενού) γεννιούνται fresh, χωρίς init.

   Χρήση:
     PIXELLAB_API_KEY=... node scripts/gen-assets-v3.cjs [step|all]
     steps: weapons, faces, textures, ui, crop */

const fs = require('fs');
const path = require('path');

try {
  const { setGlobalDispatcher, EnvHttpProxyAgent } = require('undici');
  if (process.env.HTTPS_PROXY || process.env.https_proxy) {
    setGlobalDispatcher(new EnvHttpProxyAgent());
  }
} catch (e) { /* χωρίς proxy */ }

const KEY = process.env.PIXELLAB_API_KEY;
if (!KEY) { console.error('Set PIXELLAB_API_KEY'); process.exit(1); }

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'assets');
const SRC = path.join(ROOT, '.initsrc');
const API = 'https://api.pixellab.ai/v1';

const STYLE = ', retro DOOM style, dark gritty sci-fi';
const sleep = ms => new Promise(r => setTimeout(r, ms));

let _browser = null, _page = null;
async function getPage() {
  if (_page) return _page;
  const { chromium } = require('playwright');
  _browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium',
  });
  _page = await _browser.newPage();
  return _page;
}
async function closePage() { if (_browser) await _browser.close(); _browser = _page = null; }

async function prepInit(file, w, h) {
  const page = await getPage();
  const b64 = fs.readFileSync(file).toString('base64');
  return page.evaluate(async ({ b64, w, h }) => {
    const im = await new Promise((ok, err) => {
      const i = new Image(); i.onload = () => ok(i); i.onerror = err;
      i.src = 'data:image/png;base64,' + b64;
    });
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const s = Math.min(w / im.width, h / im.height);
    const dw = im.width * s, dh = im.height * s;
    ctx.drawImage(im, (w - dw) / 2, h - dh, dw, dh);
    return c.toDataURL('image/png').split(',')[1];
  }, { b64, w, h });
}

async function post(endpoint, body, label) {
  for (let attempt = 0; attempt < 4; attempt++) {
    let res;
    try {
      res = await fetch(`${API}/${endpoint}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (e) {
      console.log(`  ${label}: ${e.cause ? e.cause.code : e.message}, retry 15s…`);
      await sleep(15000);
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      console.log(`  ${label}: HTTP ${res.status}, retry 20s…`);
      await sleep(20000);
      continue;
    }
    if (!res.ok) throw new Error(`${label}: HTTP ${res.status} ${await res.text()}`);
    return await res.json();
  }
  throw new Error(`${label}: εξαντλήθηκαν οι προσπάθειες`);
}

function save(name, b64) {
  fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(b64, 'base64'));
}

function fresh(name) {
  const lim = parseInt(process.env.SKIP_NEWER_MIN || '0', 10);
  if (!lim) return false;
  const f = path.join(OUT, name + '.png');
  return fs.existsSync(f) && fs.statSync(f).mtimeMs > Date.now() - lim * 60000;
}

/* ---------- ΟΠΛΑ: νέα σχέδια, POV σκελετός σε strength 100 ---------- */

const POV = "first person shooter viewmodel POV sprite: two hands in dark " +
  "tactical gloves gripping ";
const POV_TAIL = ", muzzle pointing away from camera toward top center, " +
  "foreshortened perspective, hands at bottom edge, crisp readable silhouette" + STYLE;

const WEAPONS = {
  pistol: "a compact ceramic-white service pistol with teal energy cell " +
    "glowing in the grip, slim square barrel",
  smg: "an angular gunmetal machine pistol with twin stubby micro barrels, " +
    "red status LEDs, folded wire stock",
  shotgun: "a chunky matte black scatter-cannon with hazard-yellow armor " +
    "plating and glowing cyan plasma coils, wide vented muzzle",
  handcannon: "a massive chromed break-action hand cannon with a glowing " +
    "orange revolver cylinder and heavy square muzzle",
  rifle: "a sleek dark-green pulse rifle with a long slim barrel, thin blue " +
    "plasma light strip and holo sight",
  railgun: "a long experimental coilgun with two exposed silver rails and " +
    "crackling magenta magnetic arcs between them",
  incinerator: "an industrial flamethrower with rusted red fuel tanks, brass " +
    "pipes and a small pilot flame at the wide nozzle",
  arccaster: "a tesla arc projector built from copper coils and glass " +
    "capacitors with white-blue electricity crawling over it",
  launcher: "a heavy olive-drab grenade launcher with a wide dark muzzle, " +
    "amber warning stripes and a drum magazine",
};

async function stepWeapons() {
  for (const [name, desc] of Object.entries(WEAPONS)) {
    const key = `weapon_${name}_idle`;
    if (fresh(key)) { console.log(`  ${key}: πρόσφατο, skip`); continue; }
    const init = await prepInit(path.join(SRC, key + '.png'), 112, 80);
    const r = await post('generate-image-pixflux', {
      description: POV + desc + POV_TAIL,
      image_size: { width: 112, height: 80 },
      no_background: true,
      outline: 'selective outline',
      shading: 'detailed shading',
      detail: 'highly detailed',
      init_image: { type: 'base64', base64: init },
      init_image_strength: 100,
    }, key);
    save(key, r.image.base64);
    console.log(`  ✔ ${key}`);
  }
}

/* ---------- FACES: fresh βάση + εκφράσεις με init στη βάση ---------- */

const FACE_BASE = "pixel art video game HUD mugshot portrait of a rugged " +
  "space marine clone soldier, buzz cut dark hair, square jaw, green armored " +
  "collar, facing forward, head and shoulders, centered, DOOM status bar " +
  "face style" + STYLE;

const FACE_EXPR = {
  grin: "grinning wide with clenched teeth, wild excited eyes",
  pain: "wincing in sharp pain, one eye squeezed shut, gritted teeth, small cuts",
  low: "badly wounded and exhausted, blood running down the face, drooping eyelids",
  dead: "dead, eyes closed, slack expression, pale bloodied skin",
};

async function stepFaces() {
  const styl = {
    outline: 'single color black outline',
    shading: 'detailed shading',
    detail: 'highly detailed',
  };
  let okB64;
  if (fresh('face_ok')) {
    console.log('  face_ok: πρόσφατο, skip');
    okB64 = fs.readFileSync(path.join(OUT, 'face_ok.png')).toString('base64');
  } else {
    const r = await post('generate-image-pixflux', {
      description: FACE_BASE + ", neutral alert expression",
      image_size: { width: 40, height: 40 },
      no_background: true,
      ...styl,
    }, 'face_ok');
    okB64 = r.image.base64;
    save('face_ok', okB64);
    console.log('  ✔ face_ok');
  }
  for (const [name, expr] of Object.entries(FACE_EXPR)) {
    const key = `face_${name}`;
    if (fresh(key)) { console.log(`  ${key}: πρόσφατο, skip`); continue; }
    const r = await post('generate-image-pixflux', {
      description: FACE_BASE + ", " + expr,
      image_size: { width: 40, height: 40 },
      no_background: true,
      ...styl,
      init_image: { type: 'base64', base64: okB64 },
      init_image_strength: 450,   // κρατά την ταυτότητα, αλλάζει έκφραση
    }, key);
    save(key, r.image.base64);
    console.log(`  ✔ ${key}`);
  }
}

/* ---------- ΤΟΙΧΟΙ / ΔΑΠΕΔΑ / ΟΡΟΦΕΣ: fresh, tileable ---------- */

const SURF = {
  outline: 'lineless',
  shading: 'detailed shading',
  detail: 'highly detailed',
};

const WALLS = {  // 128x128
  tex_hull: "seamless tileable dark blue-gray spaceship hull wall of riveted " +
    "steel panels with subtle grime and scratches, flat frontal view",
  tex_vent: "seamless tileable industrial spaceship wall with rusty " +
    "ventilation grilles, pipes and steam stains, flat frontal view",
  tex_tech: "seamless tileable sci-fi server room wall, dark computer panels " +
    "with blinking green and amber lights and hanging cables, flat frontal view",
  tex_hullBlood: "seamless tileable dark riveted spaceship hull wall smeared " +
    "with dried blood streaks and claw marks, flat frontal view",
  tex_core: "seamless tileable eerie alien reactor wall, dark metal fused " +
    "with glowing purple energy veins and strange organic growths, flat frontal view",
  tex_door: "sci-fi sliding blast door, heavy horizontal metal segments, " +
    "yellow-black hazard stripes on the edges, central seam, flat frontal view",
  tex_elevator: "sci-fi elevator door, brushed steel with a glowing green " +
    "holographic status ring and caution markings, flat frontal view",
};

const FLOORS = {  // 64x64
  tex_floor0: "seamless tileable frosty pale-blue steel floor grating with " +
    "ice crystals in the grooves, top-down view",
  tex_floor1: "seamless tileable dark iron engine room floor plates with oil " +
    "stains and faint orange glow in the seams, top-down view",
  tex_floor2: "seamless tileable wet mossy metal floor plates with green " +
    "algae growing between them, top-down view",
  tex_floor3: "seamless tileable dark polished command deck floor with " +
    "glowing purple conduit lines, top-down view",
  tex_ceil0: "seamless tileable dark spaceship ceiling of steel panels, " +
    "pipes, cables and small vents, bottom-up view",
  tex_ceil1: "seamless tileable ominous dark ceiling with purple glowing " +
    "cracks and organic alien veins, bottom-up view",
};

async function stepTextures() {
  for (const [key, desc] of Object.entries(WALLS)) {
    if (fresh(key)) { console.log(`  ${key}: πρόσφατο, skip`); continue; }
    const r = await post('generate-image-pixflux', {
      description: desc + STYLE,
      image_size: { width: 128, height: 128 },
      no_background: false,
      ...SURF,
    }, key);
    save(key, r.image.base64);
    console.log(`  ✔ ${key}`);
  }
  for (const [key, desc] of Object.entries(FLOORS)) {
    if (fresh(key)) { console.log(`  ${key}: πρόσφατο, skip`); continue; }
    const r = await post('generate-image-pixflux', {
      description: desc + STYLE,
      image_size: { width: 64, height: 64 },
      no_background: false,
      ...SURF,
    }, key);
    save(key, r.image.base64);
    console.log(`  ✔ ${key}`);
  }
}

/* ---------- UI: statusbar + φόντο μενού ---------- */

async function stepUi() {
  if (!fresh('ui_statusbar')) {
    const r = await post('generate-image-pixflux', {
      description: "very wide low sci-fi game HUD status bar panel, brushed " +
        "dark gunmetal with rivets and bevel edges, a few empty recessed " +
        "darker slots, faint green screen glow, no text, no numbers" + STYLE,
      image_size: { width: 320, height: 36 },
      no_background: false,
      ...SURF,
    }, 'ui_statusbar');
    save('ui_statusbar', r.image.base64);
    console.log('  ✔ ui_statusbar');
  }
  if (!fresh('ui_menubg')) {
    const r = await post('generate-image-pixflux', {
      description: "dark derelict spaceship corridor interior at eye level, " +
        "emergency red lights, drifting fog, sparking broken cables, a " +
        "distant glowing green elevator door, cinematic pixel art scene, " +
        "no text" + STYLE,
      image_size: { width: 320, height: 180 },
      no_background: false,
      ...SURF,
    }, 'ui_menubg');
    save('ui_menubg', r.image.base64);
    console.log('  ✔ ui_menubg');
  }
}

/* ---------- CROP: μόνο τα όπλα (per-file bbox) ---------- */

async function stepCrop() {
  const page = await getPage();
  for (const name of Object.keys(WEAPONS)) {
    const f = path.join(OUT, `weapon_${name}_idle.png`);
    const b64 = fs.readFileSync(f).toString('base64');
    const out = await page.evaluate(async (b64) => {
      const im = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + b64; });
      const c = document.createElement('canvas');
      c.width = im.width; c.height = im.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(im, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
      for (let y = 0; y < c.height; y++) {
        for (let x = 0; x < c.width; x++) {
          if (d[(y * c.width + x) * 4 + 3] > 8) {
            if (x < x0) x0 = x; if (x > x1) x1 = x;
            if (y < y0) y0 = y; if (y > y1) y1 = y;
          }
        }
      }
      if (x1 < 0) return null;
      const o = document.createElement('canvas');
      o.width = x1 - x0 + 1; o.height = y1 - y0 + 1;
      o.getContext('2d').drawImage(c, -x0, -y0);
      return o.toDataURL('image/png').split(',')[1];
    }, b64);
    if (out) fs.writeFileSync(f, Buffer.from(out, 'base64'));
    console.log(`  crop: weapon_${name}_idle`);
  }
}

/* ---------- main ---------- */

(async () => {
  const step = process.argv[2] || 'all';
  const bal = await post('balance', { usd: 10.0 }, 'balance').catch(() => null);
  if (bal) console.log('Balance: $' + (bal.usd ?? JSON.stringify(bal)));

  if (step === 'weapons' || step === 'all') { console.log('— weapons —'); await stepWeapons(); }
  if (step === 'faces' || step === 'all') { console.log('— faces —'); await stepFaces(); }
  if (step === 'textures' || step === 'all') { console.log('— textures —'); await stepTextures(); }
  if (step === 'ui' || step === 'all') { console.log('— ui —'); await stepUi(); }
  if (step === 'crop' || step === 'all') { console.log('— crop —'); await stepCrop(); }

  const b2 = await post('balance', { usd: 10.0 }, 'balance').catch(() => null);
  if (b2) console.log('Τέλος. Balance: $' + (b2.usd ?? JSON.stringify(b2)));
  await closePage();
})().catch(e => { console.error(e); closePage().then(() => process.exit(1)); });
