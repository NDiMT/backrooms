/* ΝΕΚΡΗ ΖΩΝΗ — Roguelike layer: perks ανά deck, καταστήματα, meta-progression. */

const Rogue = (() => {

  const DECK_NAMES = [
    'DECK 1 — ΚΡΥΟΘΑΛΑΜΟΙ',
    'DECK 2 — ΜΗΧΑΝΟΣΤΑΣΙΟ',
    'DECK 3 — ΥΔΡΟΠΟΝΙΚΑ',
    'DECK 4 — ΠΥΡΗΝΑΣ ΤΟΥ ΩΡΙΩΝ',
  ];

  // ---------- PERKS (επιλογή 1 από 3 μεταξύ decks) ----------
  const PERKS = [
    { id: 'dmg', name: 'ΘΕΡΜΑ ΠΥΡΑ', desc: '+15% ζημιά',
      apply: p => { p.perks.dmgMul *= 1.15; } },
    { id: 'rate', name: 'ΓΡΗΓΟΡΗ ΣΚΑΝΔΑΛΗ', desc: '+12% ταχυβολία',
      apply: p => { p.perks.rateMul *= 0.88; } },
    { id: 'hp', name: 'ΕΝΙΣΧΥΜΕΝΟΣ ΚΛΩΝΟΣ', desc: '+25 μέγιστο HP (και γέμισμα)',
      apply: p => { p.maxHp += 25; p.hp = p.maxHp; } },
    { id: 'speed', name: 'ΣΕΡΒΟ ΑΡΘΡΩΣΕΙΣ', desc: '+10% ταχύτητα',
      apply: p => { p.perks.speedMul *= 1.10; } },
    { id: 'vamp', name: 'ΑΙΜΟΡΡΟΦΗΞΙΑ', desc: '+2 HP ανά σκοτωμό',
      apply: p => { p.perks.vamp += 2; } },
    { id: 'scrap', name: 'ΣΥΛΛΕΚΤΗΣ', desc: '+30% scrap από εχθρούς',
      apply: p => { p.perks.scrapMul *= 1.3; } },
    { id: 'armor', name: 'ΠΛΑΚΕΣ ΤΙΤΑΝΙΟΥ', desc: '+50 πανοπλία τώρα',
      apply: p => { p.armor = Math.min(100, p.armor + 50); } },
    { id: 'ammo', name: 'ΑΠΟΘΗΚΕΣ', desc: '+10 φυσίγγια, +30 κελιά',
      apply: p => { p.ammo.shells += 10; p.ammo.cells += 30; } },
  ];

  function pickPerks(rand) {
    const pool = PERKS.slice();
    const out = [];
    for (let i = 0; i < 3 && pool.length; i++) {
      out.push(pool.splice((rand() * pool.length) | 0, 1)[0]);
    }
    return out;
  }

  // ---------- SHOP ----------
  const SHOP_ITEMS = [
    { id: 'medkit', name: 'ΙΑΤΡΙΚΟ ΚΙΤ', desc: '+50 HP', cost: 30,
      can: p => p.hp < p.maxHp,
      apply: p => { p.hp = Math.min(p.maxHp, p.hp + 50); } },
    { id: 'armor', name: 'ΠΑΝΟΠΛΙΑ', desc: '+50 πανοπλία', cost: 40,
      can: p => p.armor < 100,
      apply: p => { p.armor = Math.min(100, p.armor + 50); } },
    { id: 'shells', name: 'ΦΥΣΙΓΓΙΑ x10', desc: 'για την καραμπίνα', cost: 25,
      can: () => true,
      apply: p => { p.ammo.shells += 10; } },
    { id: 'cells', name: 'ΚΕΛΙΑ x25', desc: 'για rifle/launcher', cost: 25,
      can: () => true,
      apply: p => { p.ammo.cells += 25; } },
    { id: 'shotgun', name: 'ΚΑΡΑΜΠΙΝΑ', desc: '+12 φυσίγγια', cost: 80,
      can: p => !p.weapons.includes('shotgun'),
      apply: p => { p.weapons.push('shotgun'); p.ammo.shells += 12;
                    PlayerSys.switchWeapon(p, 'shotgun'); } },
    { id: 'rifle', name: 'PULSE RIFLE', desc: '+40 κελιά', cost: 120,
      can: p => !p.weapons.includes('rifle'),
      apply: p => { p.weapons.push('rifle'); p.ammo.cells += 40;
                    PlayerSys.switchWeapon(p, 'rifle'); } },
    { id: 'launcher', name: 'PLASMA LAUNCHER', desc: '+24 κελιά', cost: 160,
      can: p => !p.weapons.includes('launcher'),
      apply: p => { p.weapons.push('launcher'); p.ammo.cells += 24; } },
  ];

  // ---------- META-PROGRESSION (localStorage) ----------
  const META_KEY = 'nz_meta_v1';

  const META_UPGRADES = [
    { id: 'hp', name: 'ΓΟΝΙΔΙΑ ΑΝΤΟΧΗΣ', desc: '+25 HP εκκίνησης / επίπεδο',
      max: 3, cost: lvl => 3 + lvl * 2 },
    { id: 'dmg', name: 'ΜΝΗΜΗ ΜΑΧΗΣ', desc: '+10% ζημιά / επίπεδο',
      max: 3, cost: lvl => 4 + lvl * 2 },
    { id: 'speed', name: 'ΑΝΤΑΝΑΚΛΑΣΤΙΚΑ', desc: '+8% ταχύτητα / επίπεδο',
      max: 2, cost: lvl => 3 + lvl * 2 },
    { id: 'shotgun', name: 'ΚΡΥΜΜΕΝΗ ΚΑΡΑΜΠΙΝΑ', desc: 'ξεκινάς με καραμπίνα',
      max: 1, cost: () => 6 },
    { id: 'armor', name: 'ΘΩΡΑΚΑΣ ΚΛΩΝΟΥ', desc: 'ξεκινάς με 50 πανοπλία',
      max: 1, cost: () => 5 },
  ];

  function loadMeta() {
    try {
      const m = JSON.parse(localStorage.getItem(META_KEY));
      if (m && m.upgrades) return m;
    } catch (e) { /* κατεστραμμένο αποθηκευμένο state — ξεκίνα καθαρά */ }
    return { cores: 0, bestDeck: 0, runs: 0, wins: 0, upgrades: {} };
  }

  function saveMeta(meta) {
    try { localStorage.setItem(META_KEY, JSON.stringify(meta)); }
    catch (e) { /* π.χ. private mode — το παιχνίδι συνεχίζει χωρίς save */ }
  }

  /* Πυρήνες που κερδίζονται στο τέλος ενός run. */
  function coresEarned(run) {
    let c = run.deckIdx + 1;              // πόσο βαθιά έφτασες
    c += Math.floor(run.kills / 12);
    if (run.won) c += 6;
    return c;
  }

  return {
    DECK_NAMES, PERKS, SHOP_ITEMS, META_UPGRADES,
    pickPerks, loadMeta, saveMeta, coresEarned,
  };
})();
