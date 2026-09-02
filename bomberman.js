// Мини-игра «Бомбермен» (упрощённая).
// Контракт: Games.bomberman.start(container, { difficulty, onWin, onLose, setStatus })

window.Games = window.Games || {};

window.Games.bomberman = (() => {
  function bfsNextStep(isOpen, N, from, to) {
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
        if (nx < 0 || ny < 0 || nx >= N || ny >= N || !isOpen(nx, ny)) continue;
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

  function bfsConnected(notHard, N, from, to) {
    const seen = new Set([from.x + ',' + from.y]);
    const q = [from];
    let head = 0;
    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    while (head < q.length) {
      const cur = q[head++];
      if (cur.x === to.x && cur.y === to.y) return true;
      for (const [dx, dy] of dirs) {
        const nx = cur.x + dx, ny = cur.y + dy;
        if (nx < 0 || ny < 0 || nx >= N || ny >= N || !notHard(nx, ny)) continue;
        const k = nx + ',' + ny;
        if (seen.has(k)) continue;
        seen.add(k);
        q.push({ x: nx, y: ny });
      }
    }
    return false;
  }

  return {
    name: 'Бомбермен',

    start(container, { difficulty = 1, onWin, onLose, setStatus }) {
      const N = 11;
      const enemyTarget = difficulty >= 2 ? 3 : 2;
      const blastRadius = difficulty >= 2 ? 2 : 1;
      const bombFuseMs = 1700;
      const enemyStepMs = difficulty >= 2 ? 420 : 520;

      // 0=открыто, 1=мягкий блок (разрушаемый), 2=твёрдый столб
      let grid, enemySpots;
      const player0 = { x: 1, y: 1 };
      let tries = 0;
      do {
        grid = Array.from({ length: N }, (_, y) =>
          Array.from({ length: N }, (_, x) => {
            if (x === 0 || y === 0 || x === N - 1 || y === N - 1) return 2;
            if (x % 2 === 0 && y % 2 === 0) return 2;
            return 0;
          }));
        for (let y = 1; y < N - 1; y++) {
          for (let x = 1; x < N - 1; x++) {
            if (grid[y][x] === 2) continue;
            if (Math.abs(x - player0.x) + Math.abs(y - player0.y) <= 2) continue;
            if (Math.random() < 0.55) grid[y][x] = 1;
          }
        }
        enemySpots = [];
        for (let y = N - 2; y >= 1 && enemySpots.length < enemyTarget; y--) {
          for (let x = N - 2; x >= 1 && enemySpots.length < enemyTarget; x--) {
            if (grid[y][x] === 2) continue;
            if (Math.abs(x - player0.x) + Math.abs(y - player0.y) < 4) continue;
            const notHard = (xx, yy) => grid[yy][xx] !== 2;
            if (bfsConnected(notHard, N, player0, { x, y })) enemySpots.push({ x, y });
          }
        }
        tries++;
      } while (enemySpots.length < enemyTarget && tries < 10);

      const player = { x: player0.x, y: player0.y };
      const enemies = enemySpots.slice(0, enemyTarget).map(s => ({ x: s.x, y: s.y, alive: true }));
      let destroyed = 0;
      let bomb = null;
      let blastCells = new Map();
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
          <button data-act="bomb" aria-label="Бомба" style="background:#7a5a26;">💣</button>
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
      const isOpen = (x, y) => x >= 0 && y >= 0 && x < N && y < N && grid[y][x] === 0;

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

      function draw() {
        const dpr = window.devicePixelRatio || 1;
        const c = cell * dpr;
        for (let y = 0; y < N; y++) {
          for (let x = 0; x < N; x++) {
            const v = grid[y][x];
            const key = x + ',' + y;
            ctx.fillStyle = blastCells.has(key) ? '#e8a33d' : v === 2 ? '#2a2542' : v === 1 ? '#4a3d63' : '#100e1c';
            ctx.fillRect(x * c, y * c, c, c);
          }
        }
        if (bomb) {
          ctx.fillStyle = '#181428';
          ctx.beginPath();
          ctx.arc(bomb.x * c + c / 2, bomb.y * c + c / 2, c * 0.28, 0, Math.PI * 2);
          ctx.fill();
        }
        enemies.forEach(e => {
          if (!e.alive) return;
          ctx.fillStyle = '#d1495b';
          ctx.beginPath();
          ctx.arc(e.x * c + c / 2, e.y * c + c / 2, c * 0.32, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.fillStyle = '#3ea8a0';
        ctx.beginPath();
        ctx.arc(player.x * c + c / 2, player.y * c + c / 2, c * 0.32, 0, Math.PI * 2);
        ctx.fill();
      }

      function tryMove(dx, dy) {
        if (!alive) return;
        const nx = player.x + dx, ny = player.y + dy;
        if (isOpen(nx, ny)) { player.x = nx; player.y = ny; }
        draw();
      }

      function placeBomb() {
        if (!alive || bomb) return;
        bomb = { x: player.x, y: player.y };
        draw();
        setTimeout(explodeBomb, bombFuseMs);
      }

      function explodeBomb() {
        if (!alive || !bomb) return;
        const bx = bomb.x, by = bomb.y;
        bomb = null;
        const cells = [[bx, by]];
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (const [dx, dy] of dirs) {
          for (let step = 1; step <= blastRadius; step++) {
            const x = bx + dx * step, y = by + dy * step;
            if (x < 0 || y < 0 || x >= N || y >= N || grid[y][x] === 2) break;
            cells.push([x, y]);
            if (grid[y][x] === 1) { grid[y][x] = 0; break; }
          }
        }
        cells.forEach(([x, y]) => { blastCells.set(x + ',' + y, true); });
        draw();
        setTimeout(() => { blastCells.clear(); if (alive) draw(); }, 260);

        if (cells.some(([x, y]) => x === player.x && y === player.y)) { finish(false); return; }
        enemies.forEach(e => {
          if (e.alive && cells.some(([x, y]) => x === e.x && y === e.y)) {
            e.alive = false;
            destroyed++;
          }
        });
        if (setStatus) setStatus(`${destroyed} / ${enemyTarget}`);
        if (destroyed >= enemyTarget) finish(true);
      }

      controls.querySelectorAll('[data-dir]').forEach(bindDirBtn);
      downRow.querySelectorAll('[data-dir]').forEach(bindDirBtn);
      function bindDirBtn(btn) {
        const map = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
        const act = () => tryMove(...map[btn.dataset.dir]);
        btn.addEventListener('touchstart', e => { e.preventDefault(); act(); }, { passive: false });
        btn.addEventListener('click', act);
      }
      controls.querySelectorAll('[data-act="bomb"]').forEach(btn => {
        btn.addEventListener('touchstart', e => { e.preventDefault(); placeBomb(); }, { passive: false });
        btn.addEventListener('click', placeBomb);
      });

      function keyHandler(e) {
        const map = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
        if (map[e.key]) { e.preventDefault(); tryMove(...map[e.key]); }
        if (e.key === ' ') { e.preventDefault(); placeBomb(); }
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
        if (Math.abs(dx) < 16 && Math.abs(dy) < 16) { placeBomb(); touchStart = null; return; }
        if (Math.abs(dx) > Math.abs(dy)) tryMove(dx > 0 ? 1 : -1, 0);
        else tryMove(0, dy > 0 ? 1 : -1);
        touchStart = null;
      }, { passive: true });

      let enemyTimer = null;
      function enemyTick() {
        if (!alive) return;
        enemies.forEach(e => {
          if (!e.alive) return;
          const next = bfsNextStep(isOpen, N, e, player);
          e.x = next.x; e.y = next.y;
        });
        if (enemies.some(e => e.alive && e.x === player.x && e.y === player.y)) { finish(false); return; }
        draw();
        enemyTimer = setTimeout(enemyTick, enemyStepMs);
      }

      function onResize() { resize(); }
      window.addEventListener('resize', onResize);

      function cleanup() {
        window.removeEventListener('keydown', keyHandler);
        window.removeEventListener('resize', onResize);
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
      enemyTimer = setTimeout(enemyTick, enemyStepMs);

      return function destroy() { alive = false; cleanup(); };
    },
  };
})();
