/* DRIFTLAND — Νησί σε ΕΞΑΓΩΝΙΚΟ ισομετρικό πλέγμα.

   Pointy-top hexes σε offset rows. Συντεταγμένες κόσμου σε "hex widths":
   κέντρο hex (col,row) = (col + (row&1)*0.5, row*VSTEP). Η κίνηση είναι
   συνεχής· το terrain/collision γίνεται με εύρεση κοντινότερου hex.
   Τα tile sprites (assets 112x144) έχουν top face 83x56 και πρίσμα
   βάθους 26 — το πλέγμα κουμπώνει με VSTEP = 42/83. */

const World = (() => {
  const COLS = 128, ROWS = 128;
  const VSTEP = 42 / 83;          // απόσταση σειρών σε world units
  const PPU = 44;                 // pixels ανά world unit στην οθόνη

  // γεωμετρία sprite (πηγή 112x144)
  const SPR_W = 112, SPR_H = 144;
  const TOP_CX = 56, TOP_CY = 8 + 55.7 / 2;   // κέντρο top face στο sprite
  const HEX_W = 83;                            // πλάτος top face σε px πηγής
  const SCALE = PPU / HEX_W;                   // κλίμακα σχεδίασης tiles

  const DEEP = 0, WATER = 1, SAND = 2, GRASS = 3, JUNGLE = 4, ROCK = 5;
  const TILE_KEYS = ['hex_water_deep', 'hex_water', 'hex_sand',
    'hex_grass', 'hex_jungle', 'hex_rock'];

  function mulberry(seed) {
    let a = seed >>> 0;
    return () => {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeNoise(rand) {
    const G = 17;
    const grid = [];
    for (let y = 0; y <= G; y++) {
      grid.push(Array.from({ length: G + 1 }, () => rand()));
    }
    function at(fx, fy) {
      const x0 = Math.min(G - 1, fx | 0), y0 = Math.min(G - 1, fy | 0);
      const tx = fx - x0, ty = fy - y0;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const a = grid[y0][x0], b = grid[y0][x0 + 1];
      const c = grid[y0 + 1][x0], d = grid[y0 + 1][x0 + 1];
      return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    }
    return (nx, ny) =>
      at(nx * 4, ny * 4) * 0.62 +
      at(nx * 8, ny * 8) * 0.28 +
      at(nx * 16, ny * 16) * 0.10;
  }

  /* Κέντρο hex σε world coords. */
  function hexCenter(col, row) {
    return { x: col + (row & 1) * 0.5, y: row * VSTEP };
  }

  /* Κοντινότερο hex σε world point. */
  function hexAt(wx, wy) {
    const r0 = Math.round(wy / VSTEP);
    let best = null, bd = 1e9;
    for (let r = r0 - 1; r <= r0 + 1; r++) {
      const c = Math.round(wx - (r & 1) * 0.5);
      const ctr = hexCenter(c, r);
      const d = (ctr.x - wx) ** 2 + ((ctr.y - wy) * 1.15) ** 2;
      if (d < bd) { bd = d; best = { col: c, row: r }; }
    }
    return best;
  }

  function generate(seed) {
    const rand = mulberry(seed);
    const noise = makeNoise(rand);
    const tiles = new Uint8Array(COLS * ROWS);

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const nx = col / COLS, ny = row / ROWS;
        const dx = nx - 0.5, dy = ny - 0.5;
        const d = Math.sqrt(dx * dx + dy * dy) * 2;
        const e = noise(nx, ny) - d * d * 0.85;
        let t;
        if (e < 0.02) t = DEEP;
        else if (e < 0.14) t = WATER;
        else if (e < 0.22) t = SAND;
        else if (e < 0.40) t = GRASS;
        else if (e < 0.52) t = JUNGLE;
        else t = ROCK;
        tiles[row * COLS + col] = t;
      }
    }

    // props ανά hex
    const props = new Map();   // "col,row" -> prop
    const propRand = mulberry(seed ^ 0x9e3779b9);
    for (let row = 2; row < ROWS - 2; row++) {
      for (let col = 2; col < COLS - 2; col++) {
        const t = tiles[row * COLS + col];
        const r = propRand();
        let kind = null;
        if (t === GRASS && r < 0.05) kind = 'tree';
        else if (t === JUNGLE && r < 0.12) kind = 'tree';
        else if (t === SAND && r < 0.02) kind = 'palm';
        else if (t === GRASS && r >= 0.05 && r < 0.068) kind = 'palm';
        else if ((t === ROCK || t === JUNGLE) && r >= 0.12 && r < 0.16) kind = 'rock';
        else if (t === GRASS && r >= 0.068 && r < 0.095) kind = 'bush';
        else if (t === SAND && r >= 0.02 && r < 0.034) kind = 'driftwood';
        if (kind) props.set(col + ',' + row, freshProp(kind));
      }
    }

    // spawn σε παραλία (νότια) + ναυάγιο + θέση σκάφους
    let spawnHex = null;
    outer:
    for (let row = ROWS - 3; row > ROWS / 2; row--) {
      for (let col = COLS / 2 - 22; col < COLS / 2 + 22; col++) {
        if (tiles[row * COLS + col] === SAND &&
            tiles[(row - 1) * COLS + col] === SAND) {
          spawnHex = { col, row };
          break outer;
        }
      }
    }
    if (!spawnHex) spawnHex = { col: COLS / 2, row: ROWS / 2 };
    const spawn = hexCenter(spawnHex.col, spawnHex.row);

    const wCol = spawnHex.col + 2, wRow = spawnHex.row - 1;
    props.set(wCol + ',' + wRow, freshProp('wreck'));
    const raftSpot = { col: wCol - 1, row: wRow + 2 };
    props.delete(raftSpot.col + ',' + raftSpot.row);

    return { seed, tiles, props, spawn, raftSpot };
  }

  function freshProp(kind) {
    const HP = { tree: 5, palm: 5, rock: 6, bush: 1, driftwood: 1, wreck: 1e9 };
    return { kind, hp: HP[kind] || 1, looted: false, regrow: 0 };
  }

  function tileAtHex(w, col, row) {
    if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return DEEP;
    return w.tiles[row * COLS + col];
  }
  function tileAt(w, wx, wy) {
    const h = hexAt(wx, wy);
    return tileAtHex(w, h.col, h.row);
  }

  const SOLID_PROPS = new Set(['tree', 'palm', 'rock', 'wreck', 'wall',
    'chest', 'workbench', 'bed', 'raft']);

  function blocked(w, wx, wy) {
    const h = hexAt(wx, wy);
    const t = tileAtHex(w, h.col, h.row);
    if (t === DEEP || t === WATER) return true;
    const p = w.props.get(h.col + ',' + h.row);
    if (p && SOLID_PROPS.has(p.kind)) return true;
    return false;
  }

  function move(w, ent, dx, dy, r) {
    const free = (nx, ny) => {
      for (const [ox, oy] of [[-r, 0], [r, 0], [0, -r * 0.7], [0, r * 0.7]]) {
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

  /* Σχεδίαση ορατών hexes, σειρές από πάνω προς τα κάτω. */
  function render(ctx, w, cam, vw, vh) {
    const rowH = VSTEP * PPU;                 // 22.3 px
    const r0 = Math.floor((cam.y - vh / 2 / PPU) / VSTEP) - 1;
    const r1 = Math.ceil((cam.y + vh / 2 / PPU) / VSTEP) + 3;
    const c0 = Math.floor(cam.x - vw / 2 / PPU) - 1;
    const c1 = Math.ceil(cam.x + vw / 2 / PPU) + 1;
    const dw = SPR_W * SCALE, dh = SPR_H * SCALE;
    for (let row = Math.max(0, r0); row <= Math.min(ROWS - 1, r1); row++) {
      for (let col = Math.max(0, c0); col <= Math.min(COLS - 1, c1); col++) {
        const t = tileAtHex(w, col, row);
        const img = Assets.tiles[TILE_KEYS[t]];
        const ctr = hexCenter(col, row);
        const s = toScreen(ctr.x, ctr.y, cam, vw, vh);
        ctx.drawImage(img,
          Math.round(s.x - TOP_CX * SCALE),
          Math.round(s.y - TOP_CY * SCALE), dw, dh);
      }
    }
  }

  return {
    COLS, ROWS, VSTEP, PPU, SCALE,
    DEEP, WATER, SAND, GRASS, JUNGLE, ROCK, TILE_KEYS, SOLID_PROPS,
    // συμβατότητα: SIZE για παλιά tests/κώδικα που σκανάρουν το grid
    SIZE: Math.min(COLS, ROWS),
    generate, freshProp, hexCenter, hexAt, tileAt, tileAtHex,
    blocked, move, toScreen, render, mulberry,
    invalidate() {}, invalidateAll() {},
  };
})();
