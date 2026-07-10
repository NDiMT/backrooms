/* DEAD ZONE — Synthesized audio (WebAudio, no sound files).
   Gunshots are layered for realism: mechanical click + low-end kick +
   high crack + mid body + decaying room tail. */

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
    // ήπιος limiter για να μην ψαλιδίζουν οι ριπές
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 6;
    comp.attack.value = 0.002;
    comp.release.value = 0.12;
    master.connect(comp);
    comp.connect(ctx.destination);

    // ---- ambient: βαθύ drone μηχανών + σφύριγμα εξαερισμού ----
    ambGain = ctx.createGain();
    ambGain.gain.value = 0.07;
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
    const hg = ctx.createGain(); hg.gain.value = 0.007;
    hiss.connect(hf); hf.connect(hg); hg.connect(master);
    hiss.start();
  }

  // ---------- δομικά στοιχεία ----------
  function osc(type, f0, f1, dur, vol, delay) {
    const t = ctx.currentTime + (delay || 0);
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function noise(filterType, freq, q, dur, vol, delay, freqEnd) {
    const t = ctx.currentTime + (delay || 0);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(dur + 0.05);
    const f = ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.setValueAtTime(freq, t);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t);
  }

  /* Ρεαλιστικός πυροβολισμός: click + kick + crack + body + tail. */
  function gunshot(o) {
    if (!started) return;
    // μηχανικό click (σκανδάλη/κλείστρο)
    noise('highpass', 5000, 1, 0.018, o.click ?? 0.10);
    // low-end kick — το «σώμα» της εκπυρσοκρότησης
    osc('sine', o.kickF ?? 160, 42, o.kickDur ?? 0.11, o.kick ?? 0.5);
    // κοφτό crack ψηλών
    noise('highpass', o.crackF ?? 2400, 0.8, o.crackDur ?? 0.05, o.crack ?? 0.4);
    // μεσαίο body
    noise('bandpass', o.bodyF ?? 550, 1.2, o.bodyDur ?? 0.14, o.body ?? 0.32);
    // ουρά χώρου (μακρύ, χαμηλό)
    noise('lowpass', o.tailF ?? 900, 0.7, o.tailDur ?? 0.5, o.tail ?? 0.13, 0.015, 220);
  }

  const fireSounds = {
    pistol: () => gunshot({ kick: 0.4, kickF: 150, crack: 0.32, crackF: 2800,
                            bodyDur: 0.1, tailDur: 0.34, tail: 0.09 }),
    smg: () => gunshot({ kick: 0.3, kickF: 140, kickDur: 0.07, crack: 0.26,
                         crackDur: 0.035, bodyDur: 0.07, tailDur: 0.22, tail: 0.06 }),
    shotgun: () => {
      gunshot({ kick: 0.75, kickF: 120, kickDur: 0.16, crack: 0.5, crackF: 1900,
                crackDur: 0.08, body: 0.5, bodyF: 380, bodyDur: 0.22,
                tail: 0.2, tailDur: 0.7 });
      // κλικ της τρόμπας
      noise('highpass', 3500, 2, 0.03, 0.16, 0.28);
      noise('highpass', 3000, 2, 0.03, 0.14, 0.38);
    },
    handcannon: () => gunshot({ kick: 0.85, kickF: 170, kickDur: 0.15,
                                crack: 0.55, crackF: 2200, crackDur: 0.07,
                                body: 0.45, bodyF: 420, bodyDur: 0.2,
                                tail: 0.22, tailDur: 0.8 }),
    pulse: () => {
      if (!started) return;
      osc('sawtooth', 1100, 320, 0.08, 0.14);
      osc('square', 2200, 900, 0.05, 0.06);
      noise('highpass', 3200, 1, 0.03, 0.12);
      osc('sine', 130, 60, 0.07, 0.22);
    },
    railgun: () => {
      if (!started) return;
      // charge-whine → βαρύ κρότο → ηλεκτρικό sizzle
      osc('sawtooth', 300, 3200, 0.09, 0.10);
      osc('sine', 190, 36, 0.22, 0.8, 0.08);
      noise('highpass', 1600, 0.6, 0.14, 0.5, 0.08);
      noise('bandpass', 5200, 4, 0.3, 0.16, 0.1, 900);
      noise('lowpass', 700, 0.7, 0.9, 0.2, 0.12, 160);
    },
    incinerator: () => {
      if (!started) return;
      noise('bandpass', 900, 0.7, 0.2, 0.3, 0, 350);
      noise('lowpass', 500, 0.8, 0.28, 0.16, 0.02, 120);
      osc('sine', 220, 90, 0.16, 0.12);
    },
    arccaster: () => {
      if (!started) return;
      // κροταλιστή εκκένωση
      for (let i = 0; i < 5; i++) {
        noise('highpass', 3800 + Math.random() * 2000, 3, 0.02, 0.22, i * 0.022);
      }
      osc('sawtooth', 700, 90, 0.14, 0.2);
      osc('sine', 120, 50, 0.12, 0.3);
    },
    launcher: () => {
      if (!started) return;
      osc('sine', 90, 38, 0.35, 0.5);
      noise('lowpass', 600, 0.7, 0.3, 0.3, 0, 150);
      osc('sawtooth', 480, 130, 0.2, 0.1);
    },
  };

  return {
    start,
    fire(kind) { (fireSounds[kind] || fireSounds.pistol)(); },
    dryFire() { if (started) noise('highpass', 4200, 2, 0.03, 0.14); },
    arcChain() { if (started) { noise('highpass', 5000, 3, 0.03, 0.14); noise('highpass', 4200, 3, 0.03, 0.1, 0.03); } },
    explosion() {
      if (!started) return;
      osc('sine', 130, 30, 0.5, 0.7);
      noise('lowpass', 900, 0.6, 0.7, 0.55, 0, 120);
      noise('highpass', 2000, 0.7, 0.12, 0.3);
    },
    hitMarker() { if (started) noise('highpass', 2600, 3, 0.025, 0.10); },
    enemyPain() { if (started) { osc('sawtooth', 300, 150, 0.15, 0.08); noise('bandpass', 800, 1, 0.1, 0.05); } },
    enemyDie(type) {
      if (!started) return;
      if (type === 'drone') { osc('sawtooth', 1400, 100, 0.3, 0.12); noise('bandpass', 2000, 1, 0.2, 0.1); }
      else if (type === 'boss') { osc('sawtooth', 200, 25, 1.4, 0.3); noise('lowpass', 400, 0.7, 1.3, 0.4, 0, 60); }
      else { osc('sawtooth', 220, 60, 0.45, 0.13); noise('lowpass', 700, 0.8, 0.4, 0.15, 0, 150); }
    },
    enemyAlert(type) {
      if (!started) return;
      if (type === 'drone') osc('square', 800, 1400, 0.2, 0.06);
      else osc('sawtooth', 120, 220, 0.35, 0.09);
    },
    enemyFire(type) {
      if (!started) return;
      if (type === 'spitter') { osc('sine', 500, 200, 0.2, 0.09); noise('bandpass', 900, 1, 0.14, 0.08); }
      else gunshot({ kick: 0.2, kickF: 130, crack: 0.15, crackF: 2000,
                     bodyDur: 0.08, tail: 0.05, tailDur: 0.2, click: 0.04 });
    },
    bossFire() { if (started) { osc('sawtooth', 300, 90, 0.3, 0.16); noise('bandpass', 700, 1, 0.2, 0.12); } },
    bossRoar() { if (started) { osc('sawtooth', 90, 45, 1.2, 0.3); noise('lowpass', 300, 0.8, 1.1, 0.3, 0, 80); } },
    playerPain() { if (started) { osc('square', 250, 110, 0.2, 0.14); noise('lowpass', 600, 1, 0.15, 0.1, 0, 200); } },
    playerDie() { if (started) { osc('sawtooth', 300, 40, 1.0, 0.25); noise('lowpass', 500, 0.8, 0.9, 0.3, 0, 100); } },
    pickup() { if (started) osc('sine', 700, 1100, 0.15, 0.12); },
    scrapPickup() { if (started) osc('square', 1100, 1500, 0.08, 0.07); },
    weaponPickup() { if (started) { osc('square', 300, 700, 0.3, 0.14); noise('bandpass', 1500, 1, 0.15, 0.08); } },
    doorOpen() { if (started) { osc('sawtooth', 90, 220, 0.5, 0.06); noise('lowpass', 400, 0.7, 0.45, 0.12, 0, 150); } },
    elevator() { if (started) { osc('sine', 200, 500, 0.9, 0.14); noise('bandpass', 800, 1, 0.6, 0.1); } },
    uiClick() { if (started) noise('highpass', 3200, 2, 0.025, 0.08); },
    perk() { if (started) { osc('sine', 500, 1000, 0.5, 0.14); osc('sine', 750, 1500, 0.5, 0.08, 0.06); } },
    win() {
      if (!started) return;
      [523, 659, 784, 1046].forEach((f, i) => {
        osc('sine', f, f * 0.99, 0.8, 0.12, i * 0.14);
      });
    },
  };
})();
