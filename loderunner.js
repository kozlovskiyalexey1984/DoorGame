// Мини-игра «Lode Runner» (упрощённая): собери золото, убегая от преследователей.
// Особенность: можно прокопать временную яму перед собой — враг не сможет
// пройти через неё несколько секунд. Яма всегда сама зарастает, так что
// прокопать уровень «в тупик» невозможно — это чисто тактический инструмент.
// Контракт: Games.loderunner.start(container, { difficulty, onWin, onLose, setStatus })

window.Games = window.Games || {};

window.Games.loderunner = (() => {
  function bfsReachable(isOpen, W, H, start) {
    const dist = Array.from({ length: H }, () => Array(W).fill(-1));
    dist[start.y][start.x] = 0;
    const q = [start];
    let head = 0;
    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    while (head < q.length) {
      const cur = q[head++];
      for (const [dx, dy] of dirs) {
        const nx = cur.x + dx, ny = cur.y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        if (!isOpen(nx, ny) || dist[ny][nx] !== -1) continue;
        dist[ny][nx] = dist[cur.y][cur.x] + 1;
        q.push({ x: nx, y: ny });
      }
    }
    return dist;
  }

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

  function countReachable(d) { return d.reduce((s, row) => s + row.filter(v => v >= 0).length, 0); }

  return {
    name: 'Lode Runner',

    start(container, { difficulty = 1, onWin, onLose, setStatus }) {
      const W = difficulty >= 2 ? 13 : 11;
      const H = 9;
      const goldTarget = difficulty >= 2 ? 7 : 5;
      const enemyCount = difficulty >= 2 ? 2 : 1;
      const enemyStepMs = difficulty >= 2 ? 420 : 520;
      const rockDensity = 0.15;
      let digsLeft = difficulty >= 2 ? 3 : 4;
      const pitDurationMs = 3500;

      const player0 = { x: 1, y: 1 };
      let rock, dist0, attempts = 0;
      do {
        rock = Array.from({ length: H }, (_, y) =>
          Array.from({ length: W }, (_, x) => {
            if (x === 0 || y === 0 || x === W - 1 || y === H - 1) return true;
            if (x === player0.x && y === player0.y) return false;
            return Math.random() < rockDensity;
          }));
        dist0 = bfsReachable((x, y) => !rock[y][x], W, H, player0);
        attempts++;
      } while (countReachable(dist0) < goldTarget + enemyCount + 5 && attempts < 15);

      const reachableCells = [];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (dist0[y][x] > 0) reachableCells.push({ x, y, d: dist0[y][x] });
      }
      const gold = new Set();
      reachableCells.slice().sort(() => Math.random() - 0.5).forEach(c => {
        if (gold.size < goldTarget) gold.add(c.x + ',' + c.y);
      });
      const farCells = reachableCells.filter(c => c.d > Math.max(3, Math.floor(reachableCells.length ** 0.5)));
      const enemies = [];
      for (let i = 0; i < enemyCount; i++) {
        const pool = farCells.length ? farCells : reachableCells;
        const pick = pool[Math.floor(Math.random() * pool.length)] || { x: W - 2, y: H - 2 };
        enemies.push({ x: pick.x, y: pick.y });
      }

      let player = { x: player0.x, y: player0.y, facing: [0, 1] };
      let collected = 0;
      let alive = true;
      const pits = new Map(); // key -> timeoutId

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
          <button data-act="dig" aria-label="Копать" style="background:#5a4426;">⛏</button>
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
      const isPassable = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !rock[y][x] && !pits.has(x + ',' + y);

      function resize() {
        const avail = Math.min(wrap.clientWidth / W, wrap.clientHeight / H);
        const dpr = window.devicePixelRatio || 1;
        cell = Math.max(10, Math.floor(avail) - 1);
        canvas.style.width = (cell * W) + 'px';
        canvas.style.height = (cell * H) + 'px';
        canvas.width = cell * W * dpr;
        canvas.height = cell * H * dpr;
        draw();
      }

      function draw() {
        const dpr = window.devicePixelRatio || 1;
        const c = cell * dpr;
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const key = x + ',' + y;
            ctx.fillStyle = rock[y][x] ? '#2a2542' : pits.has(key) ? '#0a0812' : '#100e1c';
            ctx.fillRect(x * c, y * c, c, c);
          }
        }
        gold.forEach(k => {
          const [x, y] = k.split(',').map(Number);
          ctx.fillStyle = '#e8a33d';
          ctx.beginPath();
          ctx.arc(x * c + c / 2, y * c + c / 2, c * 0.24, 0, Math.PI * 2);
          ctx.fill();
        });
        enemies.forEach(e => {
          ctx.fillStyle = '#d1495b';
          ctx.beginPath();
          ctx.arc(e.x * c + c / 2, e.y * c + c / 2, c * 0.32, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.fillStyle = '#3ea8a0';
        ctx.beginPath();
        ctx.arc(player.x * c + c / 2, player.y * c + c / 2, c * 0.32, 0, Math.PI * 2);
        ctx.fill();
        // индикатор направления взгляда
        ctx.fillStyle = '#100e1c';
        ctx.fillRect(
          player.x * c + c / 2 + player.facing[0] * c * 0.22 - c * 0.05,
          player.y * c + c / 2 + player.facing[1] * c * 0.22 - c * 0.05,
          c * 0.1, c * 0.1
        );
      }

      function checkCollision() {
        if (enemies.some(e => e.x === player.x && e.y === player.y)) finish(false);
      }

      function tryMove(dx, dy) {
        if (!alive) return;
        player.facing = [dx, dy];
        const nx = player.x + dx, ny = player.y + dy;
        if (isPassable(nx, ny)) {
          player = { ...player, x: nx, y: ny };
          const key = nx + ',' + ny;
          if (gold.has(key)) {
            gold.delete(key);
            collected++;
            if (setStatus) setStatus(`${collected} / ${goldTarget} · копать: ${digsLeft}`);
          }
        }
        draw();
        checkCollision();
        if (alive && collected >= goldTarget) finish(true);
      }

      function dig() {
        if (!alive || digsLeft <= 0) return;
        const tx = player.x + player.facing[0], ty = player.y + player.facing[1];
        if (tx < 0 || ty < 0 || tx >= W || ty >= H || rock[ty][tx]) return;
        const key = tx + ',' + ty;
        if (pits.has(key)) return;
        digsLeft--;
        if (setStatus) setStatus(`${collected} / ${goldTarget} · копать: ${digsLeft}`);
        const timeoutId = setTimeout(() => { pits.delete(key); if (alive) draw(); }, pitDurationMs);
        pits.set(key, timeoutId);
        draw();
      }

      controls.querySelectorAll('[data-dir]').forEach(bindDirBtn);
      downRow.querySelectorAll('[data-dir]').forEach(bindDirBtn);
      function bindDirBtn(btn) {
        const map = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
        const act = () => tryMove(...map[btn.dataset.dir]);
        btn.addEventListener('touchstart', e => { e.preventDefault(); act(); }, { passive: false });
        btn.addEventListener('click', act);
      }
      controls.querySelectorAll('[data-act="dig"]').forEach(btn => {
        btn.addEventListener('touchstart', e => { e.preventDefault(); dig(); }, { passive: false });
        btn.addEventListener('click', dig);
      });

      function keyHandler(e) {
        const map = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
        if (map[e.key]) { e.preventDefault(); tryMove(...map[e.key]); }
        if (e.key === ' ') { e.preventDefault(); dig(); }
      }
      window.addEventListener('keydown', keyHandler);

      let touchStart = null;
      canvas.addEventListener('touchstart', e => {
        const t = e.touches[0];
        touchStart = { x: t.clientX, y: t.clientY };
      }, { passive: true });
      canvas.addEventListener('touchend', e => {
        if (!touchStart) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - touchStart.x, dy = t.clientY - touchStart.y;
        if (Math.abs(dx) < 16 && Math.abs(dy) < 16) { dig(); touchStart = null; return; }
        if (Math.abs(dx) > Math.abs(dy)) tryMove(dx > 0 ? 1 : -1, 0);
        else tryMove(0, dy > 0 ? 1 : -1);
        touchStart = null;
      }, { passive: true });

      let enemyTimer = null;
      function enemyTick() {
        if (!alive) return;
        enemies.forEach(e => {
          const next = bfsNextStep(isPassable, W, H, e, player);
          e.x = next.x; e.y = next.y;
        });
        draw();
        checkCollision();
        if (alive) enemyTimer = setTimeout(enemyTick, enemyStepMs);
      }

      function onResize() { resize(); }
      window.addEventListener('resize', onResize);

      function cleanup() {
        window.removeEventListener('keydown', keyHandler);
        window.removeEventListener('resize', onResize);
        clearTimeout(enemyTimer);
        pits.forEach(id => clearTimeout(id));
      }

      function finish(won) {
        if (!alive) return;
        alive = false;
        cleanup();
        if (won) onWin(); else onLose();
      }

      if (setStatus) setStatus(`0 / ${goldTarget} · копать: ${digsLeft}`);
      resize();
      enemyTimer = setTimeout(enemyTick, enemyStepMs);

      return function destroy() { alive = false; cleanup(); };
    },
  };
})();
