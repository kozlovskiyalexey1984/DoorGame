// Мини-игра «Танчики» (Battle City, упрощённая).
// Контракт: Games.battlecity.start(container, { difficulty, onWin, onLose, setStatus })

window.Games = window.Games || {};

window.Games.battlecity = (() => {
  function bfsNextStep(isOpen, W, H, from, to) {
    if (from.x === to.x && from.y === to.y) return from;
    const key = p => p.x + ',' + p.y;
    const prev = new Map();
    const visited = new Set([key(from)]);
    const q = [from];
    let head = 0;
    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    let found = false;
    while (head < q.length) {
      const cur = q[head++];
      if (cur.x === to.x && cur.y === to.y) { found = true; break; }
      for (const [dx, dy] of dirs) {
        const nx = cur.x + dx, ny = cur.y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || !isOpen(nx, ny)) continue;
        const k = nx + ',' + ny;
        if (visited.has(k)) continue;
        visited.add(k);
        prev.set(k, cur);
        q.push({ x: nx, y: ny });
      }
    }
    if (!found) return from;
    let cur = to;
    while (true) {
      const p = prev.get(key(cur));
      if (!p || (p.x === from.x && p.y === from.y)) return cur;
      cur = p;
    }
  }

  return {
    name: 'Танчики',

    start(container, { difficulty = 1, onWin, onLose, setStatus }) {
      const N = 13; // квадратное поле N x N
      const enemyTarget = difficulty >= 2 ? 5 : 3;
      const enemyStepMs = difficulty >= 2 ? 460 : 560;
      const enemyFireMs = difficulty >= 2 ? 1400 : 1900;
      const bulletStepMs = 70;

      // 0=открыто, 1=кирпич, 2=сталь
      const grid = Array.from({ length: N }, (_, y) =>
        Array.from({ length: N }, (_, x) => {
          if (x === 0 || y === 0 || x === N - 1 || y === N - 1) return 2;
          return 0;
        }));
      const player0 = { x: Math.floor(N / 2), y: N - 2 };
      for (let y = 1; y < N - 1; y++) {
        for (let x = 1; x < N - 1; x++) {
          if (Math.abs(x - player0.x) <= 1 && Math.abs(y - player0.y) <= 1) continue;
          if (Math.random() < 0.16) grid[y][x] = 1;
        }
      }

      let player = { x: player0.x, y: player0.y, dir: [0, -1] };
      const enemies = [];
      const spawnSpots = [];
      for (let x = 2; x < N - 2; x += 3) spawnSpots.push({ x, y: 1 });
      for (let i = 0; i < enemyTarget; i++) {
        const s = spawnSpots[i % spawnSpots.length];
        grid[s.y][s.x] = 0;
        enemies.push({ x: s.x, y: s.y, dir: [0, 1], alive: true, fireAt: performance.now() + Math.random() * enemyFireMs });
      }
      let destroyed = 0;
      let bullets = []; // {x,y,dx,dy,owner:'player'|'enemy'}
      let alive = true;

      container.innerHTML = '';
      const wrap = document.createElement('div');
      wrap.className = 'game-canvas-wrap';
      const canvas = document.createElement('canvas');
      wrap.appendChild(canvas);
      container.appendChild(wrap);

      const controls = document.createElement('div');
      controls.className = 'game-controls';
      controls.innerHTML = `
        <div class="dpad">
          <span></span><button data-dir="up" aria-label="Вверх">▲</button><span></span>
          <button data-dir="left" aria-label="Влево">◀</button>
          <button data-act="fire" aria-label="Огонь" style="background:#7a2f38;">🔥</button>
          <button data-dir="right" aria-label="Вправо">▶</button>
        </div>`;
      container.appendChild(controls);
      const downRow = document.createElement('div');
      downRow.className = 'game-controls';
      downRow.style.paddingTop = '0';
      downRow.innerHTML = `<button data-dir="down" aria-label="Вниз" style="width:54px;height:44px;background:var(--bg-panel-2);border-radius:12px;font-size:1.1rem;">▼</button>`;
      container.appendChild(downRow);

      let cell = 0;
      const ctx = canvas.getContext('2d');
      const isOpenForTanks = (x, y) => x >= 0 && y >= 0 && x < N && y < N && grid[y][x] === 0;

      function resize() {
        const avail = Math.min(wrap.clientWidth, wrap.clientHeight) - 4;
        const dpr = window.devicePixelRatio || 1;
        cell = Math.max(10, Math.floor(avail / N));
        canvas.style.width = (cell * N) + 'px';
        canvas.style.height = (cell * N) + 'px';
        canvas.width = cell * N * dpr;
        canvas.height = cell * N * dpr;
        draw();
      }

      function drawTank(x, y, dir, color, c) {
        ctx.fillStyle = color;
        const p = c * 0.14;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x * c + p, y * c + p, c - p * 2, c - p * 2, c * 0.15);
        else ctx.rect(x * c + p, y * c + p, c - p * 2, c - p * 2);
        ctx.fill();
        ctx.fillStyle = '#100e1c';
        const bx = x * c + c / 2 + dir[0] * c * 0.28 - c * 0.06;
        const by = y * c + c / 2 + dir[1] * c * 0.28 - c * 0.06;
        ctx.fillRect(bx, by, c * 0.12, c * 0.12);
      }

      function draw() {
        const dpr = window.devicePixelRatio || 1;
        const c = cell * dpr;
        for (let y = 0; y < N; y++) {
          for (let x = 0; x < N; x++) {
            const v = grid[y][x];
            ctx.fillStyle = v === 2 ? '#2a2542' : v === 1 ? '#7a5a3a' : '#100e1c';
            ctx.fillRect(x * c, y * c, c, c);
          }
        }
        enemies.forEach(e => { if (e.alive) drawTank(e.x, e.y, e.dir, '#d1495b', c); });
        drawTank(player.x, player.y, player.dir, '#3ea8a0', c);
        ctx.fillStyle = '#e8a33d';
        bullets.forEach(b => {
          ctx.beginPath();
          ctx.arc(b.x * c + c / 2, b.y * c + c / 2, c * 0.1, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      function fireBullet(from, dir, owner) {
        bullets.push({ x: from.x + dir[0], y: from.y + dir[1], dx: dir[0], dy: dir[1], owner });
      }

      function tryMove(dx, dy) {
        if (!alive) return;
        player.dir = [dx, dy];
        const nx = player.x + dx, ny = player.y + dy;
        if (isOpenForTanks(nx, ny) && !enemies.some(e => e.alive && e.x === nx && e.y === ny)) {
          player = { ...player, x: nx, y: ny };
        }
        draw();
      }

      function fire() { fireBullet(player, player.dir, 'player'); }

      controls.querySelectorAll('[data-dir]').forEach(bindDirBtn);
      downRow.querySelectorAll('[data-dir]').forEach(bindDirBtn);
      function bindDirBtn(btn) {
        const map = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
        const act = () => tryMove(...map[btn.dataset.dir]);
        btn.addEventListener('touchstart', e => { e.preventDefault(); act(); }, { passive: false });
        btn.addEventListener('click', act);
      }
      controls.querySelectorAll('[data-act="fire"]').forEach(btn => {
        btn.addEventListener('touchstart', e => { e.preventDefault(); fire(); }, { passive: false });
        btn.addEventListener('click', fire);
      });

      function keyHandler(e) {
        const map = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
        if (map[e.key]) { e.preventDefault(); tryMove(...map[e.key]); }
        if (e.key === ' ') { e.preventDefault(); fire(); }
      }
      window.addEventListener('keydown', keyHandler);

      let touchStart = null;
      canvas.addEventListener('touchstart', e => {
        const t = e.touches[0];
        touchStart = { x: t.clientX, y: t.clientY, t: Date.now() };
      }, { passive: true });
      canvas.addEventListener('touchend', e => {
        if (!touchStart) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - touchStart.x, dy = t.clientY - touchStart.y;
        if (Math.abs(dx) < 16 && Math.abs(dy) < 16) { fire(); touchStart = null; return; }
        if (Math.abs(dx) > Math.abs(dy)) tryMove(dx > 0 ? 1 : -1, 0);
        else tryMove(0, dy > 0 ? 1 : -1);
        touchStart = null;
      }, { passive: true });

      function killEnemyAt(x, y) {
        const e = enemies.find(e => e.alive && e.x === x && e.y === y);
        if (e) { e.alive = false; destroyed++; if (setStatus) setStatus(`${destroyed} / ${enemyTarget}`); }
        return !!e;
      }

      let bulletTimer = null;
      function bulletTick() {
        if (!alive) return;
        const next = [];
        for (const b of bullets) {
          const nx = b.x + b.dx, ny = b.y + b.dy;
          if (nx < 0 || ny < 0 || nx >= N || ny >= N || grid[ny][nx] === 2) continue; // сталь/граница — снаряд гасится
          if (grid[ny][nx] === 1) { grid[ny][nx] = 0; continue; } // кирпич разрушается, снаряд гасится
          if (b.owner === 'player' && killEnemyAt(nx, ny)) continue;
          if (b.owner === 'enemy' && nx === player.x && ny === player.y) { finish(false); return; }
          next.push({ ...b, x: nx, y: ny });
        }
        bullets = next;
        draw();
        if (destroyed >= enemyTarget) { finish(true); return; }
        bulletTimer = setTimeout(bulletTick, bulletStepMs);
      }

      let enemyTimer = null;
      function enemyTick() {
        if (!alive) return;
        const now = performance.now();
        enemies.forEach(e => {
          if (!e.alive) return;
          const next = bfsNextStep(isOpenForTanks, N, N, e, player);
          if (next.x !== e.x || next.y !== e.y) {
            e.dir = [next.x - e.x, next.y - e.y];
            if (!enemies.some(o => o !== e && o.alive && o.x === next.x && o.y === next.y) &&
                !(next.x === player.x && next.y === player.y)) {
              e.x = next.x; e.y = next.y;
            }
          }
          if (now >= e.fireAt) {
            fireBullet(e, e.dir, 'enemy');
            e.fireAt = now + enemyFireMs;
          }
          if (e.x === player.x && e.y === player.y) { finish(false); }
        });
        if (!alive) return;
        draw();
        enemyTimer = setTimeout(enemyTick, enemyStepMs);
      }

      function onResize() { resize(); }
      window.addEventListener('resize', onResize);

      function cleanup() {
        window.removeEventListener('keydown', keyHandler);
        window.removeEventListener('resize', onResize);
        clearTimeout(bulletTimer);
        clearTimeout(enemyTimer);
      }

      function finish(won) {
        if (!alive) return;
        alive = false;
        cleanup();
        if (won) onWin(); else onLose();
      }

      if (setStatus) setStatus(`0 / ${enemyTarget}`);
      resize();
      bulletTimer = setTimeout(bulletTick, bulletStepMs);
      enemyTimer = setTimeout(enemyTick, enemyStepMs);

      return function destroy() { alive = false; cleanup(); };
    },
  };
})();
