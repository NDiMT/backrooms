# Η ιδέα του ενός εκατομμυρίου 🎯

Concept document για το επόμενο βήμα του repo: από «φτιάχνουμε ωραία
παιχνίδια με AI» σε «φτιάχνουμε κάτι που έχει ρεαλιστικό δρόμο προς
€1M / 1M downloads».

## Executive summary

- Το πραγματικό asset αυτού του repo **δεν είναι κανένα από τα δύο
  παιχνίδια** — είναι το **εργοστάσιο**: pure-JS Canvas engine,
  PixelLab art pipeline με consistency recipes, Capacitor APK builds,
  rewarded-ad + analytics scaffolding. Ένα ολόκληρο παιχνίδι βγαίνει σε
  μέρες, όχι μήνες.
- Κανένα μεμονωμένο indie game δεν είναι «ιδέα του εκατομμυρίου» —
  αλλά ένα **χαρτοφυλάκιο** από 8–12 μικρά παιχνίδια που δοκιμάζονται
  φθηνά σε web portals (Poki, CrazyGames) και το καλύτερο κλιμακώνεται
  σε APK + ads, είναι. Αυτό ακριβώς κάνουν τα hybrid-casual studios·
  εδώ το κόστος ανά prototype είναι σχεδόν μηδέν.
- Προτεινόμενο flagship για πρώτη βολή: **DEEPER** — idle descent
  roguelite μέσα σε άπειρα liminal levels. Παντρεύει το DNA του repo
  (backrooms) με το genre με το καλύτερο retention-προς-κόπο (idle /
  incremental) και το καλύτερο fit με rewarded ads.

## Τα μαθηματικά του €1M (για να μην κοροϊδευόμαστε)

Με rewarded ads (eCPM ~€10–20) το €1M/χρόνο θέλει ~50–100k DAU — δεν
συμβαίνει με ένα shot στην τύχη. Οι ρεαλιστικοί δρόμοι:

| Δρόμος | Πώς πληρώνει | Τι χρειάζεται |
| --- | --- | --- |
| Web portals (Poki/CrazyGames) | Revenue share, χωρίς UA κόστος — το portal φέρνει τους παίκτες | Παιχνίδι που κρατάει session >7' και D1 retention >30% |
| Rewarded ads σε APK | eCPM €10–20 | Idle/roguelite loop όπου το ad είναι *δώρο*, όχι διακοπή |
| Viral daily mechanic | Μηδενικό CAC — Wordle-style share loop | Ένα αποτέλεσμα ημέρας που μοιράζεται σαν emoji grid |
| Πώληση/licensing του pipeline | B2B: templates, art pipeline as a service | Απόδειξη ότι δουλεύει (τα ίδια τα παιχνίδια) |

Η στρατηγική: **portal-first validation** (μηδενικό marketing κόστος),
metrics από το πρώτο λεπτό (το GA4 scaffolding υπάρχει ήδη), και
double-down μόνο σε ό,τι δείξει retention.

## Flagship: DEEPER — «κάθε όροφος πιο βαθιά, κάθε όροφος πιο λάθος»

### Elevator pitch

Idle descent roguelite. Κατεβαίνεις έναν ατέλειωτο πύργο από
procedurally generated ορόφους που ξεκινούν φυσιολογικοί (parking,
γραφεία, mall) και γίνονται σταδιακά όλο και πιο liminal — μέχρι
καθαρά backrooms. Στο active play σκάβεις/εξερευνάς/πολεμάς shades
(mini survivors-like)· στο idle οι «σκαπανείς» σου συνεχίζουν να
μαζεύουν resources χωρίς εσένα. Meta-progression: μόνιμα upgrades,
νέοι χαρακτήρες, βαθύτερα checkpoints.

### Γιατί αυτό

- **Genre economics**: idle/incremental = το υψηλότερο D30 retention
  στο mobile και το πιο φυσικό rewarded-ad placement (2× offline
  earnings, revive, skip floor). Ο παίκτης *ζητάει* να δει διαφήμιση.
- **DNA του repo**: επιστρέφει στο backrooms/liminal concept (ο λόγος
  που λέγεται `backrooms`) με τα mobs, τα φώτα και το art pipeline
  του DRIFTLAND σχεδόν copy-paste — shades, torch lighting,
  day/night gradients γίνονται floor lighting ως έχουν.
- **Portrait, one-handed, offline**: ήδη ο σχεδιασμός του engine.
- **Άπειρο content δωρεάν**: procedural floors + PixelLab biomes ανά
  ζώνη βάθους = το AI pipeline παράγει «ορόφους» επ' αόριστον.

### Core loop

