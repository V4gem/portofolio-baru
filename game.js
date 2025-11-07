// game tembak komet - script.js
// Pastikan file dipanggil setelah <canvas> ada di DOM

(() => {
  // DOM
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const scoreEl = document.getElementById('score');
  const livesEl = document.getElementById('lives');
  const btnRestart = document.getElementById('btn-restart');

  // ukuran logika (sesuaikan dengan atribut canvas)
  const W = canvas.width;
  const H = canvas.height;

  // game state
  let keys = {};
  let bullets = [];
  let comets = [];
  let lastCometSpawn = 0;
  let cometSpawnInterval = 900; // ms
  let lastFrame = performance.now();
  let score = 0;
  let lives = 3;
  let running = true;

  // player
  const player = {
    x: W / 2,
    y: H - 60,
    radius: 18,
    speed: 350, // px per second
    cooldown: 0, // ms until can shoot
    fireRate: 220 // ms
  };

  // util
  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  // bullet object: {x,y,w,h,vy}
  function spawnBullet() {
    if (player.cooldown > 0) return;
    bullets.push({
      x: player.x,
      y: player.y - player.radius - 8,
      w: 4,
      h: 12,
      vy: -600
    });
    player.cooldown = player.fireRate;
  }

  // comet object: {x,y,r,vx,vy,health}
  function spawnComet() {
    const r = rand(12, 36);
    const x = rand(r, W - r);
    const y = -r - 10;
    const vx = rand(-60, 60);
    const vy = rand(60, 160) + (score * 0.2); // sedikit makin cepat
    const health = Math.floor(r / 12); // bigger comets take >1 hit
    comets.push({ x, y, r, vx, vy, health });
  }

  function rectCircleCollide(rx, ry, rw, rh, cx, cy, cr) {
    // nearest point on rect to circle center
    const nx = Math.max(rx, Math.min(cx, rx + rw));
    const ny = Math.max(ry, Math.min(cy, ry + rh));
    const dx = nx - cx;
    const dy = ny - cy;
    return dx * dx + dy * dy <= cr * cr;
  }

  function circleCircleCollide(x1,y1,r1,x2,y2,r2){
    const dx=x1-x2, dy=y1-y2;
    const dist2=dx*dx+dy*dy;
    const min = r1+r2;
    return dist2 <= min*min;
  }

  // input
  window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'Space') e.preventDefault();
  });
  window.addEventListener('keyup', e => {
    keys[e.code] = false;
  });

  // touch buttons optional: tap left/right screen to move - minimal
  canvas.addEventListener('click', (e) => {
    // click to shoot
    spawnBullet();
  });

  // restart
  btnRestart.addEventListener('click', resetGame);

  // reset
  function resetGame() {
    bullets = [];
    comets = [];
    lastCometSpawn = 0;
    score = 0;
    lives = 3;
    running = true;
    player.x = W/2;
    player.cooldown = 0;
    cometSpawnInterval = 900;
    updateUI();
  }

  function updateUI(){
    scoreEl.textContent = `Score: ${score}`;
    livesEl.textContent = `Lives: ${lives}`;
  }

  // game loop
  function update(now) {
    const dt = Math.min(40, now - lastFrame); // ms, clamp
    lastFrame = now;
    if (!running) {
      draw(); // draw final frame
      requestAnimationFrame(update);
      return;
    }

    // spawn comets
    lastCometSpawn += dt;
    if (lastCometSpawn >= cometSpawnInterval) {
      spawnComet();
      lastCometSpawn = 0;
      // progressively increase spawn freq slightly but with floor
      cometSpawnInterval = Math.max(420, cometSpawnInterval - 12);
    }

    // update player cooldown
    if (player.cooldown > 0) player.cooldown = Math.max(0, player.cooldown - dt);

    // controls: ArrowLeft/ArrowRight / KeyA/KeyD
    const left = keys['ArrowLeft'] || keys['KeyA'];
    const right = keys['ArrowRight'] || keys['KeyD'];
    const shoot = keys['Space'] || keys['KeyW'] || keys['ArrowUp'];

    let move = 0;
    if (left) move -= 1;
    if (right) move += 1;
    if (move !== 0) {
      player.x += move * player.speed * (dt / 1000);
      player.x = Math.max(player.radius, Math.min(W - player.radius, player.x));
    }
    if (shoot) spawnBullet();

    // update bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.y += b.vy * (dt / 1000);
      if (b.y + b.h < -10) bullets.splice(i, 1);
    }

    // update comets
    for (let i = comets.length - 1; i >= 0; i--) {
      const c = comets[i];
      c.x += c.vx * (dt / 1000);
      c.y += c.vy * (dt / 1000);
      // screen wrap for x slightly
      if (c.x < -c.r) c.x = W + c.r;
      if (c.x > W + c.r) c.x = -c.r;

      // check collision with player
      if (circleCircleCollide(c.x, c.y, c.r, player.x, player.y, player.radius)) {
        // hit player
        comets.splice(i,1);
        lives--;
        updateUI();
        if (lives <= 0) {
          running = false;
        }
        continue;
      }

      // check bullets
      let hit = false;
      for (let j = bullets.length - 1; j >= 0; j--) {
        const b = bullets[j];
        if (rectCircleCollide(b.x - b.w/2, b.y - b.h/2, b.w, b.h, c.x, c.y, c.r)) {
          bullets.splice(j,1);
          c.health -= 1;
          if (c.health <= 0) {
            // destroy comet
            comets.splice(i,1);
            score += Math.floor(c.r); // bigger comet => more score
            updateUI();
          }
          hit = true;
          break;
        }
      }
      if (hit) continue;

      // comet passes bottom
      if (c.y - c.r > H + 20) {
        // missed: lose a life
        comets.splice(i,1);
        lives--;
        updateUI();
        if (lives <= 0) running = false;
      }
    }

    draw();
    requestAnimationFrame(update);
  }

  // draw functions
  function clear() {
    // solid background to avoid transparency artifacts
    ctx.fillStyle = '#0a1230';
    ctx.fillRect(0,0,W,H);
    // stars
    // simple static starfield (deterministic)
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let i=0;i<50;i++){
      const sx = (i * 37) % W;
      const sy = ((i * 79) % H);
      ctx.fillRect(sx, sy, 1, 1);
    }
  }

  function drawPlayer() {
    // ship as triangle with engine glow
    const x = player.x, y = player.y;
    ctx.save();
    // engine glow
    ctx.beginPath();
    ctx.fillStyle = 'rgba(255,160,60,0.12)';
    ctx.ellipse(x, y + 20, 20, 8, 0, 0, Math.PI*2);
    ctx.fill();

    // body
    ctx.beginPath();
    ctx.moveTo(x, y - 18);
    ctx.lineTo(x - 18, y + 16);
    ctx.lineTo(x + 18, y + 16);
    ctx.closePath();
    ctx.fillStyle = '#dbe7ff';
    ctx.fill();
    // cockpit
    ctx.beginPath();
    ctx.arc(x, y - 2, 6, 0, Math.PI*2);
    ctx.fillStyle = '#2b6ef6';
    ctx.fill();
    // outline
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.stroke();
    ctx.restore();
  }

  function drawBullets() {
    ctx.save();
    for (const b of bullets) {
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(b.x - b.w/2, b.y - b.h/2, b.w, b.h);
    }
    ctx.restore();
  }

  function drawComets() {
    for (const c of comets) {
      // body
      const grad = ctx.createRadialGradient(c.x - c.r*0.3, c.y - c.r*0.3, c.r*0.1, c.x, c.y, c.r);
      grad.addColorStop(0, '#fff3b0');
      grad.addColorStop(0.5, '#ff8c42');
      grad.addColorStop(1, '#a8251a');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI*2);
      ctx.fill();

      // trail
      ctx.beginPath();
      ctx.globalAlpha = 0.14;
      ctx.moveTo(c.x + c.r*0.6, c.y);
      ctx.lineTo(c.x + c.r*3, c.y - c.vy*0.03);
      ctx.lineTo(c.x + c.r*3, c.y + c.vy*0.03);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;

      // health small text
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(c.health, c.x, c.y);
    }
  }

  function drawHUD(){
    // nothing: UI elements handled in DOM
    if (!running) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, H/2 - 60, W, 120);
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 34px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Game Over', W/2, H/2 - 6);
      ctx.font = '18px Arial';
      ctx.fillText(`Final Score: ${score}`, W/2, H/2 + 26);
      ctx.restore();
    }
  }

  function draw() {
    clear();
    drawComets();
    drawBullets();
    drawPlayer();
    drawHUD();
  }

  // start
  updateUI();
  lastFrame = performance.now();
  requestAnimationFrame(update);

  // extremely small safety: catch unexpected errors so page doesn't die silently
  window.addEventListener('error', (ev) => {
    console.error('Game error:', ev.message, ev.filename, ev.lineno);
  });
})();
