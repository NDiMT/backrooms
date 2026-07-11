/* DRIFTLAND — Portrait touch controls: δυναμικό joystick στο κάτω-αριστερό
   μισό, μεγάλο κουμπί ACT δεξιά (DOM), buttons INV/CRAFT/TORCH. */

const TouchControls = (() => {
  const isTouch = matchMedia('(pointer: coarse)').matches ||
    ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

  const state = { move: { x: 0, y: 0 } };
  let joyId = null, origin = null;
  let base = null, stick = null;
  const R = 48;

  function build() {
    document.body.classList.add('touch-mode');
    base = document.getElementById('joy-base');
    stick = document.getElementById('joy-stick');
    const zone = document.getElementById('joy-zone');
    zone.addEventListener('touchstart', e => {
      e.preventDefault();
      const t = e.changedTouches[0];
      joyId = t.identifier;
      origin = { x: t.clientX, y: t.clientY };
      base.style.left = (t.clientX - 50) + 'px';
      base.style.top = (t.clientY - 50) + 'px';
      base.classList.remove('hidden');
      upd(t.clientX, t.clientY);
    }, { passive: false });
    zone.addEventListener('touchmove', e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === joyId) upd(t.clientX, t.clientY);
      }
    }, { passive: false });
    const end = e => {
      for (const t of e.changedTouches) {
        if (t.identifier === joyId) {
          joyId = null;
          state.move.x = 0; state.move.y = 0;
          base.classList.add('hidden');
        }
      }
    };
    zone.addEventListener('touchend', end);
    zone.addEventListener('touchcancel', end);
  }

  function upd(cx, cy) {
    let dx = cx - origin.x, dy = cy - origin.y;
    const d = Math.hypot(dx, dy);
    const cl = Math.min(d, R);
    const a = Math.atan2(dy, dx);
    stick.style.transform =
      `translate(${Math.cos(a) * cl}px, ${Math.sin(a) * cl}px)`;
    state.move.x = d < 8 ? 0 : Math.cos(a) * (cl / R);
    state.move.y = d < 8 ? 0 : Math.sin(a) * (cl / R);
  }

  if (isTouch) {
    if (document.readyState !== 'loading') build();
    else document.addEventListener('DOMContentLoaded', build);
  }

  return { state, get isTouch() { return isTouch; } };
})();
