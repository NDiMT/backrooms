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
    ctx.fillStyle = '#1a1c22';
    ctx.fillRect(x, y, w, 4);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, Math.max(0, Math.min(1, val / max)) * w, 4);
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

    // ---- status bar ----
    ctx.fillStyle = '#23262e';
    ctx.fillRect(0, VH, W, BAR_H);
    ctx.fillStyle = '#3a3f4c';
    ctx.fillRect(0, VH, W, 2);

    ctx.textBaseline = 'top';

    // HP
    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = p.hp < p.maxHp * 0.3 ? '#ff4040' : '#e8e4d0';
    ctx.fillText(Math.max(0, Math.ceil(p.hp)), 8, VH + 7);
    ctx.font = '7px monospace';
    ctx.fillStyle = '#8a8f9c';
    ctx.fillText('HP', 8, VH + 24);
    bar(ctx, 26, VH + 26, 34, p.hp, p.maxHp, '#c03030');

    // ARMOR
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = '#7ac0e8';
    ctx.fillText(Math.ceil(p.armor), 68, VH + 8);
    ctx.font = '7px monospace';
    ctx.fillStyle = '#8a8f9c';
    ctx.fillText('ARM', 68, VH + 24);

    // ---- πρόσωπο στο κέντρο ----
    const f = face(p, dt);
    ctx.drawImage(f, W / 2 - f.width / 2, VH + (BAR_H - f.height) / 2);

    // ---- WEAPON readout (δεξιά του προσώπου, συμπαγές για να μην
    //      πατάει στο SCRAP) ----
    const w = PlayerSys.weapon(p);
    const st = PlayerSys.stats(w, p.perks);
    ctx.font = '7px monospace';
    // κουκκίδα element + όνομα βάσης
    if (w.element) {
      ctx.fillStyle = PlayerSys.ELEMENTS[w.element].color;
      ctx.fillText('●', W / 2 + 26, VH + 5);
    }
    ctx.fillStyle = PlayerSys.RARITIES[w.rarity].color;
    const nm = PlayerSys.BASES[w.base].name;
    ctx.fillText(nm.slice(0, 15), W / 2 + (w.element ? 34 : 26), VH + 5);
    // γραμμή 2: rarity/level/mods
    let sub = '';
    if (w.rarity > 0) sub += '★'.repeat(w.rarity) + ' ';
    if (w.level > 0) sub += 'Lv' + w.level + ' ';
    if (w.mods.length) sub += 'MOD×' + w.mods.length;
    if (sub) {
      ctx.fillStyle = '#8a8f9c';
      ctx.fillText(sub.trim(), W / 2 + 26, VH + 13);
    }
    // πυρομαχικά
    const ammoStr = st.ammo ? String(p.ammo[st.ammo]) : '∞';
    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = '#e8c040';
    ctx.fillText(ammoStr, W / 2 + 26, VH + 21);
    ctx.font = '7px monospace';
    ctx.fillStyle = '#8a8f9c';
    ctx.fillText(st.ammo ? st.ammo.toUpperCase() : 'AMMO', W / 2 + 58, VH + 26);

    // SCRAP
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = '#50e0f0';
    ctx.fillText(p.scrap, W - 66, VH + 8);
    ctx.font = '7px monospace';
    ctx.fillStyle = '#8a8f9c';
    ctx.fillText('SCRAP', W - 66, VH + 24);

    // DECK
    ctx.font = '7px monospace';
    ctx.fillStyle = '#67d080';
    ctx.fillText('D' + (game.deckIdx + 1), W - 18, VH + 8);
    if (game.wardenDead && game.deckIdx < 3) {
      ctx.fillStyle = '#33e070';
      ctx.fillText('EXIT↑', W - 30, VH + 24);
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
