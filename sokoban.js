// Мини-игра «Сокобан».
// Контракт: Games.sokoban.start(container, { difficulty, onWin, onLose, setStatus })
// У Сокобана нет условия поражения — только «Начать заново» на текущем уровне,
// чтобы неудачный толчок ящика не стоил игроку жизни за забег.
// Уровни собраны вручную и заранее проверены BFS-солвером на решаемость.

window.Games = window.Games || {};

window.Games.sokoban = (() => {
  const LEVELS_BY_TIER = {
    1: [
      ['#####', '#@$.#', '#####'],
      ['###########', '#         #', '#  .   $@ #', '#         #', '###########'],
      ['#######', '#  #  #', '#  .  #', '# $#@ #', '#     #', '#######'],
    ],
    2: [
      ['########', '#      #', '# .$ $.#', '#   @  #', '#      #', '########'],
      ['########', '#      #', '# $  . #', '#      #', '# .  $ #', '#  @   #', '########'],
      ['#########', '#   #   #', '# $ # . #', '# . # $ #', '#   @   #', '#########'],
    ],
  };

  function parse(rows) {
    const walls = new Set(), targets = new Set();
    let boxes = new Set();
    let player = null;
    rows.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        const key = x + ',' + y;
        if (ch === '#') walls.add(key);
        else if (ch === '.') targets.add(key);
        else if (ch === '$') boxes.add(key);
        else if (ch === '*') { targets.add(key); boxes.add(key); }
        else if (ch === '@') player = { x, y };
        else if (ch === '+') { targets.add(key); player = { x, y }; }
      });
    });
    const cols = Math.max(...rows.map(r => r.length));
    return { walls, targets, boxes, player, cols, rows: rows.length };
  }

  return {
    name: 'Сокобан',

    start(container, { difficulty = 1, onWin, setStatus }) {
      const tier = difficulty >= 2 ? 2 : 1;
      const pool = LEVELS_BY_TIER[tier];
      const template = pool[Math.floor(Math.random() * pool.length)];

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
          <button data-dir="restart" aria-label="Заново" title="Начать заново">↺</button>
          <button data-dir="right" aria-label="Вправо">▶</button>
        </div>`;
      container.appendChild(controls);
      const downRow = document.createElement('div');
      downRow.className = 'game-controls';
      downRow.style.paddingTop = '0';
      downRow.innerHTML = `<button data-dir="down" aria-label="Вниз" style="width:54px;height:44px;background:var(--bg-panel-2);border-radius:12px;font-size:1.1rem;">▼</button>`;
      container.appendChild(downRow);

      let level, cell, alive = true;

      function loadLevel() {
        level = parse(template);
        render();
        if (setStatus) setStatus(`0 / ${level.targets.size}`);
      }

      function resize() {
        const availW = wrap.clientWidth - 8;
        const availH = wrap.clientHeight - 8;
        cell = Math.max(20, Math.floor(Math.min(availW / level.cols, availH / level.rows)));
        const dpr = window.devicePixelRatio || 1;
        canvas.style.width = (cell * level.cols) + 'px';
        canvas.style.height = (cell * level.rows) + 'px';
        canvas.width = cell * level.cols * dpr;
        canvas.height = cell * level.rows * dpr;
        render();
      }

      const ctx = canvas.getContext('2d');

      function render() {
        const dpr = window.devicePixelRatio || 1;
        const c = cell * dpr;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#181428';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        for (let y = 0; y < level.rows; y++) {
          for (let x = 0; x < level.cols; x++) {
            const key = x + ',' + y;
            const px = x * c, py = y * c;
            if (level.walls.has(key)) {
              ctx.fillStyle = '#2a2542';
              ctx.fillRect(px, py, c, c);
            } else {
              ctx.fillStyle = '#100e1c';
              ctx.fillRect(px + 1, py + 1, c - 2, c - 2);
              if (level.targets.has(key)) {
                ctx.strokeStyle = '#e8a33d';
                ctx.lineWidth = Math.max(2, c * 0.06);
                ctx.beginPath();
                ctx.arc(px + c / 2, py + c / 2, c * 0.22, 0, Math.PI * 2);
                ctx.stroke();
              }
            }
          }
        }

        level.boxes.forEach(key => {
          const [x, y] = key.split(',').map(Number);
          const onTarget = level.targets.has(key);
          const px = x * c, py = y * c, p = c * 0.12;
          ctx.fillStyle = onTarget ? '#6fae8c' : '#e8a33d';
          ctx.fillRect(px + p, py + p, c - p * 2, c - p * 2);
        });

        const { x, y } = level.player;
        ctx.fillStyle = '#3ea8a0';
        ctx.beginPath();
        ctx.arc(x * c + c / 2, y * c + c / 2, c * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }

      function tryMove(dx, dy) {
        if (!alive) return;
        const { x, y } = level.player;
        const nx = x + dx, ny = y + dy;
        const nKey = nx + ',' + ny;
        if (level.walls.has(nKey)) return;

        if (level.boxes.has(nKey)) {
          const bx = nx + dx, by = ny + dy;
          const bKey = bx + ',' + by;
          if (level.walls.has(bKey) || level.boxes.has(bKey)) return;
          level.boxes.delete(nKey);
          level.boxes.add(bKey);
        }
        level.player = { x: nx, y: ny };
        render();
        checkWin();
      }

      function checkWin() {
        for (const b of level.boxes) {
          if (!level.targets.has(b)) return;
        }
        alive = false;
        setTimeout(() => { cleanup(); onWin(); }, 350);
      }

      controls.querySelectorAll('[data-dir]').forEach(bindBtn);
      downRow.querySelectorAll('[data-dir]').forEach(bindBtn);
      function bindBtn(btn) {
        const map = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
        const act = () => {
          if (btn.dataset.dir === 'restart') { loadLevel(); return; }
          tryMove(...map[btn.dataset.dir]);
        };
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

      function onResize() { resize(); }
      window.addEventListener('resize', onResize);

      function cleanup() {
        window.removeEventListener('keydown', keyHandler);
        window.removeEventListener('resize', onResize);
      }

      loadLevel();
      resize();

      return function destroy() { alive = false; cleanup(); };
    },
  };
})();
