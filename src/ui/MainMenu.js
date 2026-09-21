/**
 * MainMenu.js — Main menu wiring (character selection + save detection)
 */
export class MainMenu {
  constructor(save) {
    this.save = save;
    this.selectedChar = 'warrior';
    this.onStartGame = null;
    this.onContinue  = null;

    this._setupCharCards();
    this._setupButtons();
    this._checkSave();
  }

  _setupCharCards() {
    const cards = document.querySelectorAll('.char-card');
    cards.forEach(card => {
      if (card.dataset.char === this.selectedChar) {
        card.classList.add('selected');
      }
      card.addEventListener('click', () => {
        cards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this.selectedChar = card.dataset.char;
        const btn = document.getElementById('btn-new-game');
        if (btn) btn.disabled = false;
      });
    });

    const newGameBtn = document.getElementById('btn-new-game');
    if (newGameBtn) newGameBtn.disabled = false;
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
