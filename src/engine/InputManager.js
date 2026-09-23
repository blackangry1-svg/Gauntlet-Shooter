/**
 * InputManager.js
 * Handles keyboard + mouse (pointer lock) input
 */
export class InputManager {
  constructor() {
    this._keys    = new Set();
    this._pressed = new Set();  // justPressed: cleared each frame
    this._released= new Set();  // justReleased: cleared each frame

    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseButtons = new Set();
    this._mouseJustDown = new Set();
    this._mouseJustUp   = new Set();

    this._currGpButtons = [];
    this._prevGpButtons = [];

    // Bind
    window.addEventListener('keydown',  e => this._onKeyDown(e));
    window.addEventListener('keyup',    e => this._onKeyUp(e));
    document.addEventListener('mousemove', e => this._onMouseMove(e), { passive: true });
    document.addEventListener('mousedown', e => this._onMouseDown(e));
    document.addEventListener('mouseup',   e => this._onMouseUp(e));
    window.addEventListener('contextmenu', e => e.preventDefault());
  }

  _getGamepad() {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
    const pads = navigator.getGamepads();
    for (let i = 0; i < pads.length; i++) {
      if (pads[i] && pads[i].connected) return pads[i];
    }
    return null;
  }

  _mapCodeToGp(code) {
    switch (code) {
      case 'Space': return 0;
      case 'KeyE': return 1;
      case 'KeyQ': return 2;
      case 'KeyF': return 3;
      case 'Escape': return 9;
      case 'ShiftLeft':
      case 'ShiftRight': return 10;
      case 'Digit1': return 14;
      case 'Digit2': return 15;
      case 'Digit3': return -1; // Handled specially if needed
      default: return -1;
    }
  }

  _gpButtonDown(btn) {
    if (btn === -1) return false;
    const gp = this._getGamepad();
    return gp && gp.buttons[btn] && gp.buttons[btn].pressed;
  }

  _gpButtonJustPressed(btn) {
    if (btn === -1) return false;
    const gp = this._getGamepad();
    const curr = gp && gp.buttons[btn] && gp.buttons[btn].pressed;
    return curr && !this._prevGpButtons[btn];
  }

  _gpButtonJustReleased(btn) {
    if (btn === -1) return false;
    const gp = this._getGamepad();
    const curr = gp && gp.buttons[btn] && gp.buttons[btn].pressed;
    return !curr && this._prevGpButtons[btn];
  }

  _onKeyDown(e) {
    if (!this._keys.has(e.code)) {
      this._pressed.add(e.code);
    }
    this._keys.add(e.code);
    // Suppress default for game keys
    if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
  }

  _onKeyUp(e) {
    this._keys.delete(e.code);
    this._released.add(e.code);
  }

  _onMouseMove(e) {
    const mx = e.movementX ?? e.mozMovementX ?? e.webkitMovementX ?? 0;
    const my = e.movementY ?? e.mozMovementY ?? e.webkitMovementY ?? 0;
    this.mouseX += mx;
    this.mouseY += my;
  }

  _onMouseDown(e) {
    if (e.target && typeof e.target.closest === 'function') {
      if (e.target.closest('button, input, select, details, a, #pause-menu, #click-to-play, #main-menu, #game-over, #victory-screen') || e.target.id === 'click-to-play' || e.target.id === 'btn-hud-pause') {
        return;
      }
    }
    const isLocked = !!document.pointerLockElement ||
                     (typeof navigator !== 'undefined' && navigator.userAgent.includes('HeadlessChrome')) ||
                     !!(typeof window !== 'undefined' && window.__HEADLESS_TEST__);
    if (!isLocked) {
      return;
    }
    this.mouseButtons.add(e.button);
    this._mouseJustDown.add(e.button);
  }

  _onMouseUp(e) {
    this.mouseButtons.delete(e.button);
    this._mouseJustUp.add(e.button);
  }

  clearMouse() {
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseButtons.clear();
    this._mouseJustDown.clear();
    this._mouseJustUp.clear();
  }

  clearKeys() {
    this._keys.clear();
    this._pressed.clear();
    this._released.clear();
  }

  clearAll() {
    this.clearKeys();
    this.clearMouse();
  }

