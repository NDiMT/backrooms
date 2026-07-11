/* DRIFTLAND — PixelLab art pipeline (νησί ναυαγού, top-down survival).

   Στηρίζεται στη δοκιμασμένη συνταγή συνέπειας για animations:
   image_guidance_scale 3.0, ρητό direction, color_image (κλείδωμα
   παλέτας), negative_description, inpainting anchor στο frame 1.
   Ο ήρωας γυρίζει σε 3 κατευθύνσεις μέσω /rotate και κάθε κατεύθυνση
   παίρνει δικό της walk cycle (η δύση είναι mirror της ανατολής).

   Χρήση: PIXELLAB_API_KEY=... node scripts/gen-art.cjs [step|all]
   steps: tiles, props, hero, mobs, icons, ui */

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
const STYLE = ', vibrant tropical pixel art, game asset';
const NEG = 'changing colors, different character, morphing, extra limbs, ' +
  'large glowing effects, motion blur, text, watermark';
const sleep = ms => new Promise(r => setTimeout(r, ms));

fs.mkdirSync(OUT, { recursive: true });

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

const SURF = { outline: 'lineless', shading: 'detailed shading', detail: 'highly detailed' };
const CHAR = { outline: 'single color black outline', shading: 'medium shading', detail: 'medium detail' };

/* Το animate-with-text απαιτεί ΑΚΡΙΒΩΣ 64x64 reference. */
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
async function pad64b64(b64) {
  const page = await getPage();
  return page.evaluate(async (b64) => {
    const im = await new Promise((ok, err) => {
      const i = new Image(); i.onload = () => ok(i); i.onerror = err;
      i.src = 'data:image/png;base64,' + b64;
    });
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const s = Math.min(64 / im.width, 64 / im.height, 1);
    const dw = Math.round(im.width * s), dh = Math.round(im.height * s);
    ctx.drawImage(im, (64 - dw) >> 1, 64 - dh, dw, dh);
    return c.toDataURL('image/png').split(',')[1];
  }, b64);
}

async function gen(name, desc, w, h, opts) {
  if (fresh(name)) { console.log(`  ${name}: πρόσφατο, skip`); return null; }
  const r = await post('generate-image-pixflux', {
    description: desc + STYLE,
    image_size: { width: w, height: h },
    ...opts,
  }, name);
  save(name, r.image.base64);
  console.log(`  ✔ ${name}`);
  return r.image.base64;
}

/* ---------- TILES (top-down, tileable) ---------- */

const TILES = {
  tile_water: "seamless tileable texture of tropical turquoise sea water with gentle wave ripples, top-down view",
  tile_water_deep: "seamless tileable texture of deep blue ocean water, darker, top-down view",
  tile_sand: "seamless tileable texture of bright warm beach sand with a few tiny shells, top-down view",
  tile_grass: "seamless tileable texture of lush green tropical grass meadow, top-down view",
  tile_jungle: "seamless tileable texture of dark dense jungle undergrowth with roots and big leaves, top-down view",
  tile_rock: "seamless tileable texture of gray rocky mountain ground with cracks, top-down view",
};

async function stepTiles() {
  for (const [k, d] of Object.entries(TILES)) {
    await gen(k, d, 64, 64, { no_background: false, view: 'high top-down', ...SURF });
  }
}

/* ---------- PROPS ---------- */

const PROPS = [
  ['prop_palm', "tall tropical palm tree with coconuts and curved trunk, full standing tree", 48, 64],
  ['prop_tree', "leafy round tropical tree with thick trunk, full standing tree", 48, 64],
  ['prop_rock', "single gray boulder with a bit of moss", 32, 32],
  ['prop_bush', "green round bush full of ripe red berries", 32, 32],
  ['prop_driftwood', "small pile of weathered driftwood planks", 32, 32],
  ['prop_wreck', "broken wooden shipwreck bow stuck in the sand, torn sail", 64, 48],
  ['prop_campfire', "burning campfire inside a ring of stones, warm flames", 32, 32],
  ['prop_campfire2', "burning campfire inside a ring of stones, flames leaning to the side", 32, 32],
  ['prop_firepit', "extinguished campfire ring of stones with charred wood, no flames", 32, 32],
  ['prop_workbench', "rustic wooden crafting workbench with a hammer and rope on it", 40, 32],
  ['prop_wall', "wooden palisade wall segment of sharpened logs lashed with rope", 32, 32],
  ['prop_chest', "small wooden storage chest with metal bands, closed", 32, 32],
  ['prop_bed', "simple castaway bed of palm leaves and folded cloth on a wooden frame", 32, 40],
  ['prop_raft1', "raft under construction: a few logs lashed together with rope, on sand", 64, 48],
  ['prop_raft2', "half-built wooden raft with a deck platform of planks, on sand", 64, 48],
  ['prop_raft3', "wooden raft with deck and a bare mast pole, nearly complete, on sand", 64, 48],
  ['prop_raft4', "completed escape raft with mast, white cloth sail and rudder, heroic", 64, 56],
];

async function stepProps() {
  for (const [k, d, w, h] of PROPS) {
    await gen(k, d, w, h, { no_background: true, view: 'side', ...CHAR });
  }
}

/* ---------- HERO: βάση νότια → rotate → walk ανά κατεύθυνση ---------- */

