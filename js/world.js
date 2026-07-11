/* DEEPER — Όροφοι σε τετράγωνο top-down πλέγμα.

   Κάθε όροφος είναι ένα procedurally generated κάτοψη: δωμάτια
   ενωμένα με διαδρόμους, elevator εισόδου/εξόδου, προαιρετικό
   κλειδωμένο vault (ανοίγει με rewarded ad) και keycard όταν η
   έξοδος κλειδώνει. Συντεταγμένες κόσμου σε tiles: το tile (tx,ty)
   καλύπτει [tx,tx+1)×[ty,ty+1). */

const World = (() => {
  const PPU = 26;                 // pixels ανά world unit (tile) στην οθόνη

  const WALL = 0, FLOOR = 1, ELEV_IN = 2, ELEV_OUT = 3,
        VAULT_DOOR = 4, VAULT_FLOOR = 5;

  function mulberry(seed) {
    let a = seed >>> 0;
    return () => {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function generate(floorNum, seed, opts = {}) {
    const T = Defs.T;
    const W = T.FLOOR_W, H = T.FLOOR_H;
    const rand = mulberry(seed);
    const tiles = new Uint8Array(W * H);          // όλα WALL
    const at = (x, y) => tiles[y * W + x];
    const set = (x, y, t) => { tiles[y * W + x] = t; };
    const inb = (x, y) => x > 0 && y > 0 && x < W - 1 && y < H - 1;

    // ---- δωμάτια ----
    const rooms = [];
    const target = Math.min(9, 5 + Math.floor(floorNum / 6));
    for (let tries = 0; tries < 90 && rooms.length < target; tries++) {
      const rw = 4 + (rand() * 5 | 0), rh = 4 + (rand() * 4 | 0);
      const rx = 1 + (rand() * (W - rw - 2) | 0);
      const ry = 1 + (rand() * (H - rh - 2) | 0);
      let ok = true;
      for (const r of rooms) {
        if (rx < r.x + r.w + 1 && rx + rw + 1 > r.x &&
            ry < r.y + r.h + 1 && ry + rh + 1 > r.y) { ok = false; break; }
      }
      if (!ok) continue;
      rooms.push({ x: rx, y: ry, w: rw, h: rh,
        cx: rx + (rw >> 1), cy: ry + (rh >> 1) });
    }
    // εγγύηση: τουλάχιστον 2 δωμάτια
    while (rooms.length < 2) {
      const rw = 5, rh = 5;
      const rx = rooms.length ? W - rw - 2 : 2, ry = rooms.length ? H - rh - 2 : 2;
      rooms.push({ x: rx, y: ry, w: rw, h: rh,
        cx: rx + (rw >> 1), cy: ry + (rh >> 1) });
    }

    // vault: κράτα ένα μεσαίο δωμάτιο εκτός διαδρόμων (ανοίγει με ad)
    let vaultRoom = null;
    if (rooms.length >= 5 && rand() < T.VAULT_CHANCE) {
      vaultRoom = rooms[2 + (rand() * (rooms.length - 3) | 0)];
    }
    const connected = rooms.filter(r => r !== vaultRoom);

    // ---- carve δωμάτια (εκτός vault — αυτό χαράζεται μετά τους διαδρόμους) ----
    for (const r of connected) {
      for (let y = r.y; y < r.y + r.h; y++) {
        for (let x = r.x; x < r.x + r.w; x++) set(x, y, FLOOR);
      }
    }

    // ---- διάδρομοι (Γ-σχήμα, πλάτος 2) ανάμεσα σε διαδοχικά δωμάτια ----
    function corridor(x0, y0, x1, y1) {
      const carve = (x, y) => {
        for (const [dx, dy] of [[0, 0], [1, 0], [0, 1]]) {
          const cx2 = x + dx, cy2 = y + dy;
          if (inb(cx2, cy2) && at(cx2, cy2) === WALL) set(cx2, cy2, FLOOR);
        }
      };
      let x = x0, y = y0;
      while (x !== x1) { carve(x, y); x += Math.sign(x1 - x); }
      while (y !== y1) { carve(x, y); y += Math.sign(y1 - y); }
      carve(x, y);
    }
    for (let i = 1; i < connected.length; i++) {
      corridor(connected[i - 1].cx, connected[i - 1].cy,
               connected[i].cx, connected[i].cy);
    }

    // ---- vault: χαράζεται ΜΕΤΑ τους διαδρόμους ώστε να μένει σφραγισμένο ----
    let vaultDoor = null;
    if (vaultRoom) {
      let intact = true;
      for (let y = vaultRoom.y; y < vaultRoom.y + vaultRoom.h && intact; y++) {
        for (let x = vaultRoom.x; x < vaultRoom.x + vaultRoom.w; x++) {
          if (at(x, y) !== WALL) { intact = false; break; }
        }
      }
      if (!intact) {
        vaultRoom = null;      // διάδρομος πέρασε από μέσα — ακύρωση
      } else {
        for (let y = vaultRoom.y; y < vaultRoom.y + vaultRoom.h; y++) {
          for (let x = vaultRoom.x; x < vaultRoom.x + vaultRoom.w; x++) {
            set(x, y, VAULT_FLOOR);
          }
        }
        // σκάψε 1-πλάτους πέρασμα προς το κοντινότερο δωμάτιο· το πρώτο
        // κελί που ακουμπά υπάρχον FLOOR γίνεται η πόρτα του vault.
        let best = null, bd = 1e9;
        for (const r of connected) {
          const d = (r.cx - vaultRoom.cx) ** 2 + (r.cy - vaultRoom.cy) ** 2;
          if (d < bd) { bd = d; best = r; }
        }
        let x = vaultRoom.cx, y = vaultRoom.cy;
        const path = [];
        while (x !== best.cx) { x += Math.sign(best.cx - x); path.push([x, y]); }
        while (y !== best.cy) { y += Math.sign(best.cy - y); path.push([x, y]); }
        for (const [px, py] of path) {
          if (!inb(px, py) || at(px, py) === FLOOR) break;
          const touching = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) =>
            at(px + dx, py + dy) === FLOOR);
          if (touching) {
            set(px, py, VAULT_DOOR);
            vaultDoor = { x: px, y: py };
            break;
          }
          if (at(px, py) === WALL) set(px, py, VAULT_FLOOR);
        }
        if (!vaultDoor) vaultRoom = null;  // δεν βγήκε πόρτα — ξέχνα το vault
      }
    }

    // ---- elevator εισόδου/εξόδου ----
    const entryRoom = connected[0];
    let exitRoom = connected[0], xd = -1;
    for (const r of connected) {
      const d = (r.cx - entryRoom.cx) ** 2 + (r.cy - entryRoom.cy) ** 2;
      if (d > xd) { xd = d; exitRoom = r; }
    }
    set(entryRoom.cx, entryRoom.cy, ELEV_IN);
    set(exitRoom.cx, exitRoom.cy, ELEV_OUT);
    const entry = { x: entryRoom.cx + 0.5, y: entryRoom.cy + 1.5 };
    const exit = { x: exitRoom.cx + 0.5, y: exitRoom.cy + 0.5 };

    const boss = !opts.noBoss && floorNum % 10 === 0;

    // ---- κλείδωμα εξόδου + keycard ----
    const locked = !boss && floorNum >= T.LOCK_FROM && rand() < T.LOCK_CHANCE;
    let keycardAt = null;
    if (locked) {
      const cands = connected.filter(r => r !== entryRoom && r !== exitRoom);
      const kr = cands.length ? cands[(rand() * cands.length) | 0] : exitRoom;
      keycardAt = {
        x: kr.x + 1 + (rand() * (kr.w - 2) | 0) + 0.5,
        y: kr.y + 1 + (rand() * (kr.h - 2) | 0) + 0.5,
      };
    }

    // ---- loot props (piles/crates) ----
    const props = new Map();     // "x,y" -> {kind, hp}
    function place(r, kind) {
      for (let tries = 0; tries < 12; tries++) {
        const x = r.x + 1 + (rand() * (r.w - 2) | 0);
        const y = r.y + 1 + (rand() * (r.h - 2) | 0);
        const t = at(x, y);
        if ((t !== FLOOR && t !== VAULT_FLOOR) || props.has(x + ',' + y)) continue;
        if (Math.abs(x + 0.5 - entry.x) < 2 && Math.abs(y + 0.5 - entry.y) < 2) continue;
        props.set(x + ',' + y, { kind, hp: kind === 'crate' ? 3 : 2, tx: x, ty: y });
        return;
      }
    }
    for (const r of connected) {
      if (r === entryRoom) continue;
      const n = 1 + (rand() * 3 | 0);
      for (let i = 0; i < n; i++) place(r, rand() < 0.35 ? 'crate' : 'pile');
    }
    if (vaultRoom) for (let i = 0; i < 4; i++) place(vaultRoom, 'crate');

    // ---- θέσεις shades ----
    const shadeSpawns = [];
    const count = boss
      ? Math.ceil((T.SHADE_BASE + floorNum * T.SHADE_PER_FLOOR) / 2)
      : Math.min(T.SHADE_MAX, Math.round(T.SHADE_BASE + floorNum * T.SHADE_PER_FLOOR));
    for (let tries = 0; tries < 200 && shadeSpawns.length < count; tries++) {
      const x = 1 + (rand() * (W - 2) | 0), y = 1 + (rand() * (H - 2) | 0);
      if (at(x, y) !== FLOOR || props.has(x + ',' + y)) continue;
      if (Math.hypot(x + 0.5 - entry.x, y + 0.5 - entry.y) < 7) continue;
      shadeSpawns.push({ x: x + 0.5, y: y + 0.5 });
    }
    if (boss) {
      // ο φύλακας «συνθλίβει» ό,τι prop βρεθεί στο σημείο γέννησής του
      props.delete((exit.x | 0) + ',' + ((exit.y + 1) | 0));
      shadeSpawns.push({ x: exit.x, y: exit.y + 1, boss: true });
    }

    // συνολικό scrap του ορόφου (για daily score fraction)
    let lootTotal = 0;
    for (const [, p] of props) lootTotal += p.kind === 'crate' ? 10 : 5;

    return {
      floorNum, W, H, tiles, props, rooms,
      entry, exit, vaultDoor, keycardAt, locked, boss,
      shadeSpawns, lootTotal, seed,
      vaultOpen: false,
    };
  }

  // ---------- collision ----------
  function tileAt(w, wx, wy) {
    const x = wx | 0, y = wy | 0;
    if (x < 0 || y < 0 || x >= w.W || y >= w.H) return WALL;
    return w.tiles[y * w.W + x];
  }

  const SOLID_PROPS = new Set(['pile', 'crate']);

  function blocked(w, wx, wy) {
    const t = tileAt(w, wx, wy);
    if (t === WALL) return true;
    if (t === VAULT_DOOR && !w.vaultOpen) return true;
    const p = w.props.get((wx | 0) + ',' + (wy | 0));
    if (p && SOLID_PROPS.has(p.kind)) return true;
    return false;
  }

  function move(w, ent, dx, dy, r) {
    const free = (nx, ny) => {
      for (const [ox, oy] of [[-r, 0], [r, 0], [0, -r], [0, r]]) {
        if (blocked(w, nx + ox, ny + oy)) return false;
      }
      return true;
    };
    if (free(ent.x + dx, ent.y)) ent.x += dx;
    if (free(ent.x, ent.y + dy)) ent.y += dy;
  }

  /* world → screen */
  function toScreen(wx, wy, cam, vw, vh) {
    return {
      x: (wx - cam.x) * PPU + vw / 2,
      y: (wy - cam.y) * PPU + vh / 2,
    };
  }

  /* Σχεδίαση ορατών tiles. */
  function render(ctx, w, cam, vw, vh, biome) {
    const ts = Assets.biomeTiles(biome);
    const x0 = Math.max(0, Math.floor(cam.x - vw / 2 / PPU) - 1);
    const x1 = Math.min(w.W - 1, Math.ceil(cam.x + vw / 2 / PPU) + 1);
    const y0 = Math.max(0, Math.floor(cam.y - vh / 2 / PPU) - 1);
    const y1 = Math.min(w.H - 1, Math.ceil(cam.y + vh / 2 / PPU) + 1);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const t = w.tiles[y * w.W + x];
        let img;
        if (t === WALL) img = ts.wall;
        else if (t === ELEV_IN) img = ts.elevIn;
        else if (t === ELEV_OUT) img = ts.elevOut;
        else if (t === VAULT_DOOR) img = w.vaultOpen ? ts.floorA : ts.vaultDoor;
        else if (t === VAULT_FLOOR) img = ts.vaultFloor;
        else img = ((x * 7 + y * 13) % 3 === 0) ? ts.floorB : ts.floorA;
        const s = toScreen(x, y, cam, vw, vh);
        ctx.drawImage(img, Math.round(s.x), Math.round(s.y), PPU, PPU);
      }
    }
  }

  return {
    PPU, WALL, FLOOR, ELEV_IN, ELEV_OUT, VAULT_DOOR, VAULT_FLOOR,
    SOLID_PROPS,
    generate, tileAt, blocked, move, toScreen, render, mulberry,
  };
})();
