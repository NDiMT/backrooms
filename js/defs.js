/* DRIFTLAND — Ορισμοί: αντικείμενα, συνταγές, buildables, tuning. */

const Defs = (() => {

  // ---------- items ----------
  const ITEMS = {
    wood:        { name: 'Wood', stack: 99 },
    stone:       { name: 'Stone', stack: 99 },
    fiber:       { name: 'Fiber', stack: 99 },
    berry:       { name: 'Berries', stack: 99, food: { hunger: 8 } },
    meat_raw:    { name: 'Raw Meat', stack: 99, food: { hunger: 12, poison: 0.2 } },
    meat_cooked: { name: 'Cooked Meat', stack: 99, food: { hunger: 35, hp: 5 } },
    metal:       { name: 'Scrap Metal', stack: 99 },
    resin:       { name: 'Resin', stack: 99 },
    rope:        { name: 'Rope', stack: 99 },
    cloth:       { name: 'Cloth', stack: 99 },
    axe:         { name: 'Axe', stack: 1, tool: 'axe', power: 3 },
    pickaxe:     { name: 'Pickaxe', stack: 1, tool: 'pickaxe', power: 3 },
    spear:       { name: 'Spear', stack: 1, tool: 'weapon', power: 8 },
    torch:       { name: 'Torch', stack: 1, tool: 'light', light: 3.5 },
  };

  // ---------- συνταγές (craft από inventory) ----------
  // tier 2 απαιτεί κοντινό workbench
  const RECIPES = [
    { id: 'axe', out: 'axe', n: 1, tier: 1,
      cost: { wood: 3, stone: 2, fiber: 2 },
      hint: 'Chops trees much faster' },
    { id: 'pickaxe', out: 'pickaxe', n: 1, tier: 1,
      cost: { wood: 3, stone: 3, fiber: 2 },
      hint: 'Mines rock much faster' },
    { id: 'spear', out: 'spear', n: 1, tier: 1,
      cost: { wood: 2, stone: 1, fiber: 2 },
      hint: 'A real weapon' },
    { id: 'rope', out: 'rope', n: 1, tier: 1,
      cost: { fiber: 3 },
      hint: 'Twisted plant fiber' },
    { id: 'torch', out: 'torch', n: 1, tier: 1,
      cost: { wood: 1, fiber: 1, resin: 1 },
      hint: 'Light in the night, scares shades' },
    { id: 'cloth', out: 'cloth', n: 1, tier: 2,
      cost: { fiber: 4 },
      hint: 'Woven at the workbench' },
    { id: 'meat_cooked', out: 'meat_cooked', n: 1, tier: 1, fire: true,
      cost: { meat_raw: 1 },
      hint: 'Cook near a campfire' },
  ];

  // ---------- buildables (τοποθετούνται στον κόσμο) ----------
  const BUILDS = [
    { id: 'campfire', name: 'Campfire', tier: 1,
      cost: { wood: 4, stone: 4 },
      hint: 'Light, cooking, keeps shades away' },
    { id: 'workbench', name: 'Workbench', tier: 1,
      cost: { wood: 6, stone: 2, rope: 2 },
      hint: 'Unlocks advanced crafting' },
    { id: 'wall', name: 'Palisade Wall', tier: 2,
      cost: { wood: 3, rope: 1 },
      hint: 'Blocks monsters' },
    { id: 'chest', name: 'Chest', tier: 2,
      cost: { wood: 5, rope: 1 },
      hint: 'Stores 12 stacks' },
    { id: 'bed', name: 'Leaf Bed', tier: 2,
      cost: { wood: 4, cloth: 3 },
      hint: 'Sleep through the night, sets respawn' },
  ];

  // ---------- σκάφος απόδρασης (στο ναυάγιο) ----------
  const RAFT_STAGES = [
    { cost: { wood: 8, rope: 4 },
      label: 'Lash the log base', done: 'A sturdy log base floats!' },
    { cost: { wood: 12, resin: 4 },
      label: 'Build & seal the deck', done: 'The deck is sealed watertight.' },
    { cost: { wood: 6, rope: 6 },
      label: 'Raise the mast', done: 'The mast stands tall.' },
    { cost: { cloth: 6, metal: 2 },
      label: 'Sail & rudder', done: 'The raft is ready to sail!' },
  ];

  // ---------- tuning ----------
  const T = {
    DAY_LEN: 240,          // δευτερόλεπτα ημέρας
    NIGHT_LEN: 120,        // δευτερόλεπτα νύχτας
    HUNGER_DRAIN: 100 / 480, // πλήρης εξάντληση σε 8 λεπτά
    STARVE_DPS: 2,
    HP_REGEN: 1.2,         // όταν χορτάτος > 60
    HAND_POWER: 1,
    PLAYER_HP: 100,
    PLAYER_ATK_CD: 0.45,
    SHADE_SPAWN_EVERY: 18,
    SHADE_MAX: 4,
    LIGHT_CAMPFIRE: 4.5,
    RESPAWN_HP: 60,
  };

  return { ITEMS, RECIPES, BUILDS, RAFT_STAGES, T };
})();
