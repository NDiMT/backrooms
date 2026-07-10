/* DEAD ZONE — main loop, game states, input, run manager. */

(() => {
  const $ = id => document.getElementById(id);
  const canvas = $('screen');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const W = Engine.W, H = Engine.H;

  // ---------- canvas scaling ----------
  function fitCanvas() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const scale = Math.min(vw / W, vh / H);
    canvas.style.width = (W * scale) + 'px';
    canvas.style.height = (H * scale) + 'px';
    if (TouchControls.isTouch) {
      $('rotate-prompt').classList.toggle('hidden', vw >= vh);
    } else {
      $('rotate-prompt').classList.add('hidden');
    }
  }
  window.addEventListener('resize', fitCanvas);
  window.addEventListener('orientationchange', fitCanvas);
  fitCanvas();

  // ---------- deck themes ----------
  const THEMES = [
    { idx: 0, floor: '#2c3444', ceil: '#1a202c' },
    { idx: 1, floor: '#3a2820', ceil: '#221610' },
    { idx: 2, floor: '#243428', ceil: '#141f16' },
    { idx: 3, floor: '#231b30', ceil: '#120d1c' },
  ];

  // ---------- state ----------
  let state = 'MENU';   // MENU|PLAY|PAUSE|REWARD|SHOP|DEAD|WIN|META
  let meta = Rogue.loadMeta();

  const game = {
    audio: GameAudio,
    player: null,
    world: null,
    enemies: [],
    projectiles: [],
    pickups: [],
    deckIdx: 0,
    seed: 0,
    kills: 0,
    scrapEarned: 0,
    elapsed: 0,
    wardenDead: false,
    showMap: false,
    shakeT: 0,
    vampHeal: 0,

    shake(t) { this.shakeT = Math.max(this.shakeT, t); },

    alertEnemies(x, y, r) {
      for (const e of this.enemies) {
        if (e.state === 'idle' &&
            Math.hypot(e.x - x, e.y - y) < r) e.state = 'chase';
      }
    },

    registerHit(e, dmg) {
      e.hurt(dmg, this);
      GameAudio.hitMarker();
      HUD.hitmarker();
    },

    onEnemyDeath(e) {
      this.kills++;
      const p = this.player;
      if (p.perks.vamp) p.hp = Math.min(p.maxHp, p.hp + p.perks.vamp);
      const wst = PlayerSys.stats(PlayerSys.weapon(p), p.perks);
      if (wst.vamp) p.hp = Math.min(p.maxHp, p.hp + wst.vamp);

      // scrap drops
      const amount = Math.round(e.stats.scrap * p.perks.scrapMul);
      if (amount > 0) {
        const pieces = e.stats.elite ? 4 : 2;
        for (let i = 0; i < pieces; i++) {
          const pk = new Entities.Pickup('scrap',
            e.x + (Math.random() - 0.5) * 0.7,
            e.y + (Math.random() - 0.5) * 0.7);
          pk.value = Math.ceil(amount / pieces);
          this.pickups.push(pk);
        }
      }
      if (!e.stats.boss && !e.stats.elite && Math.random() < 0.08) {
        this.pickups.push(new Entities.Pickup('medkit', e.x, e.y));
      }

      if (e.type === 'warden') {
        this.wardenDead = true;
        openElevator();
        showMessage('WARDEN DOWN — THE ELEVATOR IS OPEN. Follow the green sign.', 5000);
        GameAudio.elevator();
      }
      if (e.type === 'boss') {
        setTimeout(() => winRun(), 900);
      }
    },

    hurtPlayer(amount, source) {
      if (state !== 'PLAY') return;
      const dead = PlayerSys.damage(this.player, amount);
      HUD.notifyPain();
      GameAudio.playerPain();
      this.shake(0.25);
      flashDamage();
      if (dead) dieRun();
    },
  };

  // ---------- μηνύματα / εφέ ----------
  let msgTimer = null;
  function showMessage(text, ms = 3000) {
    const el = $('message');
    el.textContent = text;
    el.style.opacity = 1;
    clearTimeout(msgTimer);
    msgTimer = setTimeout(() => { el.style.opacity = 0; }, ms);
  }
  function flashDamage() {
    const el = $('damage-flash');
    el.style.opacity = 1;
    setTimeout(() => { el.style.opacity = 0; }, 120);
  }

  /* Toast ονόματος όπλου (εναλλαγή/απόκτηση). */
  let wpnTimer = null;
  function weaponToast() {
    const p = game.player;
    const w = PlayerSys.weapon(p);
    const el = $('weapon-toast');
    el.textContent = PlayerSys.displayName(w) +
      (w.rarity ? ' ' + '★'.repeat(w.rarity) : '');
    el.style.color = w.element ? PlayerSys.ELEMENTS[w.element].color
                               : PlayerSys.RARITIES[w.rarity].color;
    el.style.opacity = 1;
    clearTimeout(wpnTimer);
    wpnTimer = setTimeout(() => { el.style.opacity = 0; }, 1400);
  }
  game.onWeaponSwitch = weaponToast;

  // ---------- run / decks ----------
  function newRun() {
    meta.runs++;
    Rogue.saveMeta(meta);
    game.seed = Math.floor(Math.random() * 0xffffffff);
    game.deckIdx = 0;
    game.kills = 0;
    game.scrapEarned = 0;
    game.elapsed = 0;
    game.player = PlayerSys.create(meta);
    loadDeck();
    setState('PLAY');
    showMessage('CLONE #' + meta.runs + ' ONLINE. Find and kill the deck Warden.', 4500);
  }

  function loadDeck() {
    const world = Procgen.generate(game.seed, game.deckIdx);
    game.world = world;
    game.player.x = world.playerStart.x;
    game.player.y = world.playerStart.y;
    game.player.angle = Math.random() * Math.PI * 2;
    game.enemies = world.spawns.map(s => new Entities.Enemy(s.type, s.x, s.y));
    game.projectiles = [];
    game.pickups = world.pickups.map(p =>
      p.kind === 'weapon'
        ? new Entities.Pickup('weapon', p.x, p.y,
            Rogue.randomWeapon(game.deckIdx, Math.random))
        : new Entities.Pickup(p.kind, p.x, p.y));
    game.wardenDead = false;
    $('objective').textContent = Rogue.DECK_NAMES[game.deckIdx] +
      (game.deckIdx === 3 ? ' — DESTROY ORION' : ' — KILL THE WARDEN');
    if (game.deckIdx === 3) GameAudio.bossRoar();
  }

  function openElevator() {
    for (const [, d] of game.world.doors) {
      if (d.elevator) d.target = 1;
    }
  }

  // ---------- κάρτες αμοιβών (perk ή όπλο) ----------
  function weaponCardHTML(inst) {
    const b = PlayerSys.BASES[inst.base];
    const rar = PlayerSys.RARITIES[inst.rarity];
    const el = inst.element ? PlayerSys.ELEMENTS[inst.element] : null;
    const st = PlayerSys.stats(inst, null);
    const img = Assets.weapons[b.map].idle;
    // canvas → dataURL, ενώ τα PNG overrides είναι <img> με έτοιμο src
    const imgSrc = img.toDataURL ? img.toDataURL() : img.src;
    const details =
      `DMG ${Math.round(st.dmg)}${st.pellets > 1 ? '×' + st.pellets : ''} · ` +
      `${(1 / st.rate).toFixed(1)}/s` +
      (st.pierce ? ' · PIERCING' : '') + (st.chain ? ' · CHAINS' : '') +
      (st.splash ? ' · AOE' : '');
    return `
      <img class="wpn-preview" src="${imgSrc}" alt="">
      <h3 style="color:${el ? el.color : rar.color}">${PlayerSys.displayName(inst)}</h3>
      <p>${details}</p>
      ${el ? `<p style="color:${el.color}">${el.desc}</p>` : ''}
      <span class="cost" style="color:${rar.color}">${rar.name}${inst.rarity ? ' ' + '★'.repeat(inst.rarity) : ''}</span>`;
  }

  function nextDeck() {
    game.deckIdx++;
    GameAudio.elevator();
    const rewards = Rogue.pickRewards(game.deckIdx, Math.random);
    const holder = $('reward-cards');
    holder.innerHTML = '';
    for (const r of rewards) {
      const card = document.createElement('div');
      if (r.kind === 'perk') {
        card.className = 'card';
        card.innerHTML = `<h3>${r.perk.name}</h3><p>${r.perk.desc}</p>
          <span class="cost">PERK</span>`;
      } else {
        card.className = 'card rar' + r.inst.rarity;
        card.innerHTML = weaponCardHTML(r.inst);
      }
      card.addEventListener('click', () => {
        if (r.kind === 'perk') {
          r.perk.apply(game.player);
          GameAudio.perk();
        } else {
          showMessage('ACQUIRED: ' + PlayerSys.giveWeapon(game.player, r.inst, game), 3000);
          weaponToast();
        }
        loadDeck();
        setState('PLAY');
        showMessage(Rogue.DECK_NAMES[game.deckIdx], 3500);
      });
      holder.appendChild(card);
    }
    setState('REWARD');
  }

  function dieRun() {
    GameAudio.playerDie();
    const run = { deckIdx: game.deckIdx, kills: game.kills, won: false };
    const cores = Rogue.coresEarned(run);
    meta.cores += cores;
    meta.bestDeck = Math.max(meta.bestDeck, game.deckIdx + 1);
    Rogue.saveMeta(meta);
    $('death-stats').innerHTML =
      `Reached: ${Rogue.DECK_NAMES[game.deckIdx]}<br>` +
      `Kills: ${game.kills} · Scrap collected: ${game.scrapEarned} · ` +
      `Time: ${fmtTime(game.elapsed)}<br>Seed: ${game.seed}`;
    $('death-cores').textContent = cores;
    renderMetaCards($('meta-cards-dead'));
    setState('DEAD');
  }

  function winRun() {
    GameAudio.win();
    const run = { deckIdx: game.deckIdx, kills: game.kills, won: true };
    const cores = Rogue.coresEarned(run);
    meta.cores += cores;
    meta.wins++;
    meta.bestDeck = 4;
    Rogue.saveMeta(meta);
    $('win-stats').innerHTML =
      `Kills: ${game.kills} · Time: ${fmtTime(game.elapsed)} · Seed: ${game.seed}`;
    $('win-cores').textContent = cores;
    setState('WIN');
  }

  function fmtTime(s) {
    return `${(s / 60) | 0}:${String((s | 0) % 60).padStart(2, '0')}`;
  }

  // ---------- meta shop ----------
  function renderMetaCards(holder) {
    holder.innerHTML = '';
    if ($('meta-cores')) $('meta-cores').textContent = meta.cores;
    for (const up of Rogue.META_UPGRADES) {
      const lvl = meta.upgrades[up.id] || 0;
      const maxed = lvl >= up.max;
      const cost = maxed ? null : up.cost(lvl);
      const card = document.createElement('div');
      card.className = 'card' + ((maxed || cost > meta.cores) ? ' disabled' : '');
      card.innerHTML = `<h3>${up.name} ${up.max > 1 ? `(${lvl}/${up.max})` : (lvl ? '✓' : '')}</h3>
        <p>${up.desc}</p>
        <span class="cost">${maxed ? 'MAXED' : cost + ' CORES'}</span>`;
      if (!maxed && cost <= meta.cores) {
        card.addEventListener('click', () => {
          meta.cores -= cost;
          meta.upgrades[up.id] = lvl + 1;
          Rogue.saveMeta(meta);
          GameAudio.perk();
          renderMetaCards(holder);
          if (holder.id === 'meta-cards-dead') $('death-cores').textContent = '0';
        });
      }
      holder.appendChild(card);
    }
  }

  // ---------- shop τερματικού ----------
  let nearTerminal = false;
  function renderShop() {
    $('shop-scrap').textContent = game.player.scrap;
    const holder = $('shop-cards');
    holder.innerHTML = '';
    for (const item of Rogue.shopItems(game.player, game)) {
      const usable = item.can();
      const affordable = game.player.scrap >= item.cost;
      const card = document.createElement('div');
      card.className = 'card' + ((!usable || !affordable) ? ' disabled' : '');
      card.innerHTML = `<h3>${item.name}</h3><p>${item.desc}</p>
        <span class="cost">${item.cost} SCRAP</span>`;
      if (usable && affordable) {
        card.addEventListener('click', () => {
          game.player.scrap -= item.cost;
          const msg = item.apply();
          GameAudio.pickup();
          if (msg) showMessage(msg, 2500);
          renderShop();
        });
      }
      holder.appendChild(card);
    }
  }

  // ---------- καταστάσεις / overlays ----------
  const OVERLAYS = ['menu', 'pause', 'reward', 'shop', 'dead', 'win', 'meta'];
  function setState(s) {
    state = s;
    for (const id of OVERLAYS) $(id).classList.add('hidden');
    const map = { MENU: 'menu', PAUSE: 'pause', REWARD: 'reward',
                  SHOP: 'shop', DEAD: 'dead', WIN: 'win', META: 'meta' };
    if (map[s]) $(map[s]).classList.remove('hidden');

    const playing = s === 'PLAY';
    $('objective').classList.toggle('hidden', !playing);
    if (playing && TouchControls.isTouch) {
      TouchControls.show();
      $('pause-btn').classList.remove('hidden');
    } else {
      TouchControls.hide();
      $('pause-btn').classList.add('hidden');
    }
    if (!TouchControls.isTouch) {
      if (playing) {
        canvas.requestPointerLock && canvas.requestPointerLock();
      } else if (document.pointerLockElement === canvas) {
        // αλλιώς το lock «ρουφάει» τα clicks των overlays
        document.exitPointerLock();
      }
    }
    if (!playing) $('shop-prompt').classList.add('hidden');
  }

  // ---------- input ----------
  const keys = {};
  let mouseDown = false;

  document.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (state !== 'PLAY') return;
    if (e.code === 'Tab') { e.preventDefault(); game.showMap = !game.showMap; }
    if (e.code === 'KeyQ') PlayerSys.nextWeapon(game.player, game);
    if (e.code === 'KeyE' && nearTerminal) { renderShop(); setState('SHOP'); }
    const idx = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
    if (idx >= 0) PlayerSys.switchWeapon(game.player, idx, game);
  });
  document.addEventListener('keyup', e => { keys[e.code] = false; });

  document.addEventListener('mousemove', e => {
    if (state !== 'PLAY' || TouchControls.isTouch) return;
    if (document.pointerLockElement !== canvas) return;
    game.player.angle += e.movementX * 0.0028;
  });
  canvas.addEventListener('mousedown', () => {
    if (state === 'PLAY' && !TouchControls.isTouch &&
        document.pointerLockElement !== canvas) {
      canvas.requestPointerLock();
    }
    mouseDown = true;
  });
  document.addEventListener('mouseup', () => { mouseDown = false; });

  document.addEventListener('pointerlockchange', () => {
    if (TouchControls.isTouch) return;
    if (document.pointerLockElement !== canvas && state === 'PLAY') {
      setState('PAUSE');
    }
  });

  TouchControls.onWeaponSwitch = () => {
    if (state === 'PLAY') PlayerSys.nextWeapon(game.player, game);
  };
  TouchControls.onMapToggle = () => { game.showMap = !game.showMap; };

  // κουμπιά UI
  $('start-btn').addEventListener('click', () => { GameAudio.start(); newRun(); });
  $('resume-btn').addEventListener('click', () => setState('PLAY'));
  $('quit-btn').addEventListener('click', () => setState('MENU'));
  $('pause-btn').addEventListener('click', () => { if (state === 'PLAY') setState('PAUSE'); });
  $('retry-btn').addEventListener('click', () => { GameAudio.start(); newRun(); });
  $('win-again-btn').addEventListener('click', () => { GameAudio.start(); newRun(); });
  $('meta-btn').addEventListener('click', () => {
    renderMetaCards($('meta-cards'));
    setState('META');
  });
  $('meta-close-btn').addEventListener('click', () => setState('MENU'));
  $('shop-open-btn').addEventListener('click', () => {
    renderShop();
    setState('SHOP');
  });
  $('shop-close-btn').addEventListener('click', () => setState('PLAY'));

  if (TouchControls.isTouch) {
    $('hint-desktop').classList.add('hidden');
    $('hint-touch').classList.remove('hidden');
    $('shop-key-hint').style.display = 'none';
  }
  $('clone-no').textContent = meta.runs + 1;

  // φόρτωση PNG overrides από assets/ (AI-generated γραφικά, αν υπάρχουν)
  Assets.loadOverrides(() => {});

  // προφόρτωση pixel fonts ώστε να τα βλέπει και το canvas HUD
  if (document.fonts && document.fonts.load) {
    document.fonts.load('11px "Press Start 2P"');
    document.fonts.load('10px VT323');
  }

  // ---------- update ----------
  function update(dt) {
    const p = game.player;
    game.elapsed += dt;

    // --- movement ---
    let mx = 0, mz = 0;
    if (keys['KeyW'] || keys['ArrowUp']) mz += 1;
    if (keys['KeyS'] || keys['ArrowDown']) mz -= 1;
    if (keys['KeyA']) mx -= 1;
    if (keys['KeyD']) mx += 1;
    if (keys['ArrowLeft']) p.angle -= 2.4 * dt;
    if (keys['ArrowRight']) p.angle += 2.4 * dt;
    mx += TouchControls.state.move.x;
    mz += TouchControls.state.move.z;
    mx = Math.max(-1, Math.min(1, mx));
    mz = Math.max(-1, Math.min(1, mz));

    if (TouchControls.isTouch) {
      p.angle += TouchControls.consumeLook() * 0.006;
    }

    const speed = 3.4 * p.perks.speedMul;
    const moving = Math.abs(mx) > 0.05 || Math.abs(mz) > 0.05;
    if (moving) {
      const fx = Math.cos(p.angle), fy = Math.sin(p.angle);
      const rx = -fy, ry = fx;
      const len = Math.max(1, Math.hypot(mx, mz));
      Procgen.move(game.world, p,
        (fx * mz + rx * mx) / len * speed * dt,
        (fy * mz + ry * mx) / len * speed * dt, p.radius);
      p.bob += dt * 9;
    }

    // --- fire ---
    p.cool = Math.max(0, p.cool - dt);
    p.fireAnim = Math.max(0, p.fireAnim - dt);
    const wantFire = mouseDown || keys['Space'] || TouchControls.state.firing;
    if (wantFire) {
      PlayerSys.fire(p, game, TouchControls.isTouch ? 0.06 : 0);
    }
    // vamp από mods (μαζεύεται στο dealHit)
    if (game.vampHeal) {
      p.hp = Math.min(p.maxHp, p.hp + game.vampHeal);
      game.vampHeal = 0;
    }

    // --- doors ---
    for (const [key, d] of game.world.doors) {
      const [dx, dy] = key.split(',').map(Number);
      const near = Math.hypot(p.x - dx - 0.5, p.y - dy - 0.5) < 1.4;
      if (!d.elevator) {
        if (near) { if (d.target === 0) GameAudio.doorOpen(); d.target = 1; d.timer = 3; }
        else if (d.timer > 0) { d.timer -= dt; if (d.timer <= 0) d.target = 0; }
      }
      d.open += Math.sign(d.target - d.open) * dt * 1.8;
      d.open = Math.max(0, Math.min(1, d.open));
    }

    // --- elevator transition ---
    if (game.world.elevator && game.wardenDead) {
      const el = game.world.elevator;
      if (Math.hypot(p.x - el.x, p.y - el.y) < 0.7) {
        nextDeck();
        return;
      }
    }

    // --- enemies / projectiles ---
    for (const e of game.enemies) e.update(dt, game);
    if (state !== 'PLAY') return;
    for (const pr of game.projectiles) pr.update(dt, game);
    game.projectiles = game.projectiles.filter(pr => !pr.dead);

    // --- pickups ---
    for (const pk of game.pickups) {
      if (pk.taken) continue;
      pk.bob += dt * 3;
      if (Math.hypot(pk.x - p.x, pk.y - p.y) > 0.55) continue;
      pk.taken = true;
      applyPickup(pk);
    }
    game.pickups = game.pickups.filter(pk => !pk.taken);

    // --- terminals ---
    nearTerminal = game.world.terminals.some(t =>
      Math.hypot(t.x - p.x, t.y - p.y) < 1.3);
    $('shop-prompt').classList.toggle('hidden', !nearTerminal);

    game.shakeT = Math.max(0, game.shakeT - dt);
  }

  function applyPickup(pk) {
    const p = game.player;
    switch (pk.kind) {
      case 'medkit':
        if (p.hp >= p.maxHp) { pk.taken = false; return; }
        p.hp = Math.min(p.maxHp, p.hp + 35);
        break;
      case 'rounds': p.ammo.rounds += 12; break;
      case 'cells': p.ammo.cells += 20; break;
      case 'scrap': {
        const v = pk.value || 5;
        p.scrap += v;
        game.scrapEarned += v;
        GameAudio.scrapPickup();
        return;
      }
      case 'weapon': {
        const msg = PlayerSys.giveWeapon(p, pk.inst, game);
        HUD.notifyPickup();
        weaponToast();
        showMessage('ACQUIRED: ' + msg, 2800);
        return;
      }
    }
    GameAudio.pickup();
    HUD.notifyPickup();
    const msg = Entities.PICKUP_DEFS[pk.kind].msg;
    if (msg) showMessage(msg, 1600);
  }

  // ---------- render ----------
  let tick = 0;
  function render(dt) {
    tick += dt;
    ctx.save();
    if (game.shakeT > 0) {
      ctx.translate((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 3);
    }

    const theme = THEMES[game.deckIdx];
    const sprites = [];

    for (const e of game.enemies) {
      sprites.push({
        x: e.x, y: e.y, img: e.sprite(tick),
        worldH: e.state === 'dead' || e.state === 'dying'
          ? e.stats.worldH * 0.5 : e.stats.worldH,
        yOff: e.stats.fly || 0,
        flash: e.flash > 0,
        flashColor: e.statusFx,
      });
    }
    for (const pk of game.pickups) {
      sprites.push({
        x: pk.x, y: pk.y, img: pk.sprite(),
        worldH: pk.def.worldH,
        yOff: 0.05 + Math.sin(pk.bob) * 0.03,
        bright: pk.kind === 'scrap' || pk.kind === 'core' || pk.kind === 'weapon',
      });
    }
    for (const pr of game.projectiles) {
      sprites.push({ x: pr.x, y: pr.y, img: pr.sprite(),
                     worldH: 0.14, yOff: 0.4, bright: true });
    }
    for (const t of game.world.terminals) {
      sprites.push({ x: t.x, y: t.y, img: Assets.props.terminal, worldH: 0.62 });
    }

    Engine.render(ctx, game.world, game.player, sprites, theme, tick);
    HUD.weapon(ctx, game);
    HUD.render(ctx, game, dt);
    ctx.restore();
  }

  // ---------- loop ----------
  let last = performance.now();
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (state === 'PLAY') {
      update(dt);
      render(dt);
    } else if (state === 'MENU' || state === 'META') {
      ctx.fillStyle = '#06080c';
      ctx.fillRect(0, 0, W, H);
    }
  }
  requestAnimationFrame(loop);

  // ---------- debug hook (smoke tests) ----------
  window.__debug = {
    game, meta,
    get state() { return state; },
    setState, newRun, nextDeck, dieRun, winRun, renderShop,
    PlayerSys, Rogue, Procgen, Engine,
  };
})();
