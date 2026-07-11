/* DRIFTLAND — Assets: procedural fallbacks + PNG overrides από assets/.
   Κάθε γραφικό ζωγραφίζεται σε offscreen canvas ώστε το παιχνίδι να
   δουλεύει και χωρίς PNG· αν υπάρχει assets/<key>.png το αντικαθιστά. */

const Assets = (() => {
  const A = {};

  function cv(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    return c;
  }

  /* Hex prism tile fallback: ίδια γεωμετρία με το PixelLab pipeline
     (καμβάς 112x144, top face 83x56, βάθος 26). */
  function hexTile(top, sideL, sideR) {
    return cv(112, 144, (x) => {
      const cx = 56, s = 48, k = 0.58;
      const hw = Math.sqrt(3) / 2 * s;
      const topY = 8, topH = 2 * s * k, depth = 26;
      const pts = [
        [cx, topY], [cx + hw, topY + topH * 0.25], [cx + hw, topY + topH * 0.75],
        [cx, topY + topH], [cx - hw, topY + topH * 0.75], [cx - hw, topY + topH * 0.25],
      ];
      x.fillStyle = sideL;
      x.beginPath(); x.moveTo(...pts[4]); x.lineTo(...pts[3]);
      x.lineTo(pts[3][0], pts[3][1] + depth); x.lineTo(pts[4][0], pts[4][1] + depth);
      x.closePath(); x.fill();
      x.fillStyle = sideR;
      x.beginPath(); x.moveTo(...pts[3]); x.lineTo(...pts[2]);
      x.lineTo(pts[2][0], pts[2][1] + depth); x.lineTo(pts[3][0], pts[3][1] + depth);
      x.closePath(); x.fill();
      x.fillStyle = top;
      x.beginPath();
      x.moveTo(...pts[0]);
      for (let i = 1; i < 6; i++) x.lineTo(...pts[i]);
      x.closePath(); x.fill();
      x.strokeStyle = 'rgba(16,18,24,0.9)'; x.lineWidth = 2;
      x.beginPath();
      x.moveTo(...pts[0]);
      for (let i = 1; i < 6; i++) x.lineTo(...pts[i]);
      x.closePath(); x.stroke();
    });
  }

  // ---------- tiles (κλειδιά = hex_* όπως τα PNG) ----------
  A.tiles = {
    hex_water_deep: hexTile('#1d6f9a', '#134a68', '#0f3c55'),
    hex_water: hexTile('#3fc8d8', '#1d6f9a', '#175a80'),
    hex_sand: hexTile('#e8d29a', '#b09055', '#93753f'),
    hex_grass: hexTile('#5cae3a', '#7a5a34', '#5f4527'),
    hex_jungle: hexTile('#33702a', '#4c3a22', '#3a2c18'),
    hex_rock: hexTile('#8b8c86', '#6b6c66', '#54554f'),
  };

  // ---------- props (fallbacks) ----------
  function tree(trunk, crown, w = 48, h = 64) {
    return cv(w, h, (x) => {
      x.fillStyle = trunk; x.fillRect(w / 2 - 3, h - 22, 6, 22);
      x.fillStyle = crown;
      x.beginPath(); x.arc(w / 2, h - 34, 16, 0, 7); x.fill();
      x.beginPath(); x.arc(w / 2 - 10, h - 26, 10, 0, 7); x.fill();
      x.beginPath(); x.arc(w / 2 + 10, h - 26, 10, 0, 7); x.fill();
    });
  }
  function blob(color, w, h, ry = 0.4) {
    return cv(w, h, (x) => {
      x.fillStyle = color;
      x.beginPath();
      x.ellipse(w / 2, h * 0.6, w * 0.4, h * ry, 0, 0, 7);
      x.fill();
    });
  }

  A.props = {
    palm: tree('#9a6b3c', '#4f9440'),
    tree: tree('#6d4a28', '#3e7d2e'),
    rock: blob('#8d8e88', 32, 32, 0.34),
    bush: cv(32, 32, (x) => {
      x.fillStyle = '#3f7d2f';
      x.beginPath(); x.arc(16, 20, 11, 0, 7); x.fill();
      x.fillStyle = '#c33';
      for (const [bx, by] of [[10, 16], [20, 14], [16, 22], [23, 21]]) {
        x.beginPath(); x.arc(bx, by, 2, 0, 7); x.fill();
      }
    }),
    driftwood: cv(32, 24, (x) => {
      x.fillStyle = '#a08058';
      x.fillRect(4, 12, 24, 4); x.fillRect(8, 7, 20, 4);
      x.fillStyle = '#8a6c48'; x.fillRect(6, 17, 18, 3);
    }),
    wreck: cv(64, 48, (x) => {
      x.fillStyle = '#6d4a28';
      x.beginPath();
      x.moveTo(4, 44); x.lineTo(14, 14); x.lineTo(52, 10); x.lineTo(60, 44);
      x.closePath(); x.fill();
      x.fillStyle = '#4c3018'; x.fillRect(14, 22, 40, 4);
      x.fillStyle = '#d8d2c0'; x.fillRect(30, 2, 3, 22);
    }),
    campfire: cv(32, 32, (x) => {
      x.fillStyle = '#7b7c76';
      for (let i = 0; i < 7; i++) {
        const a = i / 7 * Math.PI * 2;
        x.fillRect(15 + Math.cos(a) * 11, 22 + Math.sin(a) * 5, 4, 4);
      }
      x.fillStyle = '#e8752a';
      x.beginPath(); x.moveTo(16, 6); x.lineTo(22, 22); x.lineTo(10, 22);
      x.closePath(); x.fill();
      x.fillStyle = '#ffc040';
      x.beginPath(); x.moveTo(16, 12); x.lineTo(19, 22); x.lineTo(13, 22);
      x.closePath(); x.fill();
    }),
    campfire2: null, // γεμίζει από campfire tint παρακάτω
    firepit: cv(32, 32, (x) => {
      x.fillStyle = '#7b7c76';
      for (let i = 0; i < 7; i++) {
        const a = i / 7 * Math.PI * 2;
        x.fillRect(15 + Math.cos(a) * 11, 22 + Math.sin(a) * 5, 4, 4);
      }
      x.fillStyle = '#3a3230'; x.fillRect(11, 18, 10, 5);
    }),
    workbench: cv(40, 32, (x) => {
      x.fillStyle = '#8a6238'; x.fillRect(2, 10, 36, 8);
      x.fillStyle = '#6d4a28';
      x.fillRect(5, 18, 5, 12); x.fillRect(30, 18, 5, 12);
      x.fillStyle = '#9c9d97'; x.fillRect(8, 6, 8, 4);
    }),
    wall: cv(32, 32, (x) => {
      x.fillStyle = '#8a6238';
      for (let i = 0; i < 4; i++) x.fillRect(2 + i * 8, 4, 6, 26);
      x.fillStyle = '#6d4a28';
      for (let i = 0; i < 4; i++) {
        x.beginPath(); x.moveTo(2 + i * 8, 5); x.lineTo(5 + i * 8, 0); x.lineTo(8 + i * 8, 5);
        x.closePath(); x.fill();
      }
    }),
    chest: cv(32, 28, (x) => {
      x.fillStyle = '#8a6238'; x.fillRect(3, 8, 26, 16);
      x.fillStyle = '#6d4a28'; x.fillRect(3, 8, 26, 5);
      x.fillStyle = '#c9a227'; x.fillRect(14, 13, 4, 6);
    }),
    bed: cv(32, 40, (x) => {
      x.fillStyle = '#8a6238'; x.fillRect(4, 4, 24, 32);
      x.fillStyle = '#5d9c46'; x.fillRect(6, 6, 20, 28);
      x.fillStyle = '#e8e0cc'; x.fillRect(6, 6, 20, 9);
    }),
    raft1: cv(64, 48, (x) => {
      x.fillStyle = '#a08058';
      for (let i = 0; i < 4; i++) x.fillRect(10, 14 + i * 7, 44, 5);
    }),
    raft2: cv(64, 48, (x) => {
      x.fillStyle = '#a08058';
      for (let i = 0; i < 4; i++) x.fillRect(10, 14 + i * 7, 44, 5);
      x.fillStyle = '#c0a070'; x.fillRect(16, 18, 32, 20);
    }),
    raft3: cv(64, 48, (x) => {
      x.fillStyle = '#a08058';
      for (let i = 0; i < 4; i++) x.fillRect(10, 14 + i * 7, 44, 5);
      x.fillStyle = '#c0a070'; x.fillRect(16, 18, 32, 20);
      x.fillStyle = '#6d4a28'; x.fillRect(30, 2, 4, 30);
    }),
    raft4: cv(64, 56, (x) => {
      x.fillStyle = '#a08058';
      for (let i = 0; i < 4; i++) x.fillRect(10, 24 + i * 7, 44, 5);
      x.fillStyle = '#c0a070'; x.fillRect(16, 28, 32, 20);
      x.fillStyle = '#6d4a28'; x.fillRect(30, 2, 4, 40);
      x.fillStyle = '#f0ead8';
      x.beginPath(); x.moveTo(34, 4); x.lineTo(56, 16); x.lineTo(34, 26);
      x.closePath(); x.fill();
    }),
    bag: cv(24, 24, (x) => {
      x.fillStyle = '#9a7448';
      x.beginPath(); x.arc(12, 14, 8, 0, 7); x.fill();
      x.fillStyle = '#6d4a28'; x.fillRect(9, 3, 6, 6);
    }),
  };
  // tint helper
  function tint(src, color, alpha) {
    return cv(src.width, src.height, (x) => {
      x.drawImage(src, 0, 0);
      x.globalCompositeOperation = 'source-atop';
      x.globalAlpha = alpha;
      x.fillStyle = color;
      x.fillRect(0, 0, src.width, src.height);
    });
  }
  A.props.campfire2 = tint(A.props.campfire, '#ff9040', 0.25);

  // ---------- ήρωας (fallback: απλός χαρακτήρας 3 όψεων) ----------
  function heroFrame(dir, step) {
    return cv(64, 64, (x) => {
      const legL = step % 2 === 0 ? 3 : -3;
      x.translate(32, 34);
      // πόδια
      x.fillStyle = '#7a5a3a';
      x.fillRect(-7, 14 + (dir === 'east' ? 0 : legL), 6, 12);
      x.fillRect(1, 14 - (dir === 'east' ? 0 : legL), 6, 12);
      // σώμα
      x.fillStyle = '#e8e0cc'; x.fillRect(-9, -6, 18, 20);
      // κεφάλι
      x.fillStyle = '#d8a878';
      x.beginPath(); x.arc(0, -14, 9, 0, 7); x.fill();
      x.fillStyle = '#3a2c1c';
      if (dir === 'south') x.fillRect(-9, -23, 18, 6);
      if (dir === 'north') { x.fillRect(-9, -23, 18, 10); }
      if (dir === 'east') { x.fillRect(-9, -23, 18, 6); x.fillRect(4, -20, 5, 6); }
      if (dir === 'south') {
        x.fillStyle = '#222';
        x.fillRect(-4, -15, 2, 2); x.fillRect(2, -15, 2, 2);
      }
    });
  }
  A.hero = {};
  for (const dir of ['south', 'north', 'east']) {
    A.hero[dir] = [0, 1, 2, 3].map(i => heroFrame(dir, i));
  }

  // ---------- mobs (fallback) ----------
  function mobBlob(color, eye, w = 48) {
    return cv(w, w, (x) => {
      x.fillStyle = color;
      x.beginPath(); x.ellipse(w / 2, w * 0.62, w * 0.36, w * 0.26, 0, 0, 7); x.fill();
      x.fillStyle = eye;
      x.fillRect(w * 0.62, w * 0.5, 4, 4);
    });
  }
  A.mobs = {
    crab: [mobBlob('#d84a30', '#111'), mobBlob('#c8402a', '#111')],
    boar: [mobBlob('#7a5638', '#fff', 56), mobBlob('#6d4c30', '#fff', 56)],
    shade: [mobBlob('#25242e', '#fff', 52), mobBlob('#1c1b26', '#fff', 52)],
  };

  // ---------- item icons (fallback: χρωματιστά κουτάκια με γράμμα) ----------
  const ICON_COLORS = {
    wood: '#9a6b3c', stone: '#8b8c86', fiber: '#b9c26a', berry: '#c93a3a',
    meat_raw: '#c96a6a', meat_cooked: '#9a5a2a', metal: '#a8a89a',
    resin: '#d8a020', rope: '#c0a070', cloth: '#e8e0cc', axe: '#7a8a96',
    pickaxe: '#7a8a96', spear: '#8a6238', torch: '#e8752a',
  };
  A.icons = {};
  for (const [k, col] of Object.entries(ICON_COLORS)) {
    A.icons[k] = cv(32, 32, (x) => {
      x.fillStyle = col;
      x.beginPath(); x.arc(16, 16, 11, 0, 7); x.fill();
      x.fillStyle = 'rgba(255,255,255,0.85)';
      x.font = 'bold 12px monospace';
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(k[0].toUpperCase(), 16, 17);
    });
  }

  A.ui = { titlebg: null, appicon: null };

  // ---------- PNG overrides ----------
  const OVERRIDES = [];
  function reg(key, apply) { OVERRIDES.push({ key, apply }); }

  /* Κάνει μια υφή πραγματικά wrap-able: σβήνει το seam αναμειγνύοντας
     μια λωρίδα κάθε άκρης με την απέναντι. */
  function wrapFix(img, band = 4) {
    const w = img.width, h = img.height;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.drawImage(img, 0, 0);
    try {
      const d = x.getImageData(0, 0, w, h);
      const px = d.data;
      const mix = (i1, i2, t) => {
        for (let k = 0; k < 3; k++) {
          px[i1 + k] = px[i1 + k] * (1 - t) + px[i2 + k] * t;
        }
      };
      for (let y = 0; y < h; y++) {
        for (let b = 0; b < band; b++) {
          const t = 0.5 * (1 - b / band);
          mix((y * w + b) * 4, (y * w + (w - 1 - b)) * 4, t);
          mix((y * w + (w - 1 - b)) * 4, (y * w + b) * 4, t);
        }
      }
      for (let xx = 0; xx < w; xx++) {
        for (let b = 0; b < band; b++) {
          const t = 0.5 * (1 - b / band);
          mix((b * w + xx) * 4, ((h - 1 - b) * w + xx) * 4, t);
          mix(((h - 1 - b) * w + xx) * 4, (b * w + xx) * 4, t);
        }
      }
      x.putImageData(d, 0, 0);
    } catch (e) { /* tainted canvas σε file:// — κρατάμε την υφή ως έχει */ }
    return c;
  }

  for (const k of Object.keys(A.tiles)) {
    reg(k, img => { A.tiles[k] = img; });   // hex_* PNG απευθείας
  }
  for (const k of Object.keys(A.props)) reg(`prop_${k}`, img => { A.props[k] = img; });
  for (const k of Object.keys(A.icons)) reg(`icon_${k}`, img => { A.icons[k] = img; });
  for (const dir of ['south', 'north', 'east']) {
    const slots = [null, null, null, null];
    for (let n = 1; n <= 4; n++) {
      reg(`hero_${dir}_walk${n}`, img => {
        slots[n - 1] = img;
        const frames = slots.filter(Boolean);
        if (frames.length) A.hero[dir] = frames;
      });
    }
  }
  for (const m of Object.keys(A.mobs)) {
    const slots = [null, null, null, null];
    for (let n = 1; n <= 4; n++) {
      reg(`mob_${m}_walk${n}`, img => {
        slots[n - 1] = img;
        const frames = slots.filter(Boolean);
        if (frames.length) A.mobs[m] = frames;
      });
    }
  }
  reg('ui_titlebg', img => { A.ui.titlebg = img; });
  reg('ui_appicon', img => { A.ui.appicon = img; });

  A.OVERRIDE_KEYS = OVERRIDES.map(o => o.key);
  A.loadOverrides = function (done) {
    let pending = OVERRIDES.length;
    if (!pending) { done && done(); return; }
    for (const o of OVERRIDES) {
      const img = new Image();
      img.onload = () => { o.apply(img); if (--pending === 0) done && done(); };
      img.onerror = () => { if (--pending === 0) done && done(); };
      img.src = 'assets/' + o.key + '.png';
    }
  };

  return A;
})();
