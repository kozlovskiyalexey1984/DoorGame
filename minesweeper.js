// Мини-игра «Сапёр».
// Контракт: Games.minesweeper.start(container, { difficulty, onWin, onLose, setStatus })
// Первый тап никогда не попадает на мину — поле генерируется после первого хода.

window.Games = window.Games || {};

window.Games.minesweeper = {
  name: 'Сапёр',

  start(container, { difficulty = 1, onWin, onLose, setStatus }) {
    const LEVELS = [
      { size: 6, mines: 5 },
      { size: 7, mines: 8 },
      { size: 8, mines: 10 },
      { size: 8, mines: 12 },
      { size: 9, mines: 14 },
      { size: 9, mines: 16 },
    ];
    const cfg = LEVELS[Math.min(difficulty, LEVELS.length) - 1];
    const size = cfg.size;
    const mineCount = cfg.mines;

    container.innerHTML = '';

    const toggleRow = document.createElement('div');
    toggleRow.className = 'game-controls';
    toggleRow.innerHTML = `
      <div class="mode-toggle">
        <button data-mode="open" class="active">Открыть</button>
        <button data-mode="flag">🚩 Флаг</button>
      </div>
    `;
    container.appendChild(toggleRow);

    const wrap = document.createElement('div');
    wrap.className = 'game-canvas-wrap';
    const grid = document.createElement('div');
    grid.className = 'mine-grid';
    wrap.appendChild(grid);
    container.appendChild(wrap);

    let mode = 'open';
    toggleRow.querySelectorAll('[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        mode = btn.dataset.mode;
        toggleRow.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('active', b === btn));
      });
    });

    // --- модель поля ---
    let cells = [];        // {mine, adjacent, revealed, flagged, el}
    let firstClickDone = false;
    let finished = false;
    let revealedSafe = 0;
    const totalSafe = size * size - mineCount;

    for (let i = 0; i < size * size; i++) {
      cells.push({ mine: false, adjacent: 0, revealed: false, flagged: false });
    }

    function idx(x, y) { return y * size + x; }
    function neighbors(x, y) {
      const res = [];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < size && ny < size) res.push({ x: nx, y: ny });
        }
      }
      return res;
    }

    function placeMines(excludeX, excludeY) {
      const excluded = new Set(neighbors(excludeX, excludeY).map(p => idx(p.x, p.y)));
      excluded.add(idx(excludeX, excludeY));
      let placed = 0;
      while (placed < mineCount) {
        const i = Math.floor(Math.random() * cells.length);
        if (excluded.has(i) || cells[i].mine) continue;
        cells[i].mine = true;
        placed++;
      }
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          if (cells[idx(x, y)].mine) continue;
          cells[idx(x, y)].adjacent = neighbors(x, y).filter(p => cells[idx(p.x, p.y)].mine).length;
        }
      }
    }

    // --- отрисовка ---
    function sizePx() {
      const avail = Math.min(wrap.clientWidth, wrap.clientHeight) - 8;
      return Math.max(26, Math.min(44, Math.floor(avail / size)));
    }

    function render() {
      const px = sizePx();
      grid.style.gridTemplateColumns = `repeat(${size}, ${px}px)`;
      grid.style.gridTemplateRows = `repeat(${size}, ${px}px)`;
      grid.innerHTML = '';
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const c = cells[idx(x, y)];
          const el = document.createElement('div');
          el.className = 'mine-cell';
          el.style.width = px + 'px';
          el.style.height = px + 'px';
          if (c.revealed) {
            el.classList.add('revealed');
            if (c.mine) {
              el.classList.add('mine');
              el.textContent = '●';
            } else if (c.adjacent > 0) {
              el.textContent = c.adjacent;
              el.style.color = numberColor(c.adjacent);
            }
          } else if (c.flagged) {
            el.classList.add('flagged');
            el.textContent = '🚩';
          }
          el.addEventListener('click', () => handleTap(x, y));
          grid.appendChild(el);
        }
      }
    }

    function numberColor(n) {
      const colors = ['', '#6fae8c', '#e8a33d', '#d1495b', '#a97fd6', '#d1495b', '#3ea8a0', '#f2ede4', '#a79ecb'];
      return colors[n] || '#f2ede4';
    }

    function reveal(x, y) {
      const c = cells[idx(x, y)];
      if (c.revealed || c.flagged) return;
      c.revealed = true;
      if (!c.mine) {
        revealedSafe++;
        if (setStatus) setStatus(`${revealedSafe} / ${totalSafe}`);
        if (c.adjacent === 0) {
          neighbors(x, y).forEach(p => reveal(p.x, p.y));
        }
      }
    }

    function handleTap(x, y) {
      if (finished) return;
      const c = cells[idx(x, y)];

      if (mode === 'flag') {
        if (!c.revealed) {
          c.flagged = !c.flagged;
          render();
        }
        return;
      }

      if (c.flagged || c.revealed) return;

      if (!firstClickDone) {
        firstClickDone = true;
        placeMines(x, y);
      }

      reveal(x, y);

      if (cells[idx(x, y)].mine) {
        finished = true;
        cells.forEach(cc => { if (cc.mine) cc.revealed = true; });
        render();
        setTimeout(() => { cleanup(); onLose(); }, 550);
        return;
      }

      render();

      if (revealedSafe >= totalSafe) {
        finished = true;
        setTimeout(() => { cleanup(); onWin(); }, 400);
      }
    }

    function onResize() { render(); }
    window.addEventListener('resize', onResize);

    if (setStatus) setStatus(`0 / ${totalSafe}`);
    render();

    function cleanup() {
      window.removeEventListener('resize', onResize);
    }

    return function destroy() { cleanup(); };
  }
};
