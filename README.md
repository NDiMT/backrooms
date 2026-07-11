# DRIFTLAND — Island Survival

A **castaway survival-crafting game** in retro pixel art, written in pure
JavaScript (Canvas 2D, 288×512 internal portrait resolution). Mobile-first
(portrait, one-handed), fully offline, with automated Android APK builds.
All sprites, tiles and animations are AI pixel art generated with
[PixelLab](https://pixellab.ai).

## The game

You are the only survivor of a shipwreck. Explore a **procedurally
generated island**, gather resources, craft tools, build a camp and
survive the nights — hungry shades roam in the dark. Salvage the old
wreck and build your **escape raft in four stages** to win.

- **Gather**: chop trees (wood), mine rocks (stone/metal), pick berries
  and fiber, loot driftwood and the shipwreck.
- **Craft**: axe, pickaxe, spear, torch, rope, cloth, cooked meals.
- **Build**: campfire (light + cooking), workbench (tier-2 recipes),
  palisade walls, storage chest, bed (respawn point + sleep through night).
- **Survive**: hunger, day/night cycle, boars that fight back, night
  shades that fear the light.
- **Escape**: four raft stages of increasing cost → sail away → win.
- **Persistence**: auto-save to localStorage; continue any time; death
  drops your backpack where you fell — go get it back.

## Controls

| Platform | Controls |
| --- | --- |
| Mobile (portrait) | Drag lower-left = move · big ACT button = context action (chop/mine/attack/pick up/interact) · INV / CRAFT / TORCH buttons |
| Desktop | WASD move · E/Space = ACT · I inventory · C crafting · T torch · Esc pause |

Open `index.html` directly — no server or build needed.

## Monetization scaffolding (js/monetize.js)

Rewarded-ad hooks are wired into gameplay (revive-on-death) and run in
**stub mode** — a simulated ad — until a real provider is configured:
AdMob (Capacitor), Poki or CrazyGames (web portals). Analytics events
(game_start, craft, build, raft_stage, death, win, ad_rewarded) push to
`window.dataLayer`, ready for GA4. Store listing draft and privacy policy
live in `store/`.

## Download the APK

Built automatically by GitHub Actions on every push:
**Releases → [`android-latest`](../../releases/tag/android-latest) →
`driftland.apk`** (allow "install from unknown sources").

### Local build (Node 18+, JDK 17, Android SDK)
```bash
npm install
npm run build          # www/
npx cap add android    # once
npm run sync
cd android && ./gradlew assembleDebug
```

## Tech

- **Chunked tilemap renderer**: το νησί (128×128 tiles) γίνεται render σε
  16×16 chunks με cache — σταθερά 60fps σε κινητά.
- **Procedural island**: value noise + radial falloff → βιότοποι
  (θάλασσα, παραλία, λιβάδι, ζούγκλα, βράχια), deterministic από seed.
- **Day/night lighting**: σκοτάδι με «τρύπες» φωτός (radial gradients,
  destination-out) γύρω από παίκτη/δάδα/φωτιές.
- **PixelLab art pipeline** (`scripts/gen-art.cjs`): tiles, props, hero
  με 3-direction walk cycles (μέσω `/rotate` + `animate-with-text` με
  τη συνταγή συνέπειας: image_guidance_scale 3.0, ρητό direction,
  color_image palette lock, inpainting anchor), mobs, item icons, title
  screen. Procedural canvas fallbacks για κάθε γραφικό.
- **WebAudio**: synthesized ήχοι + ambience ημέρας/νύχτας, χωρίς αρχεία.

## Layout

```
index.html            Portrait UI: HUD, panels (inventory/craft/chest/raft)
js/defs.js            Items, recipes, buildables, raft stages, tuning
js/assets.js          Procedural art + PNG overrides (assets/*.png)
js/world.js           Island procgen + chunked tile rendering
js/inventory.js       Slot inventory (20 θέσεις, stacks)
js/entities.js        Mobs (crab/boar/shade), drops, resource hits
js/save.js            localStorage save/load
js/audio.js           WebAudio synth + ambience
js/monetize.js        Rewarded ads / analytics scaffolding (stub mode)
js/touch.js           Portrait joystick
js/main.js            Loop, day/night, spawns, UI, raft, death/win
scripts/gen-art.cjs   PixelLab asset pipeline
store/                Play Store listing draft + privacy policy
.github/workflows/    Automated APK builds (portrait)
```
