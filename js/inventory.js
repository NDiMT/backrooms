/* DRIFTLAND — Inventory model: 20 θέσεις + hotbar 4 (δείκτες σε θέσεις). */

const Inv = (() => {
  const SLOTS = 20;

  function create() {
    return Array(SLOTS).fill(null);   // slot: {item, n} | null
  }

  function count(inv, item) {
    let n = 0;
    for (const s of inv) if (s && s.item === item) n += s.n;
    return n;
  }

  function canAfford(inv, cost) {
    return Object.entries(cost).every(([item, n]) => count(inv, item) >= n);
  }

  function pay(inv, cost) {
    if (!canAfford(inv, cost)) return false;
    for (const [item, need] of Object.entries(cost)) {
      let left = need;
      for (let i = 0; i < inv.length && left > 0; i++) {
        const s = inv[i];
        if (!s || s.item !== item) continue;
        const take = Math.min(s.n, left);
        s.n -= take; left -= take;
        if (s.n <= 0) inv[i] = null;
      }
    }
    return true;
  }

  /* Προσθήκη· επιστρέφει πόσα ΔΕΝ χώρεσαν. */
  function add(inv, item, n) {
    const max = Defs.ITEMS[item].stack;
    for (let i = 0; i < inv.length && n > 0; i++) {
      const s = inv[i];
      if (s && s.item === item && s.n < max) {
        const put = Math.min(max - s.n, n);
        s.n += put; n -= put;
      }
    }
    for (let i = 0; i < inv.length && n > 0; i++) {
      if (!inv[i]) {
        const put = Math.min(max, n);
        inv[i] = { item, n: put };
        n -= put;
      }
    }
    return n;
  }

  function firstTool(inv, toolKind) {
    for (const s of inv) {
      if (s && Defs.ITEMS[s.item].tool === toolKind) return s.item;
    }
    return null;
  }

  return { SLOTS, create, count, canAfford, pay, add, firstTool };
})();
