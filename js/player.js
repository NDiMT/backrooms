/* ΝΕΚΡΗ ΖΩΝΗ — Παίκτης: όπλα, βολές, ζημιά, εφαρμογή perks. */

const PlayerSys = (() => {

  const WEAPONS = {
    pistol:   { name: 'ΠΙΣΤΟΛΙ', dmg: 12, rate: 0.4, spread: 0.025, pellets: 1,
                ammoType: null, hitscan: true, snd: 'pistol' },
    shotgun:  { name: 'ΚΑΡΑΜΠΙΝΑ', dmg: 9, rate: 0.95, spread: 0.10, pellets: 6,
                ammoType: 'shells', ammoUse: 1, hitscan: true, snd: 'shotgun' },
    rifle:    { name: 'PULSE RIFLE', dmg: 8, rate: 0.13, spread: 0.05, pellets: 1,
                ammoType: 'cells', ammoUse: 1, hitscan: true, snd: 'rifle' },
    launcher: { name: 'PLASMA LAUNCHER', dmg: 55, rate: 1.15, spread: 0.01,
                ammoType: 'cells', ammoUse: 4, projectile: true, splash: 2.0,
                snd: 'launcher' },
  };
  const WEAPON_ORDER = ['pistol', 'shotgun', 'rifle', 'launcher'];

  function create(meta) {
    const maxHp = 100 + (meta.upgrades.hp || 0) * 25;
    const p = {
      x: 0, y: 0, angle: 0,
      hp: maxHp, maxHp,
      armor: meta.upgrades.armor ? 50 : 0,
      weapons: ['pistol'],
      current: 'pistol',
      ammo: { shells: 0, cells: 0 },
      scrap: 0,
      cool: 0,
      radius: 0.3,
      fireAnim: 0,
      bob: 0,
      perks: {
        dmgMul: 1 + (meta.upgrades.dmg || 0) * 0.10,
        rateMul: 1,
        speedMul: 1 + (meta.upgrades.speed || 0) * 0.08,
        vamp: 0,
        scrapMul: 1,
      },
    };
    if (meta.upgrades.shotgun) {
      p.weapons.push('shotgun');
      p.ammo.shells = 12;
    }
    return p;
  }

  function canFire(p) {
    const w = WEAPONS[p.current];
    if (p.cool > 0) return false;
    if (w.ammoType && p.ammo[w.ammoType] < (w.ammoUse || 1)) return false;
    return true;
  }

  /* Πυροβολισμός. aimAssist: επιπλέον γωνία ανοχής (κινητά). */
  function fire(p, game, aimAssist) {
    const w = WEAPONS[p.current];
    if (!canFire(p)) {
      if (p.cool <= 0 && w.ammoType) {
        game.audio.dryFire();
        p.cool = 0.3;
        // αυτόματη επιστροφή στο πιστόλι όταν τελειώσουν τα πυρομαχικά
        if (p.ammo[w.ammoType] < (w.ammoUse || 1)) switchWeapon(p, 'pistol', game);
      }
      return false;
    }
    p.cool = w.rate * p.perks.rateMul;
    p.fireAnim = 0.12;
    if (w.ammoType) p.ammo[w.ammoType] -= (w.ammoUse || 1);
    game.audio.fire(w.snd);
    game.alertEnemies(p.x, p.y, 9);

    if (w.projectile) {
      game.projectiles.push(new Entities.Projectile(
        p.x + Math.cos(p.angle) * 0.4, p.y + Math.sin(p.angle) * 0.4,
        p.angle, 9, w.dmg * p.perks.dmgMul, 'plasma', true, w.splash));
      return true;
    }

    // hitscan pellets
    for (let i = 0; i < w.pellets; i++) {
      const a = p.angle + (Math.random() - 0.5) * 2 * w.spread;
      hitscan(p, game, a, w.dmg * p.perks.dmgMul, aimAssist || 0);
    }
    return true;
  }

  function hitscan(p, game, angle, dmg, assist) {
    // απόσταση μέχρι τον τοίχο σε αυτή τη γωνία
    const hit = Engine.cast(game.world, p.x, p.y,
      Math.cos(angle), Math.sin(angle));
    const wallDist = hit ? hit.dist : Engine.MAX_DIST;

    let best = null, bestD = Infinity;
    for (const e of game.enemies) {
      if (!e.alive()) continue;
      const dx = e.x - p.x, dy = e.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > wallDist + e.stats.radius || d > 20) continue;
      let da = Math.atan2(dy, dx) - angle;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      const tol = Math.atan2(e.stats.radius, d) + assist;
      if (Math.abs(da) < tol && d < bestD &&
          Engine.lineOfSight(game.world, p.x, p.y, e.x, e.y)) {
        best = e; bestD = d;
      }
    }
    if (best) {
      // πτώση ζημιάς με την απόσταση (μετά τα 8m)
      const falloff = Math.max(0.45, 1 - Math.max(0, bestD - 8) * 0.07);
      game.registerHit(best, dmg * falloff);
    }
  }

  function switchWeapon(p, name, game) {
    if (!p.weapons.includes(name) || p.current === name) return;
    p.current = name;
    p.cool = Math.max(p.cool, 0.25);
    if (game) game.audio.uiClick();
  }

  function nextWeapon(p, game) {
    const owned = WEAPON_ORDER.filter(w => p.weapons.includes(w));
    const i = owned.indexOf(p.current);
    switchWeapon(p, owned[(i + 1) % owned.length], game);
  }

  /* Ζημιά στον παίκτη: η πανοπλία απορροφά 40%. */
  function damage(p, amount) {
    let dmg = amount;
    if (p.armor > 0) {
      const absorbed = Math.min(p.armor, dmg * 0.4);
      p.armor -= absorbed;
      dmg -= absorbed;
    }
    p.hp -= dmg;
    return p.hp <= 0;
  }

  return { WEAPONS, WEAPON_ORDER, create, fire, canFire, switchWeapon, nextWeapon, damage };
})();
