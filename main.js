(() => {
  const DEFAULT_CHARS = '0123456789xyztfXYZVWABCDEF/\\.-_=+[]<>^*(){}:;!';
  const MIN_CHAR_SET_SIZE = 3;
  const MAX_CHAR_SET_SIZE = 20;
  const SPACE_PROBABILITY = 0.14;
  const DEFAULT_TICK_INTERVAL_MS = 90;
  const MIN_TICK_INTERVAL_MS = 5;
  const MAX_TICK_INTERVAL_MS = 5000;
  const MUTATE_RATIO = 0.12;
  const RESIZE_DEBOUNCE_MS = 120;
  const ZOOM_STEP = 1.15;
  const MIN_ZOOM = 0.2;
  const MAX_ZOOM = 4;
  const PRESET_SLOTS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

  const stage = document.getElementById('stage');
  let cells = [];
  let currentChars = DEFAULT_CHARS;
  const charHistory = [];
  const savedPresets = new Map();
  let isPaused = false;
  let zoom = 1;
  let tickIntervalMs = DEFAULT_TICK_INTERVAL_MS;
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
   * Main animation loop throttled by tickIntervalMs.
   * @param {number} timestamp
   */
  function animate(timestamp) {
    if (!isPaused && timestamp - lastTick >= tickIntervalMs) {
      scrambleStep();
      lastTick = timestamp;
    }
    requestAnimationFrame(animate);
  }

  /**
   * Scale the tick interval by multiplier, clamped to [MIN_TICK_INTERVAL_MS, MAX_TICK_INTERVAL_MS].
   * @param {number} multiplier
   */
  function adjustTickInterval(multiplier) {
    tickIntervalMs = Math.min(
      MAX_TICK_INTERVAL_MS,
      Math.max(MIN_TICK_INTERVAL_MS, tickIntervalMs * multiplier)
    );
  }

  /**
   * Set the stage zoom level, clamping to [MIN_ZOOM, MAX_ZOOM].
   * @param {number} targetZoom
   * @returns {boolean} Whether the zoom level changed.
   */
  function setZoom(targetZoom) {
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, targetZoom));
    if (nextZoom === zoom) return false;
    zoom = nextZoom;
    stage.style.setProperty('--zoom', String(zoom));
    return true;
  }

  /**
   * Adjust the stage zoom level and rebuild the grid.
   * @param {number} factor
   */
  function adjustZoom(factor) {
    if (setZoom(zoom * factor)) {
      buildGrid();
    }
  }

  /**
   * Extract a '0'-'9' slot key from a KeyboardEvent, handling Shift+digit.
   * @param {KeyboardEvent} event
   * @returns {string | null}
   */
  function getDigitSlot(event) {
    const codeMatch = /^(?:Digit|Numpad)([0-9])$/.exec(event.code);
    if (codeMatch) return codeMatch[1];
    if (/^[0-9]$/.test(event.key)) return event.key;
    return null;
  }

  /**
   * Save or restore the zoom level and character set for a numbered slot.
   * @param {string} slot
   * @param {boolean} forceSave
   */
  function handlePresetKey(slot, forceSave) {
    if (forceSave || !savedPresets.has(slot)) {
      savedPresets.set(slot, { zoom, chars: currentChars });
      return;
    }

    const preset = savedPresets.get(slot);
    currentChars = preset.chars;
    if (setZoom(preset.zoom)) {
      buildGrid();
    } else {
      randomizeAll();
    }
  }

  /**
   * Generate a random zoom level distributed log-uniformly between MIN_ZOOM and MAX_ZOOM.
   * @returns {number}
   */
  function randomZoom() {
    return MIN_ZOOM * Math.pow(MAX_ZOOM / MIN_ZOOM, Math.random());
  }

  /**
   * Randomize all numbered presets.
   * @param {boolean} includeChars Whether to also randomize each preset's character set.
   */
  function randomizePresets(includeChars) {
    for (const slot of PRESET_SLOTS) {
      const existing = savedPresets.get(slot);
      savedPresets.set(slot, {
        zoom: randomZoom(),
        chars:
          includeChars || !existing ? generateRandomCharSet() : existing.chars,
      });
    }
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
    } else if (event.key === '[') {
      adjustTickInterval(2);
    } else if (event.key === ']') {
      adjustTickInterval(0.5);
    } else if (event.key === 'z') {
      randomizePresets(false);
    } else if (event.key === 'Z') {
      randomizePresets(true);
    } else {
      const slot = getDigitSlot(event);
      if (slot !== null) {
        event.preventDefault();
        handlePresetKey(slot, event.shiftKey);
      }
    }
  });

  randomizePresets(true);
  buildGrid();
  requestAnimationFrame(animate);
})();