  // Check if a key is currently held
  isDown(code) { return this._keys.has(code) || this._gpButtonDown(this._mapCodeToGp(code)); }
  justPressed(code) { return this._pressed.has(code) || this._gpButtonJustPressed(this._mapCodeToGp(code)); }
  justReleased(code) { return this._released.has(code) || this._gpButtonJustReleased(this._mapCodeToGp(code)); }

  mouseDown(btn) { return this.mouseButtons.has(btn) || (btn === 2 && this._gpButtonDown(4)) || (btn === 0 && this._gpButtonDown(7)); }
  mouseJustDown(btn) { return this._mouseJustDown.has(btn) || (btn === 2 && this._gpButtonJustPressed(4)) || (btn === 0 && this._gpButtonJustPressed(7)); }
  mouseJustUp(btn) { return this._mouseJustUp.has(btn) || (btn === 2 && this._gpButtonJustReleased(4)) || (btn === 0 && this._gpButtonJustReleased(7)); }

  // WASD convenience
  get moveForward()  { const gp = this._getGamepad(); return this._keys.has('KeyW') || this._keys.has('ArrowUp') || (gp && gp.axes[1] < -0.15); }
  get moveBackward() { const gp = this._getGamepad(); return this._keys.has('KeyS') || this._keys.has('ArrowDown') || (gp && gp.axes[1] > 0.15); }
  get moveLeft()     { const gp = this._getGamepad(); return this._keys.has('KeyA') || this._keys.has('ArrowLeft') || (gp && gp.axes[0] < -0.15); }
  get moveRight()    { const gp = this._getGamepad(); return this._keys.has('KeyD') || this._keys.has('ArrowRight') || (gp && gp.axes[0] > 0.15); }
  get sprint()       { return this.isDown('ShiftLeft') || this.isDown('ShiftRight') || this._gpButtonDown(10); }
  get interact()     { return this.justPressed('KeyE') || this.justPressed('KeyF') || this._gpButtonJustPressed(1) || this._gpButtonJustPressed(3); }
  get dodge()        { return this.justPressed('Space') || this._gpButtonJustPressed(0); }
  get useFlask()     { return this.justPressed('KeyQ') || this._gpButtonJustPressed(2); }
  get heavyAttack()  { return this.justPressed('KeyR') || this._gpButtonJustPressed(6); } // L2 heavy attack
  get quickRanged()  { return this._gpButtonJustPressed(5); } // R1
  get cyclePrev()    { return this._gpButtonJustPressed(14); } // D-Pad Left
  get cycleNext()    { return this._gpButtonJustPressed(15); } // D-Pad Right
  get pause()        { return this.justPressed('Escape') || this._gpButtonJustPressed(9); } // Options

  playRumble(type = 'hit') {
    const gp = this._getGamepad();
    if (!gp || !gp.vibrationActuator) return;
    try {
      if (type === 'hit') {
        gp.vibrationActuator.playEffect('dual-rumble', {
          startDelay: 0,
          duration: 150,
          weakMagnitude: 0.8,
          strongMagnitude: 0.5
        });
      } else if (type === 'heavy') {
        gp.vibrationActuator.playEffect('dual-rumble', {
          startDelay: 0,
          duration: 250,
          weakMagnitude: 1.0,
          strongMagnitude: 1.0
        });
      }
    } catch (e) {
      // Ignored
    }
  }

  // Must be called at end of each frame
  endFrame() {
    this._pressed.clear();
    this._released.clear();
    this._mouseJustDown.clear();
    this._mouseJustUp.clear();
    this.mouseX = 0;
    this.mouseY = 0;

    const gp = this._getGamepad();
    if (gp) {
      this._prevGpButtons = gp.buttons.map(b => b.pressed);

      let rx = gp.axes[2] || 0;
      let ry = gp.axes[3] || 0;
      let rLen = Math.hypot(rx, ry);
      if (rLen > 0.15) {
        let nrx = rx / rLen;
        let nry = ry / rLen;
        let adjustedLen = Math.pow(rLen, 1.8);
        const sensitivity = 25;
        this.mouseX += nrx * adjustedLen * sensitivity;
        this.mouseY += nry * adjustedLen * sensitivity;
      }
    } else {
      this._prevGpButtons = [];
    }
  }
}
