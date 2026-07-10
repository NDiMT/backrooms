/* DEAD ZONE — PixelLab asset generator.
   Παράγει ΟΛΑ τα sprites/textures με το PixelLab API (true pixel art,
   native διαφάνεια) και τα γράφει στο assets/ ως PNG overrides.

   Χρήση:
     PIXELLAB_API_KEY=... node scripts/gen-assets-pixellab.cjs [group|all]
     groups: enemies, weapons, textures, faces, pickups, extra

   Το walk2 κάθε εχθρού παράγεται με οριζόντιο καθρέφτισμα του walk1
   (κλασικό retro trick για συνεπές walk cycle). Χρειάζεται playwright
   στο NODE_PATH μόνο για το καθρέφτισμα. */

const fs = require('fs');
const path = require('path');

// Το node fetch αγνοεί το HTTPS_PROXY· σε περιβάλλοντα με proxy (π.χ.
// Claude Code cloud) δρομολόγησέ το ρητά μέσω undici EnvHttpProxyAgent.
try {
  const { setGlobalDispatcher, EnvHttpProxyAgent } = require('undici');
  if (process.env.HTTPS_PROXY || process.env.https_proxy) {
    setGlobalDispatcher(new EnvHttpProxyAgent());
  }
} catch (e) { /* χωρίς undici: απευθείας σύνδεση */ }

const KEY = process.env.PIXELLAB_API_KEY;
if (!KEY) { console.error('Set PIXELLAB_API_KEY'); process.exit(1); }

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'assets');
const API = 'https://api.pixellab.ai/v1';

const STYLE = ', retro DOOM style, dark gritty sci-fi, detailed shading, hard outlines';

/* ---------- ορισμοί assets ----------
   {out, desc, w, h, bg?: true για αδιαφανές (textures), flipTo?: extra
    αρχείο με οριζόντιο καθρέφτισμα} */
const DEFS = {
  enemies: [],
  weapons: [],
  textures: [],
  faces: [],
  pickups: [],
  extra: [],
};

const ENEMIES = {
  shambler: ['rotten green cyber-zombie space crew member in torn grey jumpsuit, one glowing red eye, crude metal left arm', 64],
  spitter: ['bloated yellow-green mutant with huge gaping toothy mouth dripping glowing acid', 64],
  drone: ['small hovering security drone, dark metal sphere with single glowing red camera lens and tiny thrusters', 48],
  heavy: ['hulking armored cyborg soldier in heavy grey plate armor with large orange-lit arm cannon', 80],
  warden: ['elite cyborg prison warden in heavy orange armor plates, huge and menacing, arm cannon', 96],
  boss: ['colossal rogue AI avatar, floating mechanical skull with glowing purple eyes and purple energy veins, thick cables hanging beneath like tentacles', 128],
};
for (const [name, [desc, size]] of Object.entries(ENEMIES)) {
  DEFS.enemies.push({
    out: `enemy_${name}_walk1`, flipTo: `enemy_${name}_walk2`,
    desc: `${desc}, walking pose, full body, front view${STYLE}`,
    w: size, h: size,
  });
  DEFS.enemies.push({
    out: `enemy_${name}_attack`,
    desc: `${desc}, attacking pose, aggressive, full body, front view${STYLE}`,
    w: size, h: size,
  });
}

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
for (const [name, desc] of Object.entries(WEAPONS)) {
  DEFS.weapons.push({
    out: `weapon_${name}_idle`,
    desc: `first person view FPS weapon like DOOM shotgun viewmodel: ${desc}, held in two gloved hands, seen from behind, barrel pointing up and away, hands at bottom${STYLE}`,
    w: 96, h: 64,
  });
}

const TEXTURES = {
  hull: 'grey-blue spaceship interior wall of metal panels with rivets and seams',
  hullBlood: 'grey-blue spaceship metal wall panels with large dried dark red blood splatter',
  vent: 'dark metal industrial ventilation grille wall with horizontal slats',
  tech: 'spaceship tech wall with small green computer screen, blinking lights and hanging cables',
  door: 'heavy metal sliding blast door with yellow black hazard stripes and central seam',
  elevator: 'metal elevator door in green light with large green downward arrow symbol',
  core: 'dark wall overgrown with glowing purple AI neural cables and pulsing nodes',
};
for (const [name, desc] of Object.entries(TEXTURES)) {
  DEFS.textures.push({
    out: `tex_${name}`,
    desc: `seamless tileable wall texture, ${desc}, fills entire image${STYLE}`,
    w: 64, h: 64, bg: true,
  });
}

