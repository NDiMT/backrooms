/* ΝΕΚΡΗ ΖΩΝΗ — Εχθροί (AI καταστάσεων), projectiles, pickups. */

const Entities = (() => {

  const STATS = {
    shambler: { hp: 30, speed: 1.7, dmg: 12, range: 1.0, ranged: false,
                cooldown: 1.0, worldH: 0.72, radius: 0.32, scrap: 6 },
    spitter:  { hp: 26, speed: 1.3, dmg: 10, range: 9, ranged: true,
                proj: 'acid', projSpeed: 5.5, cooldown: 1.7, worldH: 0.66,
                radius: 0.32, scrap: 8 },
    drone:    { hp: 14, speed: 3.1, dmg: 8, range: 7, ranged: true,
                proj: 'bolt', projSpeed: 7, cooldown: 1.3, worldH: 0.4,
                radius: 0.26, fly: 0.35, scrap: 7 },
    heavy:    { hp: 75, speed: 1.1, dmg: 7, range: 10, ranged: true,
                proj: 'bolt', projSpeed: 8, burst: 3, cooldown: 2.1,
                worldH: 0.85, radius: 0.38, scrap: 16 },
    warden:   { hp: 170, speed: 1.35, dmg: 9, range: 10, ranged: true,
                proj: 'bolt', projSpeed: 8.5, burst: 4, cooldown: 1.8,
                worldH: 0.95, radius: 0.42, scrap: 45, elite: true },
    boss:     { hp: 650, speed: 1.0, dmg: 12, range: 12, ranged: true,
                proj: 'acid', projSpeed: 6.5, cooldown: 1.5,
                worldH: 1.0, radius: 0.55, scrap: 0, boss: true },
  };

  class Enemy {
    constructor(type, x, y) {
      this.type = type;
      this.stats = STATS[type];
      this.x = x; this.y = y;
      this.hp = this.stats.hp;
      this.state = 'idle';          // idle|chase|attack|pain|dying|dead
      this.animT = 0;
      this.cool = Math.random() * 0.8;
      this.painT = 0;
      this.deadT = 0;
      this.burstLeft = 0;
      this.strafeDir = Math.random() < 0.5 ? 1 : -1;
      this.strafeT = 0;
      this.flash = 0;
      // damage-type effects
      this.burnT = 0; this.burnDps = 0;
      this.shockT = 0;
      this.cryoT = 0;
      this.statusFx = null; // χρώμα flash για το render
    }

    /* Εφαρμογή elemental status από χτύπημα. */
    applyStatus(element, dmg, game) {
      if (!this.alive()) return;
      if (element === 'fire') {
        this.burnT = 3.0;
        this.burnDps = Math.max(this.burnDps, dmg * 0.25);
        this.statusFx = '#ff7830';
      } else if (element === 'shock') {
        this.shockT = Math.max(this.shockT, this.stats.boss ? 0.25 : 0.7);
        this.statusFx = '#40d8ff';
      } else if (element === 'cryo') {
        this.cryoT = 2.5;
        this.statusFx = '#a8ccff';
      }
    }

    alive() { return this.state !== 'dying' && this.state !== 'dead'; }

    sprite(tick) {
      const set = Assets.enemies[this.type];
      if (this.state === 'dead') return set.death[2];
      if (this.state === 'dying') {
        return set.death[Math.min(2, (this.deadT * 6) | 0)];
      }
      if (this.state === 'pain') return set.pain;
      if (this.state === 'attack' && this.animT < 0.35) return set.attack;
      return set.walk[((tick * 3) | 0) % 2];
    }

    hurt(dmg, game) {
      if (!this.alive()) return false;
      this.hp -= dmg;
      this.flash = 0.1;
      if (this.state === 'idle') this.state = 'chase';
      if (this.hp <= 0) {
        this.state = 'dying';
        this.deadT = 0;
        game.audio.enemyDie(this.type);
        game.onEnemyDeath(this);
        return true;
      }
      // πιθανό pain stagger (τα αφεντικά σπάνια)
      if (Math.random() < (this.stats.boss ? 0.08 : 0.4)) {
        this.state = 'pain';
        this.painT = 0.28;
      }
      game.audio.enemyPain();
      return false;
    }

    update(dt, game) {
      const p = game.player;
      this.flash = Math.max(0, this.flash - dt);
      this.animT += dt;

      if (this.state === 'dead') return;
      if (this.state === 'dying') {
        this.deadT += dt;
        if (this.deadT > 0.5) this.state = 'dead';
        return;
      }

      // ---- elemental effects ----
      if (this.burnT > 0) {
        this.burnT -= dt;
        this.hp -= this.burnDps * dt;
        this.statusFx = '#ff7830';
        if (this.hp <= 0) {
          this.state = 'dying';
          this.deadT = 0;
          game.audio.enemyDie(this.type);
          game.onEnemyDeath(this);
          return;
        }
        if (this.burnT <= 0) { this.burnDps = 0; this.statusFx = null; }
      }
      if (this.cryoT > 0) {
        this.cryoT -= dt;
        this.statusFx = this.burnT > 0 ? this.statusFx : '#a8ccff';
        if (this.cryoT <= 0 && this.burnT <= 0) this.statusFx = null;
      }
      if (this.shockT > 0) {
        this.shockT -= dt;
        this.statusFx = '#40d8ff';
        if (this.shockT <= 0 && this.burnT <= 0 && this.cryoT <= 0) this.statusFx = null;
        return; // παράλυση — καμία ενέργεια
      }
      if (this.state === 'pain') {
        this.painT -= dt;
        if (this.painT <= 0) this.state = 'chase';
        return;
      }

      const dx = p.x - this.x, dy = p.y - this.y;
      const dist = Math.hypot(dx, dy);
      const sees = dist < 12 &&
        Engine.lineOfSight(game.world, this.x, this.y, p.x, p.y);

      if (this.state === 'idle') {
        if (sees && dist < 9) { this.state = 'chase'; game.audio.enemyAlert(this.type); }
        return;
      }

      // CHASE / ATTACK
      this.cool -= dt;
      const st = this.stats;

      if (this.state === 'attack') {
        if (this.animT > 0.4) this.state = 'chase';
        return;
      }

      // επίθεση;
      if (st.ranged) {
        if (sees && dist < st.range && this.cool <= 0) {
          this.state = 'attack';
          this.animT = 0;
          this.cool = st.cooldown;
          this.burstLeft = (st.burst || 1);
          this.fireAt(game, p);
          return;
        }
      } else if (dist < st.range && this.cool <= 0) {
        this.state = 'attack';
        this.animT = 0;
        this.cool = st.cooldown;
        game.hurtPlayer(st.dmg, this);
        return;
      }

      // ριπές (heavy/warden): συνεχίζει να ρίχνει όσο κρατά το burst
      if (this.burstLeft > 1 && sees) {
        this.burstT = (this.burstT || 0) - dt;
        if (this.burstT <= 0) {
          this.burstLeft--;
          this.burstT = 0.16;
          this.fireAt(game, p);
        }
      }

      // κίνηση προς τον παίκτη (drones κάνουν πλάγιες κινήσεις)
      if (dist > (st.ranged ? Math.min(3.2, st.range * 0.4) : 0.7)) {
        let mx = dx / dist, my = dy / dist;
        if (st.fly) {
          this.strafeT -= dt;
          if (this.strafeT <= 0) {
            this.strafeDir = -this.strafeDir;
            this.strafeT = 0.6 + Math.random();
          }
          mx += -my * 0.7 * this.strafeDir;
          my += mx * 0.7 * this.strafeDir;
          const n = Math.hypot(mx, my);
          mx /= n; my /= n;
        }
        let sp = st.speed * (sees ? 1 : 0.5);
        if (this.cryoT > 0) sp *= 0.55; // παγωμένος
        const blocked = Procgen.move(game.world, this, mx * sp * dt, my * sp * dt, st.radius);
        if (blocked && !sees) this.state = 'idle';
      }

      // ο boss «εξαγριώνεται» κάτω από 40% HP
      if (st.boss && this.hp < st.hp * 0.4) this.cool = Math.min(this.cool, 0.8);
    }

    fireAt(game, p) {
      const st = this.stats;
      const dx = p.x - this.x, dy = p.y - this.y;
      const dist = Math.hypot(dx, dy);
      const spread = st.boss ? 0.25 : 0.06;

      if (st.boss) {
        // βεντάλια 3 βλημάτων + εναλλαγή τύπου
        const base = Math.atan2(dy, dx);
        const kind = (this.hp < st.hp * 0.4 || Math.random() < 0.4) ? 'bolt' : 'acid';
        for (const off of [-0.28, 0, 0.28]) {
          game.projectiles.push(new Projectile(
            this.x, this.y, base + off, st.projSpeed, st.dmg, kind, false));
        }
        game.audio.bossFire();
        return;
      }
      const a = Math.atan2(dy, dx) + (Math.random() - 0.5) * spread * (dist / 3);
      game.projectiles.push(new Projectile(
        this.x, this.y, a, st.projSpeed, st.dmg, st.proj, false));
      game.audio.enemyFire(this.type);
    }
  }

  class Projectile {
    constructor(x, y, angle, speed, dmg, kind, fromPlayer, splash) {
      this.x = x; this.y = y;
      this.dx = Math.cos(angle) * speed;
      this.dy = Math.sin(angle) * speed;
      this.dmg = dmg;
      this.kind = kind;             // acid|bolt|plasma
      this.fromPlayer = fromPlayer;
      this.splash = splash || 0;
      this.dead = false;
      this.life = 4;
    }

    update(dt, game) {
      if (this.dead) return;
      this.life -= dt;
      if (this.life <= 0) { this.dead = true; return; }
      const nx = this.x + this.dx * dt;
      const ny = this.y + this.dy * dt;
      if (Procgen.blocked(game.world, nx, ny, 0.12)) {
        this.explode(game);
        return;
      }
      this.x = nx; this.y = ny;

      if (this.fromPlayer) {
        for (const e of game.enemies) {
          if (!e.alive()) continue;
          const d = Math.hypot(e.x - this.x, e.y - this.y);
          if (d < e.stats.radius + 0.18) { this.explode(game, e); return; }
        }
      } else {
        const p = game.player;
        if (Math.hypot(p.x - this.x, p.y - this.y) < 0.42) {
          game.hurtPlayer(this.dmg, this);
          this.dead = true;
        }
      }
    }

    explode(game, directHit) {
      this.dead = true;
      if (!this.fromPlayer) return;
      const hitOne = (e, dmg) => {
        game.registerHit(e, dmg, this.element);
        if (this.element) e.applyStatus(this.element, dmg, game);
        if (this.vamp) game.vampHeal = (game.vampHeal || 0) + this.vamp;
      };
      if (this.splash > 0) {
        game.audio.explosion();
        game.shake(0.35);
        for (const e of game.enemies) {
          if (!e.alive()) continue;
          const d = Math.hypot(e.x - this.x, e.y - this.y);
          if (d < this.splash) {
            hitOne(e, this.dmg * Math.max(0.35, 1 - d / this.splash));
          }
        }
      } else if (directHit) {
        hitOne(directHit, this.dmg);
      }
    }

    sprite() { return Assets.projectiles[this.kind]; }
  }

  const PICKUP_DEFS = {
    medkit: { worldH: 0.22, msg: '+35 HP' },
    rounds: { worldH: 0.18, msg: '+12 rounds' },
    cells:  { worldH: 0.18, msg: '+20 energy cells' },
    scrap:  { worldH: 0.16, msg: null },
    core:   { worldH: 0.24, msg: '+1 memory core' },
    weapon: { worldH: 0.28, msg: null }, // .inst καθορίζει το όπλο
  };

  class Pickup {
    constructor(kind, x, y, inst) {
      this.kind = kind; this.x = x; this.y = y;
      this.def = PICKUP_DEFS[kind];
      this.inst = inst || null;
      this.taken = false;
      this.bob = Math.random() * 6;
    }
    sprite() {
      if (this.kind === 'weapon') {
        return Assets.wpnIcons[PlayerSys.BASES[this.inst.base].map];
      }
      return Assets.pickups[this.kind];
    }
  }

  return { Enemy, Projectile, Pickup, STATS, PICKUP_DEFS };
})();
