/* DEAD ZONE — Οριστικό PixelLab asset pipeline (v2, docs-driven).
   Χτίζει ΟΛΗ την οπτική ταυτότητα από την αρχή με ενιαίο στυλ:

   - Όπλα/τοίχοι/faces/statusbar: pixflux με init_image (οι σωστές
     συνθέσεις καθοδηγούν, το PixelLab τις αποδίδει σε γνήσιο pixel art)
   - Εχθροί: fresh pixflux + animate-with-text (walk + death, 4 frames)
   - Pickups/projectiles/terminal: fresh pixflux
   - Autocrop με κοινό bbox ανά animation set

   Χρήση:
     PIXELLAB_API_KEY=... node scripts/gen-assets-v2.cjs [step|all]
     steps: guided, enemies, animations, props, crop

   Τα init sources διαβάζονται από .initsrc/ (ετοιμάζονται με
   scripts/prep-initsrc.sh ή υπάρχουν ήδη). Απαιτεί playwright στο
   NODE_PATH για επεξεργασία εικόνας. */

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

// ενιαίο στυλ σε όλα
const STYLE_TXT = ', retro DOOM style, dark gritty sci-fi';
const CHAR_STYLE = {
  outline: 'single color black outline',
  shading: 'detailed shading',
  detail: 'highly detailed',
};
const SURFACE_STYLE = {
  outline: 'lineless',
  shading: 'detailed shading',
  detail: 'highly detailed',
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

let _browser = null, _page = null;
async function getPage() {
  if (_page) return _page;
  const { chromium } = require('playwright');
  _browser = await require('playwright').chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium',
  });
  _page = await _browser.newPage();
  return _page;
}
async function closePage() { if (_browser) await _browser.close(); _browser = _page = null; }

