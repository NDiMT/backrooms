/* DEAD ZONE — HUD: Doom-style status bar with reactive mugshot, weapon
   readout (name/element/rarity), hit markers, minimap. */

const HUD = (() => {
  const W = Engine.W, H = Engine.H, VH = Engine.VH;
  const BAR_H = H - VH; // 36

  let grinT = 0, painT = 0, hitT = 0, lowPulse = 0;

  function notifyPickup() { grinT = 1.0; }
  function notifyPain() { painT = 0.6; }
  function hitmarker() { hitT = 0.12; }

  function face(p, dt) {
    grinT = Math.max(0, grinT - dt);
    painT = Math.max(0, painT - dt);
    if (p.hp <= 0) return Assets.face.dead;
    if (painT > 0) return Assets.face.pain;
    if (grinT > 0) return Assets.face.grin;
    if (p.hp < p.maxHp * 0.3) return Assets.face.low;
    return Assets.face.ok;
  }

  function bar(ctx, x, y, w, val, max, color) {
    ctx.fillStyle = '#101216';
    ctx.fillRect(x, y, w, 4);
    ctx.fillStyle = color;
    ctx.fillRect(x + 1, y + 1, Math.max(0, Math.min(1, val / max)) * (w - 2), 2);
  }

  /* DOOM-style ψηφία: μαύρο περίγραμμα + έντονο χρώμα. */
  function doomText(ctx, text, x, y, px, color) {
    ctx.font = `bold ${px}px monospace`;
    ctx.fillStyle = '#000';
    for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      ctx.fillText(text, x + ox, y + oy);
    }
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  /* Βυθισμένη «θήκη» πάνω στο panel. */
  function slot(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x, y, w, 1);
    ctx.fillRect(x, y, 1, h);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(x, y + h - 1, w, 1);
    ctx.fillRect(x + w - 1, y, 1, h);
  }

  function render(ctx, game, dt) {
    const p = game.player;
    hitT = Math.max(0, hitT - dt);
    lowPulse += dt * 4;

    // ---- crosshair (+ hit marker X) ----
    ctx.fillStyle = 'rgba(240,240,220,0.85)';
    ctx.fillRect(W / 2 - 1, VH / 2 - 4, 2, 3);
    ctx.fillRect(W / 2 - 1, VH / 2 + 1, 2, 3);
    ctx.fillRect(W / 2 - 4, VH / 2 - 1, 3, 2);
    ctx.fillRect(W / 2 + 1, VH / 2 - 1, 3, 2);
    if (hitT > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.lineWidth = 1;
      const c = W / 2, m = VH / 2, a = 3, b = 7;
      ctx.beginPath();
      ctx.moveTo(c - b, m - b); ctx.lineTo(c - a, m - a);
      ctx.moveTo(c + b, m - b); ctx.lineTo(c + a, m - a);
      ctx.moveTo(c - b, m + b); ctx.lineTo(c - a, m + a);
      ctx.moveTo(c + b, m + b); ctx.lineTo(c + a, m + a);
      ctx.stroke();
    }

    // ---- low-HP pulse στο περίγραμμα της 3D όψης ----
    if (p.hp > 0 && p.hp < p.maxHp * 0.3) {
      const a = 0.16 + Math.abs(Math.sin(lowPulse)) * 0.22;
      ctx.strokeStyle = `rgba(200,30,30,${a.toFixed(3)})`;
      ctx.lineWidth = 3;
      ctx.strokeRect(1.5, 1.5, W - 3, VH - 3);
    }

    // ---- status bar: DOOM-style μεταλλικό panel ----
    if (Assets.ui.statusbar) {
      ctx.drawImage(Assets.ui.statusbar, 0, VH, W, BAR_H);
    } else {
      ctx.fillStyle = '#2a2d33';
      ctx.fillRect(0, VH, W, BAR_H);
    }
    // bevel πάνω ακμής
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(0, VH, W, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, VH + 1, W, 1);

    ctx.textBaseline = 'top';

    // ---- HP (μεγάλα κόκκινα DOOM digits) ----
    slot(ctx, 4, VH + 4, 58, 28);
    doomText(ctx, String(Math.max(0, Math.ceil(p.hp))) + '%', 8, VH + 6, 15,
      p.hp < p.maxHp * 0.3 ? '#ff2010' : '#e03a2a');
    ctx.font = '7px monospace';
    ctx.fillStyle = '#7c828e';
    ctx.fillText('HEALTH', 8, VH + 23);
    bar(ctx, 8, VH + 30, 50, p.hp, p.maxHp, '#c03030');

    // ---- ARMOR ----
    slot(ctx, 66, VH + 4, 40, 28);
    doomText(ctx, String(Math.ceil(p.armor)), 70, VH + 8, 13, '#4a9fff');
    ctx.font = '7px monospace';
    ctx.fillStyle = '#7c828e';
    ctx.fillText('ARMOR', 70, VH + 24);

    // ---- πρόσωπο στο κέντρο, με κορνίζα ----
    const f = face(p, dt);
    const fw = f.width * ((BAR_H - 6) / f.height);
    slot(ctx, W / 2 - fw / 2 - 2, VH + 2, fw + 4, BAR_H - 4);
    ctx.drawImage(f, W / 2 - fw / 2, VH + 3, fw, BAR_H - 6);

    // ---- WEAPON readout ----
    const w = PlayerSys.weapon(p);
    const st = PlayerSys.stats(w, p.perks);
    slot(ctx, W / 2 + 22, VH + 4, 84, 28);
    ctx.font = '7px monospace';
    if (w.element) {
      ctx.fillStyle = PlayerSys.ELEMENTS[w.element].color;
      ctx.fillText('●', W / 2 + 26, VH + 6);
    }
    ctx.fillStyle = PlayerSys.RARITIES[w.rarity].color;
    const nm = PlayerSys.BASES[w.base].name;
    ctx.fillText(nm.slice(0, 13), W / 2 + (w.element ? 34 : 26), VH + 6);
    const ammoStr = st.ammo ? String(p.ammo[st.ammo]) : '∞';
    doomText(ctx, ammoStr, W / 2 + 26, VH + 15, 14, '#e03a2a');
    ctx.font = '7px monospace';
    ctx.fillStyle = '#7c828e';
    ctx.fillText(st.ammo ? st.ammo.toUpperCase() : 'AMMO', W / 2 + 58, VH + 17);
    let sub = '';
    if (w.rarity > 0) sub += '★'.repeat(w.rarity) + ' ';
    if (w.level > 0) sub += 'Lv' + w.level + ' ';
    if (w.mods.length) sub += 'M×' + w.mods.length;
    if (sub) {
      ctx.fillStyle = '#9aa0ac';
      ctx.fillText(sub.trim(), W / 2 + 58, VH + 25);
    }

    // ---- SCRAP + DECK ----
    slot(ctx, W - 70, VH + 4, 66, 28);
    doomText(ctx, String(p.scrap), W - 66, VH + 8, 12, '#50e0f0');
    ctx.font = '7px monospace';
    ctx.fillStyle = '#7c828e';
    ctx.fillText('SCRAP', W - 66, VH + 24);
    ctx.fillStyle = '#67d080';
    ctx.fillText('D' + (game.deckIdx + 1), W - 18, VH + 8);
    if (game.wardenDead && game.deckIdx < 3) {
      ctx.fillStyle = '#33e070';
      ctx.fillText('EXIT↑', W - 34, VH + 16);
    }

    // ---- minimap (toggle) ----
    if (game.showMap) minimap(ctx, game);
  }

  function minimap(ctx, game) {
    const size = 62, cell = size / Procgen.GRID;
    const ox = W - size - 4, oy = 4;
    ctx.fillStyle = 'rgba(10,12,16,0.8)';
    ctx.fillRect(ox - 2, oy - 2, size + 4, size + 4);
    for (let y = 0; y < Procgen.GRID; y++) {
      for (let x = 0; x < Procgen.GRID; x++) {
        const c = game.world.grid[y][x];
        if (c === Procgen.FLOOR) ctx.fillStyle = '#3a4150';
        else if (c === Procgen.DOOR) ctx.fillStyle = '#c0a030';
        else if (c === Procgen.ELEV) ctx.fillStyle = '#33e070';
        else continue;
        ctx.fillRect(ox + x * cell, oy + y * cell, Math.ceil(cell), Math.ceil(cell));
      }
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(ox + game.player.x * cell - 1, oy + game.player.y * cell - 1, 3, 3);
    ctx.fillStyle = '#ffd040';
    ctx.fillRect(
      ox + (game.player.x + Math.cos(game.player.angle) * 1.5) * cell,
      oy + (game.player.y + Math.sin(game.player.angle) * 1.5) * cell, 1, 1);
  }

  /* Το όπλο σε πρώτο πρόσωπο + bob + muzzle flash. */
  function weapon(ctx, game) {
    const p = game.player;
    const inst = PlayerSys.weapon(p);
    const w = Assets.weapons[PlayerSys.BASES[inst.base].map];
    const img = p.fireAnim > 0 ? w.fire : w.idle;
    const bobX = Math.sin(p.bob) * 5;
    const bobY = Math.abs(Math.cos(p.bob)) * 3;
    const x = W / 2 - img.width / 2 + bobX + 10;
    const y = VH - img.height + 6 + bobY + (p.fireAnim > 0 ? 3 : 0);
    ctx.drawImage(img, x, y);
  }

  return { render, weapon, notifyPickup, notifyPain, hitmarker, BAR_H };
})();
