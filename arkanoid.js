// Мини-игра «Арканоид».
// Контракт: Games.arkanoid.start(container, { difficulty, onWin, onLose, setStatus })
// Управление: перетаскивание пальцем по полю (или стрелки ← → на клавиатуре).
// Мяч стартует «приклеенным» к платформе — тап/клик запускает его.

window.Games = window.Games || {};

window.Games.arkanoid = {
  name: 'Арканоид',

  start(container, { difficulty = 1, onWin, onLose, setStatus }) {
    const rows = Math.min(3 + difficulty, 6);
    const cols = 7;
    const ballSpeed = 200 + difficulty * 40;

    container.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'game-canvas-wrap';
    wrap.style.padding = '0';
    const canvas = document.createElement('canvas');
    wrap.appendChild(canvas);
    container.appendChild(wrap);

    const rowColors = ['#d1495b', '#e0854a', '#e8a33d', '#6fae8c', '#3ea8a0', '#a97fd6'];

    let W = 0, H = 0;
    let paddle = { w: 0, h: 14, x: 0, y: 0 };
    let ball = { x: 0, y: 0, r: 7, dx: 0, dy: 0, launched: false };
    let bricks = [];
    let brickW = 0, brickH = 16, brickTop = 0, brickGap = 4;
    let alive = true;

    function layoutBricks() {
      brickW = (W - brickGap * (cols + 1)) / cols;
      brickTop = 44;
      bricks = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          bricks.push({
            x: brickGap + c * (brickW + brickGap),
            y: brickTop + r * (brickH + brickGap),
            w: brickW, h: brickH,
            color: rowColors[r % rowColors.length],
            alive: true,
          });
        }
      }
      if (setStatus) setStatus(`0 / ${bricks.length}`);
    }

    function resetBall() {
      ball.x = paddle.x + paddle.w / 2;
      ball.y = paddle.y - ball.r - 1;
      ball.dx = 0; ball.dy = 0;
      ball.launched = false;
    }

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      W = wrap.clientWidth;
      H = wrap.clientHeight;
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      paddle.w = Math.max(60, W * 0.22);
      paddle.y = H - 28;
      if (paddle.x === 0) paddle.x = (W - paddle.w) / 2;
      paddle.x = Math.min(Math.max(paddle.x, 0), W - paddle.w);

      layoutBricks();
      resetBall();
      draw();
    }

    const ctx = canvas.getContext('2d');

    function draw() {
      ctx.fillStyle = '#181428';
      ctx.fillRect(0, 0, W, H);

      bricks.forEach(b => {
        if (!b.alive) return;
        ctx.fillStyle = b.color;
        const rr = 4;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(b.x, b.y, b.w, b.h, rr) : ctx.rect(b.x, b.y, b.w, b.h);
        ctx.fill();
      });

      ctx.fillStyle = '#f2ede4';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(paddle.x, paddle.y, paddle.w, paddle.h, 7) : ctx.rect(paddle.x, paddle.y, paddle.w, paddle.h);
      ctx.fill();

      ctx.fillStyle = '#e8a33d';
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
      ctx.fill();

      if (!ball.launched) {
        ctx.fillStyle = 'rgba(242,237,228,0.55)';
        ctx.font = '13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Тапни, чтобы запустить', W / 2, H - 48);
      }
    }

    function launch() {
      if (ball.launched || !alive) return;
      const angle = (Math.random() * 0.5 - 0.25) - Math.PI / 2; // около «вверх»
      ball.dx = Math.cos(angle) * ballSpeed;
      ball.dy = Math.sin(angle) * ballSpeed;
      ball.launched = true;
    }

    function setPaddleCenter(clientX) {
      const rect = canvas.getBoundingClientRect();
      const localX = clientX - rect.left;
      paddle.x = Math.min(Math.max(localX - paddle.w / 2, 0), W - paddle.w);
      if (!ball.launched) resetBall();
    }

    canvas.addEventListener('touchstart', e => {
      setPaddleCenter(e.touches[0].clientX);
      if (!ball.launched) launch();
    }, { passive: true });
    canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      setPaddleCenter(e.touches[0].clientX);
    }, { passive: false });
    canvas.addEventListener('mousedown', e => {
      setPaddleCenter(e.clientX);
      if (!ball.launched) launch();
    });

    const keys = {};
    function keyDown(e) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { keys[e.key] = true; e.preventDefault(); }
      if (e.key === ' ' && !ball.launched) launch();
    }
    function keyUp(e) { keys[e.key] = false; }
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);

    let lastT = null;
    let raf = null;
    function loop(t) {
      if (!alive) return;
      if (lastT === null) lastT = t;
      const dt = Math.min((t - lastT) / 1000, 0.033);
      lastT = t;

      const padSpeed = 320;
      if (keys.ArrowLeft) paddle.x -= padSpeed * dt;
      if (keys.ArrowRight) paddle.x += padSpeed * dt;
      paddle.x = Math.min(Math.max(paddle.x, 0), W - paddle.w);

      if (!ball.launched) {
        ball.x = paddle.x + paddle.w / 2;
      } else {
        ball.x += ball.dx * dt;
        ball.y += ball.dy * dt;

        if (ball.x - ball.r < 0) { ball.x = ball.r; ball.dx *= -1; }
        if (ball.x + ball.r > W) { ball.x = W - ball.r; ball.dx *= -1; }
        if (ball.y - ball.r < 0) { ball.y = ball.r; ball.dy *= -1; }

        if (ball.dy > 0 &&
            ball.y + ball.r >= paddle.y && ball.y - ball.r <= paddle.y + paddle.h &&
            ball.x >= paddle.x && ball.x <= paddle.x + paddle.w) {
          ball.y = paddle.y - ball.r;
          const hit = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2); // -1..1
          const speed = Math.hypot(ball.dx, ball.dy);
          const angle = hit * 1.0 - Math.PI / 2;
          ball.dx = Math.cos(angle) * speed;
          ball.dy = Math.sin(angle) * speed;
        }

        for (const b of bricks) {
          if (!b.alive) continue;
          if (ball.x + ball.r > b.x && ball.x - ball.r < b.x + b.w &&
              ball.y + ball.r > b.y && ball.y - ball.r < b.y + b.h) {
            b.alive = false;
            const overlapX = Math.min(ball.x + ball.r - b.x, b.x + b.w - (ball.x - ball.r));
            const overlapY = Math.min(ball.y + ball.r - b.y, b.y + b.h - (ball.y - ball.r));
            if (overlapX < overlapY) ball.dx *= -1; else ball.dy *= -1;
            const remaining = bricks.filter(x => x.alive).length;
            if (setStatus) setStatus(`${bricks.length - remaining} / ${bricks.length}`);
            if (remaining === 0) { finish(true); return; }
            break;
          }
        }

        if (ball.y - ball.r > H) { finish(false); return; }
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

    function cleanup() {
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('resize', onResize);
    }

    resize();
    raf = requestAnimationFrame(loop);

    return function destroy() { alive = false; if (raf) cancelAnimationFrame(raf); cleanup(); };
  },
};
