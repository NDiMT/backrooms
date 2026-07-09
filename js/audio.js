/* Όλος ο ήχος συντίθεται με WebAudio — κανένα αρχείο ήχου.
   Ξεκινά μετά από user gesture (click στο start). */

const GameAudio = (() => {
  let ctx = null;
  let master, humGain, droneGain, heartGain;
  let humOsc, humLFO;
  let started = false;

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
    master.gain.value = 0.9;
    master.connect(ctx.destination);

    /* --- Βουητό λαμπών φθορίου: πριονωτό 120 Hz + φιλτραρισμένος θόρυβος --- */
    humGain = ctx.createGain();
    humGain.gain.value = 0.05;
    humGain.connect(master);

    humOsc = ctx.createOscillator();
    humOsc.type = 'sawtooth';
    humOsc.frequency.value = 120;
    const humFilter = ctx.createBiquadFilter();
    humFilter.type = 'lowpass';
    humFilter.frequency.value = 320;
    humOsc.connect(humFilter);
    humFilter.connect(humGain);
    humOsc.start();

    const hiss = ctx.createBufferSource();
    hiss.buffer = noiseBuffer(2);
    hiss.loop = true;
    const hissFilter = ctx.createBiquadFilter();
    hissFilter.type = 'bandpass';
    hissFilter.frequency.value = 2400;
    hissFilter.Q.value = 2;
    const hissGain = ctx.createGain();
    hissGain.gain.value = 0.012;
    hiss.connect(hissFilter);
    hissFilter.connect(hissGain);
    hissGain.connect(master);
    hiss.start();

    // ελαφρύ τρεμούλιασμα στο βουητό
    humLFO = ctx.createOscillator();
    humLFO.frequency.value = 7;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.015;
    humLFO.connect(lfoGain);
    lfoGain.connect(humGain.gain);
    humLFO.start();

    /* --- Drone του entity: δύο ελαφρώς detuned χαμηλά ημίτονα --- */
    droneGain = ctx.createGain();
    droneGain.gain.value = 0;
    droneGain.connect(master);
    const d1 = ctx.createOscillator();
    d1.frequency.value = 52;
    const d2 = ctx.createOscillator();
    d2.frequency.value = 54.5;
    d1.connect(droneGain);
    d2.connect(droneGain);
    d1.start(); d2.start();

    /* --- Καρδιοχτύπι όταν σε κυνηγάει --- */
    heartGain = ctx.createGain();
    heartGain.gain.value = 0;
    heartGain.connect(master);
    scheduleHeart();
  }

  let heartTimer = null;
  function scheduleHeart() {
    const thump = () => {
      if (!ctx) return;
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(70, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(38, ctx.currentTime + 0.12);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.9, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
      o.connect(g); g.connect(heartGain);
      o.start(); o.stop(ctx.currentTime + 0.2);
    };
    heartTimer = setInterval(() => { thump(); setTimeout(thump, 260); }, 850);
  }

  /* Ένταση φλας/χαμηλώματος φώτων — ακολουθεί το flicker της σκηνής. */
  function setFlicker(dim) {
    if (!started) return;
    // όταν τα φώτα πέφτουν, το βουητό «πνίγεται»
    humGain.gain.setTargetAtTime(0.05 * (0.4 + 0.6 * (1 - dim)), ctx.currentTime, 0.03);
  }

  function setEntityProximity(v) { // 0..1
    if (!started) return;
    droneGain.gain.setTargetAtTime(0.22 * v * v, ctx.currentTime, 0.25);
  }

  function setChase(on) {
    if (!started) return;
    heartGain.gain.setTargetAtTime(on ? 0.5 : 0, ctx.currentTime, 0.3);
  }

  function footstep(running) {
    if (!started) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(0.12);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = running ? 900 : 600;
    const g = ctx.createGain();
    const v = running ? 0.16 : 0.09;
    g.gain.setValueAtTime(v, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.11);
    src.connect(f); f.connect(g); g.connect(master);
    src.start();
  }

  function pickup() {
    if (!started) return;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.15);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.25, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    o.connect(g); g.connect(master);
    o.start(); o.stop(ctx.currentTime + 0.45);
  }

  function jumpscare() {
    if (!started) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(1.2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(1.0, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.1);
    src.connect(g); g.connect(master);
    src.start();
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(700, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + 0.9);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.5, ctx.currentTime);
    og.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.0);
    o.connect(og); og.connect(master);
    o.start(); o.stop(ctx.currentTime + 1.1);
  }

  function win() {
    if (!started) return;
    [523.25, 659.25, 783.99].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, ctx.currentTime + i * 0.12);
      g.gain.linearRampToValueAtTime(0.12, ctx.currentTime + i * 0.12 + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.2);
      o.connect(g); g.connect(master);
      o.start(ctx.currentTime + i * 0.12);
      o.stop(ctx.currentTime + 2.4);
    });
  }

  /* Απόκοσμος τόνος όταν πλησιάζεις την έξοδο. */
  let exitOsc = null, exitGain = null;
  function setExitProximity(v) { // 0..1
    if (!started) return;
    if (!exitOsc) {
      exitOsc = ctx.createOscillator();
      exitOsc.type = 'sine';
      exitOsc.frequency.value = 1046;
      exitGain = ctx.createGain();
      exitGain.gain.value = 0;
      exitOsc.connect(exitGain);
      exitGain.connect(master);
      exitOsc.start();
    }
    exitGain.gain.setTargetAtTime(0.05 * v, ctx.currentTime, 0.4);
  }

  return { start, setFlicker, setEntityProximity, setChase, setExitProximity,
           footstep, pickup, jumpscare, win };
})();
