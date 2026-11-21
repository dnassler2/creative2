(() => {
  const DEFAULT_CHARS = '0123456789xyztfXYZVWABCDEF/\\.-_=+[]<>^*(){}:;!';
  const MIN_CHAR_SET_SIZE = 3;
  const MAX_CHAR_SET_SIZE = 20;
  const SPACE_PROBABILITY = 0.14;
  const TICK_INTERVAL_MS = 90;
  const MUTATE_RATIO = 0.12;
  const RESIZE_DEBOUNCE_MS = 120;
  const ZOOM_STEP = 1.15;
  const MIN_ZOOM = 0.2;
  const MAX_ZOOM = 4;

  const stage = document.getElementById('stage');
  let cells = [];
  let currentChars = DEFAULT_CHARS;
  const charHistory = [];
  let isPaused = false;
  let zoom = 1;
  let lastTick = 0;
  let resizeTimer = null;

  /**
   * Pick a random character from the active palette or an occasional space.
   * @returns {string}
   */
  function randomChar() {
    if (Math.random() < SPACE_PROBABILITY) {
      return ' ';
    }
    const index = Math.floor(Math.random() * currentChars.length);
    return currentChars[index];
  }

  /**
   * Generate a random subset of characters from DEFAULT_CHARS.
   * @returns {string}
   */
  function generateRandomCharSet() {
    const pool = DEFAULT_CHARS.split('');
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const maxSize = Math.min(pool.length, MAX_CHAR_SET_SIZE);
    const size =
      MIN_CHAR_SET_SIZE +
      Math.floor(Math.random() * (maxSize - MIN_CHAR_SET_SIZE + 1));
    return pool.slice(0, size).join('');
  }

  /**
   * Measure the rendered width and height of a single monospace cell.
   * @returns {{ width: number, height: number }}
   */
  function measureCell() {
    const probe = document.createElement('span');
    probe.className = 'cell';
    probe.textContent = 'X';
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    stage.appendChild(probe);

    const rect = probe.getBoundingClientRect();
    stage.removeChild(probe);

    return {
      width: Math.max(1, rect.width),
      height: Math.max(1, rect.height),
    };
  }

  /**
   * Build or rebuild the character grid to fill the current viewport.
   */
  function buildGrid() {
    stage.innerHTML = '';
    const { width, height } = measureCell();
    const cols = Math.max(1, Math.floor(window.innerWidth / width));
    const rows = Math.max(1, Math.floor(window.innerHeight / height));
    const total = cols * rows;

    stage.style.gridTemplateColumns = `repeat(${cols}, ${width}px)`;
    stage.style.gridAutoRows = `${height}px`;

    const fragment = document.createDocumentFragment();
    cells = new Array(total);

    for (let i = 0; i < total; i += 1) {
      const cell = document.createElement('span');
      cell.className = 'cell';
      cell.textContent = randomChar();
      cells[i] = cell;
      fragment.appendChild(cell);
    }

    stage.appendChild(fragment);
  }

  /**
   * Mutate a random subset of cells to new characters.
   */
  function scrambleStep() {
    if (cells.length === 0) return;
    const count = Math.max(1, Math.floor(cells.length * MUTATE_RATIO));

    for (let i = 0; i < count; i += 1) {
      const idx = Math.floor(Math.random() * cells.length);
      cells[idx].textContent = randomChar();
    }
  }

  /**
   * Randomize every cell on the stage.
   */
  function randomizeAll() {
    for (let i = 0; i < cells.length; i += 1) {
      cells[i].textContent = randomChar();
    }
  }

  /**
   * Main animation loop throttled by TICK_INTERVAL_MS.
   * @param {number} timestamp
   */
  function animate(timestamp) {
    if (!isPaused && timestamp - lastTick >= TICK_INTERVAL_MS) {
      scrambleStep();
      lastTick = timestamp;
    }
    requestAnimationFrame(animate);
  }

  /**
   * Adjust the stage zoom level and rebuild the grid.
   * @param {number} factor
   */
  function adjustZoom(factor) {
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor));
    if (nextZoom === zoom) return;
    zoom = nextZoom;
    stage.style.setProperty('--zoom', String(zoom));
    buildGrid();
  }

  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(buildGrid, RESIZE_DEBOUNCE_MS);
  });

  window.addEventListener('keydown', (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    if (event.code === 'Space') {
      event.preventDefault();
      isPaused = !isPaused;
    } else if (event.key === 'r' || event.key === 'R') {
      randomizeAll();
    } else if (event.key === 'j' || event.key === 'J') {
      charHistory.push(currentChars);
      currentChars = generateRandomCharSet();
      randomizeAll();
    } else if (event.key === 'k' || event.key === 'K') {
      if (charHistory.length > 0) {
        currentChars = charHistory.pop();
        randomizeAll();
      }
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      adjustZoom(ZOOM_STEP);
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      adjustZoom(1 / ZOOM_STEP);
    }
  });

  buildGrid();
  requestAnimationFrame(animate);
})();
