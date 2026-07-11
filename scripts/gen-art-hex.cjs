/* DRIFTLAND v2 — Isometric hex art direction (οριστικό pipeline).

   Tiles: χρωματιστός γεωμετρικός οδηγός hex prism → pixflux @120 →
   προγραμματιστικό clip στο ακριβές εξάγωνο + σκίαση/outline. Ίδιο
   silhouette για όλα τα terrains = τέλειο πλέγμα.
   Χαρακτήρες: chunky chibi στυλ, walk cycles με τη συνταγή συνέπειας
   (igs 3.0, direction, color_image, inpaint anchor), κατευθύνσεις
   μέσω /rotate.

   Χρήση: PIXELLAB_API_KEY=... node scripts/gen-art-hex.cjs [step|all]
   steps: tiles, props, hero, mobs, ui */

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
const API = 'https://api.pixellab.ai/v1';
const STYLE = ', polished detailed pixel art game asset, vibrant tropical colors';
const CHONK = 'cute chunky blocky chibi proportions, oversized head, stubby body, ';
const NEG = 'changing colors, different character, morphing, extra limbs, ' +
  'large glowing effects, motion blur, text, watermark';
const sleep = ms => new Promise(r => setTimeout(r, ms));

fs.mkdirSync(OUT, { recursive: true });

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

