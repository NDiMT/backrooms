/* DEAD ZONE v5 — Συνεπή enemy animations με τα σωστά controls του
   animate-with-text (fix για παραμόρφωση/αλλαγή χαρακτήρα ανά frame):

   - image_guidance_scale 3.0 (default 1.4 → χαλαρή προσκόλληση = morphing)
   - direction 'south' (τα sprites κοιτούν νότια — το default 'east'
     πολεμούσε το reference)
   - color_image = reference (κλείδωμα παλέτας)
   - negative_description κατά morphing/χρωματικών αλλαγών
   - inpainting_images[0] = reference (το frame 1 αγκυρώνεται στη βάση)
   - σταθερό seed για αναπαραγωγιμότητα

   Ξαναχτίζει walk/die για όλους τους εχθρούς + attack για όσους έχουν
   AI attack set. Χρήση:
     PIXELLAB_API_KEY=... node scripts/gen-assets-v5.cjs */

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
const STYLE = ', retro DOOM style, dark gritty sci-fi';
const NEG = 'changing colors, different character, morphing, extra limbs, ' +
  'large glowing effects, motion blur';
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

async function pad64(file) {
  const page = await getPage();
  const b64 = fs.readFileSync(file).toString('base64');
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

async function animate(refB64, desc, action, keyPrefix, negOverride) {
  const r = await post('animate-with-text', {
    image_size: { width: 64, height: 64 },
    description: desc + STYLE,
    negative_description: negOverride !== undefined ? negOverride : NEG,
    action,
    view: 'side',
    direction: 'south',
    image_guidance_scale: 3.0,
    reference_image: { type: 'base64', base64: refB64 },
    color_image: { type: 'base64', base64: refB64 },
    inpainting_images: [{ type: 'base64', base64: refB64 }, null, null, null],
    seed: 7,
  }, keyPrefix);
  const frames = r.images || (r.data && r.data.images);
  frames.forEach((img, i) => fs.writeFileSync(
    path.join(OUT, `${keyPrefix}${i + 1}.png`), Buffer.from(img.base64, 'base64')));
  console.log(`  ✔ ${keyPrefix}1-${frames.length}`);
}

// Στα die frames ΔΕΝ αγκυρώνουμε το frame 1 στο όρθιο reference και
// επιτρέπουμε την «παραμόρφωση» της κατάρρευσης.
async function animateDie(refB64, desc, action, keyPrefix) {
  const r = await post('animate-with-text', {
    image_size: { width: 64, height: 64 },
    description: desc + STYLE,
    negative_description: 'changing colors, different character, large glowing effects',
    action,
    view: 'side',
    direction: 'south',
    image_guidance_scale: 3.0,
    reference_image: { type: 'base64', base64: refB64 },
    color_image: { type: 'base64', base64: refB64 },
    seed: 7,
  }, keyPrefix);
  const frames = r.images || (r.data && r.data.images);
  frames.forEach((img, i) => fs.writeFileSync(
    path.join(OUT, `${keyPrefix}${i + 1}.png`), Buffer.from(img.base64, 'base64')));
  console.log(`  ✔ ${keyPrefix}1-${frames.length}`);
}

const ENEMIES = {
  shambler: {
    desc: "undead cyborg crew member in a torn pale spacesuit with exposed wires",
    walk: "walking forward, shambling",
    die: "dying, collapsing to the ground",
  },
  spitter: {
    desc: "mutated crew member with bulging green acid sacs and a drooling maw",
    walk: "walking forward, hunched lurching",
    die: "dying, collapsing to the ground",
    attack: "attacking, rearing back and spitting a glob forward",
  },
  drone: {
    desc: "small hovering security drone with a glowing red eye and small thrusters",
    walk: "hovering in place, bobbing gently, thrusters flickering",
    die: "dying, sparking and crashing to the ground",
    attack: "attacking, firing an energy bolt and recoiling slightly",
  },
  heavy: {
    desc: "hulking armored cyborg soldier with a heavy shoulder cannon",
    walk: "walking forward, heavy stomping",
    die: "dying, collapsing to the ground",
  },
  warden: {
    desc: "tall elite cyborg warden with an orange visor and an energy staff",
    walk: "walking forward, imposing stride",
    die: "dying, collapsing to the ground",
  },
  boss: {
    desc: "giant floating corrupted AI avatar skull with purple energy tendrils",
    walk: "hovering, bobbing slowly, tendrils swaying",
    die: "dying, cracking apart and sinking down",
    attack: "attacking, tendrils flaring and casting a small purple blast",
  },
  boomer: {
    desc: "bloated mutant crew member with glowing orange unstable chemical " +
      "tanks fused into a swollen torso",
    walk: "walking forward, stumbling heavily",
    die: "dying, collapsing to the ground",
    attack: "attacking, swelling up as the tanks glow brighter",
  },
  sentry: {
    desc: "hovering security turret drone, dark gunmetal armored sphere with " +
      "twin small gun barrels underneath and one glowing red eye lens",
    walk: "hovering in place, bobbing gently, thrusters flickering",
    die: "dying, sparking and crashing to the ground",
  },
};

(async () => {
  for (const [name, d] of Object.entries(ENEMIES)) {
    console.log(`— ${name} —`);
    const ref = await pad64(path.join(OUT, `enemy_${name}_walk1.png`));
    await animate(ref, d.desc, d.walk, `enemy_${name}_walk`);
    await animateDie(ref, d.desc, d.die, `enemy_${name}_die`);
    if (d.attack) await animate(ref, d.desc, d.attack, `enemy_${name}_attack`);
  }
  const b = await post('balance', { usd: 10.0 }, 'balance').catch(() => null);
  if (b) console.log('Τέλος. Balance: $' + (b.usd ?? JSON.stringify(b)));
  await closePage();
})().catch(e => { console.error(e); closePage().then(() => process.exit(1)); });
