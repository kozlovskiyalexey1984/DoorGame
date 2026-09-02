// Мини-игра «Bejeweled» (свап соседних камней).
// Контракт: Games.bejeweled.start(container, { difficulty, onWin, onLose, setStatus })

window.Games = window.Games || {};

window.Games.bejeweled = {
  name: 'Bejeweled',

  start(container, { difficulty = 1, onWin, onLose, setStatus }) {
    const SIZE = 8;
    const COLORS = ['#d1495b', '#e8a33d', '#3ea8a0', '#6fae8c', '#a97fd6'];
    const target = difficulty >= 2 ? 50 : 32;
    let movesLeft = difficulty >= 2 ? 16 : 22;

    container.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'game-canvas-wrap';
    const canvas = document.createElement('canvas');
    wrap.appendChild(canvas);
    container.appendChild(wrap);

    let grid = [];
    let scoreCleared = 0;
    let alive = true;
    let busy = false; // идёт анимация/каскад — вход блокирован
    let selected = null;
    let cell = 0;

    function randColor(exclude) {
      let c;
      do { c = Math.floor(Math.random() * COLORS.length); } while (c === exclude);
      return c;
    }

    function matchesAt(g) {
      const marks = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));
      for (let r = 0; r < SIZE; r++) {
        let run = 1;
        for (let c = 1; c <= SIZE; c++) {
          if (c < SIZE && g[r][c] !== null && g[r][c] === g[r][c - 1]) run++;
          else {
            if (run >= 3) for (let k = c - run; k < c; k++) marks[r][k] = true;
            run = 1;
          }
        }
      }
      for (let c = 0; c < SIZE; c++) {
        let run = 1;
        for (let r = 1; r <= SIZE; r++) {
          if (r < SIZE && g[r][c] !== null && g[r][c] === g[r - 1][c]) run++;
          else {
            if (run >= 3) for (let k = r - run; k < r; k++) marks[k][c] = true;
            run = 1;
          }
        }
      }
      return marks;
    }

    function hasAnyMatch(marks) { return marks.some(row => row.some(v => v)); }

    function initGrid() {
      grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          const left1 = c >= 1 ? grid[r][c - 1] : null;
          const left2 = c >= 2 ? grid[r][c - 2] : null;
          const up1 = r >= 1 ? grid[r - 1][c] : null;
          const up2 = r >= 2 ? grid[r - 2][c] : null;
          let color;
          do { color = Math.floor(Math.random() * COLORS.length); }
          while ((left1 !== null && left1 === left2 && color === left1) ||
                 (up1 !== null && up1 === up2 && color === up1));
          grid[r][c] = color;
        }
      }
    }

    function resize() {
      const avail = Math.min(wrap.clientWidth, wrap.clientHeight) - 4;
      const dpr = window.devicePixelRatio || 1;
      cell = Math.max(16, Math.floor(avail / SIZE));
      canvas.style.width = (cell * SIZE) + 'px';
      canvas.style.height = (cell * SIZE) + 'px';
      canvas.width = cell * SIZE * dpr;
      canvas.height = cell * SIZE * dpr;
      draw();
    }

    const ctx = canvas.getContext('2d');

    function draw() {
      const dpr = window.devicePixelRatio || 1;
      const c = cell * dpr;
      ctx.fillStyle = '#181428';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (let r = 0; r < SIZE; r++) {
        for (let col = 0; col < SIZE; col++) {
          const v = grid[r][col];
          if (v === null) continue;
          const isSel = selected && selected.r === r && selected.c === col;
          ctx.fillStyle = COLORS[v];
          ctx.globalAlpha = isSel ? 0.6 : 1;
          ctx.beginPath();
          ctx.arc(col * c + c / 2, r * c + c / 2, c * 0.36, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          if (isSel) {
            ctx.strokeStyle = '#f2ede4';
            ctx.lineWidth = Math.max(2, c * 0.05);
            ctx.stroke();
          }
        }
      }
    }

    function collapseAndRefill() {
      for (let c = 0; c < SIZE; c++) {
        const vals = [];
        for (let r = 0; r < SIZE; r++) if (grid[r][c] !== null) vals.push(grid[r][c]);
        const missing = SIZE - vals.length;
        const col = [];
        for (let i = 0; i < missing; i++) col.push(Math.floor(Math.random() * COLORS.length));
        for (const v of vals) col.push(v);
        for (let r = 0; r < SIZE; r++) grid[r][c] = col[r];
      }
    }

    function resolveCascades() {
      let marks = matchesAt(grid);
      while (hasAnyMatch(marks)) {
        let removed = 0;
        for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
          if (marks[r][c]) { grid[r][c] = null; removed++; }
        }
        scoreCleared += removed;
        collapseAndRefill();
        marks = matchesAt(grid);
      }
      if (setStatus) setStatus(`${Math.min(scoreCleared, target)} / ${target}`);
    }

    function adjacent(a, b) {
      return (Math.abs(a.r - b.r) === 1 && a.c === b.c) || (Math.abs(a.c - b.c) === 1 && a.r === b.r);
    }

    function swap(a, b) {
      const t = grid[a.r][a.c];
      grid[a.r][a.c] = grid[b.r][b.c];
      grid[b.r][b.c] = t;
    }

    function handleClick(r, c) {
      if (!alive || busy) return;
      if (!selected) { selected = { r, c }; draw(); return; }
      if (selected.r === r && selected.c === c) { selected = null; draw(); return; }

      const a = selected;
      const b = { r, c };
      if (!adjacent(a, b)) { selected = { r, c }; draw(); return; }

      swap(a, b);
      const marks = matchesAt(grid);
      selected = null;

      if (!hasAnyMatch(marks)) {
        swap(a, b); // ход не дал совпадения — отменяем (swap сам себе обратный)
        draw();
        return;
      }

      movesLeft--;
      busy = true;
      draw();
      resolveCascades();
      draw();
      busy = false;

      if (scoreCleared >= target) { finish(true); return; }
      if (movesLeft <= 0) { finish(false); return; }
    }

    canvas.addEventListener('click', e => {
      const rect = canvas.getBoundingClientRect();
      const c = Math.floor((e.clientX - rect.left) / cell);
      const r = Math.floor((e.clientY - rect.top) / cell);
      if (r >= 0 && r < SIZE && c >= 0 && c < SIZE) handleClick(r, c);
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
    if (setStatus) setStatus(`0 / ${target}`);
    resize();

    return function destroy() { alive = false; cleanup(); };
  },
};
