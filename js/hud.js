/* ΝΕΚΡΗ ΖΩΝΗ — HUD: Doom-style μπάρα κατάστασης με πρόσωπο (mugshot),
   crosshair, minimap. Ζωγραφίζεται μέσα στο low-res canvas. */

const HUD = (() => {
  const W = Engine.W, H = Engine.H, VH = Engine.VH;
  const BAR_H = H - VH; // 36

  let grinT = 0, painT = 0;

  function notifyPickup() { grinT = 1.0; }
  function notifyPain() { painT = 0.6; }

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

    // ---- crosshair ----
    ctx.fillStyle = 'rgba(240,240,220,0.85)';
    ctx.fillRect(W / 2 - 1, VH / 2 - 4, 2, 3);
    ctx.fillRect(W / 2 - 1, VH / 2 + 1, 2, 3);
    ctx.fillRect(W / 2 - 4, VH / 2 - 1, 3, 2);
    ctx.fillRect(W / 2 + 1, VH / 2 - 1, 3, 2);

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
    bar(ctx, 30, VH + 26, 34, p.hp, p.maxHp, '#c03030');

    // ARMOR
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = '#7ac0e8';
    ctx.fillText(Math.ceil(p.armor), 72, VH + 8);
    ctx.font = '7px monospace';
    ctx.fillStyle = '#8a8f9c';
    ctx.fillText('ARM', 72, VH + 24);

    // ---- πρόσωπο στο κέντρο ----
    const f = face(p, dt);
    ctx.drawImage(f, W / 2 - f.width / 2, VH + (BAR_H - f.height) / 2);

    // AMMO
    const w = PlayerSys.WEAPONS[p.current];
    const ammoStr = w.ammoType ? String(p.ammo[w.ammoType]) : '∞';
    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = '#e8c040';
    ctx.fillText(ammoStr, W / 2 + 30, VH + 7);
    ctx.font = '7px monospace';
    ctx.fillStyle = '#8a8f9c';
    ctx.fillText('ΠΥΡΟΜ', W / 2 + 30, VH + 24);

    // SCRAP
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = '#50e0f0';
    ctx.fillText(p.scrap, W - 78, VH + 8);
    ctx.font = '7px monospace';
    ctx.fillStyle = '#8a8f9c';
    ctx.fillText('SCRAP', W - 78, VH + 24);

    // DECK
    ctx.font = '7px monospace';
    ctx.fillStyle = '#67d080';
    ctx.fillText('D' + (game.deckIdx + 1), W - 22, VH + 8);
    if (game.wardenDead && game.deckIdx < 3) {
      ctx.fillStyle = '#33e070';
      ctx.fillText('ΕΞΟΔΟΣ↑', W - 40, VH + 24);
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
    // παίκτης
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(ox + game.player.x * cell - 1, oy + game.player.y * cell - 1, 3, 3);
    // κατεύθυνση
    ctx.fillStyle = '#ffd040';
    ctx.fillRect(
      ox + (game.player.x + Math.cos(game.player.angle) * 1.5) * cell,
      oy + (game.player.y + Math.sin(game.player.angle) * 1.5) * cell, 1, 1);
  }

  /* Το όπλο σε πρώτο πρόσωπο + bob + muzzle flash. */
  function weapon(ctx, game) {
    const p = game.player;
    const w = Assets.weapons[p.current];
    const img = p.fireAnim > 0 ? w.fire : w.idle;
    const bobX = Math.sin(p.bob) * 5;
    const bobY = Math.abs(Math.cos(p.bob)) * 3;
    const x = W / 2 - img.width / 2 + bobX + 10;
    const y = VH - img.height + 6 + bobY + (p.fireAnim > 0 ? 3 : 0);
    ctx.drawImage(img, x, y);
  }

  return { render, weapon, notifyPickup, notifyPain, BAR_H };
})();
