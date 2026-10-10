/**
 * MainMenu.js — Main menu wiring (character selection + save detection)
 */
export class MainMenu {
  constructor(save) {
    this.save = save;
    this.selectedChar = 'warrior';
    this.onStartGame = null;
    this.onContinue  = null;

    this._charSprites = {};
    this._animReqId = null;
    this._setupCharCards();
    this._setupButtons();
    this._checkSave();
    this._focusedButtonIdx = 0;
    this._startSpriteAnimation();
  }

  update(input) {
    if (!input) return;

    // Left/Right: Cycle Character Selection
    const chars = ['warrior', 'valkyrie', 'elf', 'wizard'];
    let curIdx = chars.indexOf(this.selectedChar);
    if (curIdx === -1) curIdx = 0;

    if (input.menuLeft) {
      const prevIdx = (curIdx - 1 + chars.length) % chars.length;
      this._selectChar(chars[prevIdx]);
    } else if (input.menuRight) {
      const nextIdx = (curIdx + 1) % chars.length;
      this._selectChar(chars[nextIdx]);
    }

    // Up/Down: Cycle Menu Buttons
    const buttons = [
      document.getElementById('btn-new-game'),
      document.getElementById('btn-continue'),
      document.getElementById('btn-controls'),
    ].filter(Boolean);

    if (input.menuUp) {
      this._focusedButtonIdx = (this._focusedButtonIdx - 1 + buttons.length) % buttons.length;
      buttons.forEach((b, i) => b.classList.toggle('gamepad-focused', i === this._focusedButtonIdx));
    } else if (input.menuDown) {
      this._focusedButtonIdx = (this._focusedButtonIdx + 1) % buttons.length;
      buttons.forEach((b, i) => b.classList.toggle('gamepad-focused', i === this._focusedButtonIdx));
    }

    // Confirm (Cross button)
    if (input.menuConfirm) {
      const targetBtn = buttons[this._focusedButtonIdx] || document.getElementById('btn-new-game');
      if (targetBtn && !targetBtn.disabled) {
        targetBtn.click();
      }
    }
  }

  _selectChar(charName) {
    if (this.selectedChar !== charName) {
      this.selectedChar = charName;
      if (this._charSprites && this._charSprites[charName]) {
        this._charSprites[charName].frame = 0;
        this._charSprites[charName].timer = 0;
      }
    }
    const cards = document.querySelectorAll('.char-card');
    cards.forEach(card => {
      if (card.dataset.char === charName) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    });
    const btn = document.getElementById('btn-new-game');
    if (btn) btn.disabled = false;
  }

  _setupCharCards() {
    const canvases = document.querySelectorAll('.char-sprite-canvas');
    canvases.forEach(canvas => {
      const char = canvas.dataset.char;
      if (!char) return;
      const img = new Image();
      img.src = `/assets/sprites/${char}.png`;
      this._charSprites[char] = {
        img,
        canvas,
        ctx: canvas.getContext('2d'),
        frame: 0,
        timer: 0
      };
      img.onload = () => {
        this._drawCharFrame(char, this.selectedChar === char ? 2 : 0, 0);
      };
    });

    const cards = document.querySelectorAll('.char-card');
    cards.forEach(card => {
      if (card.dataset.char === this.selectedChar) {
        card.classList.add('selected');
      }
      card.addEventListener('click', () => {
        this._selectChar(card.dataset.char);
      });
    });

    const newGameBtn = document.getElementById('btn-new-game');
    if (newGameBtn) newGameBtn.disabled = false;
  }

  _drawCharFrame(char, row, col) {
    const item = this._charSprites[char];
    if (!item) return;
    const { img, canvas, ctx } = item;
    if (!img.complete || img.naturalWidth === 0) return;

    const cellW = img.naturalWidth / 6;
    const cellH = img.naturalHeight / 6;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      img,
      col * cellW, row * cellH, cellW, cellH,
      0, 0, canvas.width, canvas.height
    );
  }

  _startSpriteAnimation() {
    let lastTime = performance.now();
    const frameLoop = (time) => {
      const dt = Math.min(0.1, (time - lastTime) / 1000);
      lastTime = time;

      const menuEl = document.getElementById('main-menu');
      if (menuEl && !menuEl.classList.contains('hidden') && menuEl.style.display !== 'none') {
        this._updateSpriteAnimation(dt);
      }
      this._animReqId = requestAnimationFrame(frameLoop);
    };
    this._animReqId = requestAnimationFrame(frameLoop);
  }

  _updateSpriteAnimation(dt) {
    if (!this._charSprites) return;
    for (const [char, item] of Object.entries(this._charSprites)) {
      const { img } = item;
      if (!img.complete || img.naturalWidth === 0) continue;

      const isSelected = (this.selectedChar === char);
      // Row 2 is battle attack animation with clearly visible weapon strikes!
      // Row 0 is idle animation.
      const row = isSelected ? 2 : 0;
      const speed = isSelected ? 10 : 5;
      const totalFrames = 6;

      item.timer += dt * speed;
      if (item.timer >= 1.0) {
        item.timer -= 1.0;
        item.frame = (item.frame + 1) % totalFrames;
      }

      this._drawCharFrame(char, row, item.frame);
    }
  }

  _setupButtons() {
    document.getElementById('btn-new-game').addEventListener('click', () => {
      if (this.selectedChar && this.onStartGame) {
        this.onStartGame(this.selectedChar);
      }
    });

    document.getElementById('btn-continue').addEventListener('click', () => {
      if (this.onContinue) {
        this.onContinue();
      }
    });

    document.getElementById('btn-controls').addEventListener('click', () => {
      const panel = document.getElementById('controls-panel');
      panel.classList.toggle('hidden');
    });
  }

  _checkSave() {
    const continueBtn = document.getElementById('btn-continue');
    if (this.save.hasSave()) {
      continueBtn.disabled = false;
      const data = this.save.load();
      if (data) {
        continueBtn.textContent = `📜 CONTINUE (Room ${data.room + 1}, Score: ${data.score || 0})`;
      }
    } else {
      continueBtn.disabled = true;
    }
  }
}
