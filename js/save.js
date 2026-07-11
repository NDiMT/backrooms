/* DRIFTLAND — Save/load σε localStorage. Ο κόσμος αναπαράγεται από το
   seed· σώζουμε μόνο diffs (props που άλλαξαν/μπήκαν), παίκτη και χρόνο. */

const SaveGame = (() => {
  const KEY = 'dl_save_v1';

  function serialize(game) {
    const props = [];
    // Σώζουμε ΟΛΟ το props map ως λίστα — απλό και ασφαλές (λίγα KB).
    for (const [k, p] of game.world.props) {
      props.push([k, p.kind, Math.round(p.hp * 10) / 10, p.looted ? 1 : 0,
        Math.round(p.regrow || 0), p.inv || null, p.lit ? 1 : 0]);
    }
    return {
      v: 1,
      seed: game.world.seed,
      raftStage: game.raftStage,
      time: game.time,
      day: game.day,
      props,
      player: {
        x: game.player.x, y: game.player.y,
        hp: game.player.hp, hunger: game.player.hunger,
        inv: game.player.inv, hotbar: game.player.hotbar,
        spawn: game.player.spawn,
      },
      stats: game.stats,
      flags: game.flags,
    };
  }

  function save(game) {
    try {
      localStorage.setItem(KEY, JSON.stringify(serialize(game)));
      return true;
    } catch (e) { return false; }
  }

  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      if (d && d.v === 1 && typeof d.seed === 'number') return d;
    } catch (e) { /* κατεστραμμένο */ }
    return null;
  }

  function apply(game, d) {
    game.world = World.generate(d.seed);
    game.world.props.clear();
    for (const [k, kind, hp, looted, regrow, inv, lit] of d.props) {
      const p = World.freshProp(kind);
      p.hp = hp; p.looted = !!looted; p.regrow = regrow || 0;
      if (inv) p.inv = inv;
      if (lit) p.lit = true;
      game.world.props.set(k, p);
    }
    game.raftStage = d.raftStage;
    game.time = d.time;
    game.day = d.day;
    Object.assign(game.player, d.player);
    game.stats = d.stats || game.stats;
    game.flags = d.flags || game.flags;
    World.invalidateAll();
  }

  function clear() {
    try { localStorage.removeItem(KEY); } catch (e) { /* ok */ }
  }

  function exists() { return !!load(); }

  return { save, load, apply, clear, exists };
})();
