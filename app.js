(() => {
  const GAME_KEYS = ['snake', 'minesweeper', 'tetris', 'sokoban', 'arkanoid', 'pacman', 'bubbleshooter', 'collapse', 'bejeweled', 'lines', 'xonix', 'digger', 'battlecity', 'bomberman', 'loderunner'];
  const PASSES = 2; // сколько раз общий список игр проходит забег -> ROOM_COUNT = GAME_KEYS.length * PASSES
  const ROOM_COUNT = GAME_KEYS.length * PASSES;
  const MAX_LIVES = 3;

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const el = {
    corridor: document.getElementById('corridor'),
    livesDisplay: document.getElementById('lives-display'),
    scoreDisplay: document.getElementById('score-display'),
    roomLabel: document.getElementById('room-label'),
    door: document.getElementById('door'),
    doorHint: document.querySelector('.door-hint'),
    dots: document.getElementById('progress-dots'),
    corridorMessage: document.getElementById('corridor-message'),
    overlay: document.getElementById('game-overlay'),
    overlayGameName: document.getElementById('overlay-game-name'),
    overlayStatus: document.getElementById('overlay-status'),
    gameRoot: document.getElementById('game-root'),
    resultScreen: document.getElementById('result-screen'),
    resultTitle: document.getElementById('result-title'),
    resultSubtitle: document.getElementById('result-subtitle'),
    resultStats: document.getElementById('result-stats'),
    resultButton: document.getElementById('result-button'),
  };

  let state = null;
  let currentDestroy = null;

  function buildSequence() {
    if (window.__forceSequence) return window.__forceSequence.slice();

    const seq = [];
    let prevGame = null;
    for (let pass = 1; pass <= PASSES; pass++) {
      let round = shuffle(GAME_KEYS);
      if (prevGame && round[0] === prevGame) {
        // не давать одной и той же игре выпасть два раза подряд на стыке раундов
        const swapWith = 1 + Math.floor(Math.random() * (round.length - 1));
        [round[0], round[swapWith]] = [round[swapWith], round[0]];
      }
      round.forEach(game => seq.push({ game, level: pass }));
      prevGame = round[round.length - 1];
    }
    return seq;
  }

  function newRun() {
    state = { lives: MAX_LIVES, score: 0, roomIndex: 0, sequence: buildSequence() };
    hide(el.resultScreen);
    hide(el.overlay);
    renderCorridor();
  }

  function renderCorridor() {
    // жизни
    el.livesDisplay.innerHTML = '';
    for (let i = 0; i < MAX_LIVES; i++) {
      const span = document.createElement('span');
      span.className = 'heart';
      span.innerHTML = heartSvg(i < state.lives);
      el.livesDisplay.appendChild(span);
    }
    el.scoreDisplay.textContent = state.score;
    el.roomLabel.textContent = `Комната ${state.roomIndex + 1} из ${ROOM_COUNT}`;

    // точки прогресса
    el.dots.innerHTML = '';
    state.sequence.forEach((_, i) => {
      const d = document.createElement('span');
      d.className = 'dot' + (i < state.roomIndex ? ' passed' : i === state.roomIndex ? ' current' : '');
      el.dots.appendChild(d);
    });

    el.corridorMessage.textContent = state.roomIndex === 0
      ? 'За дверью — случайная игра. Проходи испытания, копи очки, не теряй все жизни.'
      : 'Дверь снова закрыта. Открывай следующую.';
    el.doorHint.textContent = state.roomIndex === 0 ? 'Нажми, чтобы начать' : 'Нажми, чтобы открыть';
  }

  function heartSvg(filled) {
    const color = filled ? '#d1495b' : '#3a3350';
    return `<svg viewBox="0 0 24 24" width="20" height="20"><path fill="${color}" d="M12 21s-7.5-4.6-10-9.1C.5 8.8 2 5 5.6 5c2 0 3.4 1.1 4.4 2.7C11 6.1 12.4 5 14.4 5 18 5 19.5 8.8 22 11.9 19.5 16.4 12 21 12 21z"/></svg>`;
  }

  function show(node) { node.classList.remove('hidden'); }
  function hide(node) { node.classList.add('hidden'); }

  function launchRoom(i) {
    const spec = state.sequence[i];
    const api = window.Games[spec.game];
    el.overlayGameName.textContent = api.name;
    el.overlayStatus.textContent = '';
    el.gameRoot.innerHTML = '';
    show(el.overlay);

    currentDestroy = api.start(el.gameRoot, {
      difficulty: spec.level,
      onWin: () => handleWin(spec.level),
      onLose: () => handleLose(),
      setStatus: (txt) => { el.overlayStatus.textContent = txt; },
    });
  }

  function closeOverlay() {
    if (currentDestroy) { try { currentDestroy(); } catch (e) { /* игра уже могла сама себя очистить */ } }
    hide(el.overlay);
    el.gameRoot.innerHTML = '';
    currentDestroy = null;
  }

  function handleWin(level) {
    const points = 300 + level * 200;
    state.score += points;
    closeOverlay();
    state.roomIndex++;

    if (state.roomIndex >= ROOM_COUNT) {
      renderCorridor();
      showRunComplete();
    } else {
      renderCorridor();
      showToast(`+${points} очков`);
    }
  }

  function handleLose() {
    state.lives--;
    closeOverlay();

    if (state.lives <= 0) {
      renderCorridor();
      showGameOver();
    } else {
      renderCorridor();
      showToast('Не в этот раз. Дверь ещё открыта — попробуй снова.');
    }
  }

  function showToast(text) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = text;
    el.corridor.appendChild(t);
    setTimeout(() => t.remove(), 1700);
  }

  function statRow(value, label) {
    return `<div class="result-stat"><b>${value}</b><span>${label}</span></div>`;
  }

  function showRunComplete() {
    el.resultTitle.textContent = 'Забег завершён';
    el.resultSubtitle.textContent = `Все ${ROOM_COUNT} комнат пройдены.`;
    el.resultStats.innerHTML =
      statRow(state.score, 'очков') +
      statRow(state.lives, 'жизней осталось');
    el.resultButton.textContent = 'Играть заново';
    show(el.resultScreen);
  }

  function showGameOver() {
    el.resultTitle.textContent = 'Забег окончен';
    el.resultSubtitle.textContent = `Жизни закончились на комнате ${state.roomIndex + 1} из ${ROOM_COUNT}.`;
    el.resultStats.innerHTML = statRow(state.score, 'очков');
    el.resultButton.textContent = 'Попробовать ещё раз';
    show(el.resultScreen);
  }

  el.door.addEventListener('click', () => {
    if (!el.overlay.classList.contains('hidden')) return;
    launchRoom(state.roomIndex);
  });

  el.resultButton.addEventListener('click', newRun);

  newRun();
})();
