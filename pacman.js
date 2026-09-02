// Мини-игра «Пакман» (упрощённая, по заметке из ГДД):
// короткий процедурный лабиринт → собери X точек → дойди до открывшегося
// выхода → не попадись призракам.
// Контракт: Games.pacman.start(container, { difficulty, onWin, onLose, setStatus })

window.Games = window.Games || {};

window.Games.pacman = (() => {
  function generateMaze(N) {
    const D = 2 * N + 1;
    const grid = Array.from({ length: D }, () => Array(D).fill(1));
    const cellXY = (cx, cy) => ({ x: 2 * cx + 1, y: 2 * cy + 1 });
    const visited = Array.from({ length: N }, () => Array(N).fill(false));
    const stack = [[0, 0]];
    visited[0][0] = true;
    { const { x, y } = cellXY(0, 0); grid[y][x] = 0; }

    while (stack.length) {
      const [cx, cy] = stack[stack.length - 1];
      const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
      const options = [];
      for (const [dx, dy] of dirs) {
        const nx = cx + dx, ny = cy + dy;
        if (nx >= 0 && ny >= 0 && nx < N && ny < N && !visited[ny][nx]) options.push([nx, ny, dx, dy]);
      }
      if (options.length) {
        const [nx, ny, dx, dy] = options[Math.floor(Math.random() * options.length)];
        const c = cellXY(cx, cy), n = cellXY(nx, ny);
        grid[c.y + dy][c.x + dx] = 0;
        grid[n.y][n.x] = 0;
        visited[ny][nx] = true;
        stack.push([nx, ny]);
      } else {
        stack.pop();
      }
    }
    return grid;
  }

  function bfsDistances(grid, D, start) {
    const dist = Array.from({ length: D }, () => Array(D).fill(-1));
    dist[start.y][start.x] = 0;
    const q = [start];
    let head = 0;
    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    while (head < q.length) {
      const cur = q[head++];
      for (const [dx, dy] of dirs) {
        const nx = cur.x + dx, ny = cur.y + dy;
        if (nx < 0 || ny < 0 || nx >= D || ny >= D) continue;
        if (grid[ny][nx] === 1) continue;
        if (dist[ny][nx] !== -1) continue;
        dist[ny][nx] = dist[cur.y][cur.x] + 1;
        q.push({ x: nx, y: ny });
      }
    }
    return dist;
  }

  function bfsNextStep(grid, D, from, to) {
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
        if (nx < 0 || ny < 0 || nx >= D || ny >= D || grid[ny][nx] === 1) continue;
        const k = nx + ',' + ny;
        if (visited.has(k)) continue;
        visited.add(k);
        prev.set(k, cur);
        q.push({ x: nx, y: ny });
      }
    }
    if (!found) return from;
    // идём от цели назад по prev, пока не дойдём до соседа, чей prev — это from
    let cur = to;
    while (true) {
      const p = prev.get(key(cur));
      if (!p || (p.x === from.x && p.y === from.y)) return cur;
      cur = p;
    }
  }

  return {
    name: 'Пакман',

    start(container, { difficulty = 1, onWin, onLose, setStatus }) {
      const N = difficulty >= 2 ? 6 : 5;
      const D = 2 * N + 1;
      const ghostCount = difficulty >= 2 ? 2 : 1;
      const ghostStepMs = difficulty >= 2 ? 420 : 520;
      const dotRatio = 0.5;

      const grid = generateMaze(N);
      let player = { x: 1, y: 1 };
      const dist0 = bfsDistances(grid, D, player);

      // точки на всех проходимых клетках, кроме старта
      const dots = new Set();
      for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) {
        if (grid[y][x] === 0 && !(x === player.x && y === player.y)) dots.add(x + ',' + y);
      }
      const dotTarget = Math.max(3, Math.round(dots.size * dotRatio));
      let dotsEaten = 0;
      let exitUnlocked = false;

      // выход — самая дальняя клетка от старта
      let exit = player, best = -1;
      for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) {
        if (grid[y][x] === 0 && dist0[y][x] > best) { best = dist0[y][x]; exit = { x, y }; }
      }
      dots.delete(exit.x + ',' + exit.y);

      // призраки — далёкие от игрока клетки
      const candidates = [];
      for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) {
        if (grid[y][x] === 0 && dist0[y][x] > D * 0.6) candidates.push({ x, y });
      }
      const ghosts = [];
      for (let i = 0; i < ghostCount; i++) {
        const c = candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : { x: D - 2, y: D - 2 };
        ghosts.push({ x: c.x, y: c.y });
      }

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
          <button data-dir="left" aria-label="Влево">◀</button><span></span><button data-dir="right" aria-label="Вправо">▶</button>
        </div>`;
      container.appendChild(controls);
      const downRow = document.createElement('div');
      downRow.className = 'game-controls';
      downRow.style.paddingTop = '0';
      downRow.innerHTML = `<button data-dir="down" aria-label="Вниз" style="width:54px;height:44px;background:var(--bg-panel-2);border-radius:12px;font-size:1.1rem;">▼</button>`;
      container.appendChild(downRow);

      let alive = true;
      let cell = 0;
      const ctx = canvas.getContext('2d');

      function resize() {
        const avail = Math.min(wrap.clientWidth, wrap.clientHeight) - 6;
        const dpr = window.devicePixelRatio || 1;
        cell = Math.max(10, Math.floor(avail / D));
        canvas.style.width = (cell * D) + 'px';
        canvas.style.height = (cell * D) + 'px';
        canvas.width = cell * D * dpr;
        canvas.height = cell * D * dpr;
        draw();
      }

      function draw() {
        const dpr = window.devicePixelRatio || 1;
        const c = cell * dpr;
        ctx.fillStyle = '#100e1c';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) {
          if (grid[y][x] === 1) {
            ctx.fillStyle = '#2a2542';
            ctx.fillRect(x * c, y * c, c, c);
          }
        }

        dots.forEach(k => {
          const [x, y] = k.split(',').map(Number);
          ctx.fillStyle = '#a79ecb';
          ctx.beginPath();
          ctx.arc(x * c + c / 2, y * c + c / 2, Math.max(1.5, c * 0.09), 0, Math.PI * 2);
          ctx.fill();
        });

        ctx.strokeStyle = exitUnlocked ? '#e8a33d' : '#4a4460';
        ctx.lineWidth = Math.max(2, c * 0.08);
        ctx.beginPath();
        ctx.arc(exit.x * c + c / 2, exit.y * c + c / 2, c * 0.32, 0, Math.PI * 2);
        ctx.stroke();
        if (exitUnlocked) {
          ctx.fillStyle = 'rgba(232,163,61,0.25)';
          ctx.fill();
        }

        ghosts.forEach(g => {
          ctx.fillStyle = '#d1495b';
          ctx.beginPath();
          ctx.arc(g.x * c + c / 2, g.y * c + c / 2, c * 0.34, 0, Math.PI * 2);
          ctx.fill();
        });

        ctx.fillStyle = '#e8a33d';
        ctx.beginPath();
        ctx.arc(player.x * c + c / 2, player.y * c + c / 2, c * 0.32, 0, Math.PI * 2);
        ctx.fill();
      }

      function checkCollision() {
        if (ghosts.some(g => g.x === player.x && g.y === player.y)) finish(false);
      }

      function tryMove(dx, dy) {
        if (!alive) return;
        const nx = player.x + dx, ny = player.y + dy;
        if (nx < 0 || ny < 0 || nx >= D || ny >= D || grid[ny][nx] === 1) return;
        player = { x: nx, y: ny };
        const key = nx + ',' + ny;
        if (dots.has(key)) {
          dots.delete(key);
          dotsEaten++;
          if (setStatus) setStatus(`${dotsEaten} / ${dotTarget}`);
          if (dotsEaten >= dotTarget) exitUnlocked = true;
        }
        draw();
        checkCollision();
        if (alive && exitUnlocked && player.x === exit.x && player.y === exit.y) finish(true);
      }

      controls.querySelectorAll('[data-dir]').forEach(bindBtn);
      downRow.querySelectorAll('[data-dir]').forEach(bindBtn);
      function bindBtn(btn) {
        const map = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
        const act = () => tryMove(...map[btn.dataset.dir]);
        btn.addEventListener('touchstart', e => { e.preventDefault(); act(); }, { passive: false });
        btn.addEventListener('click', act);
      }

      function keyHandler(e) {
        const map = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
        if (map[e.key]) { e.preventDefault(); tryMove(...map[e.key]); }
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
        if (Math.abs(dx) < 16 && Math.abs(dy) < 16) return;
        if (Math.abs(dx) > Math.abs(dy)) tryMove(dx > 0 ? 1 : -1, 0);
        else tryMove(0, dy > 0 ? 1 : -1);
        touchStart = null;
      }, { passive: true });

      let ghostTimer = null;
      function ghostTick() {
        if (!alive) return;
        ghosts.forEach(g => {
          const next = bfsNextStep(grid, D, g, player);
          g.x = next.x; g.y = next.y;
        });
        draw();
        checkCollision();
        if (alive) ghostTimer = setTimeout(ghostTick, ghostStepMs);
      }

      function onResize() { resize(); }
      window.addEventListener('resize', onResize);

      function cleanup() {
        window.removeEventListener('keydown', keyHandler);
        window.removeEventListener('resize', onResize);
        clearTimeout(ghostTimer);
      }

      function finish(won) {
        if (!alive) return;
        alive = false;
        cleanup();
        if (won) onWin(); else onLose();
      }

      if (setStatus) setStatus(`0 / ${dotTarget}`);
      resize();
      ghostTimer = setTimeout(ghostTick, ghostStepMs);

      return function destroy() { alive = false; cleanup(); };
    },
  };
})();
