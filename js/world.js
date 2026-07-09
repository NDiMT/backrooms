/* Παραγωγή του Level 0: grid από κελιά 4x4 m, τοίχοι/κολόνες με seed,
   εγγυημένη συνδεσιμότητα με flood fill. */

const World = (() => {
  const CELL = 4;
  const WALL_H = 3.2;
  const GRID = 41; // περιττός για συμμετρικό κέντρο

  // Mulberry32 — ντετερμινιστικό RNG από seed
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function generate(seed) {
    const rand = rng(seed);
    // 0 = δάπεδο, 1 = τοίχος
    const grid = Array.from({ length: GRID }, () => new Array(GRID).fill(0));

    // περιμετρικοί τοίχοι
    for (let i = 0; i < GRID; i++) {
      grid[0][i] = grid[GRID - 1][i] = 1;
      grid[i][0] = grid[i][GRID - 1] = 1;
    }

    // τυχαία «κορδόνια» τοίχων
    const strips = Math.floor(GRID * GRID * 0.055);
    for (let s = 0; s < strips; s++) {
      let x = 1 + Math.floor(rand() * (GRID - 2));
      let z = 1 + Math.floor(rand() * (GRID - 2));
      const horizontal = rand() < 0.5;
      const len = 2 + Math.floor(rand() * 5);
      for (let i = 0; i < len; i++) {
        if (x <= 0 || z <= 0 || x >= GRID - 1 || z >= GRID - 1) break;
        grid[z][x] = 1;
        if (horizontal) x++; else z++;
      }
    }

    // κολόνες σε ημι-κανονικό μοτίβο (η ραχοκοκαλιά του backrooms look)
    for (let z = 3; z < GRID - 3; z += 4) {
      for (let x = 3; x < GRID - 3; x += 4) {
        if (rand() < 0.6) {
          const jx = Math.floor(rand() * 3) - 1;
          const jz = Math.floor(rand() * 3) - 1;
          grid[z + jz][x + jx] = 1;
        }
      }
    }

    // το σημείο εκκίνησης πάντα ελεύθερο
    const mid = Math.floor(GRID / 2);
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++)
        grid[mid + dz][mid + dx] = 0;

    // flood fill από το κέντρο· ό,τι δάπεδο δεν πιάνεται γίνεται τοίχος
    const reach = Array.from({ length: GRID }, () => new Array(GRID).fill(false));
    const dist = Array.from({ length: GRID }, () => new Array(GRID).fill(-1));
    const queue = [[mid, mid]];
    reach[mid][mid] = true;
    dist[mid][mid] = 0;
    while (queue.length) {
      const [cz, cx] = queue.shift();
      for (const [dz, dx] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nz = cz + dz, nx = cx + dx;
        if (nz < 0 || nx < 0 || nz >= GRID || nx >= GRID) continue;
        if (grid[nz][nx] === 1 || reach[nz][nx]) continue;
        reach[nz][nx] = true;
        dist[nz][nx] = dist[cz][cx] + 1;
        queue.push([nz, nx]);
      }
    }
    const floorCells = [];
    for (let z = 0; z < GRID; z++)
      for (let x = 0; x < GRID; x++) {
        if (grid[z][x] === 0 && !reach[z][x]) grid[z][x] = 1;
        else if (grid[z][x] === 0) floorCells.push({ x, z, d: dist[z][x] });
      }

    // έξοδος: ένα από τα πιο απομακρυσμένα κελιά
    floorCells.sort((a, b) => b.d - a.d);
    const exitCell = floorCells[Math.floor(rand() * Math.min(8, floorCells.length))];

    // αρχική θέση entity: μακριά από τον παίκτη αλλά όχι πάνω στην έξοδο
    const farCells = floorCells.filter(c => c.d > 14 && c !== exitCell);
    const entityCell = farCells[Math.floor(rand() * farCells.length)] || exitCell;

    // almond water: διάσπαρτα, όχι πολύ κοντά στο spawn
    const bottleCells = [];
    const candidates = floorCells.filter(c => c.d > 5);
    for (let i = 0; i < 6 && candidates.length; i++) {
      const idx = Math.floor(rand() * candidates.length);
      bottleCells.push(candidates.splice(idx, 1)[0]);
    }

    return { grid, exitCell, entityCell, bottleCells, mid, rand };
  }

  function cellToWorld(x, z) {
    return {
      x: (x - (GRID - 1) / 2) * CELL,
      z: (z - (GRID - 1) / 2) * CELL,
    };
  }

  function worldToCell(wx, wz) {
    return {
      x: Math.round(wx / CELL + (GRID - 1) / 2),
      z: Math.round(wz / CELL + (GRID - 1) / 2),
    };
  }

  function isWall(grid, cx, cz) {
    if (cx < 0 || cz < 0 || cx >= GRID || cz >= GRID) return true;
    return grid[cz][cx] === 1;
  }

  /* Σύγκρουση κύκλου (ακτίνα r) με τα κελιά-τοίχους γύρω από τη θέση. */
  function collides(grid, wx, wz, r) {
    const c = worldToCell(wx, wz);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const cx = c.x + dx, cz = c.z + dz;
        if (!isWall(grid, cx, cz)) continue;
        const p = cellToWorld(cx, cz);
        // AABB του κελιού-τοίχου
        const nearX = Math.max(p.x - CELL / 2, Math.min(wx, p.x + CELL / 2));
        const nearZ = Math.max(p.z - CELL / 2, Math.min(wz, p.z + CELL / 2));
        const ddx = wx - nearX, ddz = wz - nearZ;
        if (ddx * ddx + ddz * ddz < r * r) return true;
      }
    }
    return false;
  }

  /* Οπτική επαφή: δειγματοληψία της ευθείας ανά 0.4 m. */
  function lineOfSight(grid, x1, z1, x2, z2) {
    const dx = x2 - x1, dz = z2 - z1;
    const len = Math.sqrt(dx * dx + dz * dz);
    const steps = Math.ceil(len / 0.4);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const c = worldToCell(x1 + dx * t, z1 + dz * t);
      if (isWall(grid, c.x, c.z)) return false;
    }
    return true;
  }

  /* Χτίζει όλα τα meshes της σκηνής και τα επιστρέφει. */
  function build(scene, data) {
    const { grid } = data;
    const size = GRID * CELL;

    const wallTex = Textures.wallpaper();
    wallTex.repeat.set(1, 1);
    const wallMat = new THREE.MeshLambertMaterial({ map: wallTex });

    // μετράμε τοίχους για το InstancedMesh
    let wallCount = 0;
    for (let z = 0; z < GRID; z++)
      for (let x = 0; x < GRID; x++)
        if (grid[z][x] === 1) wallCount++;

    const wallGeo = new THREE.BoxGeometry(CELL, WALL_H, CELL);
    const walls = new THREE.InstancedMesh(wallGeo, wallMat, wallCount);
    const m = new THREE.Matrix4();
    let i = 0;
    for (let z = 0; z < GRID; z++) {
      for (let x = 0; x < GRID; x++) {
        if (grid[z][x] !== 1) continue;
        const p = cellToWorld(x, z);
        m.makeTranslation(p.x, WALL_H / 2, p.z);
        walls.setMatrixAt(i++, m);
      }
    }
    walls.instanceMatrix.needsUpdate = true;
    scene.add(walls);

    const carpetTex = Textures.carpet();
    carpetTex.repeat.set(GRID, GRID);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshLambertMaterial({ map: carpetTex })
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    const ceilTex = Textures.ceiling();
    ceilTex.repeat.set(GRID, GRID);
    const ceilMat = new THREE.MeshBasicMaterial({ map: ceilTex });
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(size, size), ceilMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = WALL_H;
    scene.add(ceil);

    // Η έξοδος: ένα λαμπερό «σχίσμα» στην πραγματικότητα — το noclip σημείο.
    // Δύο σταυρωτά planes ώστε να φαίνεται από κάθε γωνία, + λευκό φως.
    const ep = cellToWorld(data.exitCell.x, data.exitCell.z);
    const exitGroup = new THREE.Group();
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, side: THREE.DoubleSide,
    });
    for (const rot of [0, Math.PI / 2]) {
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.7), glowMat);
      glow.position.y = 1.35;
      glow.rotation.y = rot;
      exitGroup.add(glow);
    }
    const exitLight = new THREE.PointLight(0xffffff, 1.1, 11);
    exitLight.position.y = 1.6;
    exitGroup.add(exitLight);
    exitGroup.position.set(ep.x, 0, ep.z);
    scene.add(exitGroup);

    // Almond water
    const bottles = [];
    const bottleGeo = new THREE.CylinderGeometry(0.09, 0.13, 0.42, 10);
    const bottleMat = new THREE.MeshLambertMaterial({
      color: 0xdfeaf2, emissive: 0xbfd8e8, emissiveIntensity: 0.9,
    });
    for (const c of data.bottleCells) {
      const p = cellToWorld(c.x, c.z);
      const b = new THREE.Mesh(bottleGeo, bottleMat);
      b.position.set(p.x, 0.55, p.z);
      b.userData.baseY = 0.55;
      scene.add(b);
      bottles.push(b);
    }

    return { walls, ceilMat, exitGroup, exitPos: ep, bottles };
  }

  return { CELL, WALL_H, GRID, generate, build,
           cellToWorld, worldToCell, isWall, collides, lineOfSight };
})();
