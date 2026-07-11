/* DRIFTLAND — main: loop, καταστάσεις, αλληλεπίδραση, φωτισμός,
   spawns, tutorial hints, save, θάνατος/αναγέννηση, νίκη. */

(() => {
  const $ = id => document.getElementById(id);
  const canvas = $('screen');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const VW = 288, VH = 512;      // εσωτερική ανάλυση (portrait 9:16)
  const TS = World.TS;
  const T = Defs.T;

  function fitCanvas() {
    const s = Math.min(window.innerWidth / VW, window.innerHeight / VH);
    canvas.style.width = (VW * s) + 'px';
    canvas.style.height = (VH * s) + 'px';
  }
  window.addEventListener('resize', fitCanvas);
  fitCanvas();

  // ---------- state ----------
  let state = 'TITLE';   // TITLE | PLAY | DEAD | WIN
  let panel = null;      // null | 'inv' | 'craft' | 'chest' | 'raft' | 'pause'
  let pendingBuild = null;
  let openChest = null;

  const game = {
    audio: GameAudio,
    world: null,
    player: null,
    mobs: [],
    drops: [],
    fx: [],
    time: 0,           // δευτ. μέσα στον κύκλο
    day: 1,
    raftStage: 0,
    stats: { kills: 0, gathered: 0, crafted: 0, days: 1 },
    flags: {},

    isDay() { return this.time < T.DAY_LEN; },
    nightAmount() {
      const t = this.time;
      if (t < T.DAY_LEN - 12) return 0;
      if (t < T.DAY_LEN) return (t - (T.DAY_LEN - 12)) / 12;
      const total = T.DAY_LEN + T.NIGHT_LEN;
      if (t > total - 12) return 1 - (t - (total - 12)) / 12;
      return 1;
    },

    nearLight(x, y) {
      const p = this.player;
      if (p.torchLit && Math.hypot(p.x - x, p.y - y) < 3.2) return true;
      for (const [k, pr] of this.world.props) {
        if (pr.kind !== 'campfire') continue;
        const [px, py] = k.split(',').map(Number);
        if (Math.hypot(px + 0.5 - x, py + 0.5 - y) < T.LIGHT_CAMPFIRE) return true;
      }
      return false;
    },

    dropItem(item, n, x, y) {
      this.drops.push(new Entities.Drop(item, n, x, y));
    },
    spawnPuff(x, y) {
      this.fx.push({ kind: 'puff', x, y, t: 0 });
    },
    spawnHitFx(x, y, k) {
      this.fx.push({ kind: 'hit', x, y, t: 0 });
    },
    markDirty(x, y) { World.invalidate(x, y); },

    hurtPlayer(dmg, src) {
      const p = this.player;
      if (state !== 'PLAY' || p.hp <= 0) return;
      p.hp -= dmg;
      p.hurtT = 0.25;
      GameAudio.playerHurt();
      if (p.hp <= 0) die();
    },
  };

  // ---------- νέος παίκτης / παιχνίδι ----------
  function freshPlayer(spawn) {
    return {
      x: spawn.x, y: spawn.y,
      dir: 'south', faceLeft: false,
      hp: T.PLAYER_HP, hunger: 100,
      inv: Inv.create(),
      spawn: { x: spawn.x, y: spawn.y },
      animT: 0, moving: false,
      attackCd: 0, hurtT: 0,
      torchLit: false,
    };
  }

  function newGame() {
    SaveGame.clear();
    game.world = World.generate((Math.random() * 0xffffffff) >>> 0);
    game.player = freshPlayer(game.world.spawn);
    game.mobs = []; game.drops = []; game.fx = [];
    game.time = 20; game.day = 1;
    game.raftStage = 0;
    game.stats = { kills: 0, gathered: 0, crafted: 0, days: 1 };
    game.flags = {};
    World.invalidateAll();
    Monetize.track('game_start', { new: true });
    setState('PLAY');
    toast('You wash ashore… Gather fiber and wood. Survive.');
  }

  function continueGame() {
    const d = SaveGame.load();
    if (!d) { newGame(); return; }
    game.player = freshPlayer({ x: 0, y: 0 });
    SaveGame.apply(game, d);
    game.mobs = []; game.drops = []; game.fx = [];
    Monetize.track('game_start', { new: false });
    setState('PLAY');
    toast('Day ' + game.day + ' — welcome back.');
  }

  // ---------- καταστάσεις / panels ----------
  function setState(s) {
    state = s;
    $('title').classList.toggle('hidden', s !== 'TITLE');
    $('dead').classList.toggle('hidden', s !== 'DEAD');
    $('win').classList.toggle('hidden', s !== 'WIN');
    $('hud').classList.toggle('hidden', s !== 'PLAY');
    if (s !== 'PLAY') closePanel();
    if (s === 'PLAY') Monetize.gameplayStart();
    else Monetize.gameplayStop();
  }

  function openPanel(name) {
    panel = name;
    for (const id of ['inv-panel', 'craft-panel', 'chest-panel', 'raft-panel', 'pause-panel']) {
      $(id).classList.add('hidden');
    }
    if (name) {
      $(name + '-panel').classList.remove('hidden');
      if (name === 'inv') renderInvPanel();
      if (name === 'craft') renderCraftPanel();
      if (name === 'chest') renderChestPanel();
      if (name === 'raft') renderRaftPanel();
    }
  }
  function closePanel() { panel = null; openPanel(null); }

  let toastTimer = null;
  function toast(text, ms = 3200) {
    const el = $('toast');
    el.textContent = text;
    el.style.opacity = 1;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.style.opacity = 0; }, ms);
  }

  // ---------- εργαλεία / στόχευση ----------
  function bestTool(kind) {
    // kind: 'axe' | 'pickaxe' | 'weapon'
    const item = Inv.firstTool(game.player.inv, kind);
    return item ? { item, power: Defs.ITEMS[item].power } : null;
  }

  function facingTile() {
    const p = game.player;
    const d = { south: [0, 1], north: [0, -1], east: [1, 0], west: [-1, 0] }[
      p.faceLeft && p.dir === 'east' ? 'west' : p.dir];
    return { x: Math.floor(p.x + d[0]), y: Math.floor(p.y + d[1]) };
  }

  /* Τι θα κάνει το ACT τώρα; */
  function findTarget() {
    const p = game.player;
    // 1. mob κοντά
    let best = null, bd = 1.15;
    for (const m of game.mobs) {
      if (m.dead) continue;
      const d = Math.hypot(m.x - p.x, m.y - p.y);
      if (d < bd) { best = m; bd = d; }
    }
    if (best) return { type: 'mob', mob: best };

    // 2. prop στο facing tile ή στο tile του παίκτη
    const f = facingTile();
    for (const t of [f, { x: Math.floor(p.x), y: Math.floor(p.y) }]) {
      const key = t.x + ',' + t.y;
      const prop = game.world.props.get(key);
      if (!prop) continue;
      if (prop.kind === 'bush' && prop.looted) continue;
      return { type: 'prop', key, prop, tx: t.x, ty: t.y };
    }
    // 3. raft spot
    const rs = game.world.raftSpot;
    if (Math.hypot(rs.x + 0.5 - p.x, rs.y + 0.5 - p.y) < 1.6) {
      return { type: 'raft' };
    }
    return null;
  }

  function actIconFor(tgt) {
    if (pendingBuild) return '🔨';
    if (!tgt) return '✊';
    if (tgt.type === 'mob') return '🗡';
    if (tgt.type === 'raft') return '⛵';
    const k = tgt.prop.kind;
    if (k === 'tree' || k === 'palm') return '🪓';
    if (k === 'rock') return '⛏';
    if (k === 'chest') return '📦';
    if (k === 'bed') return '💤';
    if (k === 'wreck') return '🔍';
    return '✊';
  }

  function act() {
    if (state !== 'PLAY' || panel) return;
    const p = game.player;

    // τοποθέτηση buildable
    if (pendingBuild) {
      placeBuild();
      return;
    }
    if (p.attackCd > 0) return;
    p.attackCd = T.PLAYER_ATK_CD;
    p.swingT = 0.18;

    const tgt = findTarget();
    if (!tgt) { GameAudio.swing(); gatherGrass(); return; }

    if (tgt.type === 'mob') {
      const w = bestTool('weapon');
      const dmg = w ? w.power : 2;
      tgt.mob.hurt(dmg, game);
      return;
    }
    if (tgt.type === 'raft') { openPanel('raft'); return; }

    const K = tgt.prop.kind;
    if (K === 'bag') {
      for (const s of (tgt.prop.inv || [])) Inv.add(p.inv, s.item, s.n);
      game.world.props.delete(tgt.key);
      World.invalidate(tgt.tx, tgt.ty);
      GameAudio.pickup();
      toast('You recover your belongings.');
      return;
    }
    if (K === 'chest') { openChest = tgt.prop; openPanel('chest'); return; }
    if (K === 'bed') { trySleep(); return; }
    if (K === 'wreck') {
      if (!tgt.prop.looted) {
        tgt.prop.looted = true;
        Inv.add(p.inv, 'metal', 2);
        Inv.add(p.inv, 'cloth', 2);
        Inv.add(p.inv, 'rope', 1);
        GameAudio.pickup();
        toast('You salvage metal, cloth and rope from the wreck.');
        game.flags.foundWreck = true;
      } else {
        toast('The old wreck. Build your escape raft beside it.');
      }
      return;
    }
    if (K === 'bush' && !tgt.prop.looted) {
      Entities.hitProp(game, tgt.key, p, 1, null);
      collectNear();
      return;
    }
    const toolKind = { tree: 'axe', palm: 'axe', rock: 'pickaxe' }[K];
    const tool = toolKind ? bestTool(toolKind) : null;
    Entities.hitProp(game, tgt.key, p, tool ? tool.power : T.HAND_POWER,
      tool ? toolKind : null);
  }

  /* Fiber από γρασίδι με άδεια χέρια όταν δεν υπάρχει άλλος στόχος. */
  function gatherGrass() {
    const p = game.player;
    const t = World.tileAt(game.world, p.x, p.y);
    if (t === World.GRASS || t === World.JUNGLE) {
      if (Math.random() < 0.6) {
        Inv.add(p.inv, 'fiber', 1);
        GameAudio.pickup();
        game.flags.gotFiber = true;
        toast('+1 fiber', 900);
      }
    }
  }

  function collectNear() {
    const p = game.player;
    for (const d of game.drops) {
      if (d.taken) continue;
      if (Math.hypot(d.x - p.x, d.y - p.y) < 0.8) {
        const left = Inv.add(p.inv, d.item, d.n);
        if (left === 0) { d.taken = true; GameAudio.pickup(); }
        else d.n = left;
      }
    }
    game.drops = game.drops.filter(d => !d.taken);
  }

  // ---------- crafting / building ----------
  function nearProp(kind, r) {
    const p = game.player;
    for (const [k, pr] of game.world.props) {
      if (pr.kind !== kind) continue;
      const [px, py] = k.split(',').map(Number);
      if (Math.hypot(px + 0.5 - p.x, py + 0.5 - p.y) < r) return true;
    }
    return false;
  }

  function canCraft(rec) {
    if (rec.tier >= 2 && !nearProp('workbench', 3)) return 'Needs workbench nearby';
    if (rec.fire && !nearProp('campfire', 2.5)) return 'Needs campfire nearby';
    if (!Inv.canAfford(game.player.inv, rec.cost)) return 'Missing materials';
    return null;
  }

  function craft(rec) {
    const err = canCraft(rec);
    if (err) { GameAudio.error(); toast(err, 1600); return; }
    Inv.pay(game.player.inv, rec.cost);
    Inv.add(game.player.inv, rec.out, rec.n);
    GameAudio.craft();
    game.stats.crafted++;
    game.flags['made_' + rec.out] = true;
    Monetize.track('craft', { item: rec.out });
    toast('Crafted: ' + Defs.ITEMS[rec.out].name, 1400);
    renderCraftPanel();
  }

  function startBuild(b) {
    if (b.tier >= 2 && !nearProp('workbench', 3)) {
      GameAudio.error(); toast('Needs workbench nearby', 1600); return;
    }
    if (!Inv.canAfford(game.player.inv, b.cost)) {
      GameAudio.error(); toast('Missing materials', 1600); return;
    }
    pendingBuild = b;
    closePanel();
    toast('Tap ACT on the highlighted spot to place ' + b.name, 2600);
  }

  function placeBuild() {
    const f = facingTile();
    const key = f.x + ',' + f.y;
    const t = World.tileAt(game.world, f.x, f.y);
    if (t <= World.WATER || game.world.props.get(key)) {
      GameAudio.error(); toast("Can't build here", 1200); return;
    }
    if (!Inv.canAfford(game.player.inv, pendingBuild.cost)) {
      GameAudio.error(); pendingBuild = null; return;
    }
    Inv.pay(game.player.inv, pendingBuild.cost);
    const p = World.freshProp(pendingBuild.id);
    p.hp = { campfire: 4, workbench: 6, wall: 8, chest: 4, bed: 4 }[pendingBuild.id] || 4;
    if (pendingBuild.id === 'chest') p.inv = Array(12).fill(null);
    game.world.props.set(key, p);
    World.invalidate(f.x, f.y);
    GameAudio.build();
    game.flags['built_' + pendingBuild.id] = true;
    Monetize.track('build', { item: pendingBuild.id });
    if (pendingBuild.id === 'bed') {
      game.player.spawn = { x: f.x + 0.5, y: f.y + 1.2 };
      toast('Respawn point set.');
    }
    pendingBuild = null;
  }

  function trySleep() {
    if (game.isDay()) { toast('You can only sleep at night.', 1800); return; }
    GameAudio.sleep();
    game.time = 10;                 // ξημέρωμα
    game.day++;
    game.stats.days = game.day;
    game.player.hp = Math.min(T.PLAYER_HP, game.player.hp + 25);
    game.mobs = game.mobs.filter(m => m.kind !== 'shade');
    SaveGame.save(game);
    toast('Day ' + game.day + '. You feel rested. (saved)');
  }

  // ---------- raft ----------
  function buildRaftStage() {
    const st = Defs.RAFT_STAGES[game.raftStage];
    if (!st) return;
    if (!Inv.canAfford(game.player.inv, st.cost)) {
      GameAudio.error(); toast('Missing materials', 1500); return;
    }
    Inv.pay(game.player.inv, st.cost);
    game.raftStage++;
    GameAudio.raftBuild();
    Monetize.track('raft_stage', { stage: game.raftStage });
    toast(st.done);
    SaveGame.save(game);
    renderRaftPanel();
  }

  function sailAway() {
    Monetize.track('win', { days: game.day, kills: game.stats.kills });
    $('win-stats').innerHTML =
      `Escaped on day <b>${game.day}</b><br>` +
      `Kills: ${game.stats.kills} · Resources gathered: ${game.stats.gathered} · ` +
      `Items crafted: ${game.stats.crafted}`;
    GameAudio.win();
    SaveGame.clear();
    setState('WIN');
  }

  // ---------- θάνατος ----------
  function die() {
    GameAudio.playerDie();
    const p = game.player;
    // τα αντικείμενα πέφτουν σε σακίδιο στο σημείο θανάτου
    const key = Math.floor(p.x) + ',' + Math.floor(p.y);
    const bag = World.freshProp('bag');
    bag.inv = p.inv.filter(Boolean);
    if (bag.inv.length && !game.world.props.get(key)) {
      game.world.props.set(key, bag);
      World.invalidate(Math.floor(p.x), Math.floor(p.y));
    } else if (bag.inv.length) {
      for (const s of bag.inv) game.dropItem(s.item, s.n, p.x, p.y);
    }
    p.inv = Inv.create();
    Monetize.track('death', { day: game.day });
    setState('DEAD');
  }

  $('revive-btn').addEventListener('click', () => {
    Monetize.showRewarded('revive', () => {
      const p = game.player;
      p.hp = T.RESPAWN_HP;
      p.hunger = Math.max(p.hunger, 40);
      // παίρνει πίσω το σακίδιο αν είναι εδώ
      const key = Math.floor(p.x) + ',' + Math.floor(p.y);
      const bag = game.world.props.get(key);
      if (bag && bag.kind === 'bag') {
        for (const s of bag.inv) Inv.add(p.inv, s.item, s.n);
        game.world.props.delete(key);
        World.invalidate(Math.floor(p.x), Math.floor(p.y));
      }
      setState('PLAY');
      toast('A rescue flare revives you!');
    });
  });
  $('respawn-btn').addEventListener('click', () => {
    const p = game.player;
    p.hp = T.RESPAWN_HP; p.hunger = 70;
    p.x = p.spawn.x; p.y = p.spawn.y;
    setState('PLAY');
    toast('You wake up… your things are where you fell.');
  });

  // ---------- tutorial hints ----------
  function currentHint() {
    const f = game.flags, p = game.player;
    if (!f.gotFiber) return 'Stand on grass and tap ACT to gather fiber';
    if (!f.made_axe) return 'Craft an axe (3 wood, 2 stone, 2 fiber)';
    if (Inv.count(p.inv, 'wood') < 4 && !f.built_campfire) return 'Chop trees for wood';
    if (!f.built_campfire) return 'Build a campfire before night falls';
    if (!f.foundWreck) return 'Search the shipwreck on the beach';
    if (game.raftStage === 0) return 'Start building the raft next to the wreck';
    if (game.raftStage < 4) return 'Raft stage ' + (game.raftStage + 1) + '/4 — gather materials';
    return 'The raft is ready — sail away!';
  }

  // ---------- spawns ----------
  let spawnT = 0, shadeT = 0;
  function updateSpawns(dt) {
    spawnT -= dt;
    if (spawnT <= 0) {
      spawnT = 5;
      game.mobs = game.mobs.filter(m => !m.dead &&
        Math.hypot(m.x - game.player.x, m.y - game.player.y) < 26);
      const alive = game.mobs.filter(m => m.kind !== 'shade').length;
      if (alive < 6) {
        const a = Math.random() * Math.PI * 2;
        const d = 9 + Math.random() * 4;
        const x = game.player.x + Math.cos(a) * d;
        const y = game.player.y + Math.sin(a) * d;
        const t = World.tileAt(game.world, x, y);
        if (t === World.SAND) game.mobs.push(new Entities.Mob('crab', x, y));
        else if (t === World.GRASS || t === World.JUNGLE) {
          game.mobs.push(new Entities.Mob(Math.random() < 0.6 ? 'boar' : 'crab', x, y));
        }
      }
    }
    if (!game.isDay()) {
      shadeT -= dt;
      if (shadeT <= 0) {
        shadeT = T.SHADE_SPAWN_EVERY;
        const shades = game.mobs.filter(m => m.kind === 'shade' && !m.dead).length;
        if (shades < T.SHADE_MAX) {
          const a = Math.random() * Math.PI * 2;
          const d = 6 + Math.random() * 3;
          const x = game.player.x + Math.cos(a) * d;
          const y = game.player.y + Math.sin(a) * d;
          if (World.tileAt(game.world, x, y) > World.WATER &&
              !game.nearLight(x, y)) {
            game.mobs.push(new Entities.Mob('shade', x, y));
            GameAudio.shadeNear();
          }
        }
      }
    }
  }

  // ---------- input ----------
  const keys = {};
  document.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (state !== 'PLAY') return;
    if (e.code === 'KeyE' || e.code === 'Space') { e.preventDefault(); act(); }
    if (e.code === 'KeyI') panel === 'inv' ? closePanel() : openPanel('inv');
    if (e.code === 'KeyC') panel === 'craft' ? closePanel() : openPanel('craft');
    if (e.code === 'KeyT') toggleTorch();
    if (e.code === 'Escape') {
      if (pendingBuild) { pendingBuild = null; toast('Build cancelled', 1000); }
      else panel ? closePanel() : openPanel('pause');
    }
  });
  document.addEventListener('keyup', e => { keys[e.code] = false; });

  function toggleTorch() {
    const p = game.player;
    if (!Inv.firstTool(p.inv, 'light')) { toast('You need a torch', 1200); return; }
    p.torchLit = !p.torchLit;
    GameAudio.uiClick();
  }

  // κουμπιά UI
  $('act-btn').addEventListener('pointerdown', e => { e.preventDefault(); act(); });
  $('inv-btn').addEventListener('click', () => panel === 'inv' ? closePanel() : openPanel('inv'));
  $('craft-btn').addEventListener('click', () => panel === 'craft' ? closePanel() : openPanel('craft'));
  $('torch-btn').addEventListener('click', toggleTorch);
  $('pause-btn').addEventListener('click', () => openPanel('pause'));
  $('start-btn').addEventListener('click', () => { GameAudio.start(); newGame(); });
  $('continue-btn').addEventListener('click', () => { GameAudio.start(); continueGame(); });
  $('resume-btn').addEventListener('click', closePanel);
  $('savequit-btn').addEventListener('click', () => {
    SaveGame.save(game);
    setState('TITLE');
    refreshTitle();
  });
  $('win-new-btn').addEventListener('click', () => { newGame(); });
  for (const id of ['inv-close', 'craft-close', 'chest-close', 'raft-close']) {
    $(id).addEventListener('click', closePanel);
  }

  function refreshTitle() {
    $('continue-btn').classList.toggle('hidden', !SaveGame.exists());
    if (Assets.ui.titlebg) {
      $('title').style.backgroundImage =
        `linear-gradient(rgba(8,12,20,0.25), rgba(8,12,20,0.6)), url(${Assets.ui.titlebg.src})`;
    }
  }

  // ---------- panels: inventory ----------
  function renderInvPanel() {
    const p = game.player;
    const grid = $('inv-grid');
    grid.innerHTML = '';
    p.inv.forEach((s, i) => {
      const d = document.createElement('div');
      d.className = 'slot' + (s ? '' : ' empty');
      if (s) {
        const img = Assets.icons[s.item];
        d.innerHTML = `<img src="${img.toDataURL ? img.toDataURL() : img.src}" alt="">` +
          `<span class="n">${s.n > 1 ? s.n : ''}</span>`;
        d.addEventListener('click', () => invAction(i));
      }
      grid.appendChild(d);
    });
    $('inv-hint').textContent = 'Tap food to eat · tools are used automatically';
  }

  function invAction(i) {
    const p = game.player;
    const s = p.inv[i];
    if (!s) return;
    const def = Defs.ITEMS[s.item];
    if (def.food) {
      s.n--;
      if (s.n <= 0) p.inv[i] = null;
      p.hunger = Math.min(100, p.hunger + def.food.hunger);
      if (def.food.hp) p.hp = Math.min(T.PLAYER_HP, p.hp + def.food.hp);
      if (def.food.poison && Math.random() < def.food.poison) {
        p.hp = Math.max(1, p.hp - 6);
        toast('Ugh… that raw meat was bad. Cook it next time!', 2200);
      } else {
        toast('+' + def.food.hunger + ' food', 900);
      }
      GameAudio.eat();
      renderInvPanel();
    } else {
      toast(def.name + (def.tool ? ' — used automatically' : ''), 1200);
    }
  }

  // ---------- panels: crafting ----------
  function costHTML(cost) {
    return Object.entries(cost).map(([item, n]) => {
      const have = Inv.count(game.player.inv, item);
      const ok = have >= n;
      return `<span class="${ok ? 'ok' : 'no'}">${Defs.ITEMS[item].name} ${have}/${n}</span>`;
    }).join(' · ');
  }

  function renderCraftPanel() {
    const list = $('craft-list');
    list.innerHTML = '';
    const mk = (title) => {
      const h = document.createElement('div');
      h.className = 'craft-head';
      h.textContent = title;
      list.appendChild(h);
    };
    mk('CRAFT');
    for (const rec of Defs.RECIPES) {
      const err = canCraft(rec);
      const row = document.createElement('div');
      row.className = 'craft-row' + (err ? ' disabled' : '');
      const img = Assets.icons[rec.out];
      row.innerHTML =
        `<img src="${img.toDataURL ? img.toDataURL() : img.src}" alt="">` +
        `<div class="ci"><b>${Defs.ITEMS[rec.out].name}</b>` +
        `<small>${rec.hint}</small><small>${costHTML(rec.cost)}</small></div>` +
        `<button>${err && err !== 'Missing materials' ? '✕' : 'MAKE'}</button>`;
      row.querySelector('button').addEventListener('click', () => craft(rec));
      list.appendChild(row);
    }
    mk('BUILD');
    for (const b of Defs.BUILDS) {
      const afford = Inv.canAfford(game.player.inv, b.cost);
      const needWb = b.tier >= 2 && !nearProp('workbench', 3);
      const row = document.createElement('div');
      row.className = 'craft-row' + ((!afford || needWb) ? ' disabled' : '');
      const img = Assets.props[b.id];
      row.innerHTML =
        `<img src="${img.toDataURL ? img.toDataURL() : img.src}" alt="">` +
        `<div class="ci"><b>${b.name}</b>` +
        `<small>${needWb ? 'Needs workbench nearby' : b.hint}</small>` +
        `<small>${costHTML(b.cost)}</small></div>` +
        `<button>PLACE</button>`;
      row.querySelector('button').addEventListener('click', () => startBuild(b));
      list.appendChild(row);
    }
  }

  // ---------- panels: chest ----------
  function renderChestPanel() {
    if (!openChest) return;
    const cg = $('chest-grid'), pg = $('chest-inv-grid');
    cg.innerHTML = ''; pg.innerHTML = '';
    openChest.inv.forEach((s, i) => {
      const d = document.createElement('div');
      d.className = 'slot' + (s ? '' : ' empty');
      if (s) {
        const img = Assets.icons[s.item];
        d.innerHTML = `<img src="${img.toDataURL ? img.toDataURL() : img.src}">` +
          `<span class="n">${s.n > 1 ? s.n : ''}</span>`;
        d.addEventListener('click', () => {
          Inv.add(game.player.inv, s.item, s.n);
          openChest.inv[i] = null;
          renderChestPanel();
          GameAudio.uiClick();
        });
      }
      cg.appendChild(d);
    });
    game.player.inv.forEach((s, i) => {
      const d = document.createElement('div');
      d.className = 'slot' + (s ? '' : ' empty');
      if (s) {
        const img = Assets.icons[s.item];
        d.innerHTML = `<img src="${img.toDataURL ? img.toDataURL() : img.src}">` +
          `<span class="n">${s.n > 1 ? s.n : ''}</span>`;
        d.addEventListener('click', () => {
          const j = openChest.inv.findIndex(x => !x);
          if (j < 0) { toast('Chest is full', 1200); return; }
          openChest.inv[j] = s;
          game.player.inv[i] = null;
          renderChestPanel();
          GameAudio.uiClick();
        });
      }
      pg.appendChild(d);
    });
  }

  // ---------- panels: raft ----------
  function renderRaftPanel() {
    const st = Defs.RAFT_STAGES[game.raftStage];
    $('raft-stage').textContent = game.raftStage >= 4
      ? 'THE RAFT IS COMPLETE'
      : `Stage ${game.raftStage + 1} / 4 — ${st.label}`;
    $('raft-cost').innerHTML = st ? costHTML(st.cost) : '';
    $('raft-build-btn').classList.toggle('hidden', game.raftStage >= 4);
    $('raft-sail-btn').classList.toggle('hidden', game.raftStage < 4);
    $('raft-build-btn').disabled = st && !Inv.canAfford(game.player.inv, st.cost);
  }
  $('raft-build-btn').addEventListener('click', buildRaftStage);
  $('raft-sail-btn').addEventListener('click', sailAway);

  // ---------- update ----------
  let saveT = 0;
  function update(dt) {
    const p = game.player;

    // χρόνος
    const wasDay = game.isDay();
    game.time += dt;
    if (game.time >= T.DAY_LEN + T.NIGHT_LEN) {
      game.time = 0;
      game.day++;
      game.stats.days = game.day;
      GameAudio.dawn();
      toast('Day ' + game.day, 2000);
    }
    if (wasDay && !game.isDay()) {
      GameAudio.nightFall();
      toast('Night falls… stay near the light.', 2600);
    }
    GameAudio.setNight(game.nightAmount());

    // πείνα / hp
    p.hunger = Math.max(0, p.hunger - T.HUNGER_DRAIN * dt);
    if (p.hunger <= 0) p.hp -= T.STARVE_DPS * dt;
    else if (p.hunger > 60 && p.hp < T.PLAYER_HP) p.hp += T.HP_REGEN * dt;
    p.hp = Math.min(T.PLAYER_HP, p.hp);
    if (p.hp <= 0 && state === 'PLAY') { die(); return; }
    p.hurtT = Math.max(0, p.hurtT - dt);
    p.attackCd = Math.max(0, p.attackCd - dt);
    p.swingT = Math.max(0, (p.swingT || 0) - dt);

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
        World.move(game.world, p, mx * 3.2 * dt, my * 3.2 * dt, 0.28);
        p.animT += dt * 7;
        if (Math.abs(mx) > Math.abs(my)) { p.dir = 'east'; p.faceLeft = mx < 0; }
        else p.dir = my > 0 ? 'south' : 'north';
        collectNear();
        // fiber από γρασίδι: πατάς ACT χωρίς στόχο — βλ. act()
      }
    }

    // mobs / fx / regrow
    for (const m of game.mobs) m.update(dt, game);
    for (const f of game.fx) f.t += dt;
    game.fx = game.fx.filter(f => f.t < 0.5);
    for (const [k, pr] of game.world.props) {
      if (pr.kind === 'bush' && pr.looted) {
        pr.regrow -= dt;
        if (pr.regrow <= 0) {
          pr.looted = false;
          const [px, py] = k.split(',').map(Number);
          World.invalidate(px, py);
        }
      }
    }

    updateSpawns(dt);

    // autosave
    saveT += dt;
    if (saveT > 12) { saveT = 0; SaveGame.save(game); }

    // HUD
    $('hp-fill').style.width = Math.max(0, p.hp) + '%';
    $('food-fill').style.width = Math.max(0, p.hunger) + '%';
    $('day-label').textContent = 'DAY ' + game.day + (game.isDay() ? ' ☀' : ' ☾');
    $('hint').textContent = currentHint();
    $('act-icon').textContent = actIconFor(findTarget());
    $('torch-btn').classList.toggle('hidden', !Inv.firstTool(p.inv, 'light'));
    $('torch-btn').classList.toggle('on', p.torchLit);
  }

  // ---------- render ----------
  let tick = 0;
  const lightCv = document.createElement('canvas');
  lightCv.width = VW; lightCv.height = VH;
  const lctx = lightCv.getContext('2d');

  function drawSprite(img, wx, wy, cam, scale = 1) {
    const sx = Math.round(wx * TS - cam.x * TS + VW / 2);
    const sy = Math.round(wy * TS - cam.y * TS + VH / 2);
    ctx.drawImage(img, sx - (img.width * scale) / 2,
      sy - img.height * scale, img.width * scale, img.height * scale);
    return { sx, sy };
  }

  function render(dt) {
    tick += dt;
    const p = game.player;
    const cam = { x: p.x, y: p.y - 0.6 };

    World.render(ctx, game.world, cam, VW, VH);

    // drops
    for (const d of game.drops) {
      d.bob += dt * 3;
      const img = Assets.icons[d.item];
      const sx = Math.round(d.x * TS - cam.x * TS + VW / 2);
      const sy = Math.round(d.y * TS - cam.y * TS + VH / 2 + Math.sin(d.bob) * 2);
      ctx.drawImage(img, sx - 8, sy - 8, 16, 16);
    }

    // depth-sorted: props + mobs + player
    const order = [];
    for (const [k, pr] of game.world.props) {
      const [px, py] = k.split(',').map(Number);
      order.push({ y: py + 1, draw: () => drawProp(pr, px, py, cam) });
    }
    // raft υπό κατασκευή (στο 0: αχνό περίγραμμα-στόχος)
    const rs = game.world.raftSpot;
    order.push({ y: rs.y + 1, draw: () => {
      if (game.raftStage > 0) {
        drawSprite(Assets.props['raft' + Math.min(4, game.raftStage)], rs.x + 0.5, rs.y + 1, cam);
      } else {
        ctx.globalAlpha = 0.35 + Math.sin(tick * 3) * 0.1;
        drawSprite(Assets.props.raft1, rs.x + 0.5, rs.y + 1, cam);
        ctx.globalAlpha = 1;
      }
    } });
    for (const m of game.mobs) {
      if (m.dead) continue;
      order.push({ y: m.y, draw: () => {
        const img = m.sprite();
        const sx = Math.round(m.x * TS - cam.x * TS + VW / 2);
        const sy = Math.round(m.y * TS - cam.y * TS + VH / 2);
        ctx.save();
        if (m.faceLeft) { ctx.translate(sx, 0); ctx.scale(-1, 1); ctx.translate(-sx, 0); }
        ctx.drawImage(img, sx - img.width / 2, sy - img.height + 6);
        if (m.flash > 0) {
          ctx.globalAlpha = 0.5; ctx.globalCompositeOperation = 'source-atop';
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = 1;
        }
        ctx.restore();
      } });
    }
    order.push({ y: p.y, draw: () => {
      const frames = Assets.hero[p.dir] || Assets.hero.south;
      const img = p.moving ? frames[(p.animT | 0) % frames.length] : frames[0];
      const sx = Math.round(p.x * TS - cam.x * TS + VW / 2);
      const sy = Math.round(p.y * TS - cam.y * TS + VH / 2);
      ctx.save();
      if (p.dir === 'east' && p.faceLeft) {
        ctx.translate(sx, 0); ctx.scale(-1, 1); ctx.translate(-sx, 0);
      }
      if (p.hurtT > 0) ctx.globalAlpha = 0.6;
      ctx.drawImage(img, sx - img.width / 2, sy - img.height + 8);
      ctx.restore();
      // swing κύκλος
      if (p.swingT > 0) {
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath();
        const f = facingTile();
        const fx = Math.round((f.x + 0.5) * TS - cam.x * TS + VW / 2);
        const fy = Math.round((f.y + 0.5) * TS - cam.y * TS + VH / 2);
        ctx.arc(fx, fy, 10 * (1 - p.swingT / 0.18) + 4, 0, 7);
        ctx.stroke();
      }
    } });
    order.sort((a, b) => a.y - b.y);
    for (const o of order) o.draw();

    // ghost τοποθέτησης
    if (pendingBuild) {
      const f = facingTile();
      const img = Assets.props[pendingBuild.id];
      ctx.globalAlpha = 0.55;
      drawSprite(img, f.x + 0.5, f.y + 1, cam);
      ctx.globalAlpha = 1;
      const sx = Math.round(f.x * TS - cam.x * TS + VW / 2);
      const sy = Math.round(f.y * TS - cam.y * TS + VH / 2);
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(sx + 1, sy + 1, TS - 2, TS - 2);
    }

    // fx
    for (const f of game.fx) {
      const sx = Math.round(f.x * TS - cam.x * TS + VW / 2);
      const sy = Math.round(f.y * TS - cam.y * TS + VH / 2);
      ctx.globalAlpha = 1 - f.t * 2;
      if (f.kind === 'puff') {
        ctx.fillStyle = '#e8e0cc';
        for (let i = 0; i < 5; i++) {
          const a = i / 5 * Math.PI * 2;
          const r = f.t * 26;
          ctx.beginPath();
          ctx.arc(sx + Math.cos(a) * r, sy - 8 + Math.sin(a) * r, 3, 0, 7);
          ctx.fill();
        }
      } else {
        ctx.fillStyle = '#fff';
        ctx.fillRect(sx - 2 + Math.random() * 4, sy - 10 + Math.random() * 4, 3, 3);
      }
      ctx.globalAlpha = 1;
    }

    // ---- φωτισμός νύχτας ----
    const night = game.nightAmount();
    if (night > 0.01) {
      lctx.clearRect(0, 0, VW, VH);
      lctx.fillStyle = `rgba(8, 10, 34, ${0.78 * night})`;
      lctx.fillRect(0, 0, VW, VH);
      lctx.globalCompositeOperation = 'destination-out';
      const hole = (wx, wy, r) => {
        const sx = wx * TS - cam.x * TS + VW / 2;
        const sy = wy * TS - cam.y * TS + VH / 2;
        const g = lctx.createRadialGradient(sx, sy, r * TS * 0.25, sx, sy, r * TS);
        g.addColorStop(0, 'rgba(0,0,0,0.95)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        lctx.fillStyle = g;
        lctx.beginPath(); lctx.arc(sx, sy, r * TS, 0, 7); lctx.fill();
      };
      hole(p.x, p.y - 0.4, p.torchLit ? 3.5 : 1.3);
      for (const [k, pr] of game.world.props) {
        if (pr.kind !== 'campfire') continue;
        const [px, py] = k.split(',').map(Number);
        hole(px + 0.5, py + 0.5, T.LIGHT_CAMPFIRE + Math.sin(tick * 6) * 0.15);
      }
      lctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(lightCv, 0, 0);
    }

    // κόκκινη λάμψη τραύματος
    if (p.hurtT > 0) {
      ctx.fillStyle = `rgba(200,20,20,${p.hurtT * 0.7})`;
      ctx.fillRect(0, 0, VW, VH);
    }
  }

  function drawProp(pr, px, py, cam) {
    let img;
    if (pr.kind === 'bush') img = pr.looted ?
      (Assets.props.bush_empty || Assets.props.bush) : Assets.props.bush;
    else if (pr.kind === 'campfire') {
      img = ((tick * 5) | 0) % 2 ? Assets.props.campfire2 : Assets.props.campfire;
    } else img = Assets.props[pr.kind];
    if (!img) return;
    drawSprite(img, px + 0.5, py + 1, cam);
  }

  // ---------- loop ----------
  let last = performance.now();
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (state === 'PLAY') {
      if (!panel) update(dt);
      render(dt);
    }
  }
  requestAnimationFrame(loop);

  // αποθήκευση όταν κρύβεται η σελίδα
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state === 'PLAY') SaveGame.save(game);
  });

  // ---------- boot ----------
  Assets.loadOverrides(() => { refreshTitle(); World.invalidateAll(); });
  refreshTitle();
  if (document.fonts && document.fonts.load) {
    document.fonts.load('11px "Press Start 2P"');
    document.fonts.load('10px VT323');
  }

  // debug hook για tests
  window.__debug = {
    game, World, Inv, Defs, Entities, SaveGame, Monetize,
    get state() { return state; },
    get panel() { return panel; },
    setState, newGame, continueGame, act, openPanel, closePanel,
    craft, startBuild, buildRaftStage, sailAway, die, gatherGrass,
    findTarget, toggleTorch, collectNear,
  };
})();
