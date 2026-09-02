// Мини-игра «Bubble Shooter» (упрощённая: квадратная сетка вместо гексагональной
// — так надёжнее считается попадание и сцепка одного цвета).
// Контракт: Games.bubbleshooter.start(container, { difficulty, onWin, onLose, setStatus })
// Для тестов: window.__forceColors = [0,1,2,...] — очередь цветов вместо случайных.

window.Games = window.Games || {};

window.Games.bubbleshooter = {
  name: 'Bubble Shooter',

  start(container, { difficulty = 1, onWin, onLose, setStatus }) {
    const COLORS = ['#d1495b', '#e8a33d', '#3ea8a0', '#6fae8c'];
    const COLS = 8;
    const MAX_ROWS = 11;
    const DANGER_ROW = MAX_ROWS - 2;
    const fillRows = difficulty >= 2 ? 5 : 3;
    const speed = 480;

    container.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'game-canvas-wrap';
    wrap.style.padding = '0';
    const canvas = document.createElement('canvas');
    wrap.appendChild(canvas);
    container.appendChild(wrap);

    let W = 0, H = 0, cellSize = 0, r = 0;
    let grid = Array.from({ length: MAX_ROWS }, () => Array(COLS).fill(null));
    let target = 0, cleared = 0;
    let alive = true;

    function nextColor() {
      if (window.__forceColors && window.__forceColors.length) return window.__forceColors.shift();
      return Math.floor(Math.random() * COLORS.length);
    }

    function initGrid() {
      grid = Array.from({ length: MAX_ROWS }, () => Array(COLS).fill(null));
      for (let row = 0; row < fillRows; row++) {
        for (let col = 0; col < COLS; col++) grid[row][col] = nextColor();
      }
      target = fillRows * COLS;
      cleared = 0;
      if (setStatus) setStatus(`0 / ${target}`);
    }

    function cellCenter(row, col) {
      return { x: col * cellSize + cellSize / 2, y: row * cellSize + cellSize / 2 };
    }

    let shooter = { x: 0, y: 0 };
    let current = 0, upcoming = 0;
    let ball = null; // {x,y,vx,vy,color} пока летит; null пока не выстрелили
    let aim = { x: 0, y: -1 };

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      W = wrap.clientWidth;
      cellSize = W / COLS;
      r = cellSize * 0.42;
      H = cellSize * (MAX_ROWS + 2);
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      shooter = { x: W / 2, y: cellSize * MAX_ROWS + cellSize * 0.8 };
      draw();
    }

    const ctx = canvas.getContext('2d');

    function draw() {
      ctx.fillStyle = '#181428';
      ctx.fillRect(0, 0, W, H);

      for (let row = 0; row < MAX_ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          const c = grid[row][col];
          if (c === null) continue;
          const { x, y } = cellCenter(row, col);
          ctx.fillStyle = COLORS[c];
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // линия опасности
      ctx.strokeStyle = 'rgba(209,73,91,0.35)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, (DANGER_ROW + 1) * cellSize);
      ctx.lineTo(W, (DANGER_ROW + 1) * cellSize);
      ctx.stroke();
      ctx.setLineDash([]);

      // прицел
      ctx.strokeStyle = 'rgba(242,237,228,0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(shooter.x, shooter.y);
      ctx.lineTo(shooter.x + aim.x * 60, shooter.y + aim.y * 60);
      ctx.stroke();

      // текущий шарик на платформе
      if (!ball) {
        ctx.fillStyle = COLORS[current];
        ctx.beginPath();
        ctx.arc(shooter.x, shooter.y, r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = COLORS[ball.color];
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // следующий (превью)
      ctx.fillStyle = COLORS[upcoming];
      ctx.beginPath();
      ctx.arc(W - r - 6, H - r - 6, r * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }

    function setAimFromPoint(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      let dx = (clientX - rect.left) - shooter.x;
      let dy = (clientY - rect.top) - shooter.y;
      if (dy > -10) dy = -10; // не даём целиться вниз/горизонтально
      const len = Math.hypot(dx, dy) || 1;
      aim = { x: dx / len, y: dy / len };
      draw();
    }

    function fire() {
      if (ball || !alive) return;
      ball = { x: shooter.x, y: shooter.y, vx: aim.x * speed, vy: aim.y * speed, color: current };
      current = upcoming;
      upcoming = nextColor();
    }

    function neighborsOf(row, col) {
      const offs = [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]];
      return offs.map(([dx, dy]) => [row + dy, col + dx])
        .filter(([rr, cc]) => rr >= 0 && rr < MAX_ROWS && cc >= 0 && cc < COLS);
    }

    function nearestEmptyCell(x, y) {
      let bestRow = Math.max(0, Math.min(MAX_ROWS - 1, Math.round((y - cellSize / 2) / cellSize)));
      let bestCol = Math.max(0, Math.min(COLS - 1, Math.round((x - cellSize / 2) / cellSize)));
      if (grid[bestRow][bestCol] === null) return { row: bestRow, col: bestCol };
      // расширяющийся поиск ближайшей свободной ячейки
      for (let radius = 1; radius < MAX_ROWS + COLS; radius++) {
        for (let dr = -radius; dr <= radius; dr++) {
          for (let dc = -radius; dc <= radius; dc++) {
            const rr = bestRow + dr, cc = bestCol + dc;
            if (rr < 0 || rr >= MAX_ROWS || cc < 0 || cc >= COLS) continue;
            if (grid[rr][cc] === null) return { row: rr, col: cc };
          }
        }
      }
      return { row: bestRow, col: bestCol };
    }

    function settleBall() {
      const { row, col } = nearestEmptyCell(ball.x, ball.y);
      grid[row][col] = ball.color;
      ball = null;

      if (row >= DANGER_ROW) { finish(false); return; }

      // сцепка того же цвета
      const color = grid[row][col];
      const seen = new Set([row + ',' + col]);
      const stack = [[row, col]];
      const cluster = [[row, col]];
      while (stack.length) {
        const [r0, c0] = stack.pop();
        for (const [rr, cc] of neighborsOf(r0, c0)) {
          const key = rr + ',' + cc;
          if (seen.has(key) || grid[rr][cc] !== color) continue;
          seen.add(key);
          stack.push([rr, cc]);
          cluster.push([rr, cc]);
        }
      }

      let poppedNow = 0;
      if (cluster.length >= 3) {
        cluster.forEach(([rr, cc]) => { grid[rr][cc] = null; });
        poppedNow += cluster.length;
      }

      // плавающие (не связанные с верхним рядом) шарики тоже убираем
      const anchored = new Set();
      const q = [];
      for (let c = 0; c < COLS; c++) if (grid[0][c] !== null) { anchored.add('0,' + c); q.push([0, c]); }
      let head = 0;
      while (head < q.length) {
        const [r0, c0] = q[head++];
        for (const [rr, cc] of neighborsOf(r0, c0)) {
          const key = rr + ',' + cc;
          if (anchored.has(key) || grid[rr][cc] === null) continue;
          anchored.add(key);
          q.push([rr, cc]);
        }
      }
      for (let rr = 0; rr < MAX_ROWS; rr++) for (let cc = 0; cc < COLS; cc++) {
        if (grid[rr][cc] !== null && !anchored.has(rr + ',' + cc)) {
          grid[rr][cc] = null;
          poppedNow++;
        }
      }

      cleared += poppedNow;
      if (setStatus) setStatus(`${Math.min(cleared, target)} / ${target}`);
      if (cleared >= target) { finish(true); return; }
      draw();
    }

    canvas.addEventListener('touchstart', e => { setAimFromPoint(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
    canvas.addEventListener('touchmove', e => { e.preventDefault(); setAimFromPoint(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
    canvas.addEventListener('touchend', () => fire(), { passive: true });
    canvas.addEventListener('mousedown', e => setAimFromPoint(e.clientX, e.clientY));
    canvas.addEventListener('mouseup', () => fire());

    let lastT = null, raf = null;
    function loop(t) {
      if (!alive) return;
      if (lastT === null) lastT = t;
      const dt = Math.min((t - lastT) / 1000, 0.033);
      lastT = t;

      if (ball) {
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;
        if (ball.x - r < 0) { ball.x = r; ball.vx *= -1; }
        if (ball.x + r > W) { ball.x = W - r; ball.vx *= -1; }
        if (ball.y - r <= 0) { ball.y = r; settleBall(); }
        else {
          outer:
          for (let row = 0; row < MAX_ROWS; row++) {
            for (let col = 0; col < COLS; col++) {
              if (grid[row][col] === null) continue;
              const c = cellCenter(row, col);
              if (Math.hypot(ball.x - c.x, ball.y - c.y) < r * 1.9) { settleBall(); break outer; }
            }
          }
        }
      }
      draw();
      raf = requestAnimationFrame(loop);
    }

    function finish(won) {
      if (!alive) return;
      alive = false;
      if (raf) cancelAnimationFrame(raf);
      cleanup();
      if (won) onWin(); else onLose();
    }

    function onResize() { resize(); }
    window.addEventListener('resize', onResize);
    function cleanup() { window.removeEventListener('resize', onResize); }

    current = nextColor();
    upcoming = nextColor();
    initGrid();
    resize();
    raf = requestAnimationFrame(loop);

    return function destroy() { alive = false; if (raf) cancelAnimationFrame(raf); cleanup(); };
  },
};
