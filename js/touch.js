/* ΝΕΚΡΗ ΖΩΝΗ — Mobile controls: joystick κίνησης (αριστερά), drag στροφής
   (δεξιά), κουμπί FIRE (κρατημένο = συνεχόμενες βολές), εναλλαγή όπλου. */

const TouchControls = (() => {
  const isTouch = matchMedia('(pointer: coarse)').matches ||
    ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

  const state = {
    isTouch,
    move: { x: 0, z: 0 },   // x: strafe, z: εμπρός/πίσω
    lookDX: 0,
    firing: false,
  };

  let root, joyBase, joyStick, fireBtn, wpnBtn, mapBtn;
  let joyTouchId = null, joyCenter = { x: 0, y: 0 };
  let lookTouchId = null, lookLastX = 0;
  const JOY_RADIUS = 52;
  let onWeaponSwitch = null, onMapToggle = null;

  function build() {
    document.body.classList.add('touch-mode');
    root = document.createElement('div');
    root.id = 'touch-controls';
    root.className = 'hidden';
    root.innerHTML = `
      <div id="joy-base"><div id="joy-stick"></div></div>
      <div id="fire-btn">FIRE</div>
      <div id="wpn-btn">WPN</div>
      <div id="map-btn">MAP</div>
    `;
    document.body.appendChild(root);
    joyBase = document.getElementById('joy-base');
    joyStick = document.getElementById('joy-stick');
    fireBtn = document.getElementById('fire-btn');
    wpnBtn = document.getElementById('wpn-btn');
    mapBtn = document.getElementById('map-btn');

    const lookPad = document.getElementById('game');
    lookPad.addEventListener('touchstart', onLookStart, { passive: false });
    lookPad.addEventListener('touchmove', onLookMove, { passive: false });
    lookPad.addEventListener('touchend', onLookEnd);
    lookPad.addEventListener('touchcancel', onLookEnd);

    joyBase.addEventListener('touchstart', onJoyStart, { passive: false });
    joyBase.addEventListener('touchmove', onJoyMove, { passive: false });
    joyBase.addEventListener('touchend', onJoyEnd);
    joyBase.addEventListener('touchcancel', onJoyEnd);

    fireBtn.addEventListener('touchstart', e => {
      e.preventDefault();
      state.firing = true;
      fireBtn.classList.add('active');
    }, { passive: false });
    fireBtn.addEventListener('touchend', () => {
      state.firing = false;
      fireBtn.classList.remove('active');
    });
    wpnBtn.addEventListener('touchstart', e => {
      e.preventDefault();
      if (onWeaponSwitch) onWeaponSwitch();
    }, { passive: false });
    mapBtn.addEventListener('touchstart', e => {
      e.preventDefault();
      if (onMapToggle) onMapToggle();
    }, { passive: false });
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
    state.move.x = kx / JOY_RADIUS;
    state.move.z = -ky / JOY_RADIUS;
  }

  function onLookStart(e) {
    if (lookTouchId !== null) return;
    const t = e.changedTouches[0];
    lookTouchId = t.identifier;
    lookLastX = t.clientX;
  }
  function onLookMove(e) {
    for (const t of e.changedTouches) {
      if (t.identifier !== lookTouchId) continue;
      e.preventDefault();
      state.lookDX += (t.clientX - lookLastX);
      lookLastX = t.clientX;
    }
  }
  function onLookEnd(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === lookTouchId) lookTouchId = null;
    }
  }

  function consumeLook() {
    const dx = state.lookDX;
    state.lookDX = 0;
    return dx;
  }

  function show() { if (root) root.classList.remove('hidden'); }
  function hide() {
    if (!root) return;
    root.classList.add('hidden');
    state.move.x = 0; state.move.z = 0;
    state.firing = false;
    joyTouchId = lookTouchId = null;
  }

  if (isTouch) {
    if (document.body) build();
    else document.addEventListener('DOMContentLoaded', build);
  }

  return {
    state, show, hide, consumeLook,
    get isTouch() { return isTouch; },
    set onWeaponSwitch(fn) { onWeaponSwitch = fn; },
    set onMapToggle(fn) { onMapToggle = fn; },
  };
})();
