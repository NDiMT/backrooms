/* DEAD ZONE v4 — συνέπεια εχθρών + νέο περιεχόμενο.

   1) attack animations για ΟΛΟΥΣ τους εχθρούς μέσω animate-with-text με
      reference το ΙΔΙΟ walk1 frame → ο εχθρός της επίθεσης είναι ίδιος
      χαρακτήρας με αυτόν της κίνησης (fix για ασυνέπεια).
   2) Δύο νέοι εχθροί (boomer, sentry) με πλήρη sets walk/die/attack.
   3) props: εκρηκτικό βαρέλι, εικονίδιο χειροβομβίδας.

   Χρήση: PIXELLAB_API_KEY=... node scripts/gen-assets-v4.cjs [step|all]
   steps: attacks, newenemies, props */

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
const CHAR = { outline: 'single color black outline', shading: 'detailed shading', detail: 'highly detailed' };
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

/* Το animate-with-text θέλει ΑΚΡΙΒΩΣ 64x64 — pad/fit το (κομμένο) walk1. */
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

function save(name, b64) {
  fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(b64, 'base64'));
}
function fresh(name) {
  const lim = parseInt(process.env.SKIP_NEWER_MIN || '0', 10);
  if (!lim) return false;
  const f = path.join(OUT, name + '.png');
  return fs.existsSync(f) && fs.statSync(f).mtimeMs > Date.now() - lim * 60000;
}

async function animate(refB64, desc, action, keyPrefix) {
  const r = await post('animate-with-text', {
    image_size: { width: 64, height: 64 },
    description: desc + STYLE,
    action,
    reference_image: { type: 'base64', base64: refB64 },
  }, keyPrefix);
  const frames = r.images || r.data && r.data.images;
  frames.forEach((img, i) => save(`${keyPrefix}${i + 1}`, img.base64));
  console.log(`  ✔ ${keyPrefix}1-${frames.length}`);
}

/* ---------- 1: attack animations από το ίδιο reference ---------- */

const ENEMIES = {
  shambler: ["undead cyborg crew member in a torn pale spacesuit with exposed wires",
    "attacking, lunging forward and slashing with both arms"],
  spitter: ["mutated crew member with bulging green acid sacs and a drooling maw",
    "attacking, rearing back and spitting a glob forward"],
  drone: ["small hovering security drone with a glowing red eye and small thrusters",
    "attacking, firing an energy bolt and recoiling"],
  heavy: ["hulking armored cyborg soldier with a heavy shoulder cannon",
    "attacking, aiming the shoulder cannon and firing with muzzle flash"],
  warden: ["tall elite cyborg warden with an orange visor and an energy staff",
    "attacking, swinging the energy staff and firing a blast"],
  boss: ["giant floating corrupted AI avatar skull with purple energy tendrils",
    "attacking, flaring its tendrils and casting a purple energy blast"],
};

async function stepAttacks() {
  for (const [name, [desc, action]] of Object.entries(ENEMIES)) {
    if (fresh(`enemy_${name}_attack4`)) { console.log(`  ${name}: πρόσφατο, skip`); continue; }
    const ref = await pad64(path.join(OUT, `enemy_${name}_walk1.png`));
    await animate(ref, desc, action, `enemy_${name}_attack`);
  }
}

/* ---------- 2: νέοι εχθροί ---------- */

const NEW_ENEMIES = {
  boomer: {
    desc: "bloated mutant crew member with glowing orange unstable chemical " +
      "tanks fused into a swollen torso, stumbling heavily",
    walk: "walking, stumbling heavily forward",
    die: "dying, collapsing to the ground",
    attack: "attacking, swelling up as the tanks glow brighter about to explode",
  },
  sentry: {
    desc: "hovering security turret drone, armored sphere with twin rotating " +
      "cannons and a red targeting eye, small downward thrusters",
    walk: "hovering in place, bobbing slightly, thrusters flickering",
    die: "dying, sparking, smoking and crashing to the ground",
    attack: "attacking, cannons spinning up and firing with muzzle flashes",
  },
};

async function stepNewEnemies() {
  for (const [name, d] of Object.entries(NEW_ENEMIES)) {
    let baseB64;
    if (fresh(`enemy_${name}_walk1`)) {
      console.log(`  enemy_${name}_walk1: πρόσφατο, skip`);
      baseB64 = await pad64(path.join(OUT, `enemy_${name}_walk1.png`));
    } else {
      const r = await post('generate-image-pixflux', {
        description: d.desc + ", full body, game enemy sprite" + STYLE,
        image_size: { width: 64, height: 64 },
        no_background: true,
        view: 'side',
        direction: 'south',
        ...CHAR,
      }, `enemy_${name}`);
      baseB64 = r.image.base64;
      save(`enemy_${name}_walk1`, baseB64);
      console.log(`  ✔ enemy_${name}_walk1 (βάση)`);
    }
    if (!fresh(`enemy_${name}_walk4`)) await animate(baseB64, d.desc, d.walk, `enemy_${name}_walk`);
    if (!fresh(`enemy_${name}_die4`)) await animate(baseB64, d.desc, d.die, `enemy_${name}_die`);
    if (!fresh(`enemy_${name}_attack4`)) await animate(baseB64, d.desc, d.attack, `enemy_${name}_attack`);
  }
}

/* ---------- 3: props ---------- */

async function stepProps() {
  if (!fresh('prop_barrel')) {
    const r = await post('generate-image-pixflux', {
      description: "explosive red metal fuel barrel with yellow hazard stripes " +
        "and a skull warning label, slightly dented" + STYLE,
      image_size: { width: 32, height: 48 },
      no_background: true,
      ...CHAR,
    }, 'prop_barrel');
    save('prop_barrel', r.image.base64);
    console.log('  ✔ prop_barrel');
  }
  if (!fresh('pickup_nade')) {
    const r = await post('generate-image-pixflux', {
      description: "sci-fi frag grenade, dark olive metal sphere with a green " +
        "LED band and a safety pin, game item icon" + STYLE,
      image_size: { width: 32, height: 32 },
      no_background: true,
      ...CHAR,
    }, 'pickup_nade');
    save('pickup_nade', r.image.base64);
    console.log('  ✔ pickup_nade');
  }
}

(async () => {
  const step = process.argv[2] || 'all';
  if (step === 'attacks' || step === 'all') { console.log('— attacks —'); await stepAttacks(); }
  if (step === 'newenemies' || step === 'all') { console.log('— new enemies —'); await stepNewEnemies(); }
  if (step === 'props' || step === 'all') { console.log('— props —'); await stepProps(); }
  const b = await post('balance', { usd: 10.0 }, 'balance').catch(() => null);
  if (b) console.log('Τέλος. Balance: $' + (b.usd ?? JSON.stringify(b)));
  await closePage();
})().catch(e => { console.error(e); closePage().then(() => process.exit(1)); });
