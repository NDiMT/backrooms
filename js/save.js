/* DEEPER — Save/load σε localStorage. Δεν σώζουμε τον όροφο (τα runs
   είναι σύντομα)· σώζουμε το meta: τράπεζα, upgrades, πρόοδο, daily,
   και lastSeen για τα offline κέρδη των drones. */

const SaveGame = (() => {
  const KEY = 'deeper_save_v1';

  function fresh() {
    return {
      v: 1,
      bank: 0,               // scrap στην τράπεζα
      cores: 0,              // μόνιμα cores (δεν ξοδεύονται)
      up: {},                // upgrade id -> level
      deepest: 0,            // βαθύτερος όροφος που έχει καθαριστεί
      checkpoint: 1,         // όροφος εκκίνησης (11, 21, … μετά από boss)
      stats: { runs: 0, kills: 0, bosses: 0, floors: 0, scrapTotal: 0 },
      daily: { date: '', score: -1 },
      lastSeen: 0,
    };
  }

  let data = null;

  function load() {
    if (data) return data;
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      if (d && d.v === 1) { data = Object.assign(fresh(), d); return data; }
    } catch (e) { /* κατεστραμμένο */ }
    data = fresh();
    return data;
  }

  function save() {
    if (!data) return false;
    data.lastSeen = Date.now();
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) { return false; }
  }

  function clear() {
    data = fresh();
    try { localStorage.removeItem(KEY); } catch (e) { /* ok */ }
  }

  function isNew() {
    try { return !localStorage.getItem(KEY); } catch (e) { return true; }
  }

  return { load, save, clear, isNew };
})();
