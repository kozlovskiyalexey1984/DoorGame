// Мини-игра «Collapse!».
// Контракт: Games.collapse.start(container, { difficulty, onWin, onLose, setStatus })
// Тап по группе из 2+ одноцветных соседних блоков убирает её; блоки падают вниз,
// пустые столбцы схлопываются влево. Поражение — если ходов больше не осталось.

window.Games = window.Games || {};

window.Games.collapse = {
  name: 'Collapse!',

  start(container, { difficulty = 1, onWin, onLose, setStatus }) {
    const COLS = 8, ROWS = 9;
    const PALETTE = ['#d1495b', '#e8a33d', '#3ea8a0', '#6fae8c', '#a97fd6'];
    const colorCount = difficulty >= 2 ? 5 : 4;
    const targetRatio = difficulty >= 2 ? 0.68 : 0.55;
    const total = COLS * ROWS;
    const target = Math.round(total * targetRatio);

    container.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'game-canvas-wrap';
    const canvas = document.createElement('canvas');
    wrap.appendChild(canvas);
    container.appendChild(wrap);

    // grid[col][row], row 0 = верх
    let grid = [];
    let cleared = 0;
    let alive = true;
    let cell = 0;

    function randomColor() { return Math.floor(Math.random() * colorCount); }

    function hasAnyMove() {
      for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS; r++) {
          if (grid[c][r] === null) continue;
          if (clusterAt(c, r).length >= 2) return true;
        }
      }
      return false;
    }

    function initGrid() {
      let attempts = 0;
      do {
        grid = Array.from({ length: COLS }, () => Array.from({ length: ROWS }, () => randomColor()));
        attempts++;
      } while (!hasAnyMove() && attempts < 20);
      cleared = 0;
      if (setStatus) setStatus(`0 / ${target}`);
    }

    function resize() {
      const availW = wrap.clientWidth - 4;
      const availH = wrap.clientHeight - 4;
      const dpr = window.devicePixelRatio || 1;
      cell = Math.max(14, Math.floor(Math.min(availW / COLS, availH / ROWS)));
      canvas.style.width = (cell * COLS) + 'px';
      canvas.style.height = (cell * ROWS) + 'px';
      canvas.width = cell * COLS * dpr;
      canvas.height = cell * ROWS * dpr;
      draw();
    }

    const ctx = canvas.getContext('2d');

    function draw() {
      const dpr = window.devicePixelRatio || 1;
      const c = cell * dpr;
      ctx.fillStyle = '#181428';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (let col = 0; col < COLS; col++) {
        for (let row = 0; row < ROWS; row++) {
          const v = grid[col][row];
          if (v === null) continue;
          const p = c * 0.08;
          ctx.fillStyle = PALETTE[v];
          const x = col * c + p, y = row * c + p, s = c - p * 2;
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(x, y, s, s, c * 0.18); else ctx.rect(x, y, s, s);
          ctx.fill();
        }
      }
    }

    function neighbors(c, r) {
      return [[c - 1, r], [c + 1, r], [c, r - 1], [c, r + 1]]
        .filter(([cc, rr]) => cc >= 0 && cc < COLS && rr >= 0 && rr < ROWS);
    }

    function clusterAt(c, r) {
      const color = grid[c][r];
      if (color === null) return [];
      const seen = new Set([c + ',' + r]);
      const stack = [[c, r]];
      const cluster = [[c, r]];
      while (stack.length) {
        const [cc, rr] = stack.pop();
        for (const [nc, nr] of neighbors(cc, rr)) {
          const key = nc + ',' + nr;
          if (seen.has(key) || grid[nc][nr] !== color) continue;
          seen.add(key);
          stack.push([nc, nr]);
          cluster.push([nc, nr]);
        }
      }
      return cluster;
    }

    function applyGravityAndCompact() {
      for (let c = 0; c < COLS; c++) {
        const vals = grid[c].filter(v => v !== null);
        const col = Array(ROWS).fill(null);
        for (let i = 0; i < vals.length; i++) col[ROWS - vals.length + i] = vals[i];
        grid[c] = col;
      }
      const nonEmpty = grid.filter(col => col.some(v => v !== null));
      const empty = grid.filter(col => !col.some(v => v !== null));
      grid = nonEmpty.concat(empty);
    }

    function handleTap(c, r) {
      if (!alive) return;
      const cluster = clusterAt(c, r);
      if (cluster.length < 2) return;
      cluster.forEach(([cc, rr]) => { grid[cc][rr] = null; });
      cleared += cluster.length;
      applyGravityAndCompact();
      if (setStatus) setStatus(`${Math.min(cleared, target)} / ${target}`);
      draw();

      if (cleared >= target) { finish(true); return; }
      if (!hasAnyMove()) { finish(false); return; }
    }

    canvas.addEventListener('click', e => {
      const rect = canvas.getBoundingClientRect();
      const c = Math.floor((e.clientX - rect.left) / cell);
      const r = Math.floor((e.clientY - rect.top) / cell);
      if (c >= 0 && c < COLS && r >= 0 && r < ROWS) handleTap(c, r);
    });

    function onResize() { resize(); }
    window.addEventListener('resize', onResize);
    function cleanup() { window.removeEventListener('resize', onResize); }

    function finish(won) {
      if (!alive) return;
      alive = false;
      cleanup();
      if (won) onWin(); else onLose();
    }

    initGrid();
    resize();

    return function destroy() { alive = false; cleanup(); };
  },
};
