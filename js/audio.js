/* DRIFTLAND — WebAudio synth: ήχοι δράσης + ημέρας/νύχτας ambience.
   Κανένα αρχείο ήχου. */

const GameAudio = (() => {
  let ctx = null, master = null, started = false;
  let ambDay = null, ambNight = null;

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

    // κύματα (μέρα): αργό filtered noise LFO
    ambDay = ctx.createGain(); ambDay.gain.value = 0.05; ambDay.connect(master);
    const waves = ctx.createBufferSource();
    waves.buffer = noiseBuffer(4); waves.loop = true;
    const wf = ctx.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 420;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.14;
    const lg = ctx.createGain(); lg.gain.value = 0.03;
    lfo.connect(lg); lg.connect(ambDay.gain);
    waves.connect(wf); wf.connect(ambDay); waves.start(); lfo.start();

    // τριζόνια (νύχτα)
    ambNight = ctx.createGain(); ambNight.gain.value = 0; ambNight.connect(master);
    const cr = ctx.createBufferSource();
    cr.buffer = noiseBuffer(2); cr.loop = true;
    const cf = ctx.createBiquadFilter(); cf.type = 'bandpass';
    cf.frequency.value = 4200; cf.Q.value = 18;
    const clfo = ctx.createOscillator(); clfo.frequency.value = 9;
    const clg = ctx.createGain(); clg.gain.value = 0.012;
    clfo.connect(clg); clg.connect(ambNight.gain);
    cr.connect(cf); cf.connect(ambNight); cr.start(); clfo.start();
  }

  function setNight(nightAmount) {
    if (!started) return;
    ambDay.gain.value = 0.05 * (1 - nightAmount) + 0.012;
    ambNight.gain.value = 0.02 * nightAmount;
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
    start, setNight,
    hit(kind) {
      if (kind === 'rock') { noise('highpass', 2400, 2, 0.05, 0.2); osc('square', 220, 140, 0.05, 0.08); }
      else if (kind === 'tree' || kind === 'palm') { noise('lowpass', 900, 1, 0.08, 0.25, 0, 300); osc('square', 140, 90, 0.06, 0.1); }
      else noise('bandpass', 1200, 1.5, 0.06, 0.14);
    },
    swing() { noise('bandpass', 900, 1.2, 0.09, 0.08, 0, 300); },
    pickup() { osc('sine', 660, 990, 0.11, 0.12); },
    eat() { noise('lowpass', 500, 1, 0.12, 0.16); osc('sine', 300, 180, 0.1, 0.08); },
    craft() { osc('square', 440, 660, 0.08, 0.1); osc('square', 660, 880, 0.08, 0.08, 0.09); },
    build() { noise('lowpass', 700, 1, 0.15, 0.2, 0, 200); osc('square', 180, 120, 0.12, 0.12); },
    mobHurt() { osc('sawtooth', 320, 180, 0.12, 0.1); },
    mobDie() { osc('sawtooth', 260, 60, 0.35, 0.14); noise('lowpass', 800, 1, 0.3, 0.12, 0, 200); },
    playerHurt() { osc('square', 240, 120, 0.16, 0.16); noise('lowpass', 600, 1, 0.12, 0.1); },
    playerDie() { osc('sawtooth', 300, 40, 0.9, 0.2); },
    shadeNear() { osc('sine', 90, 60, 0.8, 0.1); },
    nightFall() { osc('sine', 220, 110, 1.2, 0.12); osc('sine', 165, 82, 1.2, 0.1, 0.15); },
    dawn() { [392, 523, 659].forEach((f, i) => osc('sine', f, f, 0.5, 0.09, i * 0.12)); },
    uiClick() { noise('highpass', 3000, 2, 0.03, 0.08); },
    error() { osc('square', 180, 140, 0.12, 0.1); },
    sleep() { [330, 262, 196].forEach((f, i) => osc('sine', f, f, 0.6, 0.08, i * 0.2)); },
    win() { [523, 659, 784, 1046, 1318].forEach((f, i) => osc('sine', f, f * 0.995, 0.7, 0.11, i * 0.15)); },
    raftBuild() { osc('square', 330, 495, 0.2, 0.12); noise('lowpass', 800, 1, 0.2, 0.15, 0, 250); },
  };
})();
