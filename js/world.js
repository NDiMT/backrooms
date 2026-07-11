/* DRIFTLAND — Παραγωγή νησιού (value noise + radial falloff) και
   chunked tilemap rendering. Ο κόσμος είναι deterministic από seed·
   οι αλλαγές (κομμένα δέντρα, κτίσματα) κρατιούνται ως diffs. */

const World = (() => {
  const SIZE = 128;       // tiles ανά πλευρά
  const TS = 32;          // μέγεθος tile σε px
  const CHUNK = 16;       // tiles ανά chunk

  const DEEP = 0, WATER = 1, SAND = 2, GRASS = 3, JUNGLE = 4, ROCK = 5;
  const TILE_KEYS = ['water_deep', 'water', 'sand', 'grass', 'jungle', 'rock'];

  function mulberry(seed) {
    let a = seed >>> 0;
    return () => {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Value noise: πλέγμα τυχαίων τιμών + bilinear + 3 οκτάβες. */
  function makeNoise(rand) {
    const G = 17;
    const grid = [];
    for (let y = 0; y <= G; y++) {
      grid.push(Array.from({ length: G + 1 }, () => rand()));
    }
    function at(fx, fy) {
      const x0 = fx | 0, y0 = fy | 0;
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

  function generate(seed) {
    const rand = mulberry(seed);
    const noise = makeNoise(rand);
    const tiles = new Uint8Array(SIZE * SIZE);

    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const nx = x / SIZE, ny = y / SIZE;
        const dx = nx - 0.5, dy = ny - 0.5;
        const d = Math.sqrt(dx * dx + dy * dy) * 2;   // 0 κέντρο → 1 άκρη
        const e = noise(nx, ny) - d * d * 0.85;
        let t;
        if (e < 0.02) t = DEEP;
        else if (e < 0.14) t = WATER;
        else if (e < 0.22) t = SAND;
        else if (e < 0.40) t = GRASS;
        else if (e < 0.52) t = JUNGLE;
        else t = ROCK;
        tiles[y * SIZE + x] = t;
      }
    }

    // props: deterministic πάνω στο έδαφος
    const props = new Map();   // "x,y" -> {kind, hp, ...}
    const propRand = mulberry(seed ^ 0x9e3779b9);
    for (let y = 2; y < SIZE - 2; y++) {
      for (let x = 2; x < SIZE - 2; x++) {
        const t = tiles[y * SIZE + x];
        const r = propRand();
        let kind = null;
        if (t === GRASS && r < 0.045) kind = 'tree';
        else if (t === JUNGLE && r < 0.11) kind = 'tree';
        else if (t === SAND && r < 0.02) kind = 'palm';
        else if (t === GRASS && r >= 0.045 && r < 0.062) kind = 'palm';
        else if ((t === ROCK || t === JUNGLE) && r >= 0.11 && r < 0.145) kind = 'rock';
        else if (t === GRASS && r >= 0.062 && r < 0.085) kind = 'bush';
        else if (t === SAND && r >= 0.02 && r < 0.032) kind = 'driftwood';
        if (kind) props.set(x + ',' + y, freshProp(kind));
      }
    }

    // σημείο εκκίνησης: παραλία κοντά στο νότο + ναυάγιο δίπλα
    let spawn = null;
    outer:
    for (let y = SIZE - 3; y > SIZE / 2; y--) {
      for (let x = SIZE / 2 - 20; x < SIZE / 2 + 20; x++) {
        if (tiles[y * SIZE + x] === SAND && tiles[(y - 1) * SIZE + x] === SAND) {
          spawn = { x: x + 0.5, y: y - 0.5 };
          break outer;
        }
      }
    }
    if (!spawn) spawn = { x: SIZE / 2, y: SIZE / 2 }; // απίθανο fallback

    // ναυάγιο + θέση σκάφους 2 tiles δίπλα
    const wx = Math.round(spawn.x) + 2, wy = Math.round(spawn.y);
    props.set(wx + ',' + wy, freshProp('wreck'));
    const raftSpot = { x: wx - 1, y: wy + 1 };
    props.delete(raftSpot.x + ',' + raftSpot.y);

    return {
      seed, tiles, props, spawn, raftSpot,
      placed: [],           // ids τοποθετημένων buildables (για save)
    };
  }

  function freshProp(kind) {
    const HP = { tree: 5, palm: 5, rock: 6, bush: 1, driftwood: 1, wreck: 1e9 };
    return { kind, hp: HP[kind] || 1, looted: false, regrow: 0 };
  }

  function tileAt(w, x, y) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return DEEP;
    return w.tiles[y * SIZE + x];
  }

  const SOLID_PROPS = new Set(['tree', 'palm', 'rock', 'wreck', 'wall',
    'chest', 'workbench', 'bed', 'raft']);

  function blocked(w, x, y) {
    const t = tileAt(w, x, y);
    if (t === DEEP || t === WATER) return true;
    const p = w.props.get((x | 0) + ',' + (y | 0));
    if (p && SOLID_PROPS.has(p.kind)) return true;
    return false;
  }

  /* Κίνηση κύκλου με sliding: δοκίμασε x και y χωριστά. */
  function move(w, ent, dx, dy, r) {
    const tryAxis = (nx, ny) => {
      for (const [ox, oy] of [[-r, -r], [r, -r], [-r, r], [r, r]]) {
        if (blocked(w, nx + ox, ny + oy)) return false;
      }
      return true;
    };
    if (tryAxis(ent.x + dx, ent.y)) ent.x += dx;
    if (tryAxis(ent.x, ent.y + dy)) ent.y += dy;
  }

  // ---------- chunked rendering ----------
  const chunkCache = new Map();   // "cx,cy" -> canvas
  let cacheWorld = null;

  function invalidate(x, y) {
    chunkCache.delete(((x / CHUNK) | 0) + ',' + ((y / CHUNK) | 0));
  }
  function invalidateAll() { chunkCache.clear(); }

  function chunkCanvas(w, cx, cy) {
    const key = cx + ',' + cy;
    if (cacheWorld !== w) { chunkCache.clear(); cacheWorld = w; }
    let c = chunkCache.get(key);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = CHUNK * TS; c.height = CHUNK * TS;
    const x2 = c.getContext('2d');
    x2.imageSmoothingEnabled = false;
    for (let ty = 0; ty < CHUNK; ty++) {
      for (let tx = 0; tx < CHUNK; tx++) {
        const gx = cx * CHUNK + tx, gy = cy * CHUNK + ty;
        const t = tileAt(w, gx, gy);
        // δειγματοληψία με offset μέσα στη μεγάλη υφή: γειτονικά tiles
        // συνεχίζουν την ίδια υφή αντί να επαναλαμβάνουν το ίδιο πλακάκι
        const tex = Assets.tiles[TILE_KEYS[t]];
        const sx = ((gx * TS) % tex.width + tex.width) % tex.width;
        const sy = ((gy * TS) % tex.height + tex.height) % tex.height;
        const sw = Math.min(TS, tex.width - sx), sh = Math.min(TS, tex.height - sy);
        x2.drawImage(tex, sx, sy, sw, sh, tx * TS, ty * TS, sw, sh);
        if (sw < TS) x2.drawImage(tex, 0, sy, TS - sw, sh, tx * TS + sw, ty * TS, TS - sw, sh);
        if (sh < TS) x2.drawImage(tex, sx, 0, sw, TS - sh, tx * TS, ty * TS + sh, sw, TS - sh);
        if (sw < TS && sh < TS) {
          x2.drawImage(tex, 0, 0, TS - sw, TS - sh, tx * TS + sw, ty * TS + sh, TS - sw, TS - sh);
        }
        // ελαφριά ακμή στεριάς προς νερό
        if (t >= SAND) {
          x2.fillStyle = 'rgba(0,0,0,0.12)';
          if (tileAt(w, gx, gy + 1) <= WATER) x2.fillRect(tx * TS, ty * TS + TS - 2, TS, 2);
          if (tileAt(w, gx + 1, gy) <= WATER) x2.fillRect(tx * TS + TS - 2, ty * TS, 2, TS);
          if (tileAt(w, gx - 1, gy) <= WATER) x2.fillRect(tx * TS, ty * TS, 2, TS);
          if (tileAt(w, gx, gy - 1) <= WATER) x2.fillRect(tx * TS, ty * TS, TS, 2);
        }
      }
    }
    chunkCache.set(key, c);
    return c;
  }

  /* Ζωγραφίζει τα ορατά chunks γύρω από την κάμερα. */
  function render(ctx, w, cam, vw, vh) {
    const x0 = Math.floor((cam.x * TS - vw / 2) / (CHUNK * TS));
    const y0 = Math.floor((cam.y * TS - vh / 2) / (CHUNK * TS));
    const x1 = Math.floor((cam.x * TS + vw / 2) / (CHUNK * TS));
    const y1 = Math.floor((cam.y * TS + vh / 2) / (CHUNK * TS));
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        if (cx < 0 || cy < 0 || cx >= SIZE / CHUNK || cy >= SIZE / CHUNK) continue;
        ctx.drawImage(chunkCanvas(w, cx, cy),
          Math.round(cx * CHUNK * TS - cam.x * TS + vw / 2),
          Math.round(cy * CHUNK * TS - cam.y * TS + vh / 2));
      }
    }
  }

  return {
    SIZE, TS, CHUNK, DEEP, WATER, SAND, GRASS, JUNGLE, ROCK, TILE_KEYS,
    SOLID_PROPS, generate, freshProp, tileAt, blocked, move,
    render, invalidate, invalidateAll, mulberry,
  };
})();
