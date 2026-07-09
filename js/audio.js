/* ΝΕΚΡΗ ΖΩΝΗ — Συνθετικός ήχος WebAudio (κανένα αρχείο ήχου).
   Ξεκινά μετά από user gesture. */

const GameAudio = (() => {
  let ctx = null, master = null, started = false;
  let ambGain = null;

  function noiseBuffer(seconds) {
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  function start() {
    if (started) { if (ctx.state === 'suspended') ctx.resume(); return; }
    started = true;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.8;
    master.connect(ctx.destination);

    // ---- ambient: βαθύ drone μηχανών + σφύριγμα εξαερισμού ----
    ambGain = ctx.createGain();
    ambGain.gain.value = 0.08;
    ambGain.connect(master);
    const d1 = ctx.createOscillator(); d1.type = 'sawtooth'; d1.frequency.value = 36;
    const d2 = ctx.createOscillator(); d2.type = 'sine'; d2.frequency.value = 37.5;
    const df = ctx.createBiquadFilter(); df.type = 'lowpass'; df.frequency.value = 160;
    d1.connect(df); d2.connect(df); df.connect(ambGain);
    d1.start(); d2.start();
    const hiss = ctx.createBufferSource();
    hiss.buffer = noiseBuffer(2); hiss.loop = true;
    const hf = ctx.createBiquadFilter(); hf.type = 'bandpass';
    hf.frequency.value = 3200; hf.Q.value = 3;
    const hg = ctx.createGain(); hg.gain.value = 0.008;
    hiss.connect(hf); hf.connect(hg); hg.connect(master);
    hiss.start();
  }

  function blast(dur, freq0, freq1, type, vol, noiseVol, noiseFreq) {
    if (!started) return;
    const t = ctx.currentTime;
    if (vol > 0) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(freq0, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, freq1), t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + dur + 0.05);
    }
    if (noiseVol > 0) {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(dur);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = noiseFreq || 1200;
      const g = ctx.createGain();
      g.gain.setValueAtTime(noiseVol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(f); f.connect(g); g.connect(master);
      src.start(t);
    }
  }

  const fireSounds = {
    pistol:   () => blast(0.14, 400, 120, 'square', 0.12, 0.22, 2500),
    shotgun:  () => blast(0.35, 180, 50, 'square', 0.2, 0.5, 900),
    rifle:    () => blast(0.09, 900, 300, 'sawtooth', 0.14, 0.08, 4000),
    launcher: () => blast(0.4, 90, 40, 'sine', 0.25, 0.15, 500),
  };

  return {
    start,
    fire(kind) { (fireSounds[kind] || fireSounds.pistol)(); },
    dryFire() { blast(0.06, 800, 500, 'square', 0.05, 0, 0); },
    explosion() { blast(0.6, 100, 30, 'sawtooth', 0.25, 0.55, 600); },
    hitMarker() { blast(0.05, 1200, 900, 'square', 0.06, 0, 0); },
    enemyPain() { blast(0.15, 300, 150, 'sawtooth', 0.08, 0.05, 800); },
    enemyDie(type) {
      if (type === 'drone') blast(0.3, 1400, 100, 'sawtooth', 0.12, 0.1, 2000);
      else if (type === 'boss') { blast(1.4, 200, 25, 'sawtooth', 0.3, 0.5, 400); }
      else blast(0.45, 220, 60, 'sawtooth', 0.13, 0.15, 700);
    },
    enemyAlert(type) {
      if (type === 'drone') blast(0.2, 800, 1400, 'square', 0.06, 0, 0);
      else blast(0.35, 120, 220, 'sawtooth', 0.09, 0.05, 500);
    },
    enemyFire(type) {
      if (type === 'spitter') blast(0.2, 500, 200, 'sine', 0.09, 0.1, 900);
      else blast(0.12, 700, 350, 'square', 0.08, 0.04, 2000);
    },
    bossFire() { blast(0.3, 300, 90, 'sawtooth', 0.16, 0.12, 700); },
    bossRoar() { blast(1.2, 90, 45, 'sawtooth', 0.3, 0.3, 300); },
    playerPain() { blast(0.2, 250, 110, 'square', 0.14, 0.1, 600); },
    playerDie() { blast(1.0, 300, 40, 'sawtooth', 0.25, 0.3, 500); },
    pickup() { blast(0.15, 700, 1100, 'sine', 0.12, 0, 0); },
    scrapPickup() { blast(0.08, 1100, 1500, 'square', 0.07, 0, 0); },
    weaponPickup() { blast(0.3, 300, 700, 'square', 0.14, 0.08, 1500); },
    doorOpen() { blast(0.5, 90, 220, 'sawtooth', 0.06, 0.12, 400); },
    elevator() { blast(0.9, 200, 500, 'sine', 0.14, 0.1, 800); },
    uiClick() { blast(0.05, 900, 700, 'square', 0.06, 0, 0); },
    perk() { blast(0.5, 500, 1000, 'sine', 0.14, 0, 0); },
    win() {
      [523, 659, 784, 1046].forEach((f, i) => {
        setTimeout(() => blast(0.8, f, f * 0.99, 'sine', 0.12, 0, 0), i * 140);
      });
    },
  };
})();
