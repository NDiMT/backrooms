/* DEEPER — Assets: procedural fallbacks + PNG overrides από assets/.
   Κάθε γραφικό ζωγραφίζεται σε offscreen canvas ώστε το παιχνίδι να
   δουλεύει και χωρίς PNG· αν υπάρχει assets/<key>.png το αντικαθιστά.
   Επαναχρησιμοποιούμε τα PixelLab sprites του ήρωα και του shade. */

const Assets = (() => {
  const A = {};
  const TS = 26;      // μέγεθος tile art (ίδιο με World.PPU)

  function cv(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    return c;
  }

  // ντετερμινιστικό «θόρυβο» για ψηφίδες στα tiles
  function speck(x, seed, w, h, color, n) {
    x.fillStyle = color;
    let a = seed;
    for (let i = 0; i < n; i++) {
      a = (a * 1103515245 + 12345) & 0x7fffffff;
      const px = a % w;
      a = (a * 1103515245 + 12345) & 0x7fffffff;
      const py = a % h;
      x.fillRect(px, py, 1, 1);
    }
  }

  // ---------- biome tiles (procedural, με cache ανά biome) ----------
  const tileCache = new Map();
  A.biomeTiles = function (biome) {
    let ts = tileCache.get(biome.key);
    if (ts) return ts;

    const floorTile = (base, alt) => cv(TS, TS, (x) => {
      x.fillStyle = base; x.fillRect(0, 0, TS, TS);
      speck(x, 7 + base.length, TS, TS, 'rgba(0,0,0,0.13)', 14);
      speck(x, 3, TS, TS, 'rgba(255,255,255,0.05)', 8);
      x.strokeStyle = 'rgba(0,0,0,0.12)';
      x.strokeRect(0.5, 0.5, TS - 1, TS - 1);
      if (alt) { x.fillStyle = 'rgba(0,0,0,0.06)'; x.fillRect(0, 0, TS, TS); }
    });

    const wall = cv(TS, TS, (x) => {
      x.fillStyle = biome.wall; x.fillRect(0, 0, TS, TS);
      x.fillStyle = biome.wallTop; x.fillRect(0, 0, TS, 7);
      x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, TS - 4, TS, 4);
      speck(x, 11, TS, TS, 'rgba(0,0,0,0.18)', 10);
      // αρμοί
      x.fillStyle = 'rgba(0,0,0,0.2)';
      x.fillRect(0, 12, TS, 1); x.fillRect(TS / 2, 7, 1, 5); x.fillRect(6, 13, 1, 9);
    });

    const elev = (open) => cv(TS, TS, (x) => {
      x.fillStyle = '#2a2a30'; x.fillRect(0, 0, TS, TS);
      x.fillStyle = '#3c3c46'; x.fillRect(2, 2, TS - 4, TS - 4);
      // πόρτες
      x.fillStyle = open ? biome.accent : '#585866';
      x.fillRect(4, 4, TS / 2 - 5, TS - 8);
      x.fillRect(TS / 2 + 1, 4, TS / 2 - 5, TS - 8);
      x.fillStyle = 'rgba(0,0,0,0.5)';
      x.fillRect(TS / 2 - 1, 4, 2, TS - 8);
      // λαμπάκι
      x.fillStyle = open ? '#8f8' : '#f66';
      x.fillRect(TS / 2 - 1, 1, 2, 2);
    });

    const vaultDoor = cv(TS, TS, (x) => {
      x.fillStyle = biome.wall; x.fillRect(0, 0, TS, TS);
      x.fillStyle = '#c9a227'; x.fillRect(2, 2, TS - 4, TS - 4);
      x.fillStyle = '#8a6d10'; x.fillRect(4, 4, TS - 8, TS - 8);
      x.fillStyle = '#ffe86a';
      x.fillRect(TS / 2 - 2, TS / 2 - 5, 4, 6);
      x.beginPath(); x.arc(TS / 2, TS / 2 - 5, 3.4, Math.PI, 0); x.stroke();
      x.strokeStyle = '#ffe86a'; x.lineWidth = 2;
      x.beginPath(); x.arc(TS / 2, TS / 2 - 5, 3.4, Math.PI, 0); x.stroke();
    });

    const vaultFloor = cv(TS, TS, (x) => {
      x.fillStyle = '#4a4436'; x.fillRect(0, 0, TS, TS);
      speck(x, 5, TS, TS, 'rgba(255,232,106,0.16)', 9);
      x.strokeStyle = 'rgba(201,162,39,0.35)';
      x.strokeRect(0.5, 0.5, TS - 1, TS - 1);
    });

    ts = {
      floorA: floorTile(biome.floorA, false),
      floorB: floorTile(biome.floorB, true),
      wall,
      elevIn: elev(false),
      elevOut: elev(true),
      vaultDoor,
      vaultFloor,
    };
    tileCache.set(biome.key, ts);
    return ts;
  };

  // ---------- ήρωας (fallback: απλός χαρακτήρας 3 όψεων) ----------
  function heroFrame(dir, step) {
    return cv(64, 64, (x) => {
      const legL = step % 2 === 0 ? 3 : -3;
      x.translate(32, 34);
      x.fillStyle = '#4a4438';
      x.fillRect(-7, 14 + (dir === 'east' ? 0 : legL), 6, 12);
      x.fillRect(1, 14 - (dir === 'east' ? 0 : legL), 6, 12);
      x.fillStyle = '#c8b878'; x.fillRect(-9, -6, 18, 20);   // hi-vis γιλέκο
      x.fillStyle = '#d8a878';
      x.beginPath(); x.arc(0, -14, 9, 0, 7); x.fill();
      x.fillStyle = '#3a2c1c';
      if (dir === 'south') x.fillRect(-9, -23, 18, 6);
      if (dir === 'north') x.fillRect(-9, -23, 18, 10);
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

  // ---------- shade (fallback blob· τα PNG walk frames το αντικαθιστούν) ----------
  function shadeBlob(c1, eye, w = 52) {
    return cv(w, w, (x) => {
      x.fillStyle = c1;
      x.beginPath(); x.ellipse(w / 2, w * 0.62, w * 0.36, w * 0.3, 0, 0, 7); x.fill();
      x.fillStyle = eye;
      x.fillRect(w * 0.38, w * 0.5, 4, 4);
      x.fillRect(w * 0.58, w * 0.5, 4, 4);
    });
  }
  A.mobs = {
    shade: [shadeBlob('#25242e', '#fff'), shadeBlob('#1c1b26', '#fff')],
  };

  // ---------- props ----------
  A.props = {
    pile: cv(30, 26, (x) => {
      x.fillStyle = '#7b7c76';
      x.beginPath(); x.ellipse(15, 18, 12, 7, 0, 0, 7); x.fill();
      x.fillStyle = '#9c9d97';
      x.fillRect(6, 10, 8, 4); x.fillRect(16, 12, 9, 3); x.fillRect(11, 6, 6, 5);
      x.fillStyle = '#c9a227'; x.fillRect(18, 8, 4, 3);
    }),
    crate: cv(28, 26, (x) => {
      x.fillStyle = '#8a6238'; x.fillRect(2, 4, 24, 20);
      x.fillStyle = '#6d4a28'; x.fillRect(2, 4, 24, 5);
      x.strokeStyle = '#5a3d20'; x.lineWidth = 2;
      x.strokeRect(3, 5, 22, 18);
      x.beginPath(); x.moveTo(3, 5); x.lineTo(25, 23); x.stroke();
      x.beginPath(); x.moveTo(25, 5); x.lineTo(3, 23); x.stroke();
    }),
  };

  // ---------- pickup icons ----------
  A.icons = {
    scrap: cv(32, 32, (x) => {
      x.fillStyle = '#c8c8b8';
      x.beginPath(); x.arc(16, 16, 9, 0, 7); x.fill();
      x.fillStyle = '#8a8a7a';
      x.beginPath(); x.arc(16, 16, 4, 0, 7); x.fill();
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2;
        x.fillStyle = '#c8c8b8';
        x.fillRect(16 + Math.cos(a) * 10 - 2, 16 + Math.sin(a) * 10 - 2, 4, 4);
      }
    }),
    core: cv(32, 32, (x) => {
      const g = x.createRadialGradient(16, 16, 2, 16, 16, 11);
      g.addColorStop(0, '#e8b0ff'); g.addColorStop(1, '#7a30b0');
      x.fillStyle = g;
      x.beginPath(); x.arc(16, 16, 10, 0, 7); x.fill();
      x.fillStyle = 'rgba(255,255,255,0.8)';
      x.beginPath(); x.arc(13, 12, 3, 0, 7); x.fill();
    }),
    medkit: cv(32, 32, (x) => {
      x.fillStyle = '#e8e4d8'; x.fillRect(5, 8, 22, 18);
      x.fillStyle = '#c8302a';
      x.fillRect(13, 11, 6, 12); x.fillRect(10, 14, 12, 6);
    }),
    keycard: cv(32, 32, (x) => {
      x.fillStyle = '#2a6ac8'; x.fillRect(6, 9, 20, 14);
      x.fillStyle = '#ffe86a'; x.fillRect(9, 12, 6, 5);
      x.fillStyle = '#fff'; x.fillRect(9, 19, 14, 2);
    }),
    battery: cv(32, 32, (x) => {
      x.fillStyle = '#3a9c46'; x.fillRect(9, 8, 14, 20);
      x.fillStyle = '#2a6c32'; x.fillRect(13, 5, 6, 3);
      x.fillStyle = '#c8f0a0';
      x.beginPath();
      x.moveTo(18, 11); x.lineTo(13, 19); x.lineTo(16, 19);
      x.lineTo(14, 25); x.lineTo(19, 17); x.lineTo(16, 17);
      x.closePath(); x.fill();
    }),
  };

  A.ui = { titlebg: null };

  // ---------- PNG overrides ----------
  const OVERRIDES = [];
  function reg(key, apply) { OVERRIDES.push({ key, apply }); }

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
  {
    const slots = [null, null, null, null];
    for (let n = 1; n <= 4; n++) {
      reg(`mob_shade_walk${n}`, img => {
        slots[n - 1] = img;
        const frames = slots.filter(Boolean);
        if (frames.length) A.mobs.shade = frames;
      });
    }
  }
  for (const k of Object.keys(A.props)) reg(`prop_deeper_${k}`, img => { A.props[k] = img; });
  for (const k of Object.keys(A.icons)) reg(`icon_deeper_${k}`, img => { A.icons[k] = img; });
  reg('ui_deeper_titlebg', img => { A.ui.titlebg = img; });

  A.OVERRIDE_KEYS = OVERRIDES.map(o => o.key);
  A.loadOverrides = function (done) {
    let pending = OVERRIDES.length;
    if (!pending) { done && done(); return; }
    // single-file builds (scripts/build-single.cjs) περνούν τα PNG
    // inline ως data URIs μέσω window.__ASSET_DATA — τότε ό,τι λείπει
    // από το map δεν υπάρχει, οπότε δεν χτυπάμε το δίκτυο καθόλου
    const embedded = window.__ASSET_DATA;
    for (const o of OVERRIDES) {
      if (embedded && !embedded[o.key]) {
        if (--pending === 0) done && done();
        continue;
      }
      const img = new Image();
      img.onload = () => { o.apply(img); if (--pending === 0) done && done(); };
      img.onerror = () => { if (--pending === 0) done && done(); };
      img.src = embedded ? embedded[o.key] : ('assets/' + o.key + '.png');
    }
  };

  return A;
})();