const FACES = {
  ok: 'calm alert expression',
  grin: 'grinning confidently',
  pain: 'grimacing in pain, eyes squeezed shut',
  low: 'badly wounded, face covered in blood, exhausted',
  dead: 'dead, eyes closed, grey lifeless skin',
};
for (const [name, desc] of Object.entries(FACES)) {
  DEFS.faces.push({
    out: `face_${name}`,
    desc: `HUD status bar face portrait like DOOM guy: head of rugged male space marine with short brown hair, ${desc}, front view, head and neck only${STYLE}`,
    w: 32, h: 32,
  });
}

const PICKUPS = {
  medkit: 'small white medkit box with red cross',
  rounds: 'small open box of rifle bullets',
  cells: 'small glowing blue energy cell battery pack',
  scrap: 'small pile of glowing cyan scrap metal pieces',
  core: 'small glowing purple crystal shard',
};
for (const [name, desc] of Object.entries(PICKUPS)) {
  DEFS.pickups.push({
    out: `pickup_${name}`,
    desc: `${desc}, videogame floor pickup item${STYLE}`,
    w: 32, h: 32,
  });
}

DEFS.extra = [
  { out: 'proj_acid', desc: `small green dripping acid glob projectile, glowing${STYLE}`, w: 32, h: 32 },
  { out: 'proj_plasma', desc: `small bright cyan plasma ball projectile with glowing core${STYLE}`, w: 32, h: 32 },
  { out: 'proj_bolt', desc: `small red orange energy bolt projectile, glowing${STYLE}`, w: 32, h: 32 },
  { out: 'proj_flame', desc: `small orange yellow fireball projectile with flame trail${STYLE}`, w: 32, h: 32 },
  { out: 'prop_terminal', desc: `small sci-fi supply vending terminal kiosk, dark metal body, glowing green screen, yellow keypad, standing on small legs, front view${STYLE}`, w: 48, h: 64 },
];

// ---------- UI στοιχεία (9-slice panels, κουμπιά, λωρίδα status bar) ----------
DEFS.ui = [
  { out: 'ui_panel', desc: `square dark gunmetal sci-fi UI panel frame with beveled riveted metal border and dark inset center, 9-slice interface panel${STYLE}`, w: 96, h: 96, bg: true },
  { out: 'ui_button', desc: `wide dark gunmetal sci-fi UI button with beveled metal border, empty label area, interface element${STYLE}`, w: 96, h: 32, bg: true },
  { out: 'ui_button_red', desc: `wide dark red-lit sci-fi UI button with beveled metal border and red glow, empty label area, interface element${STYLE}`, w: 96, h: 32, bg: true },
  { out: 'ui_statusbar_tile', desc: `horizontally seamless dark gunmetal HUD status bar strip texture with rivets and recessed slots, tileable left to right${STYLE}`, w: 64, h: 36, bg: true },
];

/* ---------- animations: walk cycle + death ανά εχθρό ----------
   Τρέχουν ΜΕΤΑ το βασικό batch (θέλουν τα enemy_X_walk1.png ως reference). */
const ANIMS = [];
for (const [name, [desc, size]] of Object.entries(ENEMIES)) {
  ANIMS.push({
    ref: `enemy_${name}_walk1`, size,
    desc: desc + STYLE,
    action: 'walking',
    outs: [`enemy_${name}_walk1`, `enemy_${name}_walk2`,
           `enemy_${name}_walk3`, `enemy_${name}_walk4`],
  });
  ANIMS.push({
    ref: `enemy_${name}_walk1`, size,
    desc: desc + STYLE,
    action: 'dying, collapsing to the ground',
    outs: [`enemy_${name}_die1`, `enemy_${name}_die2`,
           `enemy_${name}_die3`, `enemy_${name}_die4`],
  });
}

