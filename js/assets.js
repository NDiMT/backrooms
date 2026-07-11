/* ΝΕΚΡΗ ΖΩΝΗ — Procedural pixel art.
   Όλα τα γραφικά ζωγραφίζονται εδώ σε offscreen canvases κατά το load.
   PNG OVERRIDE: αν υπάρχει αρχείο assets/<όνομα>.png (π.χ. assets/shambler_walk1.png),
   φορτώνεται αυτόματα στη θέση του procedural — δες Assets.OVERRIDE_KEYS. */

const Assets = (() => {

  // ---------- βοηθητικά ----------
  function cnv(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  /* Ζωγραφίζει char-grid pixel map. rows: array of strings, pal: {χαρακτήρας: χρώμα}
     Ανώμαλα μήκη γραμμών αντιμετωπίζονται ως διαφάνεια. */
  function px(rows, pal, scale) {
    const h = rows.length;
    const w = Math.max(...rows.map(r => r.length));
    const c = cnv(w * scale, h * scale);
    const ctx = c.getContext('2d');
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const ch = rows[y][x] || '.';
        if (ch === '.' || ch === ' ') continue;
        ctx.fillStyle = pal[ch] || '#f0f';
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
    return c;
  }

  function tint(src, color, alpha) {
    const c = cnv(src.width, src.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(src, 0, 0);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, c.width, c.height);
    return c;
  }

  function scaled(src, sx, sy) {
    const c = cnv(Math.max(1, Math.round(src.width * sx)),
                  Math.max(1, Math.round(src.height * sy)));
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 0, 0, c.width, c.height);
    return c;
  }

  /* Frames θανάτου: σταδιακή κατάρρευση προς το δάπεδο + λίμνη αίματος. */
  function deathFrames(src, blood) {
    const frames = [];
    const squash = [0.75, 0.45, 0.22];
    for (let i = 0; i < 3; i++) {
      const c = cnv(src.width, src.height);
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      const h = src.height * squash[i];
      ctx.globalAlpha = 1 - i * 0.15;
      ctx.drawImage(src, 0, src.height - h, src.width, h);
      ctx.globalAlpha = 1;
      ctx.fillStyle = blood;
      const pw = src.width * (0.4 + i * 0.25);
      ctx.beginPath();
      ctx.ellipse(src.width / 2, src.height - 4, pw / 2, 5 + i * 2, 0, 0, Math.PI * 2);
      ctx.fill();
      frames.push(c);
    }
    return frames;
  }

  function painFrame(src) { return tint(src, '#ffffff', 0.55); }

  // ---------- noise/λεπτομέρεια για textures ----------
  function speckle(ctx, w, h, n, color, a) {
    ctx.globalAlpha = a;
    ctx.fillStyle = color;
    for (let i = 0; i < n; i++) {
      ctx.fillRect((Math.random() * w) | 0, (Math.random() * h) | 0, 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  // ---------- WALL TEXTURES (64x64) ----------
  const T = 64;

  function texHull() {
    const c = cnv(T, T), ctx = c.getContext('2d');
    ctx.fillStyle = '#4a5462'; ctx.fillRect(0, 0, T, T);
    // πάνελ
    ctx.fillStyle = '#535e6e';
    ctx.fillRect(2, 2, 60, 28); ctx.fillRect(2, 34, 28, 28); ctx.fillRect(34, 34, 28, 28);
    // σκιές αρμών
    ctx.fillStyle = '#343c48';
    ctx.fillRect(0, 0, T, 2); ctx.fillRect(0, 30, T, 4); ctx.fillRect(0, 62, T, 2);
    ctx.fillRect(0, 0, 2, T); ctx.fillRect(30, 32, 4, 32); ctx.fillRect(62, 0, 2, T);
    // πριτσίνια
    ctx.fillStyle = '#6d7a8c';
    for (const [x, y] of [[6, 6], [56, 6], [6, 24], [56, 24], [6, 38], [25, 38], [38, 38], [57, 38], [6, 57], [25, 57], [38, 57], [57, 57]]) {
      ctx.fillRect(x, y, 2, 2);
    }
    speckle(ctx, T, T, 160, '#2c333d', 0.5);
    speckle(ctx, T, T, 60, '#7c8aa0', 0.4);
    return c;
  }

  function texBlood(base) {
    const c = cnv(T, T), ctx = c.getContext('2d');
    ctx.drawImage(base, 0, 0);
    ctx.fillStyle = 'rgba(120,10,10,0.85)';
    ctx.beginPath();
    ctx.ellipse(40, 20, 14, 10, 0.5, 0, Math.PI * 2);
    ctx.fill();
    // στάλες
    for (const [x, y, w, h] of [[38, 30, 3, 16], [45, 28, 2, 22], [33, 28, 2, 10], [50, 26, 2, 8]]) {
      ctx.fillRect(x, y, w, h);
    }
    speckle(ctx, T, T, 40, '#7a0a0a', 0.7);
    return c;
  }

  function texVent() {
    const c = cnv(T, T), ctx = c.getContext('2d');
    ctx.fillStyle = '#3a424e'; ctx.fillRect(0, 0, T, T);
    ctx.fillStyle = '#20262e';
    for (let y = 6; y < 60; y += 10) ctx.fillRect(8, y, 48, 5);
    ctx.fillStyle = '#525d6c';
    for (let y = 4; y < 60; y += 10) ctx.fillRect(8, y, 48, 2);
    ctx.strokeStyle = '#293039'; ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 60, 60);
    speckle(ctx, T, T, 120, '#1c2128', 0.5);
    return c;
  }

  function texTech() {
    const c = cnv(T, T), ctx = c.getContext('2d');
    ctx.fillStyle = '#2b3038'; ctx.fillRect(0, 0, T, T);
    ctx.fillStyle = '#1c2026';
    ctx.fillRect(4, 4, 56, 24);
    // «οθόνη» με γραμμές δεδομένων
    ctx.fillStyle = '#27e08a';
    for (let y = 8; y < 24; y += 4) ctx.fillRect(8, y, 20 + ((y * 13) % 28), 2);
    // καλώδια
    ctx.strokeStyle = '#141518'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(10, 32); ctx.bezierCurveTo(14, 44, 6, 52, 12, 62); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(24, 32); ctx.bezierCurveTo(28, 46, 20, 50, 26, 62); ctx.stroke();
    // λαμπάκια
    const lights = ['#ff4040', '#ffd040', '#40ff70', '#40c0ff'];
    lights.forEach((col, i) => {
      ctx.fillStyle = col;
      ctx.fillRect(38 + i * 6, 36, 3, 3);
    });
    ctx.fillStyle = '#3a424e';
    ctx.fillRect(36, 44, 24, 16);
    speckle(ctx, T, T, 100, '#12151a', 0.6);
    return c;
  }

  function texDoor() {
    const c = cnv(T, T), ctx = c.getContext('2d');
    ctx.fillStyle = '#59636f'; ctx.fillRect(0, 0, T, T);
    ctx.fillStyle = '#454e59';
    ctx.fillRect(0, 0, 4, T); ctx.fillRect(60, 0, 4, T);
    // ρίγες κινδύνου
    ctx.save();
    ctx.beginPath(); ctx.rect(6, 24, 52, 16); ctx.clip();
    for (let i = -2; i < 10; i++) {
      ctx.fillStyle = i % 2 ? '#e8c020' : '#20242a';
      ctx.beginPath();
      ctx.moveTo(i * 12, 40); ctx.lineTo(i * 12 + 8, 24);
      ctx.lineTo(i * 12 + 16, 24); ctx.lineTo(i * 12 + 8, 40);
      ctx.fill();
    }
    ctx.restore();
    // κεντρικός αρμός
    ctx.fillStyle = '#242a31';
    ctx.fillRect(30, 0, 4, T);
    ctx.fillStyle = '#6c7887';
    ctx.fillRect(8, 8, 18, 4); ctx.fillRect(38, 8, 18, 4);
    ctx.fillRect(8, 52, 18, 4); ctx.fillRect(38, 52, 18, 4);
    speckle(ctx, T, T, 120, '#333a43', 0.5);
    return c;
  }

  function texElevator() {
    const c = cnv(T, T), ctx = c.getContext('2d');
    ctx.fillStyle = '#2e3c34'; ctx.fillRect(0, 0, T, T);
    ctx.fillStyle = '#1c2620';
    ctx.fillRect(6, 6, 52, 52);
    ctx.fillStyle = '#33e070';
    ctx.fillRect(30, 6, 4, 52);
    // βέλος κάτω (κάθοδος)
    ctx.beginPath();
    ctx.moveTo(32, 46); ctx.lineTo(20, 30); ctx.lineTo(27, 30);
    ctx.lineTo(27, 16); ctx.lineTo(37, 16); ctx.lineTo(37, 30); ctx.lineTo(44, 30);
    ctx.closePath();
    ctx.fillStyle = '#33e070';
    ctx.fill();
    ctx.strokeStyle = '#33e070'; ctx.lineWidth = 2;
    ctx.strokeRect(3, 3, 58, 58);
    return c;
  }

  function texCore() {
    const c = cnv(T, T), ctx = c.getContext('2d');
    ctx.fillStyle = '#1c1424'; ctx.fillRect(0, 0, T, T);
    // παλλόμενοι «νευρώνες» της AI
    ctx.strokeStyle = '#8a30d0'; ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(4 + i * 11, 0);
      ctx.bezierCurveTo(20, 20 + i * 4, 44 - i * 4, 40, 60 - i * 9, 64);
      ctx.stroke();
    }
    ctx.fillStyle = '#c060ff';
    for (const [x, y] of [[12, 14], [30, 30], [48, 18], [20, 48], [44, 50]]) {
      ctx.fillRect(x, y, 3, 3);
    }
    speckle(ctx, T, T, 80, '#0d0a12', 0.7);
    return c;
  }

  // ---------- SPRITES εχθρών ----------
  /* Παλέτες: κοινές συντομεύσεις
     k=σκούρο περίγραμμα, r=κόκκινο, R=φωτεινό κόκκινο, m=μέταλλο, M=ανοιχτό μέταλλο */

  const shamblerPal = {
    k: '#101408', g: '#4e6b32', G: '#69894a', d: '#38491f',
    m: '#5a6470', M: '#8a95a4', r: '#c02020', R: '#ff5030',
    b: '#801010', t: '#c8b090',
  };
  // 14x18, scale 4 -> 56x72
  const shamblerBase = [
    '....kkkkk.....',
    '...kGGGGGk....',
    '...kGgRgGk....',
    '...kGgggGk....',
    '....kGGGk.....',
    '..kkkgggkkk...',
    '.kGGggggggGk..',
    'kMmkgggggkGGk.',
    'kMmkgdddgkgGk.',
    '.kk.gdddg.kgk.',
    '....gdddg..t..',
    '....gdddg.....',
    '....kgggk.....',
  ];
  const shamblerLegsA = [
    '....kg.gk.....',
    '....kg..gk....',
    '....kg...gk...',
    '...kdk...kdk..',
    '...kk.....kk..',
  ];
  const shamblerLegsB = [
    '....kg.gk.....',
    '...kg...gk....',
    '..kg.....gk...',
    '.kdk.....kdk..',
    '.kk.......kk..',
  ];
  const shamblerAttack = [
    '....kkkkk.....',
    '...kGGGGGk....',
    '...kGgRgGk....',
    '...kGgggGk....',
    'kMMkkGGGkkttk.',
    'kmm.kgggk.ttk.',
    '.k.kgggggk.k..',
    '...kgggggk....',
    '...kgdddgk....',
    '....gdddg.....',
    '....gdddg.....',
    '....gdddg.....',
    '....kgggk.....',
  ];

  const spitterPal = {
    k: '#141208', y: '#b0a028', Y: '#d4c440', d: '#7c701c',
    r: '#c03030', R: '#ff6040', o: '#503c10', w: '#f0e8c0',
  };
  const spitterBase = [
    '....kkkkkk....',
    '..kkYYYYYYkk..',
    '.kYYyRyyRyYYk.',
    '.kYyyyyyyyyYk.',
    'kYYykwwwwkyYYk',
    'kYyykroorkyyYk',
    'kYyyykrrkyyyYk',
    'kYyyyyyyyyyyYk',
    '.kYyydddyyYk..',
    '.kYyydddyyYk..',
    '..kYyyyyyYk...',
    '...kkyyykk....',
  ];
  const spitterLegsA = [
    '...ky....yk...',
    '..kdk....kdk..',
    '..kk......kk..',
  ];
  const spitterLegsB = [
    '....ky..yk....',
    '...kdk..kdk...',
    '...kk....kk...',
  ];
  const spitterAttack = spitterBase.map((row, i) =>
    i === 4 ? 'kYYykwwwwkyYYk' :
    i === 5 ? 'kYyykRRRRkyyYk' :
    i === 6 ? 'kYyykRRRRkyyYk' : row);

  const dronePal = {
    k: '#0c0e14', m: '#4a525e', M: '#727e8e', r: '#ff3030',
    R: '#ff8060', b: '#20c0ff', d: '#2c323c',
  };
  const droneBase = [
    '..kmmmmmmk..',
    '.kmMMMMMMmk.',
    'kmMdddddd Mk'.replace(' ', 'M'),
    'kmdkrrrrkdmk',
    'kmdkrRRrkdmk',
    'kmMddddddMmk',
    '.kmMMMMMMmk.',
    '..kkmddmkk..',
    '....kbbk....',
  ];
  const droneFrameB = droneBase.map((row, i) =>
    i === 8 ? '....k..k....' : row);

  const heavyPal = {
    k: '#0e0c10', m: '#5c545e', M: '#847a86', d: '#39343c',
    r: '#c02828', R: '#ff4838', o: '#e08020', g: '#282430',
  };
  const heavyBase = [
    '...kkkkkkkk...',
    '..kMMMMMMMMk..',
    '..kMdkrrkdMk..',
    '..kMdkrrkdMk..',
    '.kkMMMMMMMMkk.',
    'kMMkmmmmmmkMMk',
    'kMdkmggggmkdMk',
    'kMdkmggggmkooo',
    'kkkkmggggmkkok',
    '...kmggggmk.k.',
    '...kmmmmmmk...',
    '...kmk..kmk...',
  ];
  const heavyLegsA = [
    '..kdmk..kmdk..',
    '..kddk..kddk..',
    '..kkk....kkk..',
  ];
  const heavyLegsB = [
    '..kdmk..kmdk..',
    '.kddk....kddk.',
    '.kkk......kkk.',
  ];
  const heavyAttack = heavyBase.map((row, i) =>
    i === 7 ? 'kMdkmggggmkRRR' :
    i === 8 ? 'kkkkmggggmkkRk' : row);

  const bossPal = {
    k: '#08060c', m: '#3c3648', M: '#5c546c', p: '#8a30d0',
    P: '#c060ff', r: '#ff3050', w: '#e8e0f0', d: '#241f2e',
  };
  // 20x22, μεγάλο — scale 7 -> 140x154
  const bossBase = [
    '....kkkkkkkkkkkk....',
    '..kkMMMMMMMMMMMMkk..',
    '.kMMmmmmmmmmmmmmMMk.',
    '.kMmkkkkkkkkkkkkmMk.',
    'kMmkwwPPkkkkPPwwkmMk',
    'kMmkwPPPkkkkPPPwkmMk',
    'kMmkkPPkkkkkkPPkkmMk',
    'kMmkkkkkkkkkkkkkkmMk',
    'kMmkkwwwwwwwwwwkkmMk',
    'kMmkkwkwkwkwkwkkkmMk',
    '.kMmkkkkkkkkkkkkmMk.',
    '.kMMmmmmmmmmmmmmMMk.',
    '..kkMMMMkkkkMMMMkk..',
    '...kmmPk....kPmmk...',
    '...kmPPk....kPPmk...',
    '..kmPPk......kPPmk..',
    '..kmPk........kPmk..',
    '.kmPPk........kPPmk.',
    '.kPPk..........kPPk.',
    '.kPk............kPk.',
    '.kk..............kk.',
    '....................',
  ];
  const bossAttack = bossBase.map((row, i) =>
    (i === 4 || i === 5) ? row.replace(/P/g, 'r').replace(/w/g, 'r') : row);

  // ---------- PICKUPS / PROPS (μικρά, scale 3) ----------
  const pickPal = {
    k: '#101014', w: '#e8e8f0', r: '#d02020', y: '#e8c020',
    m: '#6a7482', M: '#98a4b4', c: '#20d0e0', C: '#a0f0ff',
    p: '#a040e0', P: '#d090ff', g: '#30c060', o: '#e07820',
    d: '#30343c', b: '#803010',
  };
  const medkitMap = [
    '.kkkkkkkkk.',
    'kwwwwwwwwwk',
    'kwwwrrrwwwk',
    'kwrrrrrrrwk',
    'kwwwrrrwwwk',
    'kwwwwwwwwwk',
    '.kkkkkkkkk.',
  ];
  const shellsMap = [
    '.kkkkkkkk.',
    'kddddddddk',
    'kdyoyoyodk',
    'kdyoyoyodk',
    'kyyyyyyyyk',
    '.kkkkkkkk.',
  ];
  const cellsMap = [
    '.kkkkkkkk.',
    'kddddddddk',
    'kdcCcCcCdk',
    'kdcCcCcCdk',
    'kcccccccck',
    '.kkkkkkkk.',
  ];
  const scrapMap = [
    '...kk.....',
    '..kCck.kk.',
    '.kcCCckcck',
    'kcCCCccck.',
    '.kcCcck...',
    '..kkk.....',
  ];
  const coreMap = [
    '....kk....',
    '...kPPk...',
    '..kPPPPk..',
    '.kPpppPPk.',
    '.kPppppPk.',
    '..kPppPk..',
    '...kPPk...',
    '....kk....',
  ];
  const termMap = [
    '.kkkkkkkkkk.',
    'kmMMMMMMMMmk',
    'kmkggggggkmk',
    'kmkgkgkggkmk',
    'kmkggggggkmk',
    'kmMMMMMMMMmk',
    'kmmkyykmmmmk',
    'kmmmmmmmmmmk',
    '.kmk....kmk.',
    '.kkk....kkk.',
  ];
  const termPal = Object.assign({}, pickPal, { g: '#27e08a' });

  // projectiles (scale 3)
  const acidMap = [
    '.kgk.',
    'kgGgk',
    'kGgGk'.replace('G', 'G'),
    '.kgk.',
  ];
  const acidPal = { k: '#0a1408', g: '#40c030', G: '#a0ff60' };
  const plasmaMap = [
    '.kck.',
    'kcCck',
    'kCcCk',
    '.kck.',
  ];
  const plasmaPal = { k: '#04141c', c: '#20a0e0', C: '#b0f0ff' };
  const boltMap = [
    '.krk.',
    'krRrk',
    'kRrRk',
    '.krk.',
  ];
  const boltPal = { k: '#180404', r: '#e03020', R: '#ffb060' };

  // ---------- ΟΠΛΑ πρώτου προσώπου (όψη από πίσω, με χέρια) ----------
  // Διπλάσια ανάλυση (~40x27, scale 2) για λεπτομέρεια: σκίαση 3 τόνων,
  // χαραγές, σκόπευτρα, λαβές, φωτεινά στοιχεία.
  const wpnPal = {
    k: '#0b0b0f', D: '#15161c', d: '#242630', g: '#343744',
    m: '#4a4e5e', M: '#6a7080', H: '#8e96a8',
    b: '#5a3c1c', B: '#7a5528', W: '#96703c',
    c: '#1898c8', C: '#40d8ff', E: '#b0f4ff',
    y: '#e8c020', o: '#e07820', r: '#c03030',
    s: '#a87848', S: '#c89058', T: '#e8b878',
  };

  const pistolMap = [
    '........................................',
    '..................kkkk..................',
    '.................kHkkHk.................',
    '.................kkMMkk.................',
    '................kkkkkkkk................',
    '...............kHMMMMMMHk...............',
    '...............kMmmmmmmmk...............',
    '...............kMdgdgdgdk...............',
    '...............kMdgdgdgdk...............',
    '...............kMdgdgdgdk...............',
    '...............kMmmmmmmmk...............',
    '...............kHMMMMMMHk...............',
    '...............kkkkkkkkkk...............',
    '...............kdDDDDDDDk...............',
    '..............kkdDDrDDDdkk..............',
    '.............kSskdDDDDDdksSk............',
    '............ksSSkdddddddkSSsk...........',
    '...........ksSTSkgggggggkSTSsk..........',
    '...........ksSSSkkgggggkkSSSsk..........',
    '...........ksSSSSkkkkkkkSSSSsk..........',
    '...........ksSSTSSSSSSSSSTSSsk..........',
    '............ksSSSSSSSSSSSSsk............',
    '............ksSSSSSSSSSSSsk.............',
    '.............ksSSSSSSSSSsk..............',
    '..............ksssssssssk...............',
    '...............kkkkkkkkk................',
    '........................................',
  ];

  const shotgunMap = [
    '........................................',
    '................kkkkkkkk................',
    '...............kHMMMMMMHk...............',
    '..............kMmkDDDDkmMk..............',
    '..............kMkDkkkkDkMk..............',
    '..............kMkDkDDkDkMk..............',
    '..............kMkDkkkkDkMk..............',
    '..............kMmkDDDDkmMk..............',
    '..............kHMkmmmmkMHk..............',
    '..............kkkkkkkkkkkk..............',
    '..............kMmgmmgmmgMk..............',
    '..............kMmgmmgmmgMk..............',
    '..............kkkkkkkkkkkk..............',
    '.............kBWbbbbbbbbWBk.............',
    '............kkBbbkbbbbkbbBkk............',
    '..........kSskBbbkbbbbkbbBksSk..........',
    '.........ksSSkBWbbbbbbbbWBkSSsk.........',
    '........ksSTSSkkkkkkkkkkkkSSTSsk........',
    '........ksSSSSSkdDDDDDDdkSSSSSsk........',
    '........ksSSSSSkdDDDDDDdkSSSSSsk........',
    '........ksSSTSSSkkkkkkkkSSTSSSsk........',
    '.........ksSSSSSSSSSSSSSSSSSSsk.........',
    '..........ksSSSSSSSSSSSSSSSsk...........',
    '...........ksSSSSSSSSSSSSsk.............',
    '............kssssssssssssk..............',
    '.............kkkkkkkkkkkk...............',
    '........................................',
  ];

  const rifleMap = [
    '........................................',
    '..............kkkkkkkkkkkk..............',
    '.............kHMMMMMMMMMMHk.............',
    '.............kMmmkkkkkkmmMk.............',
    '.............kMmkCECCECkmMk.............',
    '.............kMmkcCcccCckmMk............',
    '.............kMmkCcCCcCCkmMk............',
    '.............kMmkcCcccCckmMk............',
    '.............kMmkkkkkkkkmMk.............',
    '.............kMmmgmmgmmgmMk.............',
    '.............kMdgdgdgdgddMk.............',
    '.............kkkkkkkkkkkkkk.............',
    '.............kdDkyoyokDDDdk.............',
    '.............kdDkkkkkkDDDdk.............',
    '............kkdDDDDDDDDDdkk.............',
    '..........kSskdddddddddddksSk...........',
    '.........ksSSkgggggggggggkSSsk..........',
    '........ksSTSkkgggggggggkkSTSsk.........',
    '........ksSSSSkkkkkkkkkkkSSSSsk.........',
    '........ksSSSSSSSSSSSSSSSSSSSsk.........',
    '........ksSSTSSSSSSSSSSSSTSSSsk.........',
    '.........ksSSSSSSSSSSSSSSSSsk...........',
    '..........ksSSSSSSSSSSSSSsk.............',
    '...........ksSSSSSSSSSSsk...............',
    '............kssssssssssk................',
    '.............kkkkkkkkkk.................',
    '........................................',
  ];

  const launcherMap = [
    '........................................',
    '.............kkkkkkkkkkkkkk.............',
    '............kHMMMMMMMMMMMMHk............',
    '...........kMmkkkkkkkkkkkkmMk...........',
    '...........kMkDDdDDDDDDdDDkMk...........',
    '...........kMkDkkkkkkkkkkDkMk...........',
    '...........kMkDkcCCEECCckDkMk...........',
    '...........kMkDkCcEEEEcCkDkMk...........',
    '...........kMkDkcCCEECCckDkMk...........',
    '...........kMkDkkkkkkkkkkDkMk...........',
    '...........kMkDDdDDDDDDdDDkMk...........',
    '...........kMmkkkkkkkkkkkkmMk...........',
    '...........kHMyoyoyoyoyoyoMHk...........',
    '...........kkkkkkkkkkkkkkkkkk...........',
    '............kMmmgmmgmmgmmgMk............',
    '............kkkkkkkkkkkkkkkk............',
    '..........kSskdDDDDDDDDDDdksSk..........',
    '.........ksSSkdddddddddddDkSSsk.........',
    '........ksSTSkgggggggggggggkSTSsk.......',
    '........ksSSSkkgggggggggggkkSSSsk.......',
    '........ksSSSSkkkkkkkkkkkkkSSSSsk.......',
    '........ksSSTSSSSSSSSSSSSSSTSSSsk.......',
    '.........ksSSSSSSSSSSSSSSSSSSsk.........',
    '..........ksSSSSSSSSSSSSSSSsk...........',
    '...........ksSSSSSSSSSSSSsk.............',
    '............kssssssssssssk..............',
    '.............kkkkkkkkkkkk...............',
  ];

  const smgMap = [
    '........................................',
    '..................kkkk..................',
    '.................kHmmHk.................',
    '.................kkkkkk.................',
    '................kHMMMMHk................',
    '................kMmmmmmk................',
    '................kMdgdgdk................',
    '................kMmmmmmk................',
    '...............kkkkkkkkk................',
    '...............kdDDDDDDk................',
    '..............kkdDrDDDdkk...............',
    '.............kSskdDDDDdksSk.............',
    '............ksSSkddddddkSSsk............',
    '...........ksSTSkgggggkkSTSsk...........',
    '...........ksSSSkkgggkkSSSSsk...........',
    '...........ksSSSSkkkkkSSSSSsk...........',
    '...........ksSSTSSkDkSSTSSsk............',
    '............ksSSSSkDkSSSSsk.............',
    '............ksSSSSkDkSSSsk..............',
    '.............ksSSSkkkSSsk...............',
    '..............ksssssssk.................',
    '...............kkkkkkk..................',
    '........................................',
  ];

  const handcannonMap = [
    '........................................',
    '.................kkkkkk.................',
    '................kHkkkkHk................',
    '................kkMMMMkk................',
    '...............kHMMMMMMHk...............',
    '...............kMmmmmmmmk...............',
    '...............kMdgdgdgdk...............',
    '...............kMdgdgdgdk...............',
    '...............kMmmmmmmmk...............',
    '..............kkHMMMMMMHkk..............',
    '.............kmkkkkkkkkkkmk.............',
    '.............kmDdDDDDDDdDmk.............',
    '.............kmDdDDrDDDdDmk.............',
    '.............kkkdDDDDDDdkkk.............',
    '............kSskdDDDDDDdksSk............',
    '...........ksSSkddddddddkSSsk...........',
    '..........ksSTSkggggggggkSTSsk..........',
    '..........ksSSSkkggggggkkSSSsk..........',
    '..........ksSSSSkkkkkkkkSSSSsk..........',
    '..........ksSSTSSSSSSSSSTSSSsk..........',
    '...........ksSSSSSSSSSSSSSsk............',
    '............ksSSSSSSSSSSsk..............',
    '.............kssssssssssk...............',
    '..............kkkkkkkkkk................',
    '........................................',
  ];

  const railgunMap = [
    '........................................',
    '..............kk........kk..............',
    '.............kHMk......kMHk.............',
    '.............kMmk.CEC..kmMk.............',
    '.............kMmk.ECE..kmMk.............',
    '.............kMmk.CEC..kmMk.............',
    '.............kMmk......kmMk.............',
    '.............kMmkkkkkkkkmMk.............',
    '.............kMmmCCCCCCmmMk.............',
    '.............kMmmccccccmmMk.............',
    '.............kMdmmmmmmmmdMk.............',
    '.............kkkkkkkkkkkkkk.............',
    '.............kdDkyoyoykDDdk.............',
    '.............kdDkkkkkkkDDdk.............',
    '............kkdDDDDDDDDDdkk.............',
    '..........kSskdddddddddddksSk...........',
    '.........ksSSkgggggggggggkSSsk..........',
    '........ksSTSkkgggggggggkkSTSsk.........',
    '........ksSSSSkkkkkkkkkkkSSSSsk.........',
    '........ksSSSSSSSSSSSSSSSSSSSsk.........',
    '........ksSSTSSSSSSSSSSSSTSSSsk.........',
    '.........ksSSSSSSSSSSSSSSSSsk...........',
    '..........ksSSSSSSSSSSSSSsk.............',
    '...........ksSSSSSSSSSSsk...............',
    '............kssssssssssk................',
    '.............kkkkkkkkkk.................',
    '........................................',
  ];

  const incineratorMap = [
    '........................................',
    '................kkkkkkkk................',
    '...............kdDDDDDDdk...............',
    '...............kDkkkkkkDk...............',
    '...............kDkoOOokDk...............'.replace(/O/g, 'o'),
    '...............kDkoyyokDk...............',
    '...............kDkoOOokDk...............'.replace(/O/g, 'o'),
    '...............kDkkkkkkDk...............',
    '..............kkdDDDDDDdkk..............',
    '.............kHMMMMMMMMMMHk.............',
    '.............kMmkryrkkmmmMk.............',
    '.............kMmkkkkkkmmmMk.............',
    '.............kMdmmmmmmmmdMk.............',
    '.............kkkkkkkkkkkkkk.............',
    '............kSskdDDDDDDDdksSk...........',
    '...........ksSSkdddddddddkSSsk..........',
    '..........ksSTSkgggggggggkSTSsk.........',
    '..........ksSSSkkgggggggkkSSSsk.........',
    '..........ksSSSSkkkkkkkkkSSSSsk.........',
    '..........ksSSTSSSSSSSSSSTSSSsk.........',
    '...........ksSSSSSSSSSSSSSSsk...........',
    '............ksSSSSSSSSSSSsk.............',
    '.............ksssssssssssk..............',
    '..............kkkkkkkkkkk...............',
    '........................................',
  ];

  const arccasterMap = [
    '........................................',
    '............kkk..........kkk............',
    '...........kHMk..........kMHk...........',
    '...........kMmk...C..E...kmMk...........',
    '...........kMmk..E.C..C..kmMk...........',
    '...........kMmk.C..E.E...kmMk...........',
    '...........kMmk..........kmMk...........',
    '...........kMmkk........kkmMk...........',
    '...........kMmmkkkkkkkkkkmmMk...........',
    '...........kMmmmCCCCCCCCmmmMk...........',
    '...........kMdmmccccccccmmdMk...........',
    '...........kkkkkkkkkkkkkkkkkk...........',
    '..............kdDkCcCkDDdk..............',
    '..............kdDkkkkkDDdk..............',
    '.............kkdDDDDDDDdkk..............',
    '...........kSskdddddddddksSk............',
    '..........ksSSkgggggggggkSSsk...........',
    '.........ksSTSkkgggggggkkSTSsk..........',
    '.........ksSSSSkkkkkkkkkSSSSsk..........',
    '.........ksSSTSSSSSSSSSSTSSSsk..........',
    '..........ksSSSSSSSSSSSSSSsk............',
    '...........ksSSSSSSSSSSSsk..............',
    '............ksssssssssssk...............',
    '.............kkkkkkkkkkk................',
    '........................................',
  ];

  function muzzleFlash(base) {
    const c = cnv(base.width, base.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(base, 0, 0);
    const cx = c.width * 0.5, cy = c.height * 0.10;
    ctx.fillStyle = '#fff8c0';
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + 0.26;
      const r = i % 2 ? 7 : 18;
      ctx[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffb030';
    ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fill();
    return c;
  }

  // ---------- MUGSHOT (12x12, scale 3) ----------
  const facePal = {
    k: '#181008', s: '#c89058', S: '#e0aa70', h: '#3c2814',
    e: '#f0f0f0', p: '#101820', r: '#c02020', w: '#f0f0f0',
    d: '#804040', b: '#601010',
  };
  const faceOk = [
    '.khhhhhhhhk.',
    'khhhhhhhhhhk',
    'khsSSSSSSshk',
    'khsSSSSSSshk',
    'ksepkSSkepsk',
    'ksSSSSSSSSsk',
    'ksSSskksSSsk',
    'ksSSSSSSSSsk',
    '.ksSkkkkSsk.',
    '.ksSSSSSSsk.',
    '..kssssssk..',
    '...kkkkkk...',
  ];
  const faceGrin = faceOk.map((row, i) =>
    i === 8 ? '.kskwwwwksk.' :
    i === 9 ? '.ksSkkkkSsk.' : row);
  const facePain = faceOk.map((row, i) =>
    i === 4 ? 'kskkkSSkkksk' :
    i === 8 ? '.ksSkddkSsk.' :
    i === 9 ? '.ksSkkkkSsk.' : row);
  const faceLow = faceOk.map((row, i) =>
    i === 2 ? 'khsSbSSbSshk' :
    i === 4 ? 'ksdpkSSkdpsk' :
    i === 7 ? 'ksSbSSSSbSsk' :
    i === 8 ? '.ksSkrrkSsk.' : row);
  const faceDead = faceOk.map((row, i) =>
    i === 4 ? 'kskxkSSkxksk'.replace(/x/g, 'k') :
    i === 8 ? '.ksSkkkkSsk.' :
    i === 9 ? '.ksskkkkssk.' : row);

  // ---------- συναρμολόγηση ----------
  function withLegs(base, legs) { return base.concat(legs); }

  function build() {
    const A = {};

    A.tex = {
      hull: texHull(),
      vent: texVent(),
      tech: texTech(),
      door: texDoor(),
      elevator: texElevator(),
      core: texCore(),
    };
    A.tex.hullBlood = texBlood(A.tex.hull);

    // θεματικές παραλλαγές ανά deck (0..3): cryo/engine/hydro/core
    const themes = [
      { tint: '#4060c0', a: 0.16 },
      { tint: '#c04820', a: 0.18 },
      { tint: '#30a040', a: 0.16 },
      { tint: '#7030b0', a: 0.20 },
    ];
    A.deckTex = themes.map(th => ({
      hull: tint(A.tex.hull, th.tint, th.a),
      hullBlood: tint(A.tex.hullBlood, th.tint, th.a),
      vent: tint(A.tex.vent, th.tint, th.a),
      tech: tint(A.tex.tech, th.tint, th.a * 0.5),
      door: A.tex.door,
      elevator: A.tex.elevator,
      core: A.tex.core,
    }));

    function enemySet(baseRows, legsA, legsB, attackRows, pal, scale, blood) {
      const walk1 = px(withLegs(baseRows, legsA), pal, scale);
      const walk2 = px(withLegs(baseRows, legsB), pal, scale);
      const attack = px(withLegs(attackRows, legsA), pal, scale);
      return {
        walk: [walk1, walk2],
        attack,
        pain: painFrame(walk1),
        death: deathFrames(walk1, blood),
      };
    }

    A.enemies = {
      shambler: enemySet(shamblerBase, shamblerLegsA, shamblerLegsB,
        shamblerAttack, shamblerPal, 4, 'rgba(140,20,20,0.9)'),
      spitter: enemySet(spitterBase, spitterLegsA, spitterLegsB,
        spitterAttack, spitterPal, 4, 'rgba(140,140,20,0.9)'),
      heavy: enemySet(heavyBase, heavyLegsA, heavyLegsB,
        heavyAttack, heavyPal, 5, 'rgba(80,80,90,0.9)'),
    };
    // drone: δικά του frames (αιωρείται)
    const drone1 = px(droneBase, dronePal, 4);
    const drone2 = px(droneFrameB, dronePal, 4);
    A.enemies.drone = {
      walk: [drone1, drone2],
      attack: tint(drone1, '#ff4030', 0.35),
      pain: painFrame(drone1),
      death: deathFrames(drone1, 'rgba(40,40,50,0.9)'),
    };
    // Φρουρός: heavy recolor, μεγαλύτερος
    const wardenWalk1 = tint(scaled(A.enemies.heavy.walk[0], 1.25, 1.25), '#e08020', 0.30);
    A.enemies.warden = {
      walk: [wardenWalk1, tint(scaled(A.enemies.heavy.walk[1], 1.25, 1.25), '#e08020', 0.30)],
      attack: tint(scaled(A.enemies.heavy.attack, 1.25, 1.25), '#e08020', 0.30),
      pain: painFrame(wardenWalk1),
      death: deathFrames(wardenWalk1, 'rgba(180,100,20,0.9)'),
    };
    const boss1 = px(bossBase, bossPal, 7);
    A.enemies.boss = {
      walk: [boss1, tint(boss1, '#c060ff', 0.12)],
      attack: px(bossAttack, bossPal, 7),
      pain: painFrame(boss1),
      death: deathFrames(boss1, 'rgba(140,60,220,0.9)'),
    };

    A.pickups = {
      medkit: px(medkitMap, pickPal, 3),
      rounds: px(shellsMap, pickPal, 3),
      cells: px(cellsMap, pickPal, 3),
      scrap: px(scrapMap, pickPal, 3),
      core: px(coreMap, pickPal, 3),
    };
    A.props = {
      terminal: px(termMap, termPal, 4),
    };
    const flameMap = [
      '.kok.',
      'koYok'.replace('Y', 'y'),
      'kyYyk'.replace('Y', 'y'),
      '.kyk.',
    ];
    const flamePal = { k: '#1c0c04', o: '#e05010', y: '#ffb030' };
    A.projectiles = {
      acid: px(acidMap, acidPal, 3),
      plasma: px(plasmaMap, plasmaPal, 3),
      bolt: px(boltMap, boltPal, 3),
      flame: px(flameMap, flamePal, 3),
    };

    function weapon(map) {
      const idle = px(map, wpnPal, 2);
      return { idle, fire: muzzleFlash(idle) };
    }
    A.weapons = {
      pistol: weapon(pistolMap),
      smg: weapon(smgMap),
      shotgun: weapon(shotgunMap),
      handcannon: weapon(handcannonMap),
      rifle: weapon(rifleMap),
      railgun: weapon(railgunMap),
      incinerator: weapon(incineratorMap),
      arccaster: weapon(arccasterMap),
      launcher: weapon(launcherMap),
    };
    // μικρά εικονίδια εδάφους για weapon pickups
    A.wpnIcons = {};
    for (const [key, w] of Object.entries(A.weapons)) {
      A.wpnIcons[key] = scaled(w.idle, 0.45, 0.45);
    }

    A.face = {
      ok: px(faceOk, facePal, 3),
      grin: px(faceGrin, facePal, 3),
      pain: px(facePain, facePal, 3),
      low: px(faceLow, facePal, 3),
      dead: px(faceDead, facePal, 3),
    };

    // δάπεδα/οροφές ανά deck για το per-pixel casting (fallback: πλάκες)
    function mkSurf(base, line) {
      const c = document.createElement('canvas');
      c.width = 64; c.height = 64;
      const ctx = c.getContext('2d');
      ctx.fillStyle = base; ctx.fillRect(0, 0, 64, 64);
      ctx.strokeStyle = line; ctx.lineWidth = 1;
      for (let gx = 0; gx < 64; gx += 16) {
        for (let gy = 0; gy < 64; gy += 16) ctx.strokeRect(gx + 0.5, gy + 0.5, 16, 16);
      }
      for (let i = 0; i < 180; i++) {
        ctx.fillStyle = `rgba(0,0,0,${0.05 + (i % 3) * 0.04})`;
        ctx.fillRect((Math.random() * 64) | 0, (Math.random() * 64) | 0, 1, 1);
      }
      return c;
    }
    A.floorTex = [
      mkSurf('#2c3444', '#20283a'),
      mkSurf('#3a2820', '#2a1c14'),
      mkSurf('#243428', '#182418'),
      mkSurf('#231b30', '#161022'),
    ];
    A.ceilTex = [mkSurf('#1a202c', '#12161f'), mkSurf('#120d1c', '#0c0814')];
    // τα procedural κρατιούνται ως fallback αν το file:// ταϊνάρει το canvas
    A.floorTexFallback = A.floorTex.slice();
    A.ceilTexFallback = A.ceilTex.slice();

    A.ui = { statusbar: null }; // προαιρετικό AI panel (ui_statusbar.png)

    return A;
  }

  const A = build();

  /* ---------- PNG OVERRIDE ----------
     Ρίξε assets/<key>.png για να αντικαταστήσεις οποιοδήποτε γραφικό,
     π.χ. assets/enemy_shambler_walk1.png, assets/tex_hull.png,
     assets/weapon_pistol_idle.png, assets/face_ok.png κ.λπ. */
  const OVERRIDES = [];
  function reg(path, apply) { OVERRIDES.push({ path, apply }); }

  const BLOOD = {
    shambler: 'rgba(140,20,20,0.9)', spitter: 'rgba(140,140,20,0.9)',
    drone: 'rgba(40,40,50,0.9)', heavy: 'rgba(80,80,90,0.9)',
    warden: 'rgba(180,100,20,0.9)', boss: 'rgba(140,60,220,0.9)',
  };

  for (const [name, e] of Object.entries(A.enemies)) {
    // slots για walk cycle (έως 4 frames) και death animation (έως 4 frames)·
    // τα αρχεία φορτώνουν async, οπότε ξαναχτίζουμε τα arrays σε κάθε άφιξη
    const walkSlots = [null, null, null, null];
    const dieSlots = [null, null, null, null];
    const rebuildWalk = () => {
      const frames = walkSlots.filter(Boolean);
      if (frames.length) e.walk = frames;
    };
    const rebuildDeath = () => {
      const frames = dieSlots.filter(Boolean);
      if (frames.length) e.death = frames;
    };
    for (let n = 1; n <= 4; n++) {
      reg(`enemy_${name}_walk${n}`, img => {
        walkSlots[n - 1] = img;
        rebuildWalk();
        if (n === 1) {
          // παράγωγα από το βασικό frame (αν δεν έρθουν die frames)
          e.pain = painFrame(img);
          if (!dieSlots.some(Boolean)) e.death = deathFrames(img, BLOOD[name]);
        }
      });
      reg(`enemy_${name}_die${n}`, img => {
        dieSlots[n - 1] = img;
        rebuildDeath();
      });
    }
    reg(`enemy_${name}_attack`, img => { e.attack = img; });
  }
  for (const key of Object.keys(A.tex)) {
    reg(`tex_${key}`, img => {
      A.tex[key] = img;
      A.deckTex.forEach(set => { if (set[key]) set[key] = img; });
    });
  }
  for (const [name, w] of Object.entries(A.weapons)) {
    // νέο idle → νέο muzzle flash + νέο εικονίδιο εδάφους
    reg(`weapon_${name}_idle`, img => {
      w.idle = img;
      w.fire = muzzleFlash(img);
      A.wpnIcons[name] = scaled(img, 0.45, 0.45);
    });
    reg(`weapon_${name}_fire`, img => { w.fire = img; });
  }
  for (const key of Object.keys(A.pickups)) reg(`pickup_${key}`, img => { A.pickups[key] = img; });
  for (const key of Object.keys(A.face)) reg(`face_${key}`, img => { A.face[key] = img; });
  for (const key of Object.keys(A.projectiles)) reg(`proj_${key}`, img => { A.projectiles[key] = img; });
  reg('prop_terminal', img => { A.props.terminal = img; });
  reg('ui_statusbar', img => { A.ui.statusbar = img; });
  A.floorTex.forEach((_, i) => reg(`tex_floor${i}`, img => { A.floorTex[i] = img; }));
  A.ceilTex.forEach((_, i) => reg(`tex_ceil${i}`, img => { A.ceilTex[i] = img; }));

  A.OVERRIDE_KEYS = OVERRIDES.map(o => o.path);

  A.loadOverrides = function (done) {
    let pending = OVERRIDES.length;
    if (!pending) { done(); return; }
    for (const o of OVERRIDES) {
      const img = new Image();
      img.onload = () => { o.apply(img); if (--pending === 0) done(); };
      img.onerror = () => { if (--pending === 0) done(); };
      img.src = 'assets/' + o.path + '.png';
    }
  };

  return A;
})();
