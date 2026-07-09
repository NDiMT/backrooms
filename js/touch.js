/* Touch controls για κινητά / APK.
   Αριστερή πλευρά: virtual joystick (κίνηση). Δεξιά: drag για βλέμμα.
   Εκθέτει move {x,z}, ένα look delta που «καταναλώνεται» ανά frame, και running. */

const TouchControls = (() => {
  const isTouch = matchMedia('(pointer: coarse)').matches ||
    ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

  const state = {
    isTouch,
    move: { x: 0, z: 0 },
    lookDX: 0,
    lookDY: 0,
    running: false,
  };

  let joyBase, joyStick, runBtn, root;
  let joyTouchId = null, joyCenter = { x: 0, y: 0 };
  let lookTouchId = null, lookLast = { x: 0, y: 0 };
  const JOY_RADIUS = 60;

  function build() {
    document.body.classList.add('touch-mode');
    root = document.createElement('div');
    root.id = 'touch-controls';
    root.className = 'hidden';
    root.innerHTML = `
      <div id="joy-base"><div id="joy-stick"></div></div>
      <div id="run-btn">ΤΡΕΞΕ</div>
    `;
    document.body.appendChild(root);
    joyBase = document.getElementById('joy-base');
    joyStick = document.getElementById('joy-stick');
    runBtn = document.getElementById('run-btn');

    // Το δεξί μισό της οθόνης = look pad (όλη η σκηνή εκτός των controls)
    const lookPad = document.getElementById('game');

    lookPad.addEventListener('touchstart', onLookStart, { passive: false });
    lookPad.addEventListener('touchmove', onLookMove, { passive: false });
    lookPad.addEventListener('touchend', onLookEnd);
    lookPad.addEventListener('touchcancel', onLookEnd);

    joyBase.addEventListener('touchstart', onJoyStart, { passive: false });
    joyBase.addEventListener('touchmove', onJoyMove, { passive: false });
    joyBase.addEventListener('touchend', onJoyEnd);
    joyBase.addEventListener('touchcancel', onJoyEnd);

    runBtn.addEventListener('touchstart', e => {
      e.preventDefault(); state.running = true; runBtn.classList.add('active');
    }, { passive: false });
    runBtn.addEventListener('touchend', () => {
      state.running = false; runBtn.classList.remove('active');
    });
  }

  function onJoyStart(e) {
    e.preventDefault();
    const t = e.changedTouches[0];
    joyTouchId = t.identifier;
    const r = joyBase.getBoundingClientRect();
    joyCenter = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    updateJoy(t.clientX, t.clientY);
  }
  function onJoyMove(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === joyTouchId) updateJoy(t.clientX, t.clientY);
    }
  }
  function onJoyEnd(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === joyTouchId) {
        joyTouchId = null;
        state.move.x = 0; state.move.z = 0;
        joyStick.style.transform = 'translate(-50%, -50%)';
      }
    }
  }
  function updateJoy(cx, cy) {
    let dx = cx - joyCenter.x, dy = cy - joyCenter.y;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, JOY_RADIUS);
    const ang = Math.atan2(dy, dx);
    const kx = Math.cos(ang) * clamped, ky = Math.sin(ang) * clamped;
    joyStick.style.transform =
      `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;
    state.move.x = kx / JOY_RADIUS;   // +δεξιά
    state.move.z = -ky / JOY_RADIUS;  // +μπροστά (πάνω στην οθόνη)
  }

  function onLookStart(e) {
    if (lookTouchId !== null) return;
    const t = e.changedTouches[0];
    lookTouchId = t.identifier;
    lookLast = { x: t.clientX, y: t.clientY };
  }
  function onLookMove(e) {
    for (const t of e.changedTouches) {
      if (t.identifier !== lookTouchId) continue;
      e.preventDefault();
      state.lookDX += (t.clientX - lookLast.x);
      state.lookDY += (t.clientY - lookLast.y);
      lookLast = { x: t.clientX, y: t.clientY };
    }
  }
  function onLookEnd(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === lookTouchId) lookTouchId = null;
    }
  }

  function show() { if (root) root.classList.remove('hidden'); }
  function hide() {
    if (!root) return;
    root.classList.add('hidden');
    state.move.x = 0; state.move.z = 0; state.running = false;
    joyTouchId = lookTouchId = null;
  }

  /* Επιστρέφει το συσσωρευμένο look delta και το μηδενίζει. */
  function consumeLook() {
    const d = { dx: state.lookDX, dy: state.lookDY };
    state.lookDX = 0; state.lookDY = 0;
    return d;
  }

  if (isTouch) {
    if (document.body) build();
    else document.addEventListener('DOMContentLoaded', build);
  }

  return { state, show, hide, consumeLook, get isTouch() { return isTouch; } };
})();
