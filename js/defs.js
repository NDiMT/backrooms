/* DEEPER — Ορισμοί: biomes, upgrades, tuning. */

const Defs = (() => {

  // ---------- biomes ανά βάθος ----------
  // dark: πόσο σκοτεινός είναι ο όροφος (0..1), palette για procedural tiles
  const BIOMES = [
    { key: 'office',  name: 'OFFICES',  from: 1,
      floorA: '#8a8064', floorB: '#7d7358', wall: '#5a5244',
      wallTop: '#6e6552', accent: '#c8b878', dark: 0.50 },
    { key: 'parking', name: 'PARKING',  from: 10,
      floorA: '#62666a', floorB: '#585c60', wall: '#3e4246',
      wallTop: '#50545a', accent: '#e8c832', dark: 0.62 },
    { key: 'mall',    name: 'THE MALL', from: 20,
      floorA: '#9a8e86', floorB: '#8c8078', wall: '#5e5450',
      wallTop: '#746a64', accent: '#7ec8d8', dark: 0.58 },
    { key: 'pools',   name: 'THE POOLS', from: 30,
      floorA: '#7ea8b0', floorB: '#729ca4', wall: '#3e6068',
      wallTop: '#527880', accent: '#c8ecf0', dark: 0.66 },
    { key: 'backrooms', name: 'THE BACKROOMS', from: 40,
      floorA: '#b0a050', floorB: '#a49448', wall: '#6e6228',
      wallTop: '#887a34', accent: '#ffe86a', dark: 0.74 },
  ];

  function biomeFor(floor) {
    let b = BIOMES[0];
    for (const bi of BIOMES) if (floor >= bi.from) b = bi;
    return b;
  }
  // κάθε 10 ορόφους μετά το τελευταίο biome, το backrooms «βαθαίνει»
  function biomeTier(floor) {
    return Math.floor((floor - 1) / 10);
  }

  // ---------- upgrades (μόνιμα, αγορά με scrap στο hub) ----------
  // value(lvl) = τιμή του stat στο level αυτό
  const UPGRADES = [
    { id: 'speed',    name: 'RUNNING SHOES', icon: '👟', max: 8,
      base: 30, mult: 2.0,
      desc: lvl => 'Move speed ' + (3.2 + lvl * 0.22).toFixed(1),
      value: lvl => 3.2 + lvl * 0.22 },
    { id: 'vitality', name: 'VITALITY', icon: '❤', max: 10,
      base: 25, mult: 1.9,
      desc: lvl => 'Max HP ' + (60 + lvl * 15),
      value: lvl => 60 + lvl * 15 },
    { id: 'damage',   name: 'CROWBAR', icon: '🗡', max: 10,
      base: 35, mult: 2.0,
      desc: lvl => 'Damage ' + (5 + lvl * 3),
      value: lvl => 5 + lvl * 3 },
    { id: 'light',    name: 'FLASHLIGHT', icon: '🔦', max: 8,
      base: 40, mult: 2.1,
      desc: lvl => 'Light radius ' + (1.7 + lvl * 0.4).toFixed(1) + ' — shades fear light',
      value: lvl => 1.7 + lvl * 0.4 },
    { id: 'greed',    name: 'LOOT BAG', icon: '💰', max: 10,
      base: 45, mult: 2.1,
      desc: lvl => '+' + (lvl * 15) + '% scrap from loot',
      value: lvl => 1 + lvl * 0.15 },
    { id: 'drones',   name: 'SCAVENGER DRONES', icon: '🤖', max: 12,
      base: 60, mult: 1.85,
      desc: lvl => lvl === 0 ? 'Earn scrap while away'
        : (lvl * 3) + ' scrap/min while away',
      value: lvl => lvl * 3 },
    { id: 'battery',  name: 'DRONE BATTERY', icon: '🔋', max: 6,
      base: 80, mult: 2.2,
      desc: lvl => 'Drones run ' + (2 + lvl) + 'h offline',
      value: lvl => 2 + lvl },
  ];

  function upCost(u, lvl) {
    return Math.round(u.base * Math.pow(u.mult, lvl));
  }

  // ---------- tuning ----------
  const T = {
    PLAYER_ATK_CD: 0.38,
    PLAYER_ATK_RANGE: 1.15,
    RESPAWN_HP_FRAC: 0.6,

    // όροφοι
    FLOOR_W: 30, FLOOR_H: 30,
    LOCK_FROM: 4,          // από αυτόν τον όροφο μπορεί να κλειδώνει η έξοδος
    LOCK_CHANCE: 0.55,
    VAULT_CHANCE: 0.6,     // πιθανότητα bonus vault (ανοίγει με ad)

    // shades
    SHADE_BASE: 2,
    SHADE_PER_FLOOR: 0.35,
    SHADE_MAX: 10,
    shadeHp: f => 14 + f * 1.6,
    shadeDmg: f => 7 + f * 0.5,
    shadeSpeed: f => Math.min(3.2, 1.55 + f * 0.03),
    LIGHT_SLOW: 0.4,       // πολλαπλασιαστής ταχύτητας shade μέσα στο φως

    // boss (κάθε 10ος όροφος)
    bossHp: f => 70 + f * 7,
    bossDmg: f => 13 + f * 0.6,
    bossSpeed: f => Math.min(2.6, 1.7 + f * 0.015),
    BOSS_SCALE: 1.65,

    // loot
    scrapPile: f => Math.round((3 + Math.random() * 3) * (1 + f * 0.13)),
    crateScrap: f => Math.round((6 + Math.random() * 5) * (1 + f * 0.13)),
    CRATE_MEDKIT: 0.22,
    CRATE_BATTERY: 0.10,
    crateCore: f => (f >= 15 ? 0.04 : 0),
    MEDKIT_HEAL: 35,
    BATTERY_TIME: 45,      // δευτ. διπλάσιο φως
    GIVEUP_KEEP: 0.4,      // πεθαίνοντας χωρίς ad κρατάς 40% του run scrap

    // cores: μόνιμα, δεν ξοδεύονται
    CORE_SCRAP_BONUS: 0.10,   // +10% scrap ανά core
    CORE_DMG_BONUS: 0.05,     // +5% damage ανά core

    // idle
    OFFLINE_MIN_S: 90,        // ελάχιστη απουσία για offline panel
    droneDepthMult: deepest => 1 + Math.floor(deepest / 10) * 0.5,

    // daily
    DAILY_TIME: 99,           // δευτερόλεπτα
    DAILY_FLOOR: 13,          // «βάθος» daily ορόφου (σταθερή δυσκολία)
  };

  return { BIOMES, biomeFor, biomeTier, UPGRADES, upCost, T };
})();
