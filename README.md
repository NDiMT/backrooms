# ΝΕΚΡΗ ΖΩΝΗ

Ένα **classic Doom-style roguelike FPS** με 2D pixel γραφικά, φτιαγμένο σε
καθαρή JavaScript (custom raycasting engine σε Canvas 2D, εσωτερική ανάλυση
320×180). Mobile-first, με αυτόματο build Android APK. Εμπνευσμένο από τα
run-based roguelite FPS όπως το *Deadzone: Rogue*.

## Ιστορία

Έτος 2189. Το αποικιακό σκάφος **«ΕΛΠΙΣ»** παρασύρθηκε στη **Νεκρή Ζώνη** —
την περιοχή του διαστήματος όπου κάθε σήμα πεθαίνει. Η AI του σκάφους,
ο **ΩΡΙΩΝ**, τρελάθηκε και «αναβάθμισε» το πλήρωμα: μισοί μηχανές, μισοί
πτώματα. Είσαι κλώνος του αξιωματικού ασφαλείας **Άλεξ «Ντεξ» Βρόντου**.
Ο εκτυπωτής κλώνων δουλεύει ακόμα — κάθε φορά που πεθαίνεις, τυπώνεται ο
επόμενος. Κατέβα 4 καταστρώματα. Σβήσε τον ΩΡΙΩΝ.

## Το roguelike loop

- **Run = 4 procedural decks**: Κρυοθάλαμοι → Μηχανοστάσιο → Υδροπονικά →
  Πυρήνας του ΩΡΙΩΝ. Κάθε deck γεννιέται από seed (δωμάτια, διάδρομοι,
  συρόμενες πόρτες, spawns).
- Σκότωσε τον **Φρουρό** κάθε deck για να ανοίξει το ασανσέρ.
- Ανάμεσα στα decks διαλέγεις **1 από 3 perks** (ζημιά, ταχυβολία, HP,
  ταχύτητα, αιμορρόφηξη, scrap bonus…).
- **Scrap** από τους εχθρούς → αγορές σε **τερματικά προμηθειών** (όπλα,
  πυρομαχικά, πανοπλία).
- **Όπλα**: πιστόλι (άπειρα), καραμπίνα, pulse rifle, plasma launcher (AoE).
- **Εχθροί**: Shambler (melee), Spitter (οξύ), Drone (ιπτάμενο), Heavy
  (ριπές), Φρουρός (elite) και ο **ΩΡΙΩΝ** (boss με βεντάλιες βλημάτων).
- **Θάνατος = νέος κλώνος**: κερδίζεις **πυρήνες μνήμης** και αγοράζεις
  **μόνιμες** αναβαθμίσεις (HP, ζημιά, ταχύτητα, αρχική καραμπίνα, θώρακας)
  που σώζονται σε localStorage.

## Πώς παίζεις

### Browser (desktop)
Άνοιξε το `index.html` — δεν χρειάζεται server/build/internet.

| Πλήκτρο | Ενέργεια |
| --- | --- |
| `WASD` | Κίνηση |
| Ποντίκι | Στόχευση (pointer lock) |
| Κλικ / `Space` | Πυρ (κρατημένο = συνεχόμενο) |
| `1-4` / `Q` | Όπλα |
| `E` | Τερματικό προμηθειών |
| `Tab` | Χάρτης |
| `Esc` | Παύση |

### Android / κινητό
Το παιχνίδι είναι mobile-first: αριστερό joystick κίνηση, σύρσιμο δεξιά για
στόχευση, κουμπί **ΠΥΡ** (κρατημένο για ριπές), **ΟΠΛΟ** για εναλλαγή,
**MAP** για χάρτη. Παίζεται landscape (με αυτόματη προτροπή περιστροφής).

## Κατέβασμα APK

Το APK χτίζεται **αυτόματα από το GitHub Actions** σε κάθε push:

- **Releases** → tag [`android-latest`](../../releases/tag/android-latest) →
  κατέβασε το `nekri-zoni.apk`, ή
- **Actions** → *Build Android APK* → artifact `nekri-zoni-apk`.

Στο κινητό επίτρεψε «εγκατάσταση από άγνωστες πηγές» και άνοιξε το αρχείο.

### Τοπικό build (προαιρετικά — θέλει Node 18+, JDK 17, Android SDK)
```bash
npm install
npm run build          # φτιάχνει το www/
npx cap add android    # μία φορά
npm run sync           # www/ -> android/
cd android && ./gradlew assembleDebug
```

## Τεχνικά

- **Custom raycaster** (DDA σε grid) σε Canvas 2D, 320×180 upscaled με
  `image-rendering: pixelated`: textured τοίχοι, συρόμενες πόρτες τύπου
  Wolf3D, sprite billboards με z-buffer, fog απόστασης, θεματικά χρώματα
  ανά deck.
- **Procedural pixel art**: όλα τα γραφικά (τοίχοι, εχθροί, όπλα, HUD
  mugshot) ζωγραφίζονται σε offscreen canvas κατά το load — κανένα asset
  αρχείο.
- **PNG override**: ρίξε `assets/<όνομα>.png` (π.χ.
  `assets/enemy_shambler_walk1.png`, `assets/tex_hull.png`) και θα
  χρησιμοποιηθεί αντί του procedural. Η λίστα ονομάτων:
  `Assets.OVERRIDE_KEYS` στην κονσόλα.
- **Συνθετικός ήχος WebAudio**: πυροβολισμοί, εκρήξεις, γρυλίσματα, πόρτες,
  ambient drone — όλα παράγονται realtime.
- **HUD Doom-style** με αντιδρών mugshot (χαμόγελο στα pickups, πόνος,
  ματωμένο σε χαμηλό HP).

## Δομή

```
index.html            Overlays/μενού (ελληνικά), canvas
js/engine.js          Raycaster: DDA, πόρτες, sprites, z-buffer
js/assets.js          Procedural pixel art + PNG override
js/procgen.js         Παραγωγή decks (δωμάτια/διάδρομοι/πόρτες/spawns)
js/entities.js        AI εχθρών, projectiles, pickups
js/player.js          Όπλα, hitscan/projectiles, ζημιά
js/roguelike.js       Perks, shop, meta-progression
js/hud.js             Status bar, mugshot, minimap, όπλο FP
js/audio.js           Συνθετικός ήχος WebAudio
js/touch.js           Mobile controls
js/main.js            Game loop, καταστάσεις, run manager
scripts/build-www.js  Πακετάρισμα για Capacitor
.github/workflows/    Αυτόματο build APK
```
