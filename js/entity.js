/* Το entity — μια ψηλή σκιά που περιπλανιέται στο Level 0.
   Καταστάσεις: DORMANT (χάρη στην αρχή), WANDER, CHASE. */

class Entity {
  constructor(scene, world, data) {
    this.world = world;
    this.grid = data.grid;

    const tex = Textures.entity();
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, transparent: true, depthWrite: false,
    }));
    this.sprite.scale.set(1.7, 3.0, 1);
    const p = World.cellToWorld(data.entityCell.x, data.entityCell.z);
    this.sprite.position.set(p.x, 1.5, p.z);
    scene.add(this.sprite);

    this.state = 'DORMANT';
    this.graceLeft = 25;          // δευτερόλεπτα ηρεμίας στην αρχή
    this.dir = Math.random() * Math.PI * 2;
    this.dirTimer = 0;
    this.lostTimer = 0;

    this.WANDER_SPEED = 2.0;
    this.CHASE_SPEED = 4.6;
    this.SIGHT_RANGE = 18;
    this.KILL_RANGE = 1.15;
  }

  distanceTo(px, pz) {
    const dx = this.sprite.position.x - px;
    const dz = this.sprite.position.z - pz;
    return Math.sqrt(dx * dx + dz * dz);
  }

  /* Κίνηση με ολίσθηση πάνω στους τοίχους (ίδια λογική με τον παίκτη). */
  move(dt, angle, speed) {
    const nx = this.sprite.position.x + Math.cos(angle) * speed * dt;
    const nz = this.sprite.position.z + Math.sin(angle) * speed * dt;
    let blocked = false;
    if (!World.collides(this.grid, nx, this.sprite.position.z, 0.45)) {
      this.sprite.position.x = nx;
    } else blocked = true;
    if (!World.collides(this.grid, this.sprite.position.x, nz, 0.45)) {
      this.sprite.position.z = nz;
    } else blocked = true;
    return blocked;
  }

  /* Τηλεμεταφορά σε τυχαίο μακρινό κελί — κρατά τις συναντήσεις αραιές. */
  relocateFar(px, pz) {
    for (let tries = 0; tries < 60; tries++) {
      const cx = 1 + Math.floor(Math.random() * (World.GRID - 2));
      const cz = 1 + Math.floor(Math.random() * (World.GRID - 2));
      if (World.isWall(this.grid, cx, cz)) continue;
      const p = World.cellToWorld(cx, cz);
      const dx = p.x - px, dz = p.z - pz;
      if (dx * dx + dz * dz > 30 * 30) {
        this.sprite.position.set(p.x, 1.5, p.z);
        return;
      }
    }
  }

  /* Επιστρέφει { chasing, dist, caught } */
  update(dt, px, pz) {
    const pos = this.sprite.position;
    const dist = this.distanceTo(px, pz);

    if (this.state === 'DORMANT') {
      this.graceLeft -= dt;
      if (this.graceLeft <= 0) this.state = 'WANDER';
      return { chasing: false, dist, caught: false };
    }

    const sees = dist < this.SIGHT_RANGE &&
      World.lineOfSight(this.grid, pos.x, pos.z, px, pz);

    if (this.state === 'WANDER') {
      if (sees) {
        this.state = 'CHASE';
        this.lostTimer = 0;
      } else {
        this.dirTimer -= dt;
        const blocked = this.move(dt, this.dir, this.WANDER_SPEED);
        if (blocked || this.dirTimer <= 0) {
          this.dir = Math.random() * Math.PI * 2;
          this.dirTimer = 3 + Math.random() * 4;
        }
      }
    }

    if (this.state === 'CHASE') {
      if (sees) this.lostTimer = 0;
      else this.lostTimer += dt;

      if (this.lostTimer > 3.5) {
        this.state = 'WANDER';
        if (dist > 30) this.relocateFar(px, pz);
      } else {
        const angle = Math.atan2(pz - pos.z, px - pos.x);
        this.move(dt, angle, this.CHASE_SPEED);
      }
    }

    const caught = this.state === 'CHASE' && dist < this.KILL_RANGE;
    return { chasing: this.state === 'CHASE', dist, caught };
  }
}
