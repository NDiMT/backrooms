/* ΝΕΚΡΗ ΖΩΝΗ — Raycasting engine (καθαρό Canvas 2D, εσωτερική ανάλυση 320x180).
   DDA πάνω σε grid, textured τοίχοι, συρόμενες πόρτες τύπου Wolf3D,
   sprites-billboards με z-buffer, απόσταση-fog. */

const Engine = (() => {
  const W = 320, H = 180;
  const VH = 144;             // ύψος 3D view (κάτω 36px = HUD)
  const HORIZON = VH / 2;
  const FOV = Math.PI / 3;    // 60°
  const PLANE = Math.tan(FOV / 2);
  const MAX_DIST = 22;

  const zbuffer = new Float32Array(W);

  // προ-ζωγραφισμένες λωρίδες δαπέδου/οροφής ανά θέμα deck
  let floorStrip = null, ceilStrip = null, themeIdx = -1;

  function buildFloorCeil(theme) {
    // theme: {floor:'#..', ceil:'#..'}
    floorStrip = document.createElement('canvas');
    floorStrip.width = 1; floorStrip.height = VH - HORIZON;
    let ctx = floorStrip.getContext('2d');
    let g = ctx.createLinearGradient(0, 0, 0, floorStrip.height);
    g.addColorStop(0, shade(theme.floor, 0.15));
    g.addColorStop(1, theme.floor);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1, floorStrip.height);
    // dithering γραμμές για ρετρό υφή
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let y = 0; y < floorStrip.height; y += 2) ctx.fillRect(0, y, 1, 1);

    ceilStrip = document.createElement('canvas');
    ceilStrip.width = 1; ceilStrip.height = HORIZON;
    ctx = ceilStrip.getContext('2d');
    g = ctx.createLinearGradient(0, 0, 0, HORIZON);
    g.addColorStop(0, theme.ceil);
    g.addColorStop(1, shade(theme.ceil, 0.15));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1, HORIZON);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let y = 0; y < HORIZON; y += 2) ctx.fillRect(0, y, 1, 1);
  }

  function shade(hex, mul) {
    const n = parseInt(hex.slice(1), 16);
    const r = ((n >> 16) & 255) * mul | 0;
    const g = ((n >> 8) & 255) * mul | 0;
    const b = (n & 255) * mul | 0;
    return `rgb(${r},${g},${b})`;
  }

  /* Ρίχνει μία ακτίνα. Επιστρέφει {dist, texU, tex, side} ή null.
     world: {grid, doorAt(x,y) -> 0..1 (πόσο ανοιχτή), texFor(cell)} */
  function cast(world, px, py, dirX, dirY) {
    let mapX = px | 0, mapY = py | 0;
    const ddx = Math.abs(1 / (dirX || 1e-9));
    const ddy = Math.abs(1 / (dirY || 1e-9));
    let stepX, stepY, sdx, sdy;
    if (dirX < 0) { stepX = -1; sdx = (px - mapX) * ddx; }
    else { stepX = 1; sdx = (mapX + 1 - px) * ddx; }
    if (dirY < 0) { stepY = -1; sdy = (py - mapY) * ddy; }
    else { stepY = 1; sdy = (mapY + 1 - py) * ddy; }

    for (let i = 0; i < 64; i++) {
      let side;
      if (sdx < sdy) { sdx += ddx; mapX += stepX; side = 0; }
      else { sdy += ddy; mapY += stepY; side = 1; }
      const cell = world.grid[mapY] && world.grid[mapY][mapX];
      if (cell === undefined) return null;
      if (cell === 0) continue;

      if (cell === Engine.DOOR || cell === Engine.ELEVATOR) {
        // πόρτα: επίπεδο στο μέσο του κελιού, γλιστράει πλάγια κατά open
        const open = world.doorAt(mapX, mapY);
        let dist, frac;
        if (side === 0) {
          dist = (mapX - px + (1 - stepX) / 2 + stepX * 0.5) / dirX;
          frac = (py + dist * dirY) - mapY;
        } else {
          dist = (mapY - py + (1 - stepY) / 2 + stepY * 0.5) / dirY;
          frac = (px + dist * dirX) - mapX;
        }
        if (frac < 0 || frac >= 1) continue;      // η ακτίνα προσπερνά το κελί
        if (frac < 1 - open) {                     // το φύλλο της πόρτας
          return { dist, texU: frac + open, cell, side };
        }
        continue;                                  // πέρασε από το άνοιγμα
      }

      // κανονικός τοίχος
      let dist, frac;
      if (side === 0) {
        dist = (mapX - px + (1 - stepX) / 2) / dirX;
        frac = (py + dist * dirY) % 1;
      } else {
        dist = (mapY - py + (1 - stepY) / 2) / dirY;
        frac = (px + dist * dirX) % 1;
      }
      return { dist, texU: frac, cell, side };
    }
    return null;
  }

  /* Απλός έλεγχος οπτικής επαφής μέχρι απόσταση maxD. */
  function lineOfSight(world, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const d = Math.hypot(dx, dy);
    if (d < 0.001) return true;
    const hit = cast(world, x1, y1, dx / d, dy / d);
    return !hit || hit.dist >= d;
  }

  function render(ctx, world, cam, sprites, theme, tick) {
    if (theme.idx !== themeIdx) { buildFloorCeil(theme); themeIdx = theme.idx; }

    // οροφή/δάπεδο
    ctx.drawImage(ceilStrip, 0, 0, 1, HORIZON, 0, 0, W, HORIZON);
    ctx.drawImage(floorStrip, 0, 0, 1, VH - HORIZON, 0, HORIZON, W, VH - HORIZON);

    const dirX = Math.cos(cam.angle), dirY = Math.sin(cam.angle);
    const planeX = -dirY * PLANE, planeY = dirX * PLANE;

    // --- τοίχοι ---
    for (let x = 0; x < W; x++) {
      const camX = 2 * x / W - 1;
      const rdx = dirX + planeX * camX;
      const rdy = dirY + planeY * camX;
      const hit = cast(world, cam.x, cam.y, rdx, rdy);
      if (!hit) { zbuffer[x] = MAX_DIST; continue; }
      // με unnormalized ray direction, το dist του DDA είναι ήδη η κάθετη
      // απόσταση — δεν χρειάζεται διόρθωση fisheye
      const dist = hit.dist;
      zbuffer[x] = dist;

      const lineH = VH / dist;
      const y0 = HORIZON - lineH / 2;
      const tex = world.texFor(hit.cell, theme);
      const tx = Math.min(tex.width - 1, (hit.texU * tex.width) | 0);
      ctx.drawImage(tex, tx, 0, 1, tex.height, x, y0, 1, lineH);

      // σκίαση: απόσταση + σκοτεινότερη πλευρά
      let sh = Math.min(0.92, dist / MAX_DIST * 1.15 + (hit.side ? 0.18 : 0));
      if (sh > 0.02) {
        ctx.fillStyle = `rgba(0,0,0,${sh.toFixed(3)})`;
        ctx.fillRect(x, y0, 1, lineH);
      }
    }

    // --- sprites ---
    // sprites: [{x, y, img, worldH, yOff, bright, flash}]
    const invDet = 1 / (planeX * dirY - dirX * planeY);
    const order = [];
    for (const s of sprites) {
      const dx = s.x - cam.x, dy = s.y - cam.y;
      const ty = invDet * (-planeY * dx + planeX * dy);   // βάθος
      if (ty <= 0.15) continue;
      const txx = invDet * (dirY * dx - dirX * dy);
      order.push({ s, ty, txx });
    }
    order.sort((a, b) => b.ty - a.ty);

    for (const { s, ty, txx } of order) {
      const img = s.img;
      const screenX = (W / 2) * (1 + txx / ty);
      const lineH = VH / ty;
      const hpx = lineH * s.worldH;
      const wpx = hpx * (img.width / img.height);
      const floorY = HORIZON + lineH / 2;
      const drawY = floorY - hpx - lineH * (s.yOff || 0);
      const x0 = Math.max(0, Math.ceil(screenX - wpx / 2));
      const x1 = Math.min(W - 1, Math.floor(screenX + wpx / 2));
      if (x1 < 0 || x0 > W - 1 || hpx < 1) continue;

      const fog = s.bright ? 0.15 : Math.min(0.85, ty / MAX_DIST * 1.1);
      ctx.globalAlpha = Math.max(0.1, 1 - fog);
      for (let x = x0; x <= x1; x++) {
        if (ty >= zbuffer[x]) continue;
        const u = (x - (screenX - wpx / 2)) / wpx;
        const sx = Math.min(img.width - 1, (u * img.width) | 0);
        ctx.drawImage(img, sx, 0, 1, img.height, x, drawY, 1, hpx);
      }
      ctx.globalAlpha = 1;
      if (s.flash) {
        // στιγμιαία λάμψη (πόνος) — πρόχειρο λευκό στο πλάτος του sprite
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = '#fff';
        ctx.fillRect(x0, drawY, x1 - x0, hpx);
        ctx.globalAlpha = 1;
      }
    }

    return zbuffer;
  }

  return {
    W, H, VH, HORIZON, FOV, MAX_DIST,
    DOOR: 8, ELEVATOR: 9,
    cast, lineOfSight, render, zbuffer,
  };
})();
