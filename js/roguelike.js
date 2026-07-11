/* DEAD ZONE — Roguelite layer: mixed rewards (perks + weapon drops with
   elements/rarities), shops with weapon upgrades & mods, meta-progression. */

const Rogue = (() => {

  const DECK_NAMES = [
    'DECK 1 — CRYOGENICS',
    'DECK 2 — ENGINEERING',
    'DECK 3 — HYDROPONICS',
    'DECK 4 — ORION CORE',
  ];

  // ---------- PERKS ----------
  const PERKS = [
    { id: 'dmg', name: 'HOT LOADS', desc: '+15% damage',
      apply: p => { p.perks.dmgMul *= 1.15; } },
    { id: 'rate', name: 'RAPID CYCLING', desc: '+12% fire rate',
      apply: p => { p.perks.rateMul *= 0.88; } },
    { id: 'hp', name: 'REINFORCED CLONE', desc: '+25 max HP (and full heal)',
      apply: p => { p.maxHp += 25; p.hp = p.maxHp; } },
    { id: 'speed', name: 'SERVO JOINTS', desc: '+10% move speed',
      apply: p => { p.perks.speedMul *= 1.10; } },
    { id: 'vamp', name: 'HEMOSYNTHESIS', desc: '+2 HP per kill',
      apply: p => { p.perks.vamp += 2; } },
    { id: 'scrap', name: 'SCAVENGER', desc: '+30% scrap from enemies',
      apply: p => { p.perks.scrapMul *= 1.3; } },
    { id: 'armor', name: 'TITANIUM PLATES', desc: '+50 armor now',
      apply: p => { p.armor = Math.min(100, p.armor + 50); } },
    { id: 'ammo', name: 'DEEP POCKETS', desc: '+30 rounds, +30 cells',
      apply: p => { p.ammo.rounds += 30; p.ammo.cells += 30; } },
    { id: 'adrenal', name: 'ADRENAL VALVE', desc: '-35% dash cooldown',
      apply: p => { p.perks.dashCdMul *= 0.65; } },
    { id: 'demo', name: 'DEMOLITIONIST', desc: '+40% explosion damage, +2 grenade cap',
      apply: p => { p.perks.explMul *= 1.4; p.perks.nadeCap += 2; p.nades += 2; } },
    { id: 'skin', name: 'DERMAL WEAVE', desc: '-15% damage taken',
      apply: p => { p.perks.dmgTakenMul *= 0.85; } },
    { id: 'nades', name: 'FRAG SATCHEL', desc: '+3 grenades now',
      apply: p => { p.nades = Math.min(p.perks.nadeCap, p.nades + 3); } },
  ];

  // ---------- τυχαίο όπλο (element/rarity κλιμακώνουν με το βάθος) ----------
  function randomWeapon(depth, rand) {
    const base = PlayerSys.DROP_POOL[(rand() * PlayerSys.DROP_POOL.length) | 0];
    let element = null;
    if (!PlayerSys.BASES[base].forceElement && rand() < 0.35 + depth * 0.15) {
      element = ['fire', 'shock', 'cryo'][(rand() * 3) | 0];
    }
    const r = rand();
    const rarity = r < 0.55 - depth * 0.08 ? 0 : (r < 0.88 ? 1 : 2);
    return PlayerSys.makeWeapon(base, element, rarity);
  }

  /* 3 κάρτες αμοιβής: τουλάχιστον 1 perk, οι άλλες perk ή όπλο. */
  function pickRewards(depth, rand) {
    const pool = PERKS.slice();
    const takePerk = () =>
      ({ kind: 'perk', perk: pool.splice((rand() * pool.length) | 0, 1)[0] });
    const out = [takePerk()];
    for (let i = 0; i < 2; i++) {
      if (rand() < 0.55) out.push({ kind: 'weapon', inst: randomWeapon(depth, rand) });
      else out.push(takePerk());
    }
    // ανακάτεμα
    for (let i = out.length - 1; i > 0; i--) {
      const j = (rand() * (i + 1)) | 0;
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  // ---------- SHOP ----------
  /* Τα items παράγονται δυναμικά ώστε upgrade/mod να αφορούν το τρέχον όπλο. */
  function shopItems(p, game) {
    const w = PlayerSys.weapon(p);
    const wName = PlayerSys.displayName(w);
    const items = [
      { id: 'medkit', name: 'MEDKIT', desc: '+50 HP', cost: 30,
        can: () => p.hp < p.maxHp,
        apply: () => { p.hp = Math.min(p.maxHp, p.hp + 50); } },
      { id: 'armor', name: 'ARMOR PLATING', desc: '+50 armor', cost: 40,
        can: () => p.armor < 100,
        apply: () => { p.armor = Math.min(100, p.armor + 50); } },
      { id: 'rounds', name: 'ROUNDS x25', desc: 'kinetic ammunition', cost: 25,
        can: () => true,
        apply: () => { p.ammo.rounds += 25; } },
      { id: 'cells', name: 'CELLS x25', desc: 'energy ammunition', cost: 25,
        can: () => true,
        apply: () => { p.ammo.cells += 25; } },
      { id: 'nades', name: 'GRENADES x2', desc: 'frag grenades (G)', cost: 25,
        can: () => p.nades < p.perks.nadeCap,
        apply: () => { p.nades = Math.min(p.perks.nadeCap, p.nades + 2); } },
      { id: 'crate', name: 'WEAPON CRATE', desc: 'random weapon drop', cost: 90,
        can: () => true,
        apply: () => {
          const inst = randomWeapon(game.deckIdx, Math.random);
          return 'ACQUIRED: ' + PlayerSys.giveWeapon(p, inst, game);
        } },
    ];
    // αναβάθμιση τρέχοντος όπλου
    if (w.level < PlayerSys.MAX_LEVEL) {
      const cost = 45 + w.level * 35;
      items.push({
        id: 'upgrade', name: 'UPGRADE: ' + wName,
        desc: `+15% damage (level ${w.level + 1}/${PlayerSys.MAX_LEVEL})`,
        cost,
        can: () => true,
        apply: () => { w.level++; return 'UPGRADED: ' + PlayerSys.displayName(w); },
      });
    }
    // εγκατάσταση mod στο τρέχον όπλο
    if (w.mods.length < PlayerSys.MAX_MODS) {
      const available = PlayerSys.MODS.filter(m => !w.mods.includes(m.id));
      if (available.length) {
        const m = available[(Math.random() * available.length) | 0];
        items.push({
          id: 'mod', name: 'MOD: ' + m.name,
          desc: m.desc + ' → ' + wName, cost: 60,
          can: () => true,
          apply: () => { w.mods.push(m.id); return 'INSTALLED: ' + m.name; },
        });
      }
    }
    return items;
  }

  // ---------- META-PROGRESSION (localStorage) ----------
  const META_KEY = 'nz_meta_v1';

  const META_UPGRADES = [
    { id: 'hp', name: 'ENDURANCE GENES', desc: '+25 starting HP / level',
      max: 3, cost: lvl => 3 + lvl * 2 },
    { id: 'dmg', name: 'COMBAT MEMORY', desc: '+10% damage / level',
      max: 3, cost: lvl => 4 + lvl * 2 },
    { id: 'speed', name: 'REFLEX BOOST', desc: '+8% move speed / level',
      max: 2, cost: lvl => 3 + lvl * 2 },
    { id: 'shotgun', name: 'STASHED SHOTGUN', desc: 'start with a shotgun',
      max: 1, cost: () => 6 },
    { id: 'armor', name: 'CLONE PLATING', desc: 'start with 50 armor',
      max: 1, cost: () => 5 },
    { id: 'nades', name: 'FRAG WEBBING', desc: '+1 starting grenade & capacity / level',
      max: 2, cost: lvl => 3 + lvl * 2 },
  ];

  function loadMeta() {
    try {
      const m = JSON.parse(localStorage.getItem(META_KEY));
      if (m && m.upgrades) return m;
    } catch (e) { /* κατεστραμμένο state — καθαρή αρχή */ }
    return { cores: 0, bestDeck: 0, runs: 0, wins: 0, upgrades: {} };
  }

  function saveMeta(meta) {
    try { localStorage.setItem(META_KEY, JSON.stringify(meta)); }
    catch (e) { /* private mode — συνεχίζουμε χωρίς save */ }
  }

  function coresEarned(run) {
    let c = run.deckIdx + 1;
    c += Math.floor(run.kills / 12);
    if (run.won) c += 6;
    return c;
  }

  return {
    DECK_NAMES, PERKS, META_UPGRADES,
    randomWeapon, pickRewards, shopItems,
    loadMeta, saveMeta, coresEarned,
  };
})();
