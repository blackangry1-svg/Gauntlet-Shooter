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

    // Bind
    window.addEventListener('keydown',  e => this._onKeyDown(e));
    window.addEventListener('keyup',    e => this._onKeyUp(e));
    document.addEventListener('mousemove', e => this._onMouseMove(e), { passive: true });
    document.addEventListener('mousedown', e => this._onMouseDown(e));
    document.addEventListener('mouseup',   e => this._onMouseUp(e));
    window.addEventListener('contextmenu', e => e.preventDefault());
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
  isDown(code) { return this._keys.has(code); }

  // Check if a key was pressed this frame
  justPressed(code) { return this._pressed.has(code); }

  // Check if a key was released this frame
  justReleased(code) { return this._released.has(code); }

  // Mouse button helpers
  mouseDown(btn) { return this.mouseButtons.has(btn); }
  mouseJustDown(btn) { return this._mouseJustDown.has(btn); }
  mouseJustUp(btn) { return this._mouseJustUp.has(btn); }

  // WASD convenience
  get moveForward()  { return this._keys.has('KeyW') || this._keys.has('ArrowUp'); }
  get moveBackward() { return this._keys.has('KeyS') || this._keys.has('ArrowDown'); }
  get moveLeft()     { return this._keys.has('KeyA') || this._keys.has('ArrowLeft'); }
  get moveRight()    { return this._keys.has('KeyD') || this._keys.has('ArrowRight'); }
  get sprint()       { return this._keys.has('ShiftLeft') || this._keys.has('ShiftRight'); }
  get interact()     { return this.justPressed('KeyE') || this.justPressed('KeyF'); }
  get dodge()        { return this.justPressed('Space'); }
  get useFlask()     { return this.justPressed('KeyQ'); }
  get heavyAttack()  { return this.justPressed('KeyR'); }

  // Must be called at end of each frame
  endFrame() {
    this._pressed.clear();
    this._released.clear();
    this._mouseJustDown.clear();
    this._mouseJustUp.clear();
    this.mouseX = 0;
    this.mouseY = 0;
  }
}
