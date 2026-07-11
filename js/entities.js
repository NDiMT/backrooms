/* DRIFTLAND — Mobs (crab/boar/shade), drops στο έδαφος, χτυπήματα πόρων. */

const Entities = (() => {
  const T = Defs.T;

  const MOB_STATS = {
    crab:  { hp: 10, speed: 1.1, dmg: 0, aggro: 0, flee: true, drops: { meat_raw: 1 }, r: 0.3 },
    boar:  { hp: 24, speed: 2.2, dmg: 8, aggro: 0,  retaliate: true,
             drops: { meat_raw: 2 }, r: 0.38 },
    shade: { hp: 22, speed: 1.7, dmg: 10, aggro: 7, night: true,
             drops: { resin: 2 }, r: 0.34 },
  };

  class Mob {
    constructor(kind, x, y) {
      this.kind = kind;
      this.st = MOB_STATS[kind];
      this.x = x; this.y = y;
      this.hp = this.st.hp;
      this.dir = Math.random() * Math.PI * 2;
      this.wanderT = 0;
      this.angry = false;
      this.flee = false;
      this.flash = 0;
      this.dead = false;
      this.attackCd = 0;
      this.faceLeft = false;
    }

    hurt(dmg, game) {
      if (this.dead) return;
      this.hp -= dmg;
      this.flash = 0.12;
      if (this.st.retaliate) this.angry = true;
      if (this.st.flee) this.flee = true;
      game.audio.mobHurt(this.kind);
      if (this.hp <= 0) {
        this.dead = true;
        game.audio.mobDie(this.kind);
        game.spawnPuff(this.x, this.y);
        for (const [item, n] of Object.entries(this.st.drops)) {
          game.dropItem(item, n, this.x, this.y);
        }
        game.stats.kills++;
      }
    }

    update(dt, game) {
      if (this.dead) return;
      this.flash = Math.max(0, this.flash - dt);
      this.attackCd = Math.max(0, this.attackCd - dt);
      const p = game.player;
      const dx = p.x - this.x, dy = p.y - this.y;
      const dist = Math.hypot(dx, dy);

      // shades: καίγονται στο φως της μέρας
      if (this.st.night && game.isDay()) {
        this.hp -= 14 * dt;
        if (this.hp <= 0) {
          this.dead = true;
          game.spawnPuff(this.x, this.y);
          return;
        }
      }

      let vx = 0, vy = 0;
      const chasing = (this.st.aggro && dist < this.st.aggro && !game.nearLight(this.x, this.y)) ||
        (this.angry && dist < 9);
      if (this.flee && dist < 6) {
        vx = -dx / dist; vy = -dy / dist;
      } else if (chasing && dist > 0.01) {
        vx = dx / dist; vy = dy / dist;
        if (dist < 0.75 && this.attackCd <= 0) {
          this.attackCd = 1.1;
          game.hurtPlayer(this.st.dmg, this);
        }
      } else {
        this.wanderT -= dt;
        if (this.wanderT <= 0) {
          this.wanderT = 1.5 + Math.random() * 2.5;
          this.dir = Math.random() * Math.PI * 2;
          this.moving = Math.random() < 0.6;
        }
        if (this.moving) { vx = Math.cos(this.dir); vy = Math.sin(this.dir); }
      }
      if (vx || vy) {
        const sp = this.st.speed * ((this.flee || chasing) ? 1.4 : 0.5);
        World.move(game.world, this, vx * sp * dt, vy * sp * dt, this.st.r);
        this.faceLeft = vx < 0;
        this.animT = (this.animT || 0) + dt * 6;
      }
    }

    sprite() {
      const frames = Assets.mobs[this.kind];
      return frames[((this.animT || 0) | 0) % frames.length];
    }
  }

  /* Πεσμένο αντικείμενο στο έδαφος. */
  class Drop {
    constructor(item, n, x, y) {
      this.item = item; this.n = n;
      this.x = x + (Math.random() - 0.5) * 0.5;
      this.y = y + (Math.random() - 0.5) * 0.5;
      this.bob = Math.random() * 6;
      this.taken = false;
      this.age = 0;
    }
  }

  /* Ζημιά σε prop πόρου. Επιστρέφει true αν καταστράφηκε. */
  function hitProp(game, key, p, power, toolKind) {
    const world = game.world;
    const prop = world.props.get(key);
    if (!prop) return false;
    const [px, py] = key.split(',').map(Number);
    const K = prop.kind;

    const need = { tree: 'axe', palm: 'axe', rock: 'pickaxe' }[K];
    const mult = need ? (toolKind === need ? 1 : 0.34) : 1;
    prop.hp -= Math.max(0.5, power * mult);
    game.audio.hit(K);
    game.spawnHitFx(px + 0.5, py + 0.5, K);

    if (prop.hp > 0) return false;

    // καταστροφή → drops
    const drops = {
      tree: { wood: 3 }, palm: { wood: 2, fiber: 1 }, rock: { stone: 3 },
      bush: { berry: 2, fiber: 1 }, driftwood: { wood: 2 },
      wall: { wood: 1 }, chest: {}, workbench: { wood: 2 },
      bed: { wood: 2 }, campfire: { stone: 2 }, firepit: { stone: 2 },
    }[K] || {};
    for (const [item, n] of Object.entries(drops)) game.dropItem(item, n, px + 0.5, py + 0.5);
    if (K === 'tree' && Math.random() < 0.4) game.dropItem('resin', 1, px + 0.5, py + 0.5);
    if (K === 'rock' && Math.random() < 0.3) game.dropItem('metal', 1, px + 0.5, py + 0.5);
    if (K === 'chest' && prop.inv) {
      for (const s of prop.inv) if (s) game.dropItem(s.item, s.n, px + 0.5, py + 0.5);
    }

    if (K === 'bush') {
      // ο θάμνος μένει και ξαναβγάζει καρπούς
      prop.hp = 1;
      prop.regrow = 90;
      prop.looted = true;
      World.invalidate(px, py);
      return true;
    }
    world.props.delete(key);
    game.markDirty(px, py);
    World.invalidate(px, py);
    game.stats.gathered++;
    return true;
  }

  return { Mob, Drop, MOB_STATS, hitProp };
})();
