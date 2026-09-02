// Мини-игра «Тетрис».
// Контракт: Games.tetris.start(container, { difficulty, onWin, onLose, setStatus })
// Управление — обязательно 4 кнопки: влево, вправо, вращать, вниз (плюс стрелки на клавиатуре).

window.Games = window.Games || {};

window.Games.tetris = (() => {
  const COLS = 8;
  const ROWS = 14;

  const PIECES = {
    I: { m: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], color: '#3ea8a0' },
    O: { m: [[1,1],[1,1]], color: '#e8a33d' },
    T: { m: [[0,1,0],[1,1,1],[0,0,0]], color: '#a97fd6' },
    S: { m: [[0,1,1],[1,1,0],[0,0,0]], color: '#6fae8c' },
    Z: { m: [[1,1,0],[0,1,1],[0,0,0]], color: '#d1495b' },
    J: { m: [[1,0,0],[1,1,1],[0,0,0]], color: '#5b8ac2' },
    L: { m: [[0,0,1],[1,1,1],[0,0,0]], color: '#e0854a' },
  };
  const NAMES = Object.keys(PIECES);

  function rotateCW(m) {
    const n = m.length;
    const res = Array.from({ length: n }, () => Array(n).fill(0));
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) res[x][n - 1 - y] = m[y][x];
    return res;
  }

  return {
    name: 'Тетрис',

    start(container, { difficulty = 1, onWin, onLose, setStatus }) {
      const stepMs = Math.max(220, 720 - difficulty * 160);
      const targetLines = 2 + difficulty * 2;

      container.innerHTML = '';
      const wrap = document.createElement('div');
      wrap.className = 'game-canvas-wrap';
      const canvas = document.createElement('canvas');
      wrap.appendChild(canvas);
      container.appendChild(wrap);

      const controls = document.createElement('div');
      controls.className = 'game-controls';
      controls.innerHTML = `
        <div class="dpad" style="grid-template-columns:repeat(4,54px);grid-template-rows:54px;">
          <button data-act="left" aria-label="Влево">◀</button>
          <button data-act="rotate" aria-label="Вращать">↻</button>
          <button data-act="down" aria-label="Вниз">▼</button>
          <button data-act="right" aria-label="Вправо">▶</button>
        </div>`;
      container.appendChild(controls);

      const board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
      let piece = null, px = 0, py = 0;
      let linesCleared = 0;
      let alive = true;
      let cell = 0;

      function spawn() {
        const name = NAMES[Math.floor(Math.random() * NAMES.length)];
        piece = { name, m: PIECES[name].m.map(r => r.slice()), color: PIECES[name].color };
        px = Math.floor((COLS - piece.m.length) / 2);
        py = -1;
        if (collide(piece.m, px, py)) finish(false);
      }

      function collide(m, ox, oy) {
        for (let y = 0; y < m.length; y++) {
          for (let x = 0; x < m.length; x++) {
            if (!m[y][x]) continue;
            const bx = ox + x, by = oy + y;
            if (bx < 0 || bx >= COLS || by >= ROWS) return true;
            if (by >= 0 && board[by][bx]) return true;
          }
        }
        return false;
      }

      function lock() {
        piece.m.forEach((row, y) => row.forEach((v, x) => {
          if (!v) return;
          const bx = px + x, by = py + y;
          if (by >= 0) board[by][bx] = piece.color;
        }));
        let cleared = 0;
        for (let y = ROWS - 1; y >= 0; y--) {
          if (board[y].every(c => c)) {
            board.splice(y, 1);
            board.unshift(Array(COLS).fill(null));
            cleared++;
            y++;
          }
        }
        if (cleared) {
          linesCleared += cleared;
          if (setStatus) setStatus(`${linesCleared} / ${targetLines}`);
          if (linesCleared >= targetLines) { finish(true); return; }
        }
        spawn();
      }

      function resize() {
        const availW = wrap.clientWidth - 4;
        const availH = wrap.clientHeight - 4;
        cell = Math.max(14, Math.floor(Math.min(availW / COLS, availH / ROWS)));
        const dpr = window.devicePixelRatio || 1;
        canvas.style.width = (cell * COLS) + 'px';
        canvas.style.height = (cell * ROWS) + 'px';
        canvas.width = cell * COLS * dpr;
        canvas.height = cell * ROWS * dpr;
        draw();
      }

      const ctx = canvas.getContext('2d');

      function drawCell(gx, gy, color, dpr) {
        const c = cell * dpr, p = c * 0.06;
        ctx.fillStyle = color;
        ctx.fillRect(gx * c + p, gy * c + p, c - p * 2, c - p * 2);
      }

      function draw() {
        const dpr = window.devicePixelRatio || 1;
        ctx.fillStyle = '#181428';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        for (let x = 1; x < COLS; x++) {
          ctx.beginPath(); ctx.moveTo(x * cell * dpr, 0); ctx.lineTo(x * cell * dpr, canvas.height); ctx.stroke();
        }
        for (let y = 1; y < ROWS; y++) {
          ctx.beginPath(); ctx.moveTo(0, y * cell * dpr); ctx.lineTo(canvas.width, y * cell * dpr); ctx.stroke();
        }
        board.forEach((row, y) => row.forEach((c, x) => { if (c) drawCell(x, y, c, dpr); }));
        if (piece) {
          piece.m.forEach((row, y) => row.forEach((v, x) => {
            if (v && py + y >= 0) drawCell(px + x, py + y, piece.color, dpr);
          }));
        }
      }

      function tryMove(dx, dy) {
        if (!alive) return false;
        if (!collide(piece.m, px + dx, py + dy)) { px += dx; py += dy; draw(); return true; }
        return false;
      }

      function tryRotate() {
        if (!alive) return;
        const r = rotateCW(piece.m);
        for (const kick of [0, 1, -1, 2, -2]) {
          if (!collide(r, px + kick, py)) { piece.m = r; px += kick; draw(); return; }
        }
      }

      function softDrop() {
        if (!tryMove(0, 1)) { lock(); draw(); }
      }

      let timer = null;
      function tick() {
        if (!alive) return;
        if (!tryMove(0, 1)) lock();
        draw();
        timer = setTimeout(tick, stepMs);
      }

      function finish(won) {
        if (!alive) return;
        alive = false;
        clearTimeout(timer);
        cleanup();
        if (won) onWin(); else onLose();
      }

      controls.querySelectorAll('[data-act]').forEach(btn => {
        const actions = {
          left: () => tryMove(-1, 0),
          right: () => tryMove(1, 0),
          rotate: () => tryRotate(),
          down: () => softDrop(),
        };
        const run = () => actions[btn.dataset.act]();
        btn.addEventListener('touchstart', e => { e.preventDefault(); run(); }, { passive: false });
        btn.addEventListener('click', run);
      });

      function keyHandler(e) {
        const map = { ArrowLeft: () => tryMove(-1, 0), ArrowRight: () => tryMove(1, 0), ArrowUp: () => tryRotate(), ArrowDown: () => softDrop() };
        if (map[e.key]) { e.preventDefault(); map[e.key](); }
      }
      window.addEventListener('keydown', keyHandler);

      function onResize() { resize(); }
      window.addEventListener('resize', onResize);

      function cleanup() {
        window.removeEventListener('keydown', keyHandler);
        window.removeEventListener('resize', onResize);
      }

      if (setStatus) setStatus(`0 / ${targetLines}`);
      spawn();
      resize();
      timer = setTimeout(tick, stepMs);

      return function destroy() { alive = false; clearTimeout(timer); cleanup(); };
    },
  };
})();
