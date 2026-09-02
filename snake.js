// Мини-игра «Змейка».
// Контракт: Games.snake.start(container, { difficulty, onWin, onLose, setStatus })
// difficulty — целое число уровня сложности (1, 2, 3, ...), чем больше — тем сложнее.
// Возвращает функцию destroy() для очистки при выходе из игры.

window.Games = window.Games || {};

window.Games.snake = {
  name: 'Змейка',

  start(container, { difficulty = 1, onWin, onLose, setStatus }) {
    // --- параметры сложности ---
    const gridSize = Math.min(11 + difficulty, 17);
    const stepMs = Math.max(230 - difficulty * 18, 110);
    const targetFood = 4 + difficulty;

    // --- разметка ---
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
      </div>
    `;
    container.appendChild(controls);
    // вторая строка стрелки "вниз" отдельным рядом под дпадом для компактности
    const downRow = document.createElement('div');
    downRow.className = 'game-controls';
    downRow.style.paddingTop = '0';
    downRow.innerHTML = `<button data-dir="down" aria-label="Вниз" style="width:54px;height:44px;background:var(--bg-panel-2);border-radius:12px;font-size:1.1rem;">▼</button>`;
    container.appendChild(downRow);

    // --- состояние ---
    let snake = [{ x: Math.floor(gridSize / 2), y: Math.floor(gridSize / 2) }];
    let dir = { x: 1, y: 0 };
    let pendingDir = dir;
    let food = spawnFood();
    let eaten = 0;
    let alive = true;
    let cell = 0;

    function spawnFood() {
      let pos;
      do {
        pos = { x: Math.floor(Math.random() * gridSize), y: Math.floor(Math.random() * gridSize) };
      } while (snake.some(s => s.x === pos.x && s.y === pos.y));
      return pos;
    }

    function resize() {
      const size = Math.min(wrap.clientWidth, wrap.clientHeight) - 4;
      const dpr = window.devicePixelRatio || 1;
      canvas.style.width = size + 'px';
      canvas.style.height = size + 'px';
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      cell = (size * dpr) / gridSize;
    }
    resize();
    window.addEventListener('resize', resize);

    const ctx = canvas.getContext('2d');

    function draw() {
      ctx.fillStyle = '#181428';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      for (let i = 1; i < gridSize; i++) {
        ctx.beginPath();
        ctx.moveTo(i * cell, 0);
        ctx.lineTo(i * cell, canvas.height);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * cell);
        ctx.lineTo(canvas.width, i * cell);
        ctx.stroke();
      }

      // еда
      ctx.fillStyle = '#e8a33d';
      const fp = 3;
      ctx.beginPath();
      ctx.arc(food.x * cell + cell / 2, food.y * cell + cell / 2, cell / 2 - fp, 0, Math.PI * 2);
      ctx.fill();

      // змейка
      snake.forEach((s, i) => {
        ctx.fillStyle = i === 0 ? '#3ea8a0' : '#2f7f79';
        const p = 2;
        ctx.beginPath();
        ctx.roundRect ?
          ctx.roundRect(s.x * cell + p, s.y * cell + p, cell - p * 2, cell - p * 2, 4) :
          ctx.rect(s.x * cell + p, s.y * cell + p, cell - p * 2, cell - p * 2);
        ctx.fill();
      });
    }

    function setDir(nx, ny) {
      // запрещаем разворот на 180°
      if (snake.length > 1 && nx === -dir.x && ny === -dir.y) return;
      pendingDir = { x: nx, y: ny };
    }

    controls.querySelectorAll('[data-dir]').forEach(btn => bindDirButton(btn));
    downRow.querySelectorAll('[data-dir]').forEach(btn => bindDirButton(btn));
    function bindDirButton(btn) {
      const map = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
      btn.addEventListener('touchstart', e => { e.preventDefault(); setDir(...map[btn.dataset.dir]); }, { passive: false });
      btn.addEventListener('click', () => setDir(...map[btn.dataset.dir]));
    }

    function keyHandler(e) {
      const map = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
      if (map[e.key]) { e.preventDefault(); setDir(...map[e.key]); }
    }
    window.addEventListener('keydown', keyHandler);

    // свайпы прямо по канвасу
    let touchStart = null;
    canvas.addEventListener('touchstart', e => {
      const t = e.touches[0];
      touchStart = { x: t.clientX, y: t.clientY };
    }, { passive: true });
    canvas.addEventListener('touchend', e => {
      if (!touchStart) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStart.x;
      const dy = t.clientY - touchStart.y;
      if (Math.abs(dx) < 18 && Math.abs(dy) < 18) return;
      if (Math.abs(dx) > Math.abs(dy)) setDir(dx > 0 ? 1 : -1, 0);
      else setDir(0, dy > 0 ? 1 : -1);
      touchStart = null;
    }, { passive: true });

    let timer = null;
    function tick() {
      if (!alive) return;
      dir = pendingDir;
      const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

      const hitWall = head.x < 0 || head.y < 0 || head.x >= gridSize || head.y >= gridSize;
      const hitSelf = snake.some(s => s.x === head.x && s.y === head.y);
      if (hitWall || hitSelf) {
        finish(false);
        return;
      }

      snake.unshift(head);
      if (head.x === food.x && head.y === food.y) {
        eaten++;
        if (setStatus) setStatus(`${eaten} / ${targetFood}`);
        if (eaten >= targetFood) {
          draw();
          finish(true);
          return;
        }
        food = spawnFood();
      } else {
        snake.pop();
      }
      draw();
    }

    function loop() {
      tick();
      if (alive) timer = setTimeout(loop, stepMs);
    }

    function finish(won) {
      if (!alive) return;
      alive = false;
      clearTimeout(timer);
      cleanup();
      if (won) onWin(); else onLose();
    }

    function cleanup() {
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', keyHandler);
    }

    if (setStatus) setStatus(`0 / ${targetFood}`);
    draw();
    timer = setTimeout(loop, stepMs);

    return function destroy() {
      alive = false;
      clearTimeout(timer);
      cleanup();
    };
  }
};
