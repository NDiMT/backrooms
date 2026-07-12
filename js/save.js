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
      daily: { date: '', score: -1, num: 0 },
      lastSeen: 0,
    };
  }

  let data = null;

  /* Επιλεκτικό, τύπο-ασφαλές merge: ένα μισογραμμένο/πειραγμένο save δεν
     πρέπει ποτέ να ρίχνει NaN ή null μέσα στην πρόοδο. */
  function load() {
    if (data) return data;
    data = fresh();
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      if (d && d.v === 1) {
        const num = (v, f) => (typeof v === 'number' && isFinite(v) ? v : f);
        data.bank = num(d.bank, 0);
        data.cores = num(d.cores, 0);
        data.deepest = num(d.deepest, 0);
        data.checkpoint = Math.max(1, num(d.checkpoint, 1));
        data.lastSeen = num(d.lastSeen, 0);
        if (d.up && typeof d.up === 'object') {
          for (const [k, v] of Object.entries(d.up)) data.up[k] = num(v, 0);
        }
        if (d.stats && typeof d.stats === 'object') {
          for (const k of Object.keys(data.stats)) {
            data.stats[k] = num(d.stats[k], data.stats[k]);
          }
        }
        if (d.daily && typeof d.daily === 'object') {
          if (typeof d.daily.date === 'string') data.daily.date = d.daily.date;
          data.daily.score = num(d.daily.score, -1);
          data.daily.num = num(d.daily.num, 0);
        }
      }
    } catch (e) { /* κατεστραμμένο — fresh */ }
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
