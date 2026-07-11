/* DEEPER — WebAudio synth: ήχοι δράσης + liminal ambience (βουητό
   κλιματισμού + τρεμόπαιγμα φθορισμού). Κανένα αρχείο ήχου. */

const GameAudio = (() => {
  let ctx = null, master = null, started = false;
  let hum = null, buzz = null, flickerT = null;

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
    master.gain.value = 0.75;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 5;
    master.connect(comp); comp.connect(ctx.destination);

    // βουητό κτηρίου: χαμηλό sawtooth μέσα από lowpass
    hum = ctx.createGain(); hum.gain.value = 0.03; hum.connect(master);
    const h1 = ctx.createOscillator(); h1.type = 'sawtooth'; h1.frequency.value = 46;
    const h2 = ctx.createOscillator(); h2.type = 'sine'; h2.frequency.value = 92.5;
    const hf = ctx.createBiquadFilter(); hf.type = 'lowpass'; hf.frequency.value = 160;
    h1.connect(hf); h2.connect(hf); hf.connect(hum);
    h1.start(); h2.start();

    // φθορισμός: ψιλό bandpass noise που τρεμοπαίζει
    buzz = ctx.createGain(); buzz.gain.value = 0.006; buzz.connect(master);
    const bn = ctx.createBufferSource(); bn.buffer = noiseBuffer(2); bn.loop = true;
    const bf = ctx.createBiquadFilter(); bf.type = 'bandpass';
    bf.frequency.value = 5600; bf.Q.value = 14;
    bn.connect(bf); bf.connect(buzz); bn.start();
    flickerT = setInterval(() => {
      if (!started || ctx.state !== 'running') return;
      if (Math.random() < 0.25) {
        const t = ctx.currentTime;
        buzz.gain.setValueAtTime(0.02, t);
        buzz.gain.exponentialRampToValueAtTime(0.006, t + 0.18);
      }
    }, 700);
  }

  /* βάθος 0..1: πιο σκοτεινά = πιο έντονο βουητό, πιο αχνός φθορισμός */
  function setDark(a) {
    if (!started) return;
    hum.gain.value = 0.02 + a * 0.035;
  }

  function osc(type, f0, f1, dur, vol, delay) {
    if (!started) return;
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
    if (!started) return;
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

  return {
    start, setDark,
    hit(kind) {
      if (kind === 'crate') { noise('lowpass', 900, 1, 0.08, 0.25, 0, 300); osc('square', 140, 90, 0.06, 0.1); }
      else { noise('highpass', 2400, 2, 0.05, 0.2); osc('square', 220, 140, 0.05, 0.08); }
    },
    swing() { noise('bandpass', 900, 1.2, 0.09, 0.08, 0, 300); },
    scrap() { osc('square', 880, 1320, 0.07, 0.09); },
    pickup() { osc('sine', 660, 990, 0.11, 0.12); },
    medkit() { [523, 659].forEach((f, i) => osc('sine', f, f, 0.25, 0.1, i * 0.1)); },
    keycard() { osc('square', 440, 880, 0.15, 0.12); osc('square', 880, 1760, 0.12, 0.08, 0.12); },
    core() { [392, 523, 784].forEach((f, i) => osc('sine', f, f * 1.01, 0.4, 0.1, i * 0.08)); },
    elevator() { osc('sine', 784, 784, 0.35, 0.12); osc('sine', 988, 988, 0.4, 0.1, 0.2); },
    descend() { noise('lowpass', 400, 1, 1.1, 0.22, 0, 90); osc('sine', 180, 55, 1.1, 0.1); },
    vaultOpen() { osc('square', 220, 440, 0.3, 0.12); [659, 880, 1046].forEach((f, i) => osc('sine', f, f, 0.35, 0.1, 0.25 + i * 0.1)); },
    mobHurt() { osc('sawtooth', 320, 180, 0.12, 0.1); },
    mobDie(boss) {
      osc('sawtooth', boss ? 180 : 260, 50, boss ? 0.7 : 0.35, 0.15);
      noise('lowpass', 800, 1, 0.3, 0.12, 0, 200);
    },
    bossNear() { osc('sawtooth', 70, 45, 1.4, 0.15); },
    playerHurt() { osc('square', 240, 120, 0.16, 0.16); noise('lowpass', 600, 1, 0.12, 0.1); },
    playerDie() { osc('sawtooth', 300, 40, 0.9, 0.2); },
    shadeNear() { osc('sine', 90, 60, 0.8, 0.1); },
    cashout() { [523, 659, 784, 1046].forEach((f, i) => osc('sine', f, f * 0.995, 0.5, 0.11, i * 0.11)); },
    upgrade() { osc('square', 440, 660, 0.08, 0.1); osc('square', 660, 880, 0.08, 0.08, 0.09); },
    uiClick() { noise('highpass', 3000, 2, 0.03, 0.08); },
    error() { osc('square', 180, 140, 0.12, 0.1); },
  };
})();