1. **Descend** (active, 2–5'): διάλεξε πόρτα → όροφος-αρένα →
   μάζεψε loot, απόφυγε/πολέμησε shades, βρες το ασανσέρ.
2. **Upgrade** (idle): resources → μόνιμα stats, auto-miners που
   δουλεύουν offline, νέα gear.
3. **Push deeper**: κάθε 10 όροφοι νέο biome + μίνι boss + checkpoint.
4. **Daily floor**: ίδιος seed για όλους, μία προσπάθεια, share
   αποτέλεσμα ως emoji grid (🚪⬛🟨…) — το viral hook.

### Rewarded ads (όλα ήδη wired στο monetize.js)

- Revive on death (υπάρχει ήδη ως hook).
- 2× offline earnings κατά την επιστροφή.
- «Κλειδωμένη πόρτα»: προαιρετικό bonus room με ad.
- Skip 5 floors (late game convenience).

### MVP scope (2–3 εβδομάδες με το υπάρχον stack)

- 30 floors, 3 biomes (office → mall → backrooms), 3 mobs (reuse
  shades + 2 νέα), 10 upgrades, offline earnings, daily floor + share.
- Launch: Poki/CrazyGames submission + APK στο GitHub Releases.
- KPIs για go/no-go σε 4 εβδομάδες: D1 > 30%, avg session > 7',
  ads/DAU > 1.5. Κάτω από αυτά → επόμενο concept, όχι επιμονή.

## Runner-ups (τα επόμενα shots του χαρτοφυλακίου)

### 2. LEVEL ∞ — survivors-like στα backrooms

Vampire-Survivors clone (auto-attack, hordes, level-up choices) σε
liminal αρένες. Το πιο δοκιμασμένο genre στα web portals αυτή τη
στιγμή· τα assets του DEAD ZONE (όπλα, enemies) επαναχρησιμοποιούνται.
Ρίσκο: κορεσμένο genre — θέλει twist (π.χ. το φως ως όπλο/πόρος).

### 3. ΤΟ ΔΩΜΑΤΙΟ — daily liminal puzzle (το viral bet)

Wordle-format: κάθε μέρα μία AI-generated εικόνα liminal χώρου,
μαντεύεις σε ποιο «Level» των backrooms ανήκει / τι είναι λάθος στην
εικόνα, σε 6 προσπάθειες. Share ως emoji grid. Σχεδόν μηδενικό
development (το PixelLab pipeline παράγει τις εικόνες batch), καθαρά
viral upside, web-only. Χαμηλότερο revenue ceiling αλλά και κόστος ~0.

### 4. DRIFTLAND: Idle Isles — το sequel που πληρώνει

Το DRIFTLAND έχει ήδη πλήρες art set. Μετατροπή σε idle colony sim:
οι επιζώντες δουλεύουν μόνοι τους, εσύ βελτιστοποιείς. Το survival
gameplay γίνεται management — genre με πολύ καλύτερο monetization
από το premium survival. Το φθηνότερο σε κόπο από όλα (reuse ~80%).

## Ρίσκα & παραδοχές

- **Παραδοχή**: τα portals δέχονται το παιχνίδι (έχουν curation).
  Mitigation: τα quality bars τους είναι δημοσιευμένα· το polish του
  DRIFTLAND δείχνει ότι το pipeline τα πιάνει.
- **Ρίσκο**: rewarded eCPM στην Ελλάδα είναι χαμηλό — ο σχεδιασμός
  στοχεύει global (EN πρώτα), όχι ελληνική αγορά.
- **Ρίσκο**: idle games θέλουν προσεκτικό balancing (curves). Το
  tuning ζει ήδη σε ένα αρχείο (`defs.js` pattern) — iterate γρήγορα.
- **GDPR/privacy**: ads + analytics σε ΕΕ θέλουν consent flow πριν το
  πρώτο event· υπάρχει ήδη privacy policy scaffold στο `store/`.

## Roadmap

1. **Εβδ. 1–3**: DEEPER MVP → Poki/CrazyGames submission + APK.
2. **Εβδ. 4**: metrics review → go/no-go.
3. **Παράλληλα** (χαμηλό κόστος): ΤΟ ΔΩΜΑΤΙΟ live ως web toy — καθαρό
   viral πείραμα.
4. **Μήνας 2+**: double-down στο winner ή επόμενο concept. Στόχος:
   ένα νέο shot κάθε 3–4 εβδομάδες μέχρι κάτι να «πιάσει» D1 > 35%.

---

*Το εκατομμύριο δεν είναι ένα παιχνίδι — είναι η ταχυβολία. Το
εργοστάσιο υπάρχει ήδη· αυτό το doc απλώς του δίνει σκοπευτικό.*
