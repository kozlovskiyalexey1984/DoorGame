// Мини-игра «Xonix».
// Контракт: Games.xonix.start(container, { difficulty, onWin, onLose, setStatus })
// Игрок ходит по захваченной территории свободно; заходя в незахваченную —
// оставляет след. Вернувшись на захваченную территорию, участок отрезается
// и заливкой присоединяется к захваченному (если там нет врага).

window.Games = window.Games || {};

window.Games.xonix = {
  name: 'Xonix',

  start(container, { difficulty = 1, onWin, onLose, setStatus }) {
    const COLS = 15, ROWS = 10;
    const enemyCount = difficulty >= 2 ? 2 : 1;
    const enemyStepMs = difficulty >= 2 ? 300 : 380;
    const targetRatio = difficulty >= 2 ? 0.68 : 0.55;

    let captured = Array.from({ length: ROWS }, (_, r) =>
      Array.from({ length: COLS }, (_, c) => (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1)));
    let trail = new Set();
    let player = { x: 0, y: 0 };
    let alive = true;

    const totalCells = COLS * ROWS;
    function capturedCount() {
      let n = 0;
      captured.forEach(row => row.forEach(v => { if (v) n++; }));
      return n;
    }

    const enemies = [];
    for (let i = 0; i < enemyCount; i++) {
      let ex, ey;
      do {
        ex = 1 + Math.floor(Math.random() * (COLS - 2));
        ey = 1 + Math.floor(Math.random() * (ROWS - 2));
      } while (captured[ey][ex]);
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      enemies.push({ x: ex, y: ey, dir: dirs[Math.floor(Math.random() * 4)] });
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

    let cell = 0;
    const ctx = canvas.getContext('2d');

    function resize() {
      const availW = wrap.clientWidth - 6, availH = wrap.clientHeight - 6;
      const dpr = window.devicePixelRatio || 1;
      cell = Math.max(10, Math.floor(Math.min(availW / COLS, availH / ROWS)));
      canvas.style.width = (cell * COLS) + 'px';
      canvas.style.height = (cell * ROWS) + 'px';
      canvas.width = cell * COLS * dpr;
      canvas.height = cell * ROWS * dpr;
      draw();
    }

    function draw() {
      const dpr = window.devicePixelRatio || 1;
      const c = cell * dpr;
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const key = x + ',' + y;
          ctx.fillStyle = captured[y][x] ? '#2a2542' : (trail.has(key) ? '#5a4426' : '#100e1c');
          ctx.fillRect(x * c, y * c, c, c);
        }
      }
      enemies.forEach(e => {
        ctx.fillStyle = '#d1495b';
        ctx.beginPath();
        ctx.arc(e.x * c + c / 2, e.y * c + c / 2, c * 0.34, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.fillStyle = '#3ea8a0';
      ctx.beginPath();
      ctx.arc(player.x * c + c / 2, player.y * c + c / 2, c * 0.34, 0, Math.PI * 2);
      ctx.fill();
    }

    function neighbors4(x, y) {
      return [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]
        .filter(([nx, ny]) => nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS);
    }

    function finalizeTrail() {
      trail.forEach(key => {
        const [x, y] = key.split(',').map(Number);
        captured[y][x] = true;
      });
      trail.clear();

      const visited = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          if (captured[y][x] || visited[y][x]) continue;
          const comp = [[x, y]];
          visited[y][x] = true;
          const q = [[x, y]];
          let head = 0;
          let hasEnemy = enemies.some(e => e.x === x && e.y === y);
          while (head < q.length) {
            const [cx, cy] = q[head++];
            for (const [nx, ny] of neighbors4(cx, cy)) {
              if (captured[ny][nx] || visited[ny][nx]) continue;
              visited[ny][nx] = true;
              comp.push([nx, ny]);
              q.push([nx, ny]);
              if (enemies.some(e => e.x === nx && e.y === ny)) hasEnemy = true;
            }
          }
          if (!hasEnemy) comp.forEach(([cx, cy]) => { captured[cy][cx] = true; });
        }
      }

      const ratio = capturedCount() / totalCells;
      if (setStatus) setStatus(`${Math.round(ratio * 100)}% / ${Math.round(targetRatio * 100)}%`);
      if (ratio >= targetRatio) { finish(true); return true; }
      return false;
    }

    function tryMove(dx, dy) {
      if (!alive) return;
      const nx = player.x + dx, ny = player.y + dy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) return;

      if (captured[ny][nx]) {
        player = { x: nx, y: ny };
        if (trail.size > 0) { if (finalizeTrail()) return; }
      } else {
        const key = nx + ',' + ny;
        if (trail.has(key)) { finish(false); return; }
        trail.add(key);
        player = { x: nx, y: ny };
        if (enemies.some(e => e.x === nx && e.y === ny)) { finish(false); return; }
      }
      draw();
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

    let enemyTimer = null;
    function enemyStepOne(e) {
      const tryDir = ([dx, dy]) => {
        const nx = e.x + dx, ny = e.y + dy;
        if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) return false;
        if (captured[ny][nx]) return false;
        e.x = nx; e.y = ny; e.dir = [dx, dy];
        return true;
      };
      if (!tryDir(e.dir)) {
        const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => {
          const nx = e.x + dx, ny = e.y + dy;
          return nx >= 0 && ny >= 0 && nx < COLS && ny < ROWS && !captured[ny][nx];
        });
        if (opts.length) tryDir(opts[Math.floor(Math.random() * opts.length)]);
      }
    }

    function enemyTick() {
      if (!alive) return;
      enemies.forEach(enemyStepOne);
      for (const e of enemies) {
        if (trail.has(e.x + ',' + e.y)) { finish(false); return; }
        if (e.x === player.x && e.y === player.y) { finish(false); return; }
      }
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

    if (setStatus) setStatus(`${Math.round((capturedCount() / totalCells) * 100)}% / ${Math.round(targetRatio * 100)}%`);
    resize();
    enemyTimer = setTimeout(enemyTick, enemyStepMs);

    return function destroy() { alive = false; cleanup(); };
  },
};
