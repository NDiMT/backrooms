/* ΝΕΚΡΗ ΖΩΝΗ — Procedural παραγωγή deck.
   Δωμάτια + διάδρομοι (MST), πόρτες Wolf-style, ασανσέρ, spawns/loot
   κλιμακούμενα με το βάθος. Seeded RNG για αναπαραγώγιμα runs. */

const Procgen = (() => {
  const GRID = 44;

  // κελιά
  const FLOOR = 0, HULL = 1, BLOOD = 2, VENT = 3, TECH = 4;
  const DOOR = 8, ELEV = 9;

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function generate(seed, deckIdx) {
    const rand = mulberry32(seed + deckIdx * 7919);
    const grid = Array.from({ length: GRID }, () => new Array(GRID).fill(HULL));

    // ---- δωμάτια ----
    const rooms = [];
    const isBoss = deckIdx === 3;
    const wanted = isBoss ? 7 : 9;
    for (let tries = 0; tries < 250 && rooms.length < wanted; tries++) {
      const w = 4 + (rand() * 6) | 0;
      const h = 4 + (rand() * 6) | 0;
      const x = 2 + ((rand() * (GRID - w - 4)) | 0);
      const y = 2 + ((rand() * (GRID - h - 4)) | 0);
      let ok = true;
      for (const r of rooms) {
        if (x < r.x + r.w + 2 && r.x < x + w + 2 &&
            y < r.y + r.h + 2 && r.y < y + h + 2) { ok = false; break; }
      }
      if (!ok) continue;
      rooms.push({ x, y, w, h, cx: x + w / 2, cy: y + h / 2 });
    }
    // boss room: μεγαλύτερο, τελευταίο
    if (isBoss) {
      const r = rooms[rooms.length - 1];
      // μεγάλωσέ το όσο χωράει
      r.w = Math.min(12, GRID - 3 - r.x);
      r.h = Math.min(12, GRID - 3 - r.y);
      r.cx = r.x + r.w / 2; r.cy = r.y + r.h / 2;
    }
    for (const r of rooms) {
      for (let y = r.y; y < r.y + r.h; y++)
        for (let x = r.x; x < r.x + r.w; x++)
          grid[y][x] = FLOOR;
    }

    // ---- διάδρομοι: MST + 2 extra συνδέσεις ----
    const connected = [0];
    const edges = [];
    while (connected.length < rooms.length) {
      let best = null;
      for (const a of connected) {
        for (let b = 0; b < rooms.length; b++) {
          if (connected.includes(b)) continue;
          const d = Math.hypot(rooms[a].cx - rooms[b].cx, rooms[a].cy - rooms[b].cy);
          if (!best || d < best.d) best = { a, b, d };
        }
      }
      edges.push(best);
      connected.push(best.b);
    }
    for (let i = 0; i < 2 && rooms.length > 3; i++) {
      const a = (rand() * rooms.length) | 0;
      let b = (rand() * rooms.length) | 0;
      if (a !== b) edges.push({ a, b });
    }

    const corridorCells = [];
    function carve(x, y) {
      if (grid[y][x] !== FLOOR) { grid[y][x] = FLOOR; corridorCells.push({ x, y }); }
    }
    for (const e of edges) {
      let x = Math.round(rooms[e.a].cx), y = Math.round(rooms[e.a].cy);
      const tx = Math.round(rooms[e.b].cx), ty = Math.round(rooms[e.b].cy);
      const xFirst = rand() < 0.5;
      if (xFirst) {
        while (x !== tx) { carve(x, y); x += Math.sign(tx - x); }
        while (y !== ty) { carve(x, y); y += Math.sign(ty - y); }
      } else {
        while (y !== ty) { carve(x, y); y += Math.sign(ty - y); }
        while (x !== tx) { carve(x, y); x += Math.sign(tx - x); }
      }
      carve(x, y);
    }

    // ---- πόρτες: σε κελιά διαδρόμου με τοίχο εκατέρωθεν ----
    const doors = new Map();
    const doorKey = (x, y) => x + ',' + y;
    let placed = 0;
    for (const c of corridorCells) {
      if (placed > 10) break;
      const { x, y } = c;
      const wallLR = grid[y][x - 1] === HULL && grid[y][x + 1] === HULL;
      const wallUD = grid[y - 1] && grid[y - 1][x] === HULL && grid[y + 1][x] === HULL;
      const openUD = grid[y - 1] && grid[y - 1][x] === FLOOR && grid[y + 1][x] === FLOOR;
      const openLR = grid[y][x - 1] === FLOOR && grid[y][x + 1] === FLOOR;
      if ((wallLR && openUD) || (wallUD && openLR)) {
        // όχi πόρτα δίπλα σε πόρτα
        let near = false;
        for (const k of doors.keys()) {
          const [dx, dy] = k.split(',').map(Number);
          if (Math.abs(dx - x) + Math.abs(dy - y) < 3) { near = true; break; }
        }
        if (near || rand() < 0.35) continue;
        grid[y][x] = DOOR;
        doors.set(doorKey(x, y), { open: 0, target: 0, timer: 0 });
        placed++;
      }
    }

    // ---- ποικιλία τοίχων ----
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        if (grid[y][x] !== HULL) continue;
        // μόνο τοίχοι που «βλέπονται» (δίπλα σε δάπεδο)
        let exposed = false;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const n = grid[y + dy] && grid[y + dy][x + dx];
          if (n === FLOOR || n === DOOR) { exposed = true; break; }
        }
        if (!exposed) continue;
        const r = rand();
        if (r < 0.07) grid[y][x] = BLOOD;
        else if (r < 0.17) grid[y][x] = VENT;
        else if (r < 0.25) grid[y][x] = TECH;
      }
    }

    // ---- αρχή παίκτη + ασανσέρ/boss ----
    const startRoom = rooms[0];
    const playerStart = { x: startRoom.cx, y: startRoom.cy };

    // πιο μακρινό δωμάτιο = στόχος
    let farRoom = rooms[1] || rooms[0];
    let farD = 0;
    for (let i = 1; i < rooms.length; i++) {
      const d = Math.hypot(rooms[i].cx - startRoom.cx, rooms[i].cy - startRoom.cy);
      if (d > farD) { farD = d; farRoom = rooms[i]; }
    }

    let elevator = null;
    if (!isBoss) {
      // αλκόβα ασανσέρ: κελί τοίχου του farRoom με τοίχο από πίσω
      outer:
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        for (let t = 0; t < 30; t++) {
          const fx = farRoom.x + ((rand() * farRoom.w) | 0);
          const fy = farRoom.y + ((rand() * farRoom.h) | 0);
          const wx = fx + dx, wy = fy + dy;
          const bx = fx + dx * 2, by = fy + dy * 2;
          if (grid[wy] && grid[wy][wx] === HULL &&
              grid[by] && grid[by][bx] === HULL) {
            grid[wy][wx] = ELEV;
            doors.set(doorKey(wx, wy), { open: 0, target: 0, timer: 0, elevator: true });
            elevator = { x: wx + 0.5, y: wy + 0.5 };
            break outer;
          }
        }
      }
    }

    // ---- spawns εχθρών ----
    const spawns = [];
    const weights = [
      // [shambler, spitter, drone, heavy] ανά deck
      [0.75, 0.25, 0.0, 0.0],
      [0.5, 0.3, 0.2, 0.0],
      [0.35, 0.25, 0.25, 0.15],
      [0.3, 0.25, 0.2, 0.25],
    ][deckIdx] || [0.4, 0.3, 0.2, 0.1];
    const types = ['shambler', 'spitter', 'drone', 'heavy'];

    function pickType() {
      let r = rand();
      for (let i = 0; i < 4; i++) { r -= weights[i]; if (r <= 0) return types[i]; }
      return 'shambler';
    }
    function freeSpot(room) {
      for (let t = 0; t < 20; t++) {
        const x = room.x + 0.5 + ((rand() * room.w) | 0);
        const y = room.y + 0.5 + ((rand() * room.h) | 0);
        if (grid[y | 0][x | 0] === FLOOR) return { x, y };
      }
      return null;
    }

    for (let i = 1; i < rooms.length; i++) {
      const room = rooms[i];
      const isTarget = room === farRoom;
      let count = 2 + ((rand() * 2) | 0) + Math.floor(deckIdx * 1.2);
      if (isBoss && isTarget) count = 2;
      for (let n = 0; n < count; n++) {
        const p = freeSpot(room);
        if (p) spawns.push({ type: pickType(), x: p.x, y: p.y });
      }
      if (isTarget) {
        const p = freeSpot(room) || { x: room.cx, y: room.cy };
        spawns.push({ type: isBoss ? 'boss' : 'warden', x: p.x, y: p.y });
      }
    }

    // ---- pickups ----
    const pickups = [];
    function drop(kind, room) {
      const p = freeSpot(room);
      if (p) pickups.push({ kind, x: p.x, y: p.y });
    }
    for (let i = 1; i < rooms.length; i++) {
      const room = rooms[i];
      if (rand() < 0.55) drop('medkit', room);
      if (rand() < 0.6) drop(rand() < 0.55 ? 'shells' : 'cells', room);
      if (rand() < 0.35) drop('scrap', room);
    }
    // εγγυημένο όπλο ανά deck (στο 2ο κοντινότερο δωμάτιο)
    const wpnByDeck = ['wShotgun', 'wRifle', 'wLauncher', null][deckIdx];
    if (wpnByDeck && rooms.length > 2) drop(wpnByDeck, rooms[1 + ((rand() * (rooms.length - 2)) | 0)]);

    // ---- τερματικά καταστήματος ----
    const terminals = [];
    for (let i = 0; i < 2 && rooms.length > 3; i++) {
      const room = rooms[1 + ((rand() * (rooms.length - 1)) | 0)];
      const p = freeSpot(room);
      if (p) terminals.push({ x: (p.x | 0) + 0.5, y: (p.y | 0) + 0.5 });
    }

    return {
      grid, rooms, doors, playerStart, elevator, spawns, pickups, terminals,
      seed, deckIdx,
      doorAt(x, y) {
        const d = doors.get(x + ',' + y);
        return d ? d.open : 0;
      },
      texFor(cell, theme) {
        const set = Assets.deckTex[theme.idx] || Assets.deckTex[0];
        switch (cell) {
          case BLOOD: return set.hullBlood;
          case VENT: return set.vent;
          case TECH: return deckIdx === 3 ? set.core : set.tech;
          case DOOR: return set.door;
          case ELEV: return set.elevator;
          default: return set.hull;
        }
      },
    };
  }

  /* Σύγκρουση κύκλου ακτίνας r με τοίχους/κλειστές πόρτες. */
  function blocked(world, wx, wy, r) {
    const cx = wx | 0, cy = wy | 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const gx = cx + dx, gy = cy + dy;
        const cell = world.grid[gy] && world.grid[gy][gx];
        if (cell === undefined) return true;
        if (cell === FLOOR) continue;
        if ((cell === DOOR || cell === ELEV) && world.doorAt(gx, gy) > 0.75) continue;
        const nx = Math.max(gx, Math.min(wx, gx + 1));
        const ny = Math.max(gy, Math.min(wy, gy + 1));
        const ddx = wx - nx, ddy = wy - ny;
        if (ddx * ddx + ddy * ddy < r * r) return true;
      }
    }
    return false;
  }

  /* Κίνηση με ολίσθηση στους τοίχους. Επιστρέφει true αν μπλοκαρίστηκε. */
  function move(world, pos, dx, dy, r) {
    let hit = false;
    if (!blocked(world, pos.x + dx, pos.y, r)) pos.x += dx; else hit = true;
    if (!blocked(world, pos.x, pos.y + dy, r)) pos.y += dy; else hit = true;
    return hit;
  }

  return { GRID, FLOOR, HULL, DOOR, ELEV, generate, blocked, move };
})();
