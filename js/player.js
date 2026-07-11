/* DEAD ZONE — Player: weapon system (bases × elements × rarity × levels × mods),
   firing (hitscan / pierce / chain / projectiles), damage intake. */

const PlayerSys = (() => {

  // ---------- damage types ----------
  const ELEMENTS = {
    fire:  { name: 'INCENDIARY', color: '#ff7830', desc: 'burns targets (damage over time)' },
    shock: { name: 'VOLTAIC',    color: '#40d8ff', desc: 'stuns and arcs to a nearby enemy' },
    cryo:  { name: 'CRYO',       color: '#a8ccff', desc: 'slows targets' },
  };

  const RARITIES = [
    { name: 'COMMON', mul: 1.0,  color: '#cfd4e0' },
    { name: 'RARE',   mul: 1.22, color: '#4a9fff' },
    { name: 'EPIC',   mul: 1.5,  color: '#c060ff' },
  ];

  // ---------- weapon bases ----------
  const BASES = {
    sidearm:    { name: 'SIDEARM', dmg: 12, rate: 0.38, spread: 0.03, pellets: 1,
                  ammo: null, snd: 'pistol', map: 'pistol' },
    smg:        { name: 'SMG', dmg: 6, rate: 0.085, spread: 0.06, pellets: 1,
                  ammo: 'rounds', use: 1, snd: 'smg', map: 'smg' },
    shotgun:    { name: 'SHOTGUN', dmg: 9, rate: 0.9, spread: 0.10, pellets: 6,
                  ammo: 'rounds', use: 2, snd: 'shotgun', map: 'shotgun' },
    handcannon: { name: 'HAND CANNON', dmg: 40, rate: 0.72, spread: 0.018, pellets: 1,
                  ammo: 'rounds', use: 2, snd: 'handcannon', map: 'handcannon' },
    pulse:      { name: 'PULSE RIFLE', dmg: 8, rate: 0.12, spread: 0.045, pellets: 1,
                  ammo: 'cells', use: 1, snd: 'pulse', map: 'rifle' },
    railgun:    { name: 'RAILGUN', dmg: 65, rate: 1.35, spread: 0.004, pellets: 1,
                  ammo: 'cells', use: 5, pierce: true, snd: 'railgun', map: 'railgun' },
    incinerator:{ name: 'INCINERATOR', dmg: 7, rate: 0.11, spread: 0.09, pellets: 1,
                  ammo: 'cells', use: 1, projectile: 'flame', projSpeed: 8.5,
                  forceElement: 'fire', snd: 'incinerator', map: 'incinerator' },
    arccaster:  { name: 'ARC CASTER', dmg: 15, rate: 0.5, spread: 0.02, pellets: 1,
                  ammo: 'cells', use: 2, chain: true,
                  forceElement: 'shock', snd: 'arccaster', map: 'arccaster' },
    launcher:   { name: 'PLASMA LAUNCHER', dmg: 55, rate: 1.15, spread: 0.01, pellets: 1,
                  ammo: 'cells', use: 4, projectile: 'plasma', splash: 2.0,
                  snd: 'launcher', map: 'launcher' },
  };
  // πισίνα για drops/αμοιβές (χωρίς το sidearm)
  const DROP_POOL = ['smg', 'shotgun', 'handcannon', 'pulse',
                     'railgun', 'incinerator', 'arccaster', 'launcher'];

  // ---------- mods (2 υποδοχές ανά όπλο) ----------
  const MODS = [
    { id: 'trigger', name: 'HAIR TRIGGER', desc: '+15% fire rate', rate: 0.85 },
    { id: 'fmj',     name: 'FMJ ROUNDS', desc: '+20% damage', dmg: 1.2 },
    { id: 'stab',    name: 'STABILIZER', desc: '-40% spread', spread: 0.6 },
    { id: 'leech',   name: 'LEECH ROUNDS', desc: '+1 HP per kill', vamp: 1 },
    { id: 'eco',     name: 'CHARGE RECYCLER', desc: '-30% ammo use', eco: 0.7 },
  ];
  const MAX_MODS = 2;
  const MAX_LEVEL = 3;
  const MAX_WEAPONS = 3;

  function makeWeapon(base, element, rarity) {
    return {
      base,
      element: BASES[base].forceElement || element || null,
      rarity: rarity || 0,
      level: 0,
      mods: [],
    };
  }

  /* Πραγματικά stats ενός instance (βάση × rarity × level × mods × perks). */
  function stats(w, perks) {
    const b = BASES[w.base];
    let dmg = b.dmg * RARITIES[w.rarity].mul * (1 + 0.15 * w.level);
    let rate = b.rate;
    let spread = b.spread;
    let use = b.use || 0;
    let vamp = 0;
    for (const id of w.mods) {
      const m = MODS.find(x => x.id === id);
      if (!m) continue;
      if (m.dmg) dmg *= m.dmg;
      if (m.rate) rate *= m.rate;
      if (m.spread) spread *= m.spread;
      if (m.vamp) vamp += m.vamp;
      if (m.eco) use = Math.max(1, Math.round(use * m.eco));
    }
    if (perks) {
      dmg *= perks.dmgMul;
      rate *= perks.rateMul;
    }
    return { ...b, dmg, rate, spread, use, vamp };
  }

  function displayName(w) {
    const b = BASES[w.base];
    const el = w.element && !b.forceElement ? ELEMENTS[w.element].name + ' ' : '';
    const lvl = w.level > 0 ? ' +' + w.level : '';
    return el + b.name + lvl;
  }

  function create(meta) {
    const maxHp = 100 + (meta.upgrades.hp || 0) * 25;
    const p = {
      x: 0, y: 0, angle: 0,
      hp: maxHp, maxHp,
      armor: meta.upgrades.armor ? 50 : 0,
      weapons: [makeWeapon('sidearm')],
      current: 0,
      ammo: { rounds: 0, cells: 0 },
      scrap: 0,
      cool: 0,
      radius: 0.3,
      fireAnim: 0,
      bob: 0,
      nades: 1 + (meta.upgrades.nades || 0),
      dashCd: 0,
      dashT: 0,
      dashDx: 0, dashDy: 0,
      invulnT: 0,
      perks: {
        dmgMul: 1 + (meta.upgrades.dmg || 0) * 0.10,
        rateMul: 1,
        speedMul: 1 + (meta.upgrades.speed || 0) * 0.08,
        vamp: 0,
        scrapMul: 1,
        dashCdMul: 1,
        nadeCap: 3 + (meta.upgrades.nades || 0),
        dmgTakenMul: 1,
        explMul: 1,
      },
    };
    if (meta.upgrades.shotgun) {
      p.weapons.push(makeWeapon('shotgun'));
      p.ammo.rounds = 20;
      p.current = 1;
    }
    return p;
  }

  function weapon(p) { return p.weapons[p.current]; }

  /* Δίνει όπλο στον παίκτη· αν είναι γεμάτος, αντικαθιστά το τρέχον
     (ή τη θέση 1 αν κρατά το sidearm). Επιστρέφει μήνυμα. */
  function giveWeapon(p, inst, game) {
    if (p.weapons.length < MAX_WEAPONS) {
      p.weapons.push(inst);
      p.current = p.weapons.length - 1;
      if (game) game.audio.weaponPickup();
      return displayName(inst);
    }
    const slot = p.current === 0 ? 1 : p.current;
    const old = p.weapons[slot];
    p.weapons[slot] = inst;
    p.current = slot;
    if (game) game.audio.weaponPickup();
    return displayName(inst) + ' (replaced ' + displayName(old) + ')';
  }

  function canFire(p) {
    const w = weapon(p);
    const st = stats(w, p.perks);
    if (p.cool > 0) return false;
    if (st.ammo && p.ammo[st.ammo] < st.use) return false;
    return true;
  }

  function fire(p, game, aimAssist) {
    const w = weapon(p);
    const st = stats(w, p.perks);
    if (p.cool > 0) return false;
    if (st.ammo && p.ammo[st.ammo] < st.use) {
      game.audio.dryFire();
      p.cool = 0.3;
      switchWeapon(p, 0, game); // πίσω στο sidearm
      return false;
    }
    p.cool = st.rate;
    p.fireAnim = 0.12;
    if (st.ammo) p.ammo[st.ammo] -= st.use;
    game.audio.fire(st.snd);
    game.alertEnemies(p.x, p.y, 9);

    if (st.projectile) {
      const pr = new Entities.Projectile(
        p.x + Math.cos(p.angle) * 0.4, p.y + Math.sin(p.angle) * 0.4,
        p.angle, st.projSpeed || 9, st.dmg, st.projectile, true, st.splash);
      pr.element = w.element;
      pr.vamp = st.vamp;
      if (st.projectile === 'flame') pr.life = 0.6; // κοντινή εμβέλεια
      game.projectiles.push(pr);
      return true;
    }

    for (let i = 0; i < st.pellets; i++) {
      const a = p.angle + (Math.random() - 0.5) * 2 * st.spread;
      hitscan(p, game, a, st, w, aimAssist || 0);
    }
    return true;
  }

  function hitscan(p, game, angle, st, w, assist) {
    const hit = Engine.cast(game.world, p.x, p.y,
      Math.cos(angle), Math.sin(angle));
    const wallDist = hit ? hit.dist : Engine.MAX_DIST;

    // υποψήφιοι στη γραμμή βολής
    const targets = [];
    for (const e of game.enemies) {
      if (!e.alive()) continue;
      const dx = e.x - p.x, dy = e.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > wallDist + e.stats.radius || d > 20) continue;
      let da = Math.atan2(dy, dx) - angle;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      const tol = Math.atan2(e.stats.radius, d) + assist;
      if (Math.abs(da) < tol &&
          Engine.lineOfSight(game.world, p.x, p.y, e.x, e.y)) {
        targets.push({ e, d });
      }
    }
    if (!targets.length) return;
    targets.sort((a, b) => a.d - b.d);

    const hits = st.pierce ? targets : [targets[0]];
    for (const t of hits) {
      const falloff = Math.max(0.45, 1 - Math.max(0, t.d - 8) * 0.07);
      dealHit(game, t.e, st.dmg * falloff, w.element, st);
    }
  }

  /* Κοινή εφαρμογή χτυπήματος: ζημιά + element + chain + vamp. */
  function dealHit(game, e, dmg, element, st) {
    game.registerHit(e, dmg, element);
    if (element) e.applyStatus(element, dmg, game);
    if (st && st.vamp) game.vampHeal = (game.vampHeal || 0) + st.vamp;

    // Arc Caster: εκκένωση σε κοντινό δεύτερο στόχο
    if (st && st.chain) {
      let best = null, bd = 4;
      for (const o of game.enemies) {
        if (o === e || !o.alive()) continue;
        const d = Math.hypot(o.x - e.x, o.y - e.y);
        if (d < bd && Engine.lineOfSight(game.world, e.x, e.y, o.x, o.y)) {
          best = o; bd = d;
        }
      }
      if (best) {
        game.registerHit(best, dmg * 0.5, 'shock');
        best.applyStatus('shock', dmg * 0.5, game);
        game.audio.arcChain();
      }
    }
  }

  function switchWeapon(p, idx, game) {
    if (idx < 0 || idx >= p.weapons.length || idx === p.current) return false;
    p.current = idx;
    p.cool = Math.max(p.cool, 0.25);
    if (game) {
      game.audio.uiClick();
      game.onWeaponSwitch && game.onWeaponSwitch();
    }
    return true;
  }

  function nextWeapon(p, game) {
    switchWeapon(p, (p.current + 1) % p.weapons.length, game);
  }

  /* Ζημιά στον παίκτη: η πανοπλία απορροφά 40%. i-frames στο dash. */
  function damage(p, amount) {
    if (p.invulnT > 0) return false;
    let dmg = amount * (p.perks.dmgTakenMul || 1);
    if (p.armor > 0) {
      const absorbed = Math.min(p.armor, dmg * 0.4);
      p.armor -= absorbed;
      dmg -= absorbed;
    }
    p.hp -= dmg;
    return p.hp <= 0;
  }

  /* Dash: γρήγορη ώθηση με i-frames. Κατεύθυνση = κίνηση ή βλέμμα. */
  function dash(p, game, dx, dy) {
    if (p.dashCd > 0 || p.dashT > 0) return false;
    if (!dx && !dy) { dx = Math.cos(p.angle); dy = Math.sin(p.angle); }
    const n = Math.hypot(dx, dy) || 1;
    p.dashDx = dx / n; p.dashDy = dy / n;
    p.dashT = 0.16;
    p.dashCd = 2.4 * (p.perks.dashCdMul || 1);
    p.invulnT = 0.3;
    game.audio.dash();
    return true;
  }

  /* Χειροβομβίδα: βλήμα με έκρηξη είτε σε πρόσκρουση είτε στο τέλος. */
  function throwNade(p, game) {
    if (p.nades <= 0) { game.audio.dryFire(); return false; }
    p.nades--;
    const pr = new Entities.Projectile(
      p.x + Math.cos(p.angle) * 0.4, p.y + Math.sin(p.angle) * 0.4,
      p.angle, 7.5, 60 * p.perks.dmgMul * (p.perks.explMul || 1),
      'plasma', true, 2.2);
    pr.life = 0.85;
    pr.explodeOnTimeout = true;
    game.projectiles.push(pr);
    game.audio.nadeThrow();
    game.alertEnemies(p.x, p.y, 9);
    return true;
  }

  return {
    BASES, ELEMENTS, RARITIES, MODS, DROP_POOL, MAX_MODS, MAX_LEVEL, MAX_WEAPONS,
    makeWeapon, stats, displayName, giveWeapon, weapon, dealHit,
    create, fire, canFire, switchWeapon, nextWeapon, damage, dash, throwNade,
  };
})();
