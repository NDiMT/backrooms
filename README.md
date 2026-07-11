# DEEPER — Idle Descent

An **idle descent roguelite** in retro pixel art, written in pure
JavaScript (Canvas 2D, 288×512 internal portrait resolution).
Mobile-first (portrait, one-handed), fully offline, with automated
Android APK builds. Character sprites are AI pixel art generated with
[PixelLab](https://pixellab.ai); floors and UI are procedural.

## The game

An elevator that only goes down. Descend through **endless procedurally
generated floors** that start mundane — offices, parking, a dead mall —
and slowly go *wrong*, all the way to the Backrooms. Loot scrap, dodge
the shades that hunt in the dark, and decide at every elevator:
**cash out, or go deeper?**

- **Descend**: every floor is a procedural maze of rooms and corridors
  with an entry and an exit elevator. Every 10 floors a new biome —
  OFFICES → PARKING → THE MALL → THE POOLS → THE BACKROOMS.
- **Loot**: scrap piles and crates hold scrap, medkits, flashlight
  batteries, keycards (some exits are locked) and rare **cores**
  (permanent +scrap/+damage).
- **Fight or flee**: shades fear your flashlight and hunt in the dark.
  Every 10th floor a **guardian boss** blocks the elevator — kill it to
  unlock a permanent **checkpoint** (runs start deeper).
- **Risk it**: dying loses most of your run scrap. Cashing out banks it.
  The elevator always asks: *deeper?*
- **Upgrade** (the surface): speed, vitality, damage, flashlight, loot
  bag — and **scavenger drones** that earn scrap while you're away
  (idle/offline earnings).
- **Daily floor**: one attempt per day, same floor for everyone,
  99 seconds — share your emoji-grid result.
- **Persistence**: auto-save to localStorage.

## Controls

| Platform | Controls |
| --- | --- |
| Mobile (portrait) | Drag lower-left = move · big ACT button = context action (attack/loot/elevator/vault) |
| Desktop | WASD move · E/Space = ACT · Esc/P pause |

Open `index.html` directly — no server or build needed.

## Monetization scaffolding (js/monetize.js)

Rewarded-ad hooks are wired into gameplay and run in **stub mode** — a
simulated ad — until a real provider is configured (AdMob via Capacitor,
Poki or CrazyGames for web portals):

- **Revive** — keep your scrap and continue the run.
- **Cash out ×2** — double the banked scrap at the elevator.
- **Vault** — open the sealed bonus room on a floor.
- **Offline ×2** — double the drones' offline earnings.

Analytics events (game_start, run_start, floor_reach, boss_kill, death,
cashout, upgrade, daily_score, ad_rewarded) push to `window.dataLayer`,
ready for GA4. Store listing draft and privacy policy live in `store/`.

## Download the APK

Built automatically by GitHub Actions on every push:
**Releases → [`deeper-latest`](../../releases/tag/deeper-latest) →
`deeper.apk`** (allow "install from unknown sources").

### Local build (Node 18+, JDK 17, Android SDK)
```bash
npm install
npm run build          # www/
npx cap add android    # once
npm run sync
cd android && ./gradlew assembleDebug
```

## Tech

- **Procedural floors**: δωμάτια + Γ-διάδρομοι σε 30×30 grid,
  deterministic από seed· κλειδωμένες έξοδοι με keycard, σφραγισμένα
  vaults που ανοίγουν με rewarded ad.
- **Biome tiles**: procedural 26×26 tiles ανά biome (palette-driven),
  με PNG override hooks για μελλοντικό PixelLab art.
- **Lighting**: μόνιμο σκοτάδι ανά biome με «τρύπες» φωτός
  (radial gradients, destination-out) γύρω από παίκτη/ασανσέρ/vault —
  ο φακός είναι και όπλο: οι shades διστάζουν στο φως.
- **Idle economy**: drones με offline earnings (capped ώρες, ×2 με ad),
  checkpoints ανά 10 ορόφους, exponential upgrade curves στο
  `js/defs.js` — όλα τα tuning numbers σε ένα αρχείο.
- **Daily floor**: seed από την UTC ημερομηνία — ίδιος όροφος για
  όλους, emoji-grid share (Web Share API / clipboard).
- **PixelLab sprites**: ο ήρωας (3-direction walk cycles) και το shade
  προέρχονται από το υπάρχον asset pipeline· procedural canvas
  fallbacks για κάθε γραφικό, το παιχνίδι τρέχει και χωρίς PNG.
- **WebAudio**: synthesized ήχοι + liminal ambience (βουητό κτηρίου,
  τρεμόπαιγμα φθορισμού), χωρίς αρχεία ήχου.

## Layout

```
index.html            Portrait UI: HUD, hub, elevator/pause panels, overlays
js/defs.js            Biomes, upgrades, tuning
js/assets.js          Procedural art + PNG overrides (assets/*.png)
js/world.js           Floor generator, collision, tile renderer
js/entities.js        Shades/boss, pickups, loot props
js/save.js            Meta progression σε localStorage
js/audio.js           WebAudio synth + ambience
js/monetize.js        Rewarded-ad & analytics scaffolding (stub mode)
js/touch.js           Joystick + ACT button
js/main.js            Loop, states, run logic, daily, lighting
scripts/gen-art.cjs   PixelLab asset pipeline (από το προηγούμενο παιχνίδι)
store/                Store listing draft + privacy policy
CONCEPT-ONE-MILLION.md Στρατηγική & γιατί υπάρχει αυτό το παιχνίδι
```
