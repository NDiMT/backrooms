/* THE BACKROOMS — Level 0
   Κύριος βρόχος παιχνιδιού, controls, HUD, καταστάσεις. */

(() => {
  // ---------- seed ----------
  const params = new URLSearchParams(location.search);
  let seed = parseInt(params.get('seed'), 10);
  if (!Number.isFinite(seed)) seed = Math.floor(Math.random() * 0xffffffff);

  // ---------- σκηνή ----------
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x151109, 0.055);

  const camera = new THREE.PerspectiveCamera(
    75, window.innerWidth / window.innerHeight, 0.1, 250);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  document.getElementById('game').appendChild(renderer.domElement);

  const AMBIENT_BASE = 0.8, POINT_BASE = 0.9;
  const ambient = new THREE.AmbientLight(0xa89a68, AMBIENT_BASE);
  scene.add(ambient);
  const lamp = new THREE.PointLight(0xffefc0, POINT_BASE, 22);
  scene.add(lamp);

  // ---------- κόσμος ----------
  const data = World.generate(seed);
  const built = World.build(scene, data);
  const entity = new Entity(scene, World, data);

  const EYE = 1.65;
  const spawn = World.cellToWorld(data.mid, data.mid);
  const player = {
    x: spawn.x, z: spawn.z,
    yaw: Math.random() * Math.PI * 2, pitch: 0,
    stamina: 100, sanity: 100,
  };

  // ---------- DOM ----------
  const $ = id => document.getElementById(id);
  const menuEl = $('menu'), pauseEl = $('pause'), deadEl = $('dead'),
        winEl = $('win'), hudEl = $('hud'), msgEl = $('message'),
        vignetteEl = $('vignette'), scareEl = $('jumpscare'),
        staminaBar = $('stamina-fill'), sanityBar = $('sanity-fill');

  $('jumpscare-img').src = Textures.jumpscareFace();

  // ---------- κατάσταση ----------
  let state = 'MENU'; // MENU | PLAYING | PAUSED | DEAD | WIN
  let elapsed = 0, bottlesFound = 0;
  let msgTimer = null;

  function showMessage(text, ms = 3500) {
    msgEl.textContent = text;
    msgEl.style.opacity = 1;
    clearTimeout(msgTimer);
    msgTimer = setTimeout(() => { msgEl.style.opacity = 0; }, ms);
  }

  function formatTime(s) {
    const m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
  }

  // ---------- controls ----------
  const keys = {};
  document.addEventListener('keydown', e => { keys[e.code] = true; });
  document.addEventListener('keyup', e => { keys[e.code] = false; });

  const canvas = renderer.domElement;

  function lock() { canvas.requestPointerLock(); }

  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === canvas;
    if (!locked && state === 'PLAYING') {
      state = 'PAUSED';
      pauseEl.classList.remove('hidden');
      hudEl.classList.add('hidden');
    }
  });

  document.addEventListener('mousemove', e => {
    if (document.pointerLockElement !== canvas || state !== 'PLAYING') return;
    player.yaw -= e.movementX * 0.0022;
    player.pitch -= e.movementY * 0.0022;
    const lim = Math.PI / 2 - 0.08;
    player.pitch = Math.max(-lim, Math.min(lim, player.pitch));
  });

  function startGame() {
    GameAudio.start();
    menuEl.classList.add('hidden');
    pauseEl.classList.add('hidden');
    hudEl.classList.remove('hidden');
    state = 'PLAYING';
    lock();
    if (elapsed === 0) {
      showMessage('Έκανες noclip έξω από την πραγματικότητα. Βρες την έξοδο.', 5000);
    }
  }

  $('start-btn').addEventListener('click', startGame);
  $('resume-btn').addEventListener('click', startGame);
  const restart = () => { location.href = '?seed=' + Math.floor(Math.random() * 0xffffffff); };
  $('retry-btn').addEventListener('click', restart);
  $('again-btn').addEventListener('click', restart);

  // ---------- flicker των φώτων ----------
  let flickerTimer = 4 + Math.random() * 8;
  let flickerLeft = 0;
  let dim = 0;

  function updateFlicker(dt) {
    if (flickerLeft > 0) {
      flickerLeft -= dt;
      dim = 0.3 + Math.random() * 0.6;
      if (flickerLeft <= 0) {
        dim = 0;
        flickerTimer = 6 + Math.random() * 9;
      }
    } else {
      flickerTimer -= dt;
      if (flickerTimer <= 0) flickerLeft = 0.3 + Math.random() * 1.3;
    }
    ambient.intensity = AMBIENT_BASE * (1 - dim * 0.85);
    lamp.intensity = POINT_BASE * (1 - dim * 0.85);
    const c = 1 - dim * 0.9;
    built.ceilMat.color.setRGB(c, c, c);
    GameAudio.setFlicker(dim);
  }

  // ---------- θάνατος / νίκη ----------
  function die(reason, withScare) {
    state = 'DEAD';
    hudEl.classList.add('hidden');
    document.exitPointerLock();
    $('death-reason').textContent = reason;
    $('death-stats').textContent =
      `Άντεξες ${formatTime(elapsed)} · Almond water: ${bottlesFound}/6 · Seed: ${seed}`;
    GameAudio.setChase(false);
    GameAudio.setEntityProximity(0);
    if (withScare) {
      GameAudio.jumpscare();
      scareEl.classList.remove('hidden');
      setTimeout(() => {
        scareEl.classList.add('hidden');
        deadEl.classList.remove('hidden');
      }, 900);
    } else {
      deadEl.classList.remove('hidden');
    }
  }

  function winGame() {
    state = 'WIN';
    hudEl.classList.add('hidden');
    document.exitPointerLock();
    $('win-stats').textContent =
      `Χρόνος: ${formatTime(elapsed)} · Almond water: ${bottlesFound}/6 · Seed: ${seed}`;
    GameAudio.setChase(false);
    GameAudio.setEntityProximity(0);
    GameAudio.setExitProximity(0);
    GameAudio.win();
    winEl.classList.remove('hidden');
  }

  // ---------- κύριος βρόχος ----------
  const clock = new THREE.Clock();
  let bobPhase = 0, stepAcc = 0;
  let saidExitHint = false;

  function update(dt) {
    elapsed += dt;

    // κίνηση
    let mx = 0, mz = 0;
    if (keys['KeyW'] || keys['ArrowUp']) mz += 1;
    if (keys['KeyS'] || keys['ArrowDown']) mz -= 1;
    if (keys['KeyA'] || keys['ArrowLeft']) mx -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) mx += 1;
    const moving = mx !== 0 || mz !== 0;

    const wantsRun = (keys['ShiftLeft'] || keys['ShiftRight']) && moving;
    const running = wantsRun && player.stamina > 0;
    if (running) player.stamina = Math.max(0, player.stamina - 24 * dt);
    else player.stamina = Math.min(100, player.stamina + 13 * dt);

    const speed = running ? 5.8 : 3.6;
    if (moving) {
      const len = Math.hypot(mx, mz);
      const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
      const rx = -fz, rz = fx;
      const dx = (fx * mz / len + rx * mx / len) * speed * dt;
      const dz = (fz * mz / len + rz * mx / len) * speed * dt;
      if (!World.collides(data.grid, player.x + dx, player.z, 0.45)) player.x += dx;
      if (!World.collides(data.grid, player.x, player.z + dz, 0.45)) player.z += dz;

      bobPhase += speed * dt * 1.8;
      stepAcc += speed * dt;
      const stride = running ? 2.6 : 2.1;
      if (stepAcc > stride) {
        stepAcc = 0;
        GameAudio.footstep(running);
      }
    }

    camera.position.set(
      player.x,
      EYE + (moving ? Math.sin(bobPhase) * 0.045 : 0),
      player.z);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = player.yaw;
    camera.rotation.x = player.pitch;
    lamp.position.set(player.x, EYE + 0.3, player.z);

    updateFlicker(dt);

    // entity
    const st = entity.update(dt, player.x, player.z);
    GameAudio.setEntityProximity(Math.max(0, 1 - st.dist / 25));
    GameAudio.setChase(st.chasing);
    if (st.caught) { die('Σε βρήκε.', true); return; }

    // sanity
    let drain = 0.35;
    if (st.chasing) drain += 2.2;
    if (dim > 0.4) drain += 0.9;
    player.sanity = Math.max(0, player.sanity - drain * dt);
    if (player.sanity <= 0) {
      die('Το μυαλό σου έγινε ένα με τους τοίχους.', false);
      return;
    }

    // almond water
    for (let i = built.bottles.length - 1; i >= 0; i--) {
      const b = built.bottles[i];
      b.rotation.y += dt * 1.2;
      b.position.y = b.userData.baseY + Math.sin(elapsed * 2 + i) * 0.06;
      const d = Math.hypot(b.position.x - player.x, b.position.z - player.z);
      if (d < 1.3) {
        scene.remove(b);
        built.bottles.splice(i, 1);
        bottlesFound++;
        player.sanity = Math.min(100, player.sanity + 40);
        GameAudio.pickup();
        showMessage('Almond water. Το μυαλό σου καθαρίζει.');
      }
    }

    // έξοδος
    const ed = Math.hypot(built.exitPos.x - player.x, built.exitPos.z - player.z);
    GameAudio.setExitProximity(Math.max(0, 1 - ed / 18));
    if (ed < 22 && !saidExitHint) {
      saidExitHint = true;
      showMessage('Ακούς κάτι… σαν έξοδο.');
    }
    if (ed < 1.5) { winGame(); return; }

    // HUD
    staminaBar.style.width = player.stamina + '%';
    sanityBar.style.width = player.sanity + '%';
    vignetteEl.style.opacity = (1 - player.sanity / 100) * 0.85;
  }

  function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (state === 'PLAYING') update(dt);
    renderer.render(scene, camera);
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // debug hook (χρησιμοποιείται από τα smoke tests)
  window.__debug = { player, entity, built, data, seed };

  // αρχική θέση κάμερας για το background του μενού
  camera.position.set(player.x, EYE, player.z);
  camera.rotation.order = 'YXZ';
  camera.rotation.y = player.yaw;
  lamp.position.set(player.x, EYE + 0.3, player.z);

  loop();
})();
