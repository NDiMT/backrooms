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
  { out: 'proj_acid', desc: `small green dripping acid glob projectile, glowing${STYLE}`, w: 16, h: 16 },
  { out: 'proj_plasma', desc: `small bright cyan plasma ball projectile with glowing core${STYLE}`, w: 16, h: 16 },
  { out: 'proj_bolt', desc: `small red orange energy bolt projectile, glowing${STYLE}`, w: 16, h: 16 },
  { out: 'proj_flame', desc: `small orange yellow fireball projectile with flame trail${STYLE}`, w: 16, h: 16 },
  { out: 'prop_terminal', desc: `small sci-fi supply vending terminal kiosk, dark metal body, glowing green screen, yellow keypad, standing on small legs, front view${STYLE}`, w: 48, h: 64 },
];

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
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${API}/generate-image-pixflux`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
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

(async () => {
  const what = process.argv[2] || 'all';
  fs.mkdirSync(OUT, { recursive: true });
  const groups = what === 'all' ? Object.keys(DEFS) : [what];
  const jobs = groups.flatMap(g => DEFS[g] || []);
  console.log(`PixelLab: ${jobs.length} εικόνες. Balance: $${await balance()}`);

  const flips = [];
  for (const def of jobs) {
    if (fs.existsSync(path.join(OUT, def.out + '.png')) && process.env.SKIP_EXISTING) {
      console.log(`  ${def.out}: υπάρχει, skip`);
    } else {
      await generate(def);
      await sleep(1200);
    }
    if (def.flipTo) flips.push([def.out, def.flipTo]);
  }
  await makeFlips(flips);
  console.log(`Τέλος. Balance: $${await balance()}`);
})().catch(e => { console.error(e); process.exit(1); });