const HERO_DESC = "shipwrecked castaway survivor man with short messy dark " +
  "hair and stubble, ragged white shirt, rolled-up brown trousers, barefoot";

async function animateDir(refB64, desc, action, dir, keyPrefix) {
  if (fresh(`${keyPrefix}4`)) { console.log(`  ${keyPrefix}: πρόσφατο, skip`); return; }
  const r = await post('animate-with-text', {
    image_size: { width: 64, height: 64 },
    description: desc + STYLE,
    negative_description: NEG,
    action,
    view: 'low top-down',
    direction: dir,
    image_guidance_scale: 3.0,
    reference_image: { type: 'base64', base64: refB64 },
    color_image: { type: 'base64', base64: refB64 },
    inpainting_images: [{ type: 'base64', base64: refB64 }, null, null, null],
    seed: 7,
  }, keyPrefix);
  const frames = r.images || (r.data && r.data.images);
  frames.forEach((img, i) => save(`${keyPrefix}${i + 1}`, img.base64));
  console.log(`  ✔ ${keyPrefix}1-${frames.length}`);
}

async function stepHero() {
  let south;
  if (fresh('hero_south_walk1') && fs.existsSync(path.join(OUT, 'hero_south_walk1.png'))) {
    south = fs.readFileSync(path.join(OUT, 'hero_south_walk1.png')).toString('base64');
    console.log('  hero βάση: πρόσφατη, skip');
  } else {
    const r = await post('generate-image-pixflux', {
      description: HERO_DESC + ", standing, full body, game character sprite" + STYLE,
      image_size: { width: 64, height: 64 },
      no_background: true,
      view: 'low top-down',
      direction: 'south',
      ...CHAR,
    }, 'hero_base');
    south = r.image.base64;
    save('hero_south_walk1', south);
    console.log('  ✔ hero βάση (νότια)');
  }

  // rotate σε north + east με την ίδια παλέτα
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
      seed: 7,
    }, key);
    dirs[dir] = r.image.base64;
    save(key, dirs[dir]);
    console.log(`  ✔ ${key} (rotate)`);
  }

  for (const [dir, ref] of Object.entries(dirs)) {
    await animateDir(ref, HERO_DESC, 'walking forward', dir, `hero_${dir}_walk`);
  }
}

/* ---------- MOBS (side view, mirror για δύση) ---------- */

const MOBS = {
  crab: "small bright red beach crab with big pincers",
  boar: "wild brown boar with white tusks and bristly fur",
  shade: "dark shadowy night wraith with wispy smoke body and glowing white eyes",
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
        description: desc + ", full body, game creature sprite" + STYLE,
        image_size: { width: 48, height: 48 },
        no_background: true,
        view: 'side',
        direction: 'east',
        ...CHAR,
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
      view: 'side',
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

/* ---------- ITEM ICONS ---------- */

const ICONS = {
  icon_wood: "a few stacked wooden logs",
  icon_stone: "a couple of gray stones",
  icon_fiber: "bundle of dry plant fibers tied together",
  icon_berry: "cluster of ripe red berries",
  icon_meat_raw: "raw red meat steak",
  icon_meat_cooked: "grilled brown meat steak on a stick",
  icon_metal: "rusty bent scrap metal piece",
  icon_resin: "amber drop of sticky tree resin",
  icon_rope: "coiled rope",
  icon_cloth: "folded piece of white cloth",
  icon_axe: "stone axe with wooden handle",
  icon_pickaxe: "stone pickaxe with wooden handle",
  icon_spear: "wooden spear with sharpened stone tip",
  icon_torch: "burning wooden torch",
};

async function stepIcons() {
  for (const [k, d] of Object.entries(ICONS)) {
    await gen(k, d + ", game inventory item icon, centered", 32, 32,
      { no_background: true, ...CHAR });
  }
}

/* ---------- UI ---------- */

async function stepUi() {
  await gen('ui_titlebg',
    "beautiful tropical island beach at sunrise seen from the sea, a wooden " +
    "shipwreck on the shore, palm trees, calm turquoise water, dramatic warm " +
    "sky, cinematic pixel art scene, no text", 240, 400,
    { no_background: false, ...SURF });
  await gen('ui_appicon',
    "square game icon: a small wooden raft with a white sail on turquoise sea " +
    "in front of a tropical island with a palm tree, bold shapes, no text",
    128, 128, { no_background: false, ...SURF });
}

(async () => {
  const step = process.argv[2] || 'all';
  if (step === 'tiles' || step === 'all') { console.log('— tiles —'); await stepTiles(); }
  if (step === 'props' || step === 'all') { console.log('— props —'); await stepProps(); }
  if (step === 'hero' || step === 'all') { console.log('— hero —'); await stepHero(); }
  if (step === 'mobs' || step === 'all') { console.log('— mobs —'); await stepMobs(); }
  if (step === 'icons' || step === 'all') { console.log('— icons —'); await stepIcons(); }
  if (step === 'ui' || step === 'all') { console.log('— ui —'); await stepUi(); }
  const b = await post('balance', { usd: 10.0 }, 'balance').catch(() => null);
  if (b) console.log('Τέλος. Balance: $' + (b.usd ?? JSON.stringify(b)));
})().catch(e => { console.error(e); process.exit(1); });
