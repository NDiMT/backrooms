/* Procedural textures για το Level 0 — όλα ζωγραφίζονται σε canvas,
   κανένα εξωτερικό asset. */

const Textures = (() => {

  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  function noise(ctx, w, h, alpha, dark) {
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() * 2 - 1) * alpha * 255;
      d[i]     = Math.max(0, Math.min(255, d[i]     + n - dark));
      d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n - dark));
      d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n - dark));
    }
    ctx.putImageData(img, 0, 0);
  }

  function stains(ctx, w, h, count, color) {
    for (let i = 0; i < count; i++) {
      const x = Math.random() * w, y = Math.random() * h;
      const r = 10 + Math.random() * 50;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }

  /* Η κλασική μονότονη κίτρινη ταπετσαρία με τις κάθετες ρίγες. */
  function wallpaper() {
    const w = 256, h = 256;
    const c = canvas(w, h), ctx = c.getContext('2d');
    ctx.fillStyle = '#c9b765';
    ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) {
      ctx.fillStyle = (x / 16) % 2 === 0 ? '#c2af5b' : '#cdbb6a';
      ctx.fillRect(x, 0, 8, h);
    }
    stains(ctx, w, h, 6, 'rgba(90,70,20,0.06)');
    noise(ctx, w, h, 0.05, 4);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  /* Υγρή, παλιά μοκέτα. */
  function carpet() {
    const w = 256, h = 256;
    const c = canvas(w, h), ctx = c.getContext('2d');
    ctx.fillStyle = '#7d7040';
    ctx.fillRect(0, 0, w, h);
    stains(ctx, w, h, 10, 'rgba(40,32,10,0.12)');
    stains(ctx, w, h, 4, 'rgba(120,110,60,0.10)');
    noise(ctx, w, h, 0.16, 10);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  /* Ψευδοροφή: πλάκες 1x1 m με σκοτεινούς αρμούς και φωτιστικό πάνελ
     στο κέντρο κάθε κελιού (το texture καλύπτει ένα κελί 4x4 m). */
  function ceiling() {
    const w = 512, h = 512;
    const c = canvas(w, h), ctx = c.getContext('2d');
    ctx.fillStyle = '#cfc7a6';
    ctx.fillRect(0, 0, w, h);
    // πλάκες
    for (let y = 0; y < h; y += 128) {
      for (let x = 0; x < w; x += 128) {
        ctx.fillStyle = Math.random() < 0.15 ? '#c4bb98' : '#cfc7a6';
        ctx.fillRect(x + 2, y + 2, 124, 124);
      }
    }
    noise(ctx, w, h, 0.05, 6);
    // αρμοί
    ctx.strokeStyle = 'rgba(60,52,30,0.8)';
    ctx.lineWidth = 4;
    for (let i = 0; i <= w; i += 128) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(w, i); ctx.stroke();
    }
    // φωτιστικό πάνελ στο κέντρο
    const g = ctx.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, 160);
    g.addColorStop(0, 'rgba(255,250,220,0.9)');
    g.addColorStop(1, 'rgba(255,250,220,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fffbe2';
    ctx.fillRect(w / 2 - 96, h / 2 - 48, 192, 96);
    ctx.strokeStyle = 'rgba(120,110,70,0.9)';
    ctx.lineWidth = 6;
    ctx.strokeRect(w / 2 - 96, h / 2 - 48, 192, 96);
    // γρίλια του πάνελ
    ctx.strokeStyle = 'rgba(190,180,130,0.7)';
    ctx.lineWidth = 2;
    for (let x = w / 2 - 96; x <= w / 2 + 96; x += 24) {
      ctx.beginPath(); ctx.moveTo(x, h / 2 - 48); ctx.lineTo(x, h / 2 + 48); ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  /* Το entity: ψηλή μαύρη φιγούρα με χλωμό πρόσωπο και χαμόγελο. */
  function entity() {
    const w = 256, h = 512;
    const c = canvas(w, h), ctx = c.getContext('2d');
    ctx.clearRect(0, 0, w, h);

    // σώμα — μακρόστενη σκιά που σβήνει προς τα κάτω
    const body = ctx.createLinearGradient(0, 60, 0, h);
    body.addColorStop(0, 'rgba(5,5,8,0.98)');
    body.addColorStop(0.75, 'rgba(5,5,8,0.85)');
    body.addColorStop(1, 'rgba(5,5,8,0)');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(w * 0.30, 110);
    ctx.bezierCurveTo(w * 0.18, 200, w * 0.30, 380, w * 0.34, h);
    ctx.lineTo(w * 0.66, h);
    ctx.bezierCurveTo(w * 0.70, 380, w * 0.82, 200, w * 0.70, 110);
    ctx.closePath();
    ctx.fill();

    // κεφάλι
    ctx.fillStyle = 'rgba(8,8,10,0.98)';
    ctx.beginPath();
    ctx.ellipse(w / 2, 80, 46, 58, 0, 0, Math.PI * 2);
    ctx.fill();

    // μάτια
    ctx.fillStyle = '#f5f2e0';
    ctx.shadowColor = '#fffbe0';
    ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.ellipse(w / 2 - 18, 68, 6, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(w / 2 + 18, 68, 6, 9, 0, 0, Math.PI * 2); ctx.fill();

    // χαμόγελο
    ctx.strokeStyle = '#f5f2e0';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(w / 2, 88, 26, 0.25 * Math.PI, 0.75 * Math.PI);
    ctx.stroke();
    ctx.shadowBlur = 0;

    const tex = new THREE.CanvasTexture(c);
    return tex;
  }

  /* Μεγάλη έκδοση του προσώπου για το jumpscare overlay (data URL). */
  function jumpscareFace() {
    const w = 512, h = 512;
    const c = canvas(w, h), ctx = c.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#f5f2e0';
    ctx.shadowColor = '#fffbe0';
    ctx.shadowBlur = 40;
    ctx.beginPath(); ctx.ellipse(w / 2 - 90, 190, 34, 52, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(w / 2 + 90, 190, 34, 52, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#f5f2e0';
    ctx.lineWidth = 22;
    ctx.beginPath();
    ctx.arc(w / 2, 260, 150, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    return c.toDataURL();
  }

  return { wallpaper, carpet, ceiling, entity, jumpscareFace };
})();
