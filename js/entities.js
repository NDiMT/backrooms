/* DEEPER — Shades (+ boss), pickups στο πάτωμα, χτυπήματα σε loot props. */

const Entities = (() => {
  const T = Defs.T;

  class Shade {
    constructor(x, y, floor, boss) {
      this.x = x; this.y = y;
      this.boss = !!boss;
      this.hp = boss ? T.bossHp(floor) : T.shadeHp(floor);
      this.maxHp = this.hp;
      this.dmg = boss ? T.bossDmg(floor) : T.shadeDmg(floor);
      this.speed = boss ? T.bossSpeed(floor) : T.shadeSpeed(floor);
      this.r = boss ? 0.42 : 0.3;
      this.dir = Math.random() * Math.PI * 2;
      this.wanderT = 0;
      this.moving = false;
      this.flash = 0;
      this.dead = false;
      this.attackCd = 0;
      this.faceLeft = false;
      this.animT = 0;
    }

    hurt(dmg, game) {
      if (this.dead) return;
      this.hp -= dmg;
      this.flash = 0.12;
      game.audio.mobHurt();
      if (this.hp <= 0) {
        this.dead = true;
        game.audio.mobDie(this.boss);
        game.spawnPuff(this.x, this.y);
        game.onShadeKilled(this);
      }
    }

    update(dt, game) {
      if (this.dead) return;
      this.flash = Math.max(0, this.flash - dt);
      this.attackCd = Math.max(0, this.attackCd - dt);
      const p = game.player;
      const dx = p.x - this.x, dy = p.y - this.y;
      const dist = Math.hypot(dx, dy);
      const inLight = game.inLight(this.x, this.y);

      // στο φως διστάζουν· στο σκοτάδι μυρίζονται από μακριά
      const aggro = inLight ? 3.2 : (this.boss ? 30 : 6.5);
      let vx = 0, vy = 0, sp = this.speed;
      if (dist < aggro && dist > 0.01) {
        vx = dx / dist; vy = dy / dist;
        if (inLight) sp *= T.LIGHT_SLOW;
        if (dist < 0.75 && this.attackCd <= 0) {
          this.attackCd = 1.0;
          game.hurtPlayer(this.dmg, this);
        }
      } else {
        this.wanderT -= dt;
        if (this.wanderT <= 0) {
          this.wanderT = 1.5 + Math.random() * 2.5;
          this.dir = Math.random() * Math.PI * 2;
          this.moving = Math.random() < 0.65;
        }
        if (this.moving) { vx = Math.cos(this.dir); vy = Math.sin(this.dir); }
        sp *= 0.45;
      }
      if (vx || vy) {
        World.move(game.world, this, vx * sp * dt, vy * sp * dt, this.r);
        this.faceLeft = vx < 0;
        this.animT += dt * 6;
      }
    }

    sprite() {
      const frames = Assets.mobs.shade;
      return frames[(this.animT | 0) % frames.length];
    }
  }

  /* Αντικείμενο στο πάτωμα — μαζεύεται αυτόματα με το πέρασμα. */
  class Pickup {
    constructor(kind, n, x, y) {
      this.kind = kind;                 // scrap | core | medkit | keycard | battery
      this.n = n;
      this.x = x + (Math.random() - 0.5) * 0.5;
      this.y = y + (Math.random() - 0.5) * 0.5;
      this.bob = Math.random() * 6;
      this.taken = false;
    }
  }

  /* Χτύπημα σε loot prop (pile/crate). Επιστρέφει true αν έσπασε. */
  function hitProp(game, key, prop) {
    const [tx, ty] = key.split(',').map(Number);
    const cx = tx + 0.5, cy = ty + 0.5;
    prop.hp -= 1;
    game.audio.hit(prop.kind);
    game.spawnHitFx(cx, cy);
    if (prop.hp > 0) return false;

    const f = game.run.floor;
    game.world.props.delete(key);
    game.spawnPuff(cx, cy);

    if (prop.kind === 'pile') {
      dropScrap(game, T.scrapPile(f), cx, cy);
    } else {
      dropScrap(game, T.crateScrap(f), cx, cy);
      const r = Math.random();
      if (r < T.crateCore(f)) game.pickups.push(new Pickup('core', 1, cx, cy));
      else if (r < T.crateCore(f) + T.CRATE_MEDKIT) {
        game.pickups.push(new Pickup('medkit', 1, cx, cy));
      } else if (r < T.crateCore(f) + T.CRATE_MEDKIT + T.CRATE_BATTERY) {
        game.pickups.push(new Pickup('battery', 1, cx, cy));
      }
    }
    return true;
  }

  /* Σκόρπισμα scrap σε 2-4 «θραύσματα». */
  function dropScrap(game, total, x, y) {
    const parts = 2 + (Math.random() * 3 | 0);
    for (let i = 0; i < parts; i++) {
      const n = Math.max(1, Math.round(total / parts));
      game.pickups.push(new Pickup('scrap', n, x, y));
    }
  }

  return { Shade, Pickup, hitProp, dropScrap };
})();
