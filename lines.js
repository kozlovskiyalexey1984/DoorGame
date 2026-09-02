// Мини-игра «Lines» (Color Lines).
// Контракт: Games.lines.start(container, { difficulty, onWin, onLose, setStatus })

window.Games = window.Games || {};

window.Games.lines = {
  name: 'Lines',

  start(container, { difficulty = 1, onWin, onLose, setStatus }) {
    const SIZE = 8;
    const COLORS = ['#d1495b', '#e8a33d', '#3ea8a0', '#6fae8c', '#a97fd6', '#5b8ac2'];
    const colorCount = difficulty >= 2 ? 6 : 5;
    const target = difficulty >= 2 ? 40 : 25;
    const newPerTurn = 3;
    const initialBalls = difficulty >= 2 ? 7 : 5;

    container.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'game-canvas-wrap';
    const canvas = document.createElement('canvas');
    wrap.appendChild(canvas);
    container.appendChild(wrap);

    let grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    let scoreCleared = 0;
    let selected = null;
    let alive = true;
    let cell = 0;

    function emptyCells() {
      const out = [];
      for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (grid[r][c] === null) out.push({ r, c });
      return out;
    }

    function placeRandomBalls(n) {
      const free = emptyCells();
      for (let i = 0; i < n && free.length; i++) {
        const idx = Math.floor(Math.random() * free.length);
        const { r, c } = free.splice(idx, 1)[0];
        grid[r][c] = Math.floor(Math.random() * colorCount);
      }
      return free.length === 0 && n > 0;
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
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      for (let i = 1; i < SIZE; i++) {
        ctx.beginPath(); ctx.moveTo(i * c, 0); ctx.lineTo(i * c, canvas.height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i * c); ctx.lineTo(canvas.width, i * c); ctx.stroke();
      }
      for (let r = 0; r < SIZE; r++) {
        for (let col = 0; col < SIZE; col++) {
          const v = grid[r][col];
          if (v === null) continue;
          const isSel = selected && selected.r === r && selected.c === col;
          ctx.fillStyle = COLORS[v];
          ctx.beginPath();
          ctx.arc(col * c + c / 2, r * c + c / 2, c * (isSel ? 0.28 : 0.36), 0, Math.PI * 2);
          ctx.fill();
          if (isSel) {
            ctx.strokeStyle = '#f2ede4';
            ctx.lineWidth = Math.max(2, c * 0.05);
            ctx.stroke();
          }
        }
      }
    }

    function pathExists(a, b) {
      const seen = new Set([a.r + ',' + a.c]);
      const q = [a];
      let head = 0;
      const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
      while (head < q.length) {
        const cur = q[head++];
        if (cur.r === b.r && cur.c === b.c) return true;
        for (const [dr, dc] of dirs) {
          const nr = cur.r + dr, nc = cur.c + dc;
          if (nr < 0 || nc < 0 || nr >= SIZE || nc >= SIZE) continue;
          if (grid[nr][nc] !== null) continue; // проходить можно только по пустым клеткам
          const key = nr + ',' + nc;
          if (seen.has(key)) continue;
          seen.add(key);
          q.push({ r: nr, c: nc });
        }
      }
      return false;
    }

    function findLines(r, c) {
      const color = grid[r][c];
      if (color === null) return [];
      const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
      const toRemove = new Set();
      for (const [dr, dc] of dirs) {
        const line = [[r, c]];
        let rr = r + dr, cc = c + dc;
        while (rr >= 0 && rr < SIZE && cc >= 0 && cc < SIZE && grid[rr][cc] === color) { line.push([rr, cc]); rr += dr; cc += dc; }
        rr = r - dr; cc = c - dc;
        while (rr >= 0 && rr < SIZE && cc >= 0 && cc < SIZE && grid[rr][cc] === color) { line.push([rr, cc]); rr -= dr; cc -= dc; }
        if (line.length >= 5) line.forEach(([lr, lc]) => toRemove.add(lr + ',' + lc));
      }
      return [...toRemove].map(k => k.split(',').map(Number));
    }

    function handleClick(r, c) {
      if (!alive) return;
      if (grid[r][c] !== null) { selected = { r, c }; draw(); return; }
      if (!selected) return;
      if (!pathExists(selected, { r, c })) return;

      grid[r][c] = grid[selected.r][selected.c];
      grid[selected.r][selected.c] = null;
      selected = null;

      const cleared = findLines(r, c);
      if (cleared.length) {
        cleared.forEach(([lr, lc]) => { grid[lr][lc] = null; });
        scoreCleared += cleared.length;
        if (setStatus) setStatus(`${Math.min(scoreCleared, target)} / ${target}`);
        draw();
        if (scoreCleared >= target) { finish(true); return; }
      } else {
        const boardFull = placeRandomBalls(newPerTurn);
        draw();
        if (boardFull) { finish(false); return; }
      }
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

    placeRandomBalls(initialBalls);
    if (setStatus) setStatus(`0 / ${target}`);
    resize();

    return function destroy() { alive = false; cleanup(); };
  },
};