/* NN resize/τοποθέτηση init εικόνας στο μέγεθος του canvas */
async function prepInit(file, w, h, mode) {
  const page = await getPage();
  const b64 = fs.readFileSync(file).toString('base64');
  return await page.evaluate(async ({ b64, w, h, mode }) => {
    const im = await new Promise((ok, err) => {
      const i = new Image(); i.onload = () => ok(i); i.onerror = err;
      i.src = 'data:image/png;base64,' + b64;
    });
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    if (mode === 'stretch') {
      ctx.drawImage(im, 0, 0, w, h);
    } else { // fit-bottom (όπλα: κάτω-κέντρο)
      const s = Math.min(w / im.width, h / im.height);
      const dw = im.width * s, dh = im.height * s;
      ctx.drawImage(im, (w - dw) / 2, h - dh, dw, dh);
    }
    return c.toDataURL('image/png').split(',')[1];
  }, { b64, w, h, mode });
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

function fresh(name, min) {
  const f = path.join(OUT, name + '.png');
  const lim = parseInt(process.env.SKIP_NEWER_MIN || '0', 10);
  if (!lim) return false;
  return fs.existsSync(f) && fs.statSync(f).mtimeMs > Date.now() - lim * 60000;
}

/* ---------- 1. GUIDED: όπλα, τοίχοι, statusbar, faces ---------- */
const WEAPONS = {
  pistol: 'compact semi-automatic pistol',
  smg: 'boxy compact submachine gun',
  shotgun: 'pump-action combat shotgun with wooden pump',
  handcannon: 'massive heavy revolver hand cannon',
  rifle: 'futuristic pulse rifle with glowing cyan energy coils',
  railgun: 'long twin-rail electromagnetic railgun with glowing cyan coils',
  incinerator: 'industrial flamethrower with orange fuel gauge and wide nozzle',
  arccaster: 'tesla lightning gun with two metal prongs and blue electric arcs',
  launcher: 'heavy plasma launcher with fat glowing cyan energy cylinder',
};
const TEXTURES = {
  hull: 'grey-blue metal wall panels with rivets and seams',
  hullBlood: 'grey-blue metal wall panels with large dried dark red blood splatter',
  vent: 'dark metal industrial ventilation grille with horizontal slats',
  tech: 'tech wall with small green computer screen, blinking lights, hanging cables',
  door: 'heavy metal sliding blast door with yellow black hazard stripes, central seam',
  elevator: 'metal elevator door in green light with large green down arrow',
  core: 'dark wall overgrown with glowing purple AI neural cables and nodes',
};
const FACES = {
  ok: 'calm alert expression',
  grin: 'grinning confidently',
  pain: 'grimacing in pain',
  low: 'badly wounded, bloody face',
  dead: 'dead, eyes closed, grey skin',
};

async function stepGuided() {
  for (const [n, desc] of Object.entries(WEAPONS)) {
    const out = `weapon_${n}_idle`;
    if (fresh(out)) { console.log(`  ${out}: skip`); continue; }
    const d = await post('generate-image-pixflux', {
      description: `first person view ${desc} held in two gloved hands, DOOM style FPS viewmodel, barrel pointing away from camera${STYLE_TXT}`,
      image_size: { width: 112, height: 80 },
      no_background: true,
      init_image: { type: 'base64', base64: await prepInit(path.join(SRC, out + '.png'), 112, 80, 'fit') },
      init_image_strength: 650,
      ...CHAR_STYLE, outline: 'selective outline',
    }, out);
    save(out, d.image.base64);
    console.log(`  ${out}: OK`);
    await sleep(1200);
  }
  for (const [n, desc] of Object.entries(TEXTURES)) {
    const out = `tex_${n}`;
    if (fresh(out)) { console.log(`  ${out}: skip`); continue; }
    const d = await post('generate-image-pixflux', {
      description: `seamless tileable sci-fi spaceship wall texture, ${desc}, fills entire image${STYLE_TXT}`,
      image_size: { width: 128, height: 128 },
      init_image: { type: 'base64', base64: await prepInit(path.join(SRC, out + '.png'), 128, 128, 'stretch') },
      init_image_strength: 450,
      ...SURFACE_STYLE,
    }, out);
    save(out, d.image.base64);
    console.log(`  ${out}: OK`);
    await sleep(1200);
  }
  if (!fresh('ui_statusbar')) {
    const d = await post('generate-image-pixflux', {
      description: `wide dark gunmetal FPS HUD status bar panel with rivets, beveled edges and recessed rectangular slots, DOOM style status bar background, no text, no icons${STYLE_TXT}`,
      image_size: { width: 320, height: 36 },
      init_image: { type: 'base64', base64: await prepInit(path.join(SRC, 'ui_statusbar.png'), 320, 36, 'stretch') },
      init_image_strength: 500,
      ...SURFACE_STYLE,
    }, 'ui_statusbar');
    save('ui_statusbar', d.image.base64);
    console.log('  ui_statusbar: OK');
  }
  for (const [n, desc] of Object.entries(FACES)) {
    const out = `face_${n}`;
    if (fresh(out)) { console.log(`  ${out}: skip`); continue; }
    const d = await post('generate-image-pixflux', {
      description: `HUD portrait of rugged male space marine head with short brown hair, ${desc}, front view, like DOOM status bar face${STYLE_TXT}`,
      image_size: { width: 40, height: 40 },
      no_background: true,
      init_image: { type: 'base64', base64: await prepInit(path.join(SRC, out + '.png'), 40, 40, 'stretch') },
      init_image_strength: 600,
      ...CHAR_STYLE,
    }, out);
    save(out, d.image.base64);
    console.log(`  ${out}: OK`);
    await sleep(1200);
  }
}

/* ---------- 2. ENEMIES: fresh pixflux 64x64 ---------- */
const ENEMIES = {
  shambler: 'rotten green cyber-zombie space crew member in torn grey jumpsuit, one glowing red eye, crude metal left arm',
  spitter: 'bloated yellow-green mutant with huge gaping toothy mouth dripping glowing acid',
  drone: 'small hovering security drone, dark metal sphere with single glowing red camera lens and small thrusters',
  heavy: 'hulking armored cyborg soldier in heavy grey plate armor with large orange-lit arm cannon',
  warden: 'elite cyborg prison warden in heavy orange armor plates, huge and menacing, arm cannon',
  boss: 'colossal rogue AI avatar, floating mechanical skull with glowing purple eyes, purple energy veins, thick cables hanging like tentacles',
};

async function stepEnemies() {
  for (const [n, desc] of Object.entries(ENEMIES)) {
    for (const [pose, poseTxt] of [['walk1', 'walking pose'], ['attack', 'attacking pose, aggressive']]) {
      const out = `enemy_${n}_${pose}`;
      if (fresh(out)) { console.log(`  ${out}: skip`); continue; }
      const d = await post('generate-image-pixflux', {
        description: `${desc}, ${poseTxt}, full body, facing the viewer${STYLE_TXT}`,
        image_size: { width: 64, height: 64 },
        no_background: true,
        view: 'side',
        direction: 'south',
        ...CHAR_STYLE,
      }, out);
      save(out, d.image.base64);
      console.log(`  ${out}: OK`);
      await sleep(1200);
    }
  }
}

/* ---------- 3. ANIMATIONS: walk + death ανά εχθρό ---------- */
async function stepAnimations() {
  for (const [n, desc] of Object.entries(ENEMIES)) {
    for (const [kind, action, outs] of [
      ['walk', 'walking', [1, 2, 3, 4].map(i => `enemy_${n}_walk${i}`)],
      ['die', 'dying, collapsing to the ground', [1, 2, 3, 4].map(i => `enemy_${n}_die${i}`)],
    ]) {
      if (fresh(outs[outs.length - 1])) { console.log(`  ${outs[0]}…: skip`); continue; }
      const ref = fs.readFileSync(path.join(OUT, `enemy_${n}_walk1.png`)).toString('base64');
      const d = await post('animate-with-text', {
        image_size: { width: 64, height: 64 },
        description: desc + STYLE_TXT,
        action,
        reference_image: { type: 'base64', base64: ref },
        view: 'side',
        direction: 'south',
      }, outs[0]);
      const frames = d.images || [];
      for (let i = 0; i < outs.length && i < frames.length; i++) {
        save(outs[i], frames[i].base64 || frames[i]);
      }
      console.log(`  ${action} × ${n}: ${frames.length} frames OK`);
      await sleep(1500);
    }
  }
}

/* ---------- 4. PROPS: pickups, projectiles, terminal ---------- */
const PICKUPS = {
  medkit: 'small white medkit box with red cross',
  rounds: 'small open box of rifle bullets',
  cells: 'small glowing blue energy cell battery pack',
  scrap: 'small pile of glowing cyan scrap metal',
  core: 'small glowing purple crystal shard',
};
const PROJ = {
  acid: 'small green dripping acid glob projectile, glowing',
  plasma: 'small bright cyan plasma ball projectile with glowing core',
  bolt: 'small red orange energy bolt projectile, glowing',
  flame: 'small orange yellow fireball projectile with flame trail',
};

async function stepProps() {
  for (const [n, desc] of Object.entries(PICKUPS)) {
    const out = `pickup_${n}`;
    if (fresh(out)) { console.log(`  ${out}: skip`); continue; }
    const d = await post('generate-image-pixflux', {
      description: `${desc}, videogame floor pickup item${STYLE_TXT}`,
      image_size: { width: 32, height: 32 },
      no_background: true,
      ...CHAR_STYLE,
    }, out);
    save(out, d.image.base64);
    console.log(`  ${out}: OK`);
    await sleep(1200);
  }
  for (const [n, desc] of Object.entries(PROJ)) {
    const out = `proj_${n}`;
    if (fresh(out)) { console.log(`  ${out}: skip`); continue; }
    const d = await post('generate-image-pixflux', {
      description: desc + STYLE_TXT,
      image_size: { width: 32, height: 32 },
      no_background: true,
      ...CHAR_STYLE,
    }, out);
    save(out, d.image.base64);
    console.log(`  ${out}: OK`);
    await sleep(1200);
  }
  if (!fresh('prop_terminal')) {
    const d = await post('generate-image-pixflux', {
      description: `small sci-fi supply vending terminal kiosk, dark metal body, glowing green screen, yellow keypad, standing on small legs, front view${STYLE_TXT}`,
      image_size: { width: 48, height: 64 },
      no_background: true,
      ...CHAR_STYLE,
    }, 'prop_terminal');
    save('prop_terminal', d.image.base64);
    console.log('  prop_terminal: OK');
  }
}

/* ---------- 5. CROP: κοινό bbox ανά set ---------- */
async function stepCrop() {
  const page = await getPage();
  const sets = [];
  for (const n of Object.keys(ENEMIES)) {
    sets.push([1, 2, 3, 4].map(i => `enemy_${n}_walk${i}`));
    sets.push([1, 2, 3, 4].map(i => `enemy_${n}_die${i}`));
    sets.push([`enemy_${n}_attack`]);
  }
  for (const n of Object.keys(PICKUPS)) sets.push([`pickup_${n}`]);
  for (const n of Object.keys(PROJ)) sets.push([`proj_${n}`]);
  sets.push(['prop_terminal']);
  for (const n of Object.keys(WEAPONS)) sets.push([`weapon_${n}_idle`]);
  for (const n of Object.keys(FACES)) sets.push([`face_${n}`]);

  for (const set of sets) {
    const files = set.filter(f => fs.existsSync(path.join(OUT, f + '.png')));
    if (!files.length) continue;
    const datas = files.map(f => fs.readFileSync(path.join(OUT, f + '.png')).toString('base64'));
    const out = await page.evaluate(async (datas) => {
      const cs = [];
      for (const b64 of datas) {
        const im = await new Promise((ok, err) => {
          const i = new Image(); i.onload = () => ok(i); i.onerror = err;
          i.src = 'data:image/png;base64,' + b64;
        });
        const c = document.createElement('canvas');
        c.width = im.width; c.height = im.height;
        c.getContext('2d').drawImage(im, 0, 0);
        cs.push(c);
      }
      let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
      for (const c of cs) {
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        for (let y = 0; y < c.height; y++)
          for (let x = 0; x < c.width; x++)
            if (d[(y * c.width + x) * 4 + 3] > 20) {
              if (x < x0) x0 = x; if (x > x1) x1 = x;
              if (y < y0) y0 = y; if (y > y1) y1 = y;
            }
      }
      if (x1 < 0) return null;
      return cs.map(c => {
        const o = document.createElement('canvas');
        o.width = x1 - x0 + 1; o.height = y1 - y0 + 1;
        o.getContext('2d').drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
        return o.toDataURL('image/png').split(',')[1];
      });
    }, datas);
    if (!out) continue;
    files.forEach((f, i) => save(f, out[i]));
    console.log(`  crop: ${files[0]} ×${files.length}`);
  }
}

async function balance() {
  try {
    const r = await fetch(`${API}/balance`, { headers: { Authorization: `Bearer ${KEY}` } });
    return (await r.json()).usd;
  } catch (e) { return '?'; }
}

(async () => {
  const what = process.argv[2] || 'all';
  fs.mkdirSync(OUT, { recursive: true });
  console.log(`Balance: $${await balance()}`);
  const steps = {
    guided: stepGuided, enemies: stepEnemies,
    animations: stepAnimations, props: stepProps, crop: stepCrop,
  };
  const order = what === 'all'
    ? ['guided', 'enemies', 'animations', 'props', 'crop'] : [what];
  for (const s of order) {
    console.log(`=== ${s} ===`);
    await steps[s]();
  }
  await closePage();
  console.log(`Τέλος. Balance: $${await balance()}`);
})().catch(async e => { console.error(e); await closePage(); process.exit(1); });
