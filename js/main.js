/* DEEPER — main: loop, καταστάσεις (TITLE/HUB/PLAY/DEAD/DAILY),
   κατάβαση, μάχη, loot, φωτισμός, idle drones, daily floor, ads. */

(() => {
  const $ = id => document.getElementById(id);
  const canvas = $('screen');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const VW = 288, VH = 512;      // εσωτερική ανάλυση (portrait 9:16)
  const T = Defs.T;
  const S = SaveGame.load();     // μόνιμη πρόοδος

  function fitCanvas() {
    const s = Math.min(window.innerWidth / VW, window.innerHeight / VH);
    canvas.style.width = (VW * s) + 'px';
    canvas.style.height = (VH * s) + 'px';
  }
  window.addEventListener('resize', fitCanvas);
  fitCanvas();

  // ---------- state ----------
  let state = 'TITLE';   // TITLE | HUB | PLAY | DEAD | DAILY_RESULT
  let panel = null;      // null | 'elev' | 'pause'

  const game = {
    audio: GameAudio,
    world: null,
    player: null,
    shades: [],
    pickups: [],
    fx: [],
    run: null,

    inLight(x, y) {
      const p = this.player;
      if (!p) return false;
      return Math.hypot(p.x - x, p.y - y) < lightRadius();
    },
    spawnPuff(x, y) { this.fx.push({ kind: 'puff', x, y, t: 0 }); },
    spawnHitFx(x, y) { this.fx.push({ kind: 'hit', x, y, t: 0 }); },

    hurtPlayer(dmg, src) {
      const p = this.player;
      if (state !== 'PLAY' || p.hp <= 0) return;
      p.hp -= dmg;
      p.hurtT = 0.25;
      GameAudio.playerHurt();
      if (p.hp <= 0) die();
    },

    onShadeKilled(shade) {
      S.stats.kills++;
      if (shade.boss) {
        S.stats.bosses++;
        Entities.dropScrap(game, T.crateScrap(game.run.floor) * 3, shade.x, shade.y);
        game.pickups.push(new Entities.Pickup('core', 1, shade.x, shade.y));
        game.run.bossAlive = false;
        const next = game.run.floor + 1;
        if (!game.run.daily && next > S.checkpoint) {
          S.checkpoint = next;
          toast('☑ CHECKPOINT — runs now start at floor ' + next, 3200);
          SaveGame.save();
        }
        Monetize.track('boss_kill', { floor: game.run.floor });
      } else if (Math.random() < 0.5) {
        Entities.dropScrap(game, Math.ceil(T.scrapPile(game.run.floor) / 2),
          shade.x, shade.y);
      }
    },
  };

  // ---------- stats από upgrades ----------
  function upLvl(id) { return S.up[id] || 0; }
  function upDef(id) { return Defs.UPGRADES.find(u => u.id === id); }
  function upVal(id) { return upDef(id).value(upLvl(id)); }
  function dmgStat() {
    return Math.round(upVal('damage') * (1 + S.cores * T.CORE_DMG_BONUS));
  }
  function greedMult() { return upVal('greed') * (1 + S.cores * T.CORE_SCRAP_BONUS); }
  function lightRadius() {
    return upVal('light') * (game.run && game.run.batteryT > 0 ? 1.6 : 1);
  }
  function droneRatePerMin() {
    return upVal('drones') * T.droneDepthMult(S.deepest);
  }

  // ---------- ημερομηνίες daily ----------
  function todayStr() {
    const d = new Date();
    return d.getUTCFullYear() + '-' +
      String(d.getUTCMonth() + 1).padStart(2, '0') + '-' +
      String(d.getUTCDate()).padStart(2, '0');
  }
  function dailySeed() {
    let h = 0;
    for (const c of todayStr()) h = (h * 31 + c.charCodeAt(0)) | 0;
    return h >>> 0;
  }
  function dailyNumber() { return Math.floor(Date.now() / 86400000) - 20454; }
  function dailyDone() { return S.daily.date === todayStr(); }

  // ---------- καταστάσεις / panels ----------
  function setState(s) {
    state = s;
    $('title').classList.toggle('hidden', s !== 'TITLE');
    $('hub').classList.toggle('hidden', s !== 'HUB');
    $('dead').classList.toggle('hidden', s !== 'DEAD');
    $('daily-result').classList.toggle('hidden', s !== 'DAILY_RESULT');
    $('hud').classList.toggle('hidden', s !== 'PLAY');
    if (s !== 'PLAY') closePanel();
    if (s === 'PLAY') Monetize.gameplayStart();
    else Monetize.gameplayStop();
  }

  function openPanel(name) {
    panel = name;
    for (const id of ['elev-panel', 'pause-panel']) $(id).classList.add('hidden');
    if (name) $(name + '-panel').classList.remove('hidden');
  }
  function closePanel() { panel = null; openPanel(null); }

  let toastTimer = null;
  function toast(text, ms = 2800) {
    const el = $('toast');
    el.textContent = text;
    el.style.opacity = 1;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.style.opacity = 0; }, ms);
  }

  // ---------- run / όροφοι ----------
  function freshPlayer() {
    return {
      x: 0, y: 0, dir: 'south', faceLeft: false,
      hp: upVal('vitality'), maxHp: upVal('vitality'),
      animT: 0, moving: false,
      attackCd: 0, hurtT: 0, swingT: 0,
    };
  }

  function startRun(floor, daily) {
    game.run = {
      floor, daily: !!daily,
      scrap: 0, keycard: false, batteryT: 0,
      bossAlive: false,
      seed: (Math.random() * 0xffffffff) >>> 0,
      timeLeft: daily ? T.DAILY_TIME : 0,
    };
    game.player = freshPlayer();
    S.stats.runs++;
    Monetize.track('run_start', { floor, daily: !!daily });
    loadFloor(floor);
    setState('PLAY');
    if (daily) toast('DAILY FLOOR — grab everything you can!', 3000);
    else if (floor === 1 && S.stats.runs <= 2) {
      toast('Loot the scrap. Find the elevator. Go deeper.', 3200);
    }
  }

  function loadFloor(f) {
    const run = game.run;
    run.floor = f;
    run.keycard = false;
    const seed = run.daily
      ? dailySeed()
      : ((run.seed ^ Math.imul(f, 2654435761)) >>> 0);
    game.world = World.generate(f, seed);
    game.player.x = game.world.entry.x;
    game.player.y = game.world.entry.y;
    game.shades = game.world.shadeSpawns.map(s =>
      new Entities.Shade(s.x, s.y, f, s.boss));
    game.pickups = [];
    game.fx = [];
    if (game.world.keycardAt) {
      game.pickups.push(new Entities.Pickup('keycard', 1,
        game.world.keycardAt.x, game.world.keycardAt.y));
    }
    run.bossAlive = game.world.boss;
    Monetize.track('floor_reach', { floor: f });
    const b = Defs.biomeFor(f);
    if (b.from === f) toast('— ' + b.name + ' —', 2600);
    if (game.world.boss) { toast('⚠ Something big is down here…', 2600); GameAudio.bossNear(); }
  }

  // ---------- ACT / στόχευση ----------
  function facingVec() {
    const p = game.player;
    if (p.dir === 'east') return p.faceLeft ? [-1, 0] : [1, 0];
    return p.dir === 'south' ? [0, 1] : [0, -1];
  }

  function findTarget() {
    const p = game.player, w = game.world;
    let best = null, bd = T.PLAYER_ATK_RANGE;
    for (const m of game.shades) {
      if (m.dead) continue;
      const d = Math.hypot(m.x - p.x, m.y - p.y);
      if (d < bd) { best = m; bd = d; }
    }
    if (best) return { type: 'shade', shade: best };

    for (const [k, pr] of w.props) {
      const [tx, ty] = k.split(',').map(Number);
      if (Math.hypot(tx + 0.5 - p.x, ty + 0.5 - p.y) < 1.25) {
        return { type: 'prop', key: k, prop: pr };
      }
    }
    if (w.vaultDoor && !w.vaultOpen &&
        Math.hypot(w.vaultDoor.x + 0.5 - p.x, w.vaultDoor.y + 0.5 - p.y) < 1.35) {
      return { type: 'vault' };
    }
    if (Math.hypot(w.exit.x - p.x, w.exit.y - p.y) < 1.2) {
      return { type: 'exit' };
    }
    return null;
  }

  function actIconFor(tgt) {
    if (!tgt) return '✊';
    if (tgt.type === 'shade') return '🗡';
    if (tgt.type === 'prop') return '⛏';
    if (tgt.type === 'vault') return '🎁';
    if (tgt.type === 'exit') return '🛗';
    return '✊';
  }

  function act() {
    if (state !== 'PLAY' || panel) return;
    const p = game.player;
    if (p.attackCd > 0) return;
    p.attackCd = T.PLAYER_ATK_CD;
    p.swingT = 0.18;

    const tgt = findTarget();
    if (!tgt) { GameAudio.swing(); return; }
    if (tgt.type === 'shade') { tgt.shade.hurt(dmgStat(), game); return; }
    if (tgt.type === 'prop') { Entities.hitProp(game, tgt.key, tgt.prop); return; }
    if (tgt.type === 'vault') { openVault(); return; }
    if (tgt.type === 'exit') { tryExit(); return; }
  }

  function openVault() {
    Monetize.showRewarded('vault', () => {
      game.world.vaultOpen = true;
      GameAudio.vaultOpen();
      toast('The vault opens…', 2200);
      Monetize.track('vault_open', { floor: game.run.floor });
    });
  }

  function tryExit() {
    const w = game.world, run = game.run;
    if (w.boss && run.bossAlive) {
      GameAudio.error(); toast('Something guards the elevator…', 2000); return;
    }
    if (w.locked && !run.keycard) {
      GameAudio.error(); toast('LOCKED — find the KEYCARD on this floor', 2200); return;
    }
    if (run.daily) { endDaily('exit'); return; }
    GameAudio.elevator();
    S.deepest = Math.max(S.deepest, run.floor);
    SaveGame.save();
    renderElevPanel();
    openPanel('elev');
  }

  // ---------- elevator panel ----------
  function renderElevPanel() {
    const run = game.run;
    $('elev-info').innerHTML =
      `FLOOR <b>${run.floor}</b> cleared · carrying <b>${run.scrap}</b> ⚙<br>` +
      `<small>Deeper: richer loot, darker halls.</small>`;
    $('elev-cashout').textContent = `CASH OUT — BANK ${run.scrap} ⚙`;
    $('elev-cashout2').textContent = `📺 BANK ${run.scrap * 2} ⚙ (AD)`;
    $('elev-cashout').disabled = run.scrap <= 0;
    $('elev-cashout2').classList.toggle('hidden', run.scrap <= 0);
  }

  function goDeeper() {
    closePanel();
    GameAudio.descend();
    S.stats.floors++;
    Monetize.track('go_deeper', { floor: game.run.floor + 1 });
    loadFloor(game.run.floor + 1);
  }

  function cashOut(mult) {
    const run = game.run;
    const gain = Math.round(run.scrap * mult);
    S.bank += gain;
    S.stats.floors++;
    S.stats.scrapTotal += gain;
    GameAudio.cashout();
    Monetize.track('cashout', { floor: run.floor, scrap: gain, mult });
    SaveGame.save();
    closePanel();
    enterHub();
    toast('+' + gain + ' ⚙ banked', 2400);
  }

  $('elev-deeper').addEventListener('click', goDeeper);
  $('elev-cashout').addEventListener('click', () => cashOut(1));
  $('elev-cashout2').addEventListener('click', () => {
    Monetize.showRewarded('cashout2x', () => cashOut(2));
  });

  // ---------- θάνατος ----------
  function die() {
    GameAudio.playerDie();
    Monetize.track('death', { floor: game.run.floor, daily: game.run.daily });
    if (game.run.daily) { endDaily('death'); return; }
    $('dead-info').innerHTML =
      `You fell on floor <b>${game.run.floor}</b> carrying ` +
      `<b>${game.run.scrap}</b> ⚙.`;
    setState('DEAD');
  }

  $('revive-btn').addEventListener('click', () => {
    Monetize.showRewarded('revive', () => {
      const p = game.player;
      p.hp = Math.round(p.maxHp * T.RESPAWN_HP_FRAC);
      p.x = game.world.entry.x;
      p.y = game.world.entry.y;
      setState('PLAY');
      toast('You claw your way back…', 2200);
    });
  });
  $('giveup-btn').addEventListener('click', () => {
    const gain = Math.round(game.run.scrap * T.GIVEUP_KEEP);
    S.bank += gain;
    S.stats.scrapTotal += gain;
    SaveGame.save();
    enterHub();
    if (gain > 0) toast('The drones salvage ' + gain + ' ⚙ from your body.', 2800);
  });

  // ---------- daily ----------
  function startDaily() {
    if (dailyDone()) { toast('Daily already done — come back tomorrow'); return; }
    startRun(T.DAILY_FLOOR, true);
  }

  function endDaily(reason) {
    const run = game.run;
    const score = run.scrap;
    S.bank += score;
    S.stats.scrapTotal += score;
    S.daily = { date: todayStr(), score };
    SaveGame.save();
    const expected = Math.max(1,
      game.world.lootTotal * (1 + T.DAILY_FLOOR * 0.13) * greedMult());
    const frac = Math.min(1, score / expected);
    const squares = Math.max(score > 0 ? 1 : 0, Math.round(frac * 5));
    const tail = reason === 'death' ? '💀' : reason === 'exit' ? '🚪' : '⏰';
    game.dailyGrid = '🟨'.repeat(squares) + '⬛'.repeat(5 - squares) + ' ' + tail;
    $('daily-grid').textContent = game.dailyGrid;
    $('daily-score-line').innerHTML =
      `<b>${score}</b> ⚙ banked` +
      (reason === 'death' ? '<br>The dark got you.' :
       reason === 'exit' ? '<br>Clean exit!' : '<br>Time ran out.');
    Monetize.track('daily_score', { score, reason });
    setState('DAILY_RESULT');
  }

  $('daily-close').addEventListener('click', enterHub);
  $('share-btn').addEventListener('click', () => {
    const text = 'DEEPER Daily #' + dailyNumber() + '\n' +
      game.dailyGrid + '\n' +
      S.daily.score + ' scrap — how deep can you go?';
    Monetize.track('share', {});
    if (navigator.share) {
      navigator.share({ text }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text)
        .then(() => toast('Copied to clipboard!'))
        .catch(() => toast(text, 4000));
    } else toast(text, 4000);
  });

  // ---------- hub ----------
  let hubAcc = 0;   // κλασματικό υπόλοιπο ζωντανών drone εσόδων

  function enterHub() {
    setState('HUB');
    renderHub();
    SaveGame.save();
  }

  function renderHub() {
    $('hub-bank').innerHTML =
      `⚙ ${Math.floor(S.bank)} · <span class="core">◆ ${S.cores}</span>`;
    const rate = droneRatePerMin();
    $('hub-sub').textContent =
      (S.deepest ? `Deepest: floor ${S.deepest}` : 'The elevator hums below.') +
      (rate ? ` · drones ${rate.toFixed(0)} ⚙/min` : '');
    $('descend-btn').textContent = '⬇ DESCEND — FLOOR ' + S.checkpoint;
    $('daily-btn').textContent = dailyDone()
      ? `📅 DAILY DONE — ${S.daily.score} ⚙`
      : '📅 DAILY FLOOR';
    $('daily-btn').disabled = dailyDone();

    const list = $('upgrade-list');
    list.innerHTML = '';
    for (const u of Defs.UPGRADES) {
      const lvl = upLvl(u.id);
      const maxed = lvl >= u.max;
      const cost = Defs.upCost(u, lvl);
      const row = document.createElement('div');
      row.className = 'up-row' + (maxed ? ' maxed' : '');
      row.innerHTML =
        `<div class="ic">${u.icon}</div>` +
        `<div class="ci"><b>${u.name} <small>Lv${lvl}</small></b>` +
        `<span class="d">${u.desc(lvl)}${maxed ? '' :
          ' → ' + u.desc(lvl + 1).replace(/^[^0-9+]*/, '')}</span></div>` +
        `<button ${maxed || S.bank < cost ? 'disabled' : ''}>` +
        `${maxed ? 'MAX' : cost + ' ⚙'}</button>`;
      if (!maxed) {
        row.querySelector('button').addEventListener('click', () => {
          if (S.bank < cost) return;
          S.bank -= cost;
          S.up[u.id] = lvl + 1;
          GameAudio.upgrade();
          Monetize.track('upgrade', { id: u.id, lvl: lvl + 1 });
          SaveGame.save();
          renderHub();
        });
      }
      list.appendChild(row);
    }
    if (S.cores > 0) {
      const d = document.createElement('div');
      d.id = 'core-note';
      d.style.cssText = 'font-size:15px;opacity:0.85;margin:4px 0;color:#c88aff';
      d.textContent = `◆ ${S.cores} cores: +${Math.round(S.cores * T.CORE_SCRAP_BONUS * 100)}% scrap, ` +
        `+${Math.round(S.cores * T.CORE_DMG_BONUS * 100)}% damage (permanent)`;
      list.appendChild(d);
    }
    $('hub-stats').textContent =
      `runs ${S.stats.runs} · kills ${S.stats.kills} · bosses ${S.stats.bosses} · ` +
      `floors ${S.stats.floors} · total ⚙ ${Math.floor(S.stats.scrapTotal)}`;
  }

  function hubIdleTick(dt) {
    const rate = droneRatePerMin();
    if (!rate) return;
    hubAcc += rate / 60 * dt;
    if (hubAcc >= 1) {
      const whole = Math.floor(hubAcc);
      hubAcc -= whole;
      S.bank += whole;
      $('hub-bank').innerHTML =
        `⚙ ${Math.floor(S.bank)} · <span class="core">◆ ${S.cores}</span>`;
    }
  }

  $('descend-btn').addEventListener('click', () => startRun(S.checkpoint, false));
  $('daily-btn').addEventListener('click', startDaily);

  // ---------- offline earnings ----------
  function offlineEarnings() {
    if (!upLvl('drones') || !S.lastSeen) return 0;
    const capS = upVal('battery') * 3600;
    const dt = Math.min(capS, (Date.now() - S.lastSeen) / 1000);
    if (dt < T.OFFLINE_MIN_S) return 0;
    return Math.floor(droneRatePerMin() * (dt / 60));
  }

  let offlinePending = 0;
  function maybeShowOffline() {
    if (offlinePending <= 0) return;
    $('offline-amt').textContent = offlinePending;
    $('offline').classList.remove('hidden');
  }
  function claimOffline(mult) {
    S.bank += offlinePending * mult;
    S.stats.scrapTotal += offlinePending * mult;
    Monetize.track('offline_claim', { amt: offlinePending, mult });
    offlinePending = 0;
    $('offline').classList.add('hidden');
    SaveGame.save();
    renderHub();
  }
  $('offline-claim').addEventListener('click', () => claimOffline(1));
  $('offline-claim2').addEventListener('click', () => {
    Monetize.showRewarded('offline2x', () => claimOffline(2));
  });

  // ---------- hints ----------
  function currentHint() {
    const run = game.run, w = game.world;
    if (run.daily) return 'Grab everything before the clock runs out!';
    const tgt = findTarget();
    if (tgt && tgt.type === 'exit') return 'Tap ACT to use the elevator';
    if (w.boss && run.bossAlive) return 'Defeat the guardian to unlock the elevator';
    if (w.locked && !run.keycard) return 'The exit is LOCKED — find the keycard';
    if (run.floor === 1 && S.stats.kills === 0 && game.run.scrap === 0) {
      return 'Tap ACT next to scrap piles to loot them';
    }
    return '';
  }

  // ---------- input ----------
  const keys = {};
  document.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (state !== 'PLAY') return;
    if (e.code === 'KeyE' || e.code === 'Space') { e.preventDefault(); act(); }
    if (e.code === 'Escape' || e.code === 'KeyP') {
      panel ? closePanel() : openPanel('pause');
    }
  });
  document.addEventListener('keyup', e => { keys[e.code] = false; });

  $('act-btn').addEventListener('pointerdown', e => { e.preventDefault(); act(); });
  $('pause-btn').addEventListener('click', () => openPanel('pause'));
  $('resume-btn').addEventListener('click', closePanel);
  $('abandon-btn').addEventListener('click', () => {
    const gain = Math.round(game.run.scrap * T.GIVEUP_KEEP);
    S.bank += gain;
    S.stats.scrapTotal += gain;
    SaveGame.save();
    closePanel();
    enterHub();
    if (gain > 0) toast('+' + gain + ' ⚙ salvaged', 2000);
  });
  $('enter-btn').addEventListener('click', () => {
    GameAudio.start();
    Monetize.track('game_start', { new: SaveGame.isNew() });
    enterHub();
    maybeShowOffline();
  });

  function refreshTitle() {
    if (Assets.ui.titlebg) {
      $('title').style.backgroundImage =
        `linear-gradient(rgba(10,8,4,0.3), rgba(10,8,4,0.75)), url(${Assets.ui.titlebg.src})`;
    }
  }

  // ---------- συλλογή pickups ----------
  function collectNear() {
    const p = game.player, run = game.run;
    for (const d of game.pickups) {
      if (d.taken) continue;
      if (Math.hypot(d.x - p.x, d.y - p.y) > 0.7) continue;
      d.taken = true;
      if (d.kind === 'scrap') {
        run.scrap += Math.max(1, Math.round(d.n * greedMult()));
        GameAudio.scrap();
      } else if (d.kind === 'core') {
        S.cores++;
        GameAudio.core();
        toast('◆ CORE! Permanent +10% scrap, +5% damage', 3000);
        SaveGame.save();
      } else if (d.kind === 'medkit') {
        p.hp = Math.min(p.maxHp, p.hp + T.MEDKIT_HEAL);
        GameAudio.medkit();
        toast('+' + T.MEDKIT_HEAL + ' HP', 1200);
      } else if (d.kind === 'keycard') {
        run.keycard = true;
        GameAudio.keycard();
        toast('KEYCARD — the elevator is yours', 2200);
      } else if (d.kind === 'battery') {
        run.batteryT = T.BATTERY_TIME;
        GameAudio.pickup();
        toast('🔋 Flashlight boosted!', 1800);
      }
    }
    game.pickups = game.pickups.filter(d => !d.taken);
  }

  // ---------- update ----------
  let shadeCueT = 0;
  function update(dt) {
    const p = game.player, run = game.run;

    p.hurtT = Math.max(0, p.hurtT - dt);
    p.attackCd = Math.max(0, p.attackCd - dt);
    p.swingT = Math.max(0, p.swingT - dt);
    run.batteryT = Math.max(0, run.batteryT - dt);

    // daily χρονόμετρο
    if (run.daily) {
      run.timeLeft -= dt;
      if (run.timeLeft <= 0) { endDaily('time'); return; }
    }

    // κίνηση
    if (!panel) {
      let mx = 0, my = 0;
      if (keys['KeyW'] || keys['ArrowUp']) my -= 1;
      if (keys['KeyS'] || keys['ArrowDown']) my += 1;
      if (keys['KeyA'] || keys['ArrowLeft']) mx -= 1;
      if (keys['KeyD'] || keys['ArrowRight']) mx += 1;
      mx += TouchControls.state.move.x;
      my += TouchControls.state.move.y;
      const len = Math.hypot(mx, my);
      p.moving = len > 0.08;
      if (p.moving) {
        mx /= Math.max(1, len); my /= Math.max(1, len);
        const sp = upVal('speed');
        World.move(game.world, p, mx * sp * dt, my * sp * dt, 0.28);
        p.animT += dt * 7;
        if (Math.abs(mx) > Math.abs(my)) { p.dir = 'east'; p.faceLeft = mx < 0; }
        else p.dir = my > 0 ? 'south' : 'north';
      }
    }
    collectNear();

    // shades / fx
    for (const m of game.shades) m.update(dt, game);
    for (const f of game.fx) f.t += dt;
    game.fx = game.fx.filter(f => f.t < 0.5);

    // ηχητικό cue όταν πλησιάζει shade στο σκοτάδι
    shadeCueT -= dt;
    if (shadeCueT <= 0) {
      shadeCueT = 5;
      for (const m of game.shades) {
        if (m.dead) continue;
        const d = Math.hypot(m.x - p.x, m.y - p.y);
        if (d < 3.5 && !game.inLight(m.x, m.y)) {
          m.boss ? GameAudio.bossNear() : GameAudio.shadeNear();
          break;
        }
      }
    }

    const biome = Defs.biomeFor(run.floor);
    GameAudio.setDark(Math.min(0.85, biome.dark));

    // HUD
    $('hp-fill').style.width = Math.max(0, p.hp / p.maxHp * 100) + '%';
    $('floor-label').textContent = run.daily
      ? 'DAILY · ' + Math.ceil(run.timeLeft) + 's'
      : 'FLOOR ' + run.floor + ' · ' + biome.name;
    $('run-loot').innerHTML = '⚙ ' + run.scrap +
      (S.cores ? ' <span class="core">◆ ' + S.cores + '</span>' : '') +
      (run.keycard ? ' 🔑' : '');
    $('hint').textContent = currentHint();
    $('act-icon').textContent = actIconFor(findTarget());
  }

  // ---------- render ----------
  let tick = 0;
  const lightCv = document.createElement('canvas');
  lightCv.width = VW; lightCv.height = VH;
  const lctx = lightCv.getContext('2d');

  const CHAR_SCALE = 0.62;

  function scr(wx, wy, cam) { return World.toScreen(wx, wy, cam, VW, VH); }

  function drawChar(img, wx, wy, cam, scale, faceLeft, alpha) {
    const s = scr(wx, wy, cam);
    ctx.save();
    if (faceLeft) { ctx.translate(s.x, 0); ctx.scale(-1, 1); ctx.translate(-s.x, 0); }
    if (alpha !== undefined) ctx.globalAlpha = alpha;
    ctx.drawImage(img,
      Math.round(s.x - img.width * scale / 2),
      Math.round(s.y - img.height * scale + 6 * scale),
      img.width * scale, img.height * scale);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function render(dt) {
    tick += dt;
    const p = game.player;
    const run = game.run;
    const biome = Defs.biomeFor(run.floor);
    const cam = { x: p.x, y: p.y - 0.3 };

    ctx.fillStyle = '#0a0906';
    ctx.fillRect(0, 0, VW, VH);

    World.render(ctx, game.world, cam, VW, VH, biome);

    // pickups
    for (const d of game.pickups) {
      d.bob += dt * 3;
      const img = Assets.icons[d.kind];
      const s = scr(d.x, d.y, cam);
      ctx.drawImage(img, Math.round(s.x - 8),
        Math.round(s.y - 8 + Math.sin(d.bob) * 2), 16, 16);
    }

    // depth-sorted: props + shades + player
    const order = [];
    for (const [k, pr] of game.world.props) {
      const [tx, ty] = k.split(',').map(Number);
      order.push({ y: ty + 0.5, draw: () => {
        const img = Assets.props[pr.kind];
        const s = scr(tx + 0.5, ty + 0.9, cam);
        ctx.drawImage(img,
          Math.round(s.x - img.width / 2),
          Math.round(s.y - img.height), img.width, img.height);
      } });
    }
    for (const m of game.shades) {
      if (m.dead) continue;
      order.push({ y: m.y, draw: () => {
        const img = m.sprite();
        const sc = CHAR_SCALE * (m.boss ? T.BOSS_SCALE : 1);
        drawChar(img, m.x, m.y, cam, sc, m.faceLeft,
          m.flash > 0 ? 0.55 : undefined);
        if (m.boss) {
          const s = scr(m.x, m.y, cam);
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.fillRect(s.x - 18, s.y - img.height * sc - 2, 36, 5);
          ctx.fillStyle = '#c8302a';
          ctx.fillRect(s.x - 17, s.y - img.height * sc - 1,
            34 * Math.max(0, m.hp / m.maxHp), 3);
        }
      } });
    }
    order.push({ y: p.y, draw: () => {
      const frames = Assets.hero[p.dir] || Assets.hero.south;
      const img = p.moving ? frames[(p.animT | 0) % frames.length] : frames[0];
      drawChar(img, p.x, p.y, cam, CHAR_SCALE,
        p.dir === 'east' && p.faceLeft, p.hurtT > 0 ? 0.6 : undefined);
      if (p.swingT > 0) {
        const [fx2, fy2] = facingVec();
        const fs = scr(p.x + fx2 * 0.9, p.y + fy2 * 0.9, cam);
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath();
        ctx.arc(fs.x, fs.y, 11 * (1 - p.swingT / 0.18) + 4, 0, 7);
        ctx.stroke();
      }
    } });
    order.sort((a, b) => a.y - b.y);
    for (const o of order) o.draw();

    // fx
    for (const f of game.fx) {
      const s = scr(f.x, f.y, cam);
      ctx.globalAlpha = 1 - f.t * 2;
      if (f.kind === 'puff') {
        ctx.fillStyle = '#d8d0b8';
        for (let i = 0; i < 5; i++) {
          const a = i / 5 * Math.PI * 2;
          const r = f.t * 24;
          ctx.beginPath();
          ctx.arc(s.x + Math.cos(a) * r, s.y - 8 + Math.sin(a) * r, 3, 0, 7);
          ctx.fill();
        }
      } else {
        ctx.fillStyle = '#fff';
        ctx.fillRect(s.x - 2 + Math.random() * 4, s.y - 10 + Math.random() * 4, 3, 3);
      }
      ctx.globalAlpha = 1;
    }

    // ---- φωτισμός ----
    const darkness = Math.min(0.86,
      biome.dark + Defs.biomeTier(run.floor) * 0.012);
    lctx.clearRect(0, 0, VW, VH);
    lctx.fillStyle = `rgba(6, 6, 14, ${darkness})`;
    lctx.fillRect(0, 0, VW, VH);
    lctx.globalCompositeOperation = 'destination-out';
    const hole = (wx, wy, r, str) => {
      const s = scr(wx, wy, cam);
      const rp = r * World.PPU;
      const g = lctx.createRadialGradient(s.x, s.y, rp * 0.25, s.x, s.y, rp);
      g.addColorStop(0, `rgba(0,0,0,${str})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      lctx.fillStyle = g;
      lctx.beginPath(); lctx.arc(s.x, s.y, rp, 0, 7); lctx.fill();
    };
    const flick = 1 + Math.sin(tick * 11) * 0.03 + Math.sin(tick * 3.7) * 0.03;
    hole(p.x, p.y - 0.2, lightRadius() * flick, 0.95);
    hole(game.world.exit.x, game.world.exit.y, 1.9, 0.75);
    hole(game.world.entry.x, game.world.entry.y - 1, 1.2, 0.5);
    if (game.world.vaultDoor && !game.world.vaultOpen) {
      hole(game.world.vaultDoor.x + 0.5, game.world.vaultDoor.y + 0.5,
        1.3 + Math.sin(tick * 4) * 0.2, 0.6);
    }
    lctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(lightCv, 0, 0);

    // κόκκινη λάμψη τραύματος
    if (p.hurtT > 0) {
      ctx.fillStyle = `rgba(200,20,20,${p.hurtT * 0.7})`;
      ctx.fillRect(0, 0, VW, VH);
    }
  }

  // ---------- loop ----------
  let last = performance.now();
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (state === 'PLAY') {
      if (!panel) update(dt);
      if (state === 'PLAY') render(dt);
    } else if (state === 'HUB') {
      hubIdleTick(dt);
    }
  }
  requestAnimationFrame(loop);

  // αποθήκευση όταν κρύβεται η σελίδα (και lastSeen για offline drones)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) SaveGame.save();
  });

  // ---------- boot ----------
  offlinePending = offlineEarnings();
  Assets.loadOverrides(refreshTitle);
  refreshTitle();
  if (document.fonts && document.fonts.load) {
    document.fonts.load('11px "Press Start 2P"');
    document.fonts.load('10px VT323');
  }

  // debug hook για tests
  window.__debug = {
    game, World, Defs, Entities, SaveGame, Monetize, S,
    get state() { return state; },
    get panel() { return panel; },
    setState, startRun, startDaily, endDaily, act, openPanel, closePanel,
    goDeeper, cashOut, die, enterHub, findTarget, tryExit, loadFloor,
    upVal, dmgStat, greedMult, offlineEarnings,
  };
})();