async function animate(a) {
  const refPath = path.join(OUT, a.ref + '.png');
  const reference = fs.readFileSync(refPath).toString('base64');
  const dim = Math.max(64, a.size); // το animate API απαιτεί >= 64
  const body = {
    image_size: { width: dim, height: dim },
    description: a.desc,
    action: a.action,
    reference_image: { type: 'base64', base64: reference },
  };
  for (let attempt = 0; attempt < 4; attempt++) {
    let res;
    try {
      res = await fetch(`${API}/animate-with-text`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (e) {
      console.log(`  ${a.outs[0]}: ${e.cause ? e.cause.code : e.message}, retry σε 15s…`);
      await sleep(15000);
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      console.log(`  ${a.outs[0]}…: HTTP ${res.status}, retry σε 20s`);
      await sleep(20000);
      continue;
    }
    if (!res.ok) throw new Error(`${a.outs[0]}: HTTP ${res.status} ${await res.text()}`);
    const data = await res.json();
    const images = data.images || data.frames || [];
    if (!images.length) throw new Error(`${a.outs[0]}: no frames (${JSON.stringify(data).slice(0, 200)})`);
    for (let i = 0; i < a.outs.length && i < images.length; i++) {
      const b64 = images[i].base64 || images[i];
      fs.writeFileSync(path.join(OUT, a.outs[i] + '.png'), Buffer.from(b64, 'base64'));
    }
    console.log(`  ${a.action} × ${a.ref}: ${Math.min(images.length, a.outs.length)} frames OK`);
    return;
  }
  throw new Error(`${a.outs[0]}: εξαντλήθηκαν οι προσπάθειες`);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function balance() {
  const res = await fetch(`${API}/balance`, {
    headers: { Authorization: `Bearer ${KEY}` } });
  return (await res.json()).usd;
}

async function generate(def) {
  const body = {
    description: def.desc,
    image_size: { width: def.w, height: def.h },
    no_background: !def.bg,
  };
  for (let attempt = 0; attempt < 4; attempt++) {
    let res;
    try {
      res = await fetch(`${API}/generate-image-pixflux`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (e) {
      console.log(`  ${def.out}: ${e.cause ? e.cause.code : e.message}, retry σε 15s…`);
      await sleep(15000);
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      console.log(`  ${def.out}: HTTP ${res.status}, retry σε 20s…`);
      await sleep(20000);
      continue;
    }
    if (!res.ok) throw new Error(`${def.out}: HTTP ${res.status} ${await res.text()}`);
    const data = await res.json();
    const b64 = data.image && (data.image.base64 || data.image);
    if (!b64 || typeof b64 !== 'string') throw new Error(`${def.out}: no image (${JSON.stringify(data).slice(0, 200)})`);
    fs.writeFileSync(path.join(OUT, def.out + '.png'), Buffer.from(b64, 'base64'));
    console.log(`  ${def.out}: OK (${def.w}x${def.h})`);
    return;
  }
  throw new Error(`${def.out}: εξαντλήθηκαν οι προσπάθειες`);
}

/* Οριζόντιο καθρέφτισμα για walk2 frames (μέσω headless chromium). */
async function makeFlips(flips) {
  if (!flips.length) return;
  const { chromium } = require('playwright');
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium',
  });
  const page = await browser.newPage();
  for (const [src, dst] of flips) {
    const durl = 'data:image/png;base64,' +
      fs.readFileSync(path.join(OUT, src + '.png')).toString('base64');
    const out = await page.evaluate(async (durl) => {
      const im = await new Promise((ok, err) => {
        const i = new Image(); i.onload = () => ok(i); i.onerror = err; i.src = durl;
      });
      const c = document.createElement('canvas');
      c.width = im.width; c.height = im.height;
      const ctx = c.getContext('2d');
      ctx.translate(im.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(im, 0, 0);
      return c.toDataURL('image/png');
    }, durl);
    fs.writeFileSync(path.join(OUT, dst + '.png'),
      Buffer.from(out.split(',')[1], 'base64'));
    console.log(`  ${dst}: OK (mirror του ${src})`);
  }
  await browser.close();
}

async function safeBalance() {
  try { return await balance(); } catch (e) { return '?'; }
}

(async () => {
  const what = process.argv[2] || 'all';
  fs.mkdirSync(OUT, { recursive: true });

  if (what === 'animations') {
    console.log(`PixelLab animations: ${ANIMS.length} κλήσεις. Balance: $${await safeBalance()}`);
    for (const a of ANIMS) {
      const skipMin = parseInt(process.env.SKIP_NEWER_MIN || '0', 10);
      const first = path.join(OUT, a.outs[0] + '.png');
      if (skipMin && fs.existsSync(first) &&
          fs.statSync(first).mtimeMs > Date.now() - skipMin * 60000) {
        console.log(`  ${a.outs[0]}…: υπάρχει, skip`);
        continue;
      }
      await animate(a);
      await sleep(1500);
    }
    console.log(`Τέλος. Balance: $${await safeBalance()}`);
    return;
  }

  const groups = what === 'all' ? Object.keys(DEFS) : [what];
  const jobs = groups.flatMap(g => DEFS[g] || []);
  console.log(`PixelLab: ${jobs.length} εικόνες. Balance: $${await safeBalance()}`);

  const flips = [];
  for (const def of jobs) {
    const fpath = path.join(OUT, def.out + '.png');
    const skipMin = parseInt(process.env.SKIP_NEWER_MIN || '0', 10);
    const fresh = skipMin && fs.existsSync(fpath) &&
      fs.statSync(fpath).mtimeMs > Date.now() - skipMin * 60000;
    if (fresh || (fs.existsSync(fpath) && process.env.SKIP_EXISTING)) {
      console.log(`  ${def.out}: υπάρχει, skip`);
    } else {
      await generate(def);
      await sleep(1200);
    }
    if (def.flipTo) flips.push([def.out, def.flipTo]);
  }
  await makeFlips(flips);
  console.log(`Τέλος. Balance: $${await safeBalance()}`);
})().catch(e => { console.error(e); process.exit(1); });