async function post(endpoint, body, label) {
  for (let attempt = 0; attempt < 5; attempt++) {
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

/* ---------- κοινή γεωμετρία hex prism (καμβάς 112x144) ---------- */
const GEO = `
  const W = 112, H = 144;
  const cx = W / 2, s = 48, k = 0.58;
  const hw = Math.sqrt(3) / 2 * s;
  const topY = 8, topH = 2 * s * k, depth = 26;
  const pts = [
    [cx, topY], [cx + hw, topY + topH * 0.25], [cx + hw, topY + topH * 0.75],
    [cx, topY + topH], [cx - hw, topY + topH * 0.75], [cx - hw, topY + topH * 0.25],
  ];
  function prismPath(x) {
    x.beginPath();
    x.moveTo(...pts[0]); x.lineTo(...pts[1]); x.lineTo(...pts[2]);
    x.lineTo(pts[2][0], pts[2][1] + depth);
    x.lineTo(pts[3][0], pts[3][1] + depth);
    x.lineTo(pts[4][0], pts[4][1] + depth);
    x.lineTo(...pts[4]); x.lineTo(...pts[5]);
    x.closePath();
  }
  function topPath(x) {
    x.beginPath();
    x.moveTo(...pts[0]);
    for (let i = 1; i < 6; i++) x.lineTo(...pts[i]);
    x.closePath();
  }
`;

async function hexGuide(top, sideL, sideR) {
  const page = await getPage();
  return page.evaluate(new Function('c0', GEO + `
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.fillStyle = c0.sideL;
    x.beginPath(); x.moveTo(...pts[4]); x.lineTo(...pts[3]);
    x.lineTo(pts[3][0], pts[3][1] + depth); x.lineTo(pts[4][0], pts[4][1] + depth);
    x.closePath(); x.fill();
    x.fillStyle = c0.sideR;
    x.beginPath(); x.moveTo(...pts[3]); x.lineTo(...pts[2]);
    x.lineTo(pts[2][0], pts[2][1] + depth); x.lineTo(pts[3][0], pts[3][1] + depth);
    x.closePath(); x.fill();
    x.fillStyle = c0.top;
    topPath(x); x.fill();
    return c.toDataURL('image/png').split(',')[1];
  `), { top, sideL, sideR });
}

async function clipHex(b64) {
  const page = await getPage();
  return page.evaluate(new Function('b64', GEO + `
    return (async () => {
      const im = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + b64; });
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const x = c.getContext('2d');
      x.save(); prismPath(x); x.clip();
      x.drawImage(im, 0, 0);
      x.restore();
      x.save();
      x.beginPath();
      x.moveTo(...pts[4]); x.lineTo(...pts[3]);
      x.lineTo(pts[3][0], pts[3][1] + depth); x.lineTo(pts[4][0], pts[4][1] + depth);
      x.closePath(); x.fillStyle = 'rgba(0,0,0,0.18)'; x.fill();
      x.beginPath();
      x.moveTo(...pts[3]); x.lineTo(...pts[2]);
      x.lineTo(pts[2][0], pts[2][1] + depth); x.lineTo(pts[3][0], pts[3][1] + depth);
      x.closePath(); x.fillStyle = 'rgba(0,0,0,0.32)'; x.fill();
      x.restore();
      x.strokeStyle = 'rgba(16,18,24,0.9)'; x.lineWidth = 2;
      prismPath(x); x.stroke();
      topPath(x); x.stroke();
      return c.toDataURL('image/png').split(',')[1];
    })();
  `), b64);
}

async function pad64b64(b64) {
  const page = await getPage();
  return page.evaluate(async (b64) => {
    const im = await new Promise((ok, err) => {
      const i = new Image(); i.onload = () => ok(i); i.onerror = err;
      i.src = 'data:image/png;base64,' + b64;
    });
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    const s = Math.min(64 / im.width, 64 / im.height, 1);
    const dw = Math.round(im.width * s), dh = Math.round(im.height * s);
    x.drawImage(im, (64 - dw) >> 1, 64 - dh, dw, dh);
    return c.toDataURL('image/png').split(',')[1];
  }, b64);
}

/* ---------- TILES ---------- */

const TILES = {
  hex_water_deep: {
    guide: ['#1d6f9a', '#134a68', '#0f3c55'],
    desc: "isometric hexagonal deep ocean tile: dark blue water with faint " +
      "big wave shapes and sparse foam on top, near-black depths on the sides",
  },
  hex_water: {
    guide: ['#3fc8d8', '#1d6f9a', '#175a80'],
    desc: "isometric hexagonal sea tile: sparkling turquoise ocean water with " +
      "foam rings, ripples and light reflections on top, deep blue gradient " +
      "sides with bubbles",
  },
  hex_sand: {
    guide: ['#e8d29a', '#b09055', '#93753f'],
    desc: "isometric hexagonal beach tile: warm bright sand with ripple lines, " +
      "tiny shells and pebbles on top, compact wet sand layers on the sides",
  },
  hex_grass: {
    guide: ['#5cae3a', '#7a5a34', '#5f4527'],
    desc: "isometric hexagonal terrain tile: dense lush tropical grass with " +
      "visible blades, tiny flowers and leaf clumps on top, rich layered soil " +
      "with roots and embedded stones on the sides",
  },
  hex_jungle: {
    guide: ['#33702a', '#4c3a22', '#3a2c18'],
    desc: "isometric hexagonal jungle tile: dark dense tropical undergrowth " +
      "with big leaves, ferns and moss on top, dark wet soil with thick roots " +
      "on the sides",
  },
  hex_rock: {
    guide: ['#8b8c86', '#6b6c66', '#54554f'],
    desc: "isometric hexagonal rocky tile: cracked gray stone slabs with " +
      "pebbles and small crystals on top, layered rock strata on the sides",
  },
};

async function stepTiles() {
  for (const [name, t] of Object.entries(TILES)) {
    if (fresh(name)) { console.log(`  ${name}: πρόσφατο, skip`); continue; }
    const guide = await hexGuide(...t.guide);
    const r = await post('generate-image-pixflux', {
      description: t.desc + ", highly textured" + STYLE,
      image_size: { width: 112, height: 144 },
      no_background: true,
      isometric: true,
      outline: 'selective outline',
      shading: 'detailed shading',
      detail: 'highly detailed',
      init_image: { type: 'base64', base64: guide },
      init_image_strength: 120,
      seed: 11,
    }, name);
    save(name, await clipHex(r.image.base64));
    console.log(`  ✔ ${name}`);
  }
}

/* ---------- PROPS (chunky, χωρίς βάση) ---------- */

const PROPS = [
  ['prop_tree', "stylized chunky tropical tree: thick short trunk, big rounded " +
    "blocky canopy of layered vivid leaves", 96, 112],
  ['prop_palm', "stylized chunky palm tree: curved thick trunk, big blocky " +
    "fronds and coconuts", 96, 112],
  ['prop_rock', "chunky gray boulder with cracks, moss patches and a small " +
    "crystal", 64, 56],
  ['prop_bush', "chunky round berry bush with big vivid leaves and fat red " +
    "berries", 64, 56],
  ['prop_driftwood', "small pile of chunky weathered driftwood planks and a " +
    "rope", 64, 48],
  ['prop_wreck', "chunky broken wooden shipwreck bow stuck in sand, torn white " +
    "sail, barnacles", 112, 96],
  ['prop_campfire', "chunky campfire: ring of fat stones with big lively " +
    "orange flames", 64, 64],
  ['prop_campfire2', "chunky campfire: ring of fat stones with big lively " +
    "orange flames leaning sideways", 64, 64],
  ['prop_workbench', "chunky wooden crafting workbench with fat legs, hammer " +
    "and rope on top", 80, 64],
  ['prop_wall', "chunky wooden palisade wall segment: fat sharpened logs " +
    "lashed with rope", 64, 72],
  ['prop_chest', "chunky wooden storage chest with fat metal bands and big " +
    "lock", 64, 56],
  ['prop_bed', "chunky simple castaway bed: wooden frame with palm leaves and " +
    "folded cloth", 64, 64],
  ['prop_raft1', "chunky log raft base under construction: a few fat logs " +
    "lashed with rope", 96, 64],
  ['prop_raft2', "chunky half-built wooden raft with plank deck", 96, 64],
  ['prop_raft3', "chunky wooden raft with deck and bare mast pole", 96, 88],
  ['prop_raft4', "chunky completed escape raft with mast, white sail and " +
    "rudder, heroic", 96, 96],
];

async function stepProps() {
  for (const [k, d, w, h] of PROPS) {
    if (fresh(k)) { console.log(`  ${k}: πρόσφατο, skip`); continue; }
    const r = await post('generate-image-pixflux', {
      description: d + ", standing alone on transparent background, no ground " +
        "base" + STYLE,
      image_size: { width: w, height: h },
      no_background: true,
      isometric: true,
      outline: 'selective outline',
      shading: 'detailed shading',
      detail: 'highly detailed',
      seed: 11,
    }, k);
    save(k, r.image.base64);
    console.log(`  ✔ ${k}`);
  }
}

/* ---------- HERO (chunky, 3 κατευθύνσεις) ---------- */

const HERO_DESC = CHONK + "castaway survivor: oversized square head with messy " +
  "dark hair and stubble, big expressive eyes, ragged white shirt, brown " +
  "shorts, barefoot";

async function stepHero() {
  let south;
  if (fresh('hero_south_walk1')) {
    south = fs.readFileSync(path.join(OUT, 'hero_south_walk1.png')).toString('base64');
    console.log('  hero βάση: πρόσφατη, skip');
  } else {
    const r = await post('generate-image-pixflux', {
      description: HERO_DESC + ", standing, full body" + STYLE,
      image_size: { width: 64, height: 64 },
      no_background: true,
      isometric: true,
      view: 'low top-down',
      direction: 'south',
      outline: 'single color black outline',
      shading: 'detailed shading',
      detail: 'highly detailed',
      seed: 11,
    }, 'hero_base');
    south = r.image.base64;
    save('hero_south_walk1', south);
    console.log('  ✔ hero βάση (νότια)');
  }

  const dirs = { south };
  for (const dir of ['north', 'east']) {
    const key = `hero_${dir}_walk1`;
    if (fresh(key)) {
      dirs[dir] = fs.readFileSync(path.join(OUT, key + '.png')).toString('base64');
      console.log(`  ${key}: πρόσφατο, skip`);
      continue;
    }
    const r = await post('rotate', {
      image_size: { width: 64, height: 64 },
      from_view: 'low top-down', to_view: 'low top-down',
      from_direction: 'south', to_direction: dir,
      image_guidance_scale: 4.0,
      from_image: { type: 'base64', base64: south },
      color_image: { type: 'base64', base64: south },
      seed: 11,
    }, key);
    dirs[dir] = r.image.base64;
    save(key, dirs[dir]);
    console.log(`  ✔ ${key} (rotate)`);
  }

  for (const [dir, ref] of Object.entries(dirs)) {
    if (fresh(`hero_${dir}_walk4`)) { console.log(`  hero_${dir}_walk: πρόσφατο, skip`); continue; }
    const r = await post('animate-with-text', {
      image_size: { width: 64, height: 64 },
      description: HERO_DESC + STYLE,
      negative_description: NEG,
      action: 'walking forward',
      view: 'low top-down',
      direction: dir,
      image_guidance_scale: 3.0,
      reference_image: { type: 'base64', base64: ref },
      color_image: { type: 'base64', base64: ref },
      inpainting_images: [{ type: 'base64', base64: ref }, null, null, null],
      seed: 7,
    }, `hero_${dir}_walk`);
    const frames = r.images || (r.data && r.data.images);
    frames.forEach((img, i) => save(`hero_${dir}_walk${i + 1}`, img.base64));
    console.log(`  ✔ hero_${dir}_walk1-${frames.length}`);
  }
}

/* ---------- MOBS (chunky) ---------- */

const MOBS = {
  crab: CHONK + "beach crab: fat bright red-orange body, big oversized " +
    "pincers, tiny legs, cute angry eyes",
  boar: CHONK + "wild boar: fat brown bristly body, big head with white " +
    "tusks, tiny legs",
  shade: CHONK + "night wraith: round dark smoky blob body with wispy tendrils " +
    "and big glowing white eyes",
};

async function stepMobs() {
  for (const [name, desc] of Object.entries(MOBS)) {
    let base;
    const baseKey = `mob_${name}_walk1`;
    if (fresh(baseKey)) {
      base = fs.readFileSync(path.join(OUT, baseKey + '.png')).toString('base64');
      console.log(`  ${baseKey}: πρόσφατο, skip`);
    } else {
      const r = await post('generate-image-pixflux', {
        description: desc + ", full body" + STYLE,
        image_size: { width: 64, height: 64 },
        no_background: true,
        isometric: true,
        view: 'low top-down',
        direction: 'east',
        outline: 'single color black outline',
        shading: 'detailed shading',
        detail: 'highly detailed',
        seed: 11,
      }, baseKey);
      base = r.image.base64;
      save(baseKey, base);
      console.log(`  ✔ ${baseKey}`);
    }
    if (fresh(`mob_${name}_walk4`)) { console.log(`  mob_${name}_walk: πρόσφατο, skip`); continue; }
    base = await pad64b64(base);
    const r2 = await post('animate-with-text', {
      image_size: { width: 64, height: 64 },
      description: desc + STYLE,
      negative_description: NEG,
      action: name === 'shade' ? 'floating, drifting, wisps swaying' : 'walking forward',
      view: 'low top-down',
      direction: 'east',
      image_guidance_scale: 3.0,
      reference_image: { type: 'base64', base64: base },
      color_image: { type: 'base64', base64: base },
      inpainting_images: [{ type: 'base64', base64: base }, null, null, null],
      seed: 7,
    }, `mob_${name}_walk`);
    const frames = r2.images || (r2.data && r2.data.images);
    frames.forEach((img, i) => save(`mob_${name}_walk${i + 1}`, img.base64));
    console.log(`  ✔ mob_${name}_walk1-${frames.length}`);
  }
}

/* ---------- UI ---------- */

async function stepUi() {
  if (!fresh('ui_titlebg')) {
    const r = await post('generate-image-pixflux', {
      description: "beautiful isometric view of a small hexagonal tropical " +
        "island floating on turquoise sea at sunrise, chunky stylized palm " +
        "trees, a wooden shipwreck on the beach, dramatic warm sky, cinematic " +
        "polished pixel art scene, no text",
      image_size: { width: 240, height: 400 },
      no_background: false,
      isometric: true,
      outline: 'lineless',
      shading: 'detailed shading',
      detail: 'highly detailed',
      seed: 11,
    }, 'ui_titlebg');
    save('ui_titlebg', r.image.base64);
    console.log('  ✔ ui_titlebg');
  }
  if (!fresh('ui_appicon')) {
    const r = await post('generate-image-pixflux', {
      description: "square game icon: single isometric hexagonal island tile " +
        "with a chunky palm tree and a tiny raft floating beside it on " +
        "turquoise sea, bold shapes, no text",
      image_size: { width: 128, height: 128 },
      no_background: false,
      isometric: true,
      outline: 'lineless',
      shading: 'detailed shading',
      detail: 'highly detailed',
      seed: 11,
    }, 'ui_appicon');
    save('ui_appicon', r.image.base64);
    console.log('  ✔ ui_appicon');
  }
}

(async () => {
  const step = process.argv[2] || 'all';
  if (step === 'tiles' || step === 'all') { console.log('— tiles —'); await stepTiles(); }
  if (step === 'props' || step === 'all') { console.log('— props —'); await stepProps(); }
  if (step === 'hero' || step === 'all') { console.log('— hero —'); await stepHero(); }
  if (step === 'mobs' || step === 'all') { console.log('— mobs —'); await stepMobs(); }
  if (step === 'ui' || step === 'all') { console.log('— ui —'); await stepUi(); }
  const b = await post('balance', { usd: 10.0 }, 'balance').catch(() => null);
  if (b) console.log('Τέλος. Balance: $' + (b.usd ?? JSON.stringify(b)));
  await closePage();
})().catch(e => { console.error(e); closePage().then(() => process.exit(1)); });
