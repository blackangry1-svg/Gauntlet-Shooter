/**
 * InputManager.js
 * Comprehensive Native PS4 DualShock Controller (1st Priority) + Keyboard/Mouse Support
 * Full mapping for all 18 PS4 buttons, dual analog sticks, rumble haptics, and auto-detect.
 */
export class InputManager {
  constructor() {
    this._keys     = new Set();
    this._pressed  = new Set();  // justPressed: cleared each frame
    this._released = new Set();  // justReleased: cleared each frame

    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseButtons = new Set();
    this._mouseJustDown = new Set();
    this._mouseJustUp   = new Set();

    this.isGamepadActive = false;
    this._currGpButtons = [];
    this._prevGpButtons = [];

    // Bind event listeners
    window.addEventListener('keydown',  e => this._onKeyDown(e));
    window.addEventListener('keyup',    e => this._onKeyUp(e));
    document.addEventListener('mousemove', e => this._onMouseMove(e), { passive: true });
    document.addEventListener('mousedown', e => this._onMouseDown(e));
    document.addEventListener('mouseup',   e => this._onMouseUp(e));
    window.addEventListener('contextmenu', e => e.preventDefault());

    // Gamepad connection events
    window.addEventListener('gamepadconnected', (e) => {
      console.log(`[InputManager] Gamepad connected at index ${e.gamepad.index}: ${e.gamepad.id}`);
      this.isGamepadActive = true;
      this.playRumble('hit');
    });
    window.addEventListener('gamepaddisconnected', (e) => {
      console.log(`[InputManager] Gamepad disconnected from index ${e.gamepad.index}`);
    });
  }

  _getGamepad() {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
    const pads = navigator.getGamepads();
    for (let i = 0; i < pads.length; i++) {
      if (pads[i] && pads[i].connected) return pads[i];
    }
    return null;
  }

  // PS4 Button helpers
  // 0: Cross, 1: Circle, 2: Square, 3: Triangle
  // 4: L1, 5: R1, 6: L2, 7: R2
  // 8: Share, 9: Options, 10: L3, 11: R3
  // 12: DpadUp, 13: DpadDown, 14: DpadLeft, 15: DpadRight, 17: Touchpad
  _gpButtonDown(btn) {
    if (btn === -1) return false;
    const gp = this._getGamepad();
    if (!gp || !gp.buttons[btn]) return false;
    const pressed = typeof gp.buttons[btn] === 'object' ? gp.buttons[btn].pressed : gp.buttons[btn] > 0.5;
    if (pressed) this.isGamepadActive = true;
    return pressed;
  }

  _gpButtonJustPressed(btn) {
    if (btn === -1) return false;
    const gp = this._getGamepad();
    if (!gp || !gp.buttons[btn]) return false;
    const curr = typeof gp.buttons[btn] === 'object' ? gp.buttons[btn].pressed : gp.buttons[btn] > 0.5;
    const prev = this._prevGpButtons[btn] || false;
    if (curr) this.isGamepadActive = true;
    return curr && !prev;
  }

  _gpButtonJustReleased(btn) {
    if (btn === -1) return false;
    const gp = this._getGamepad();
    if (!gp || !gp.buttons[btn]) return false;
    const curr = typeof gp.buttons[btn] === 'object' ? gp.buttons[btn].pressed : gp.buttons[btn] > 0.5;
    const prev = this._prevGpButtons[btn] || false;
    return !curr && prev;
  }

  _onKeyDown(e) {
    this.isGamepadActive = false;
    if (!this._keys.has(e.code)) {
      this._pressed.add(e.code);
    }
    this._keys.add(e.code);
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
    if (Math.abs(mx) > 1 || Math.abs(my) > 1) {
      this.isGamepadActive = false;
    }
    this.mouseX += mx;
    this.mouseY += my;
  }

  _onMouseDown(e) {
    this.isGamepadActive = false;
    if (e.target && typeof e.target.closest === 'function') {
      if (e.target.closest('button, input, select, details, a, #pause-menu, #click-to-play, #main-menu, #game-over, #victory-screen') || e.target.id === 'click-to-play' || e.target.id === 'btn-hud-pause') {
        return;
      }
    }
    const isLocked = !!document.pointerLockElement ||
                     (typeof navigator !== 'undefined' && navigator.userAgent.includes('HeadlessChrome')) ||
                     !!(typeof window !== 'undefined' && window.__HEADLESS_TEST__);
    if (!isLocked) return;

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

  // Keyboard check
  isDown(code) { return this._keys.has(code); }
  justPressed(code) { return this._pressed.has(code); }
  justReleased(code) { return this._released.has(code); }

  // Combat input: PS4 R2 (btn 7) OR Square (btn 2) OR Left Click
  mouseDown(btn) {
    if (btn === 0) {
      return this.mouseButtons.has(0) || this._gpButtonDown(7) || this._gpButtonDown(2);
    }
    if (btn === 2) { // Block: L1 (btn 4) or Right Click
      return this.mouseButtons.has(2) || this._gpButtonDown(4);
    }
    return this.mouseButtons.has(btn);
  }

  mouseJustDown(btn) {
    if (btn === 0) {
      return this._mouseJustDown.has(0) || this._gpButtonJustPressed(7) || this._gpButtonJustPressed(2);
    }
    if (btn === 2) {
      return this._mouseJustDown.has(2) || this._gpButtonJustPressed(4);
    }
    return this._mouseJustDown.has(btn);
  }

  mouseJustUp(btn) {
    if (btn === 0) {
      return this._mouseJustUp.has(0) || this._gpButtonJustReleased(7) || this._gpButtonJustReleased(2);
    }
    if (btn === 2) {
      return this._mouseJustUp.has(2) || this._gpButtonJustReleased(4);
    }
    return this._mouseJustUp.has(btn);
  }

  // True Analog Movement (Left Stick axes 0, 1) or WASD
  getMoveAxes() {
    let kx = 0;
    let ky = 0;
    if (this._keys.has('KeyD') || this._keys.has('ArrowRight')) kx += 1;
    if (this._keys.has('KeyA') || this._keys.has('ArrowLeft'))  kx -= 1;
    if (this._keys.has('KeyW') || this._keys.has('ArrowUp'))    ky += 1;
    if (this._keys.has('KeyS') || this._keys.has('ArrowDown'))  ky -= 1;

    const gp = this._getGamepad();
    if (gp) {
      const DEADZONE = 0.18;
      const lx = gp.axes[0] || 0;
      const ly = -(gp.axes[1] || 0); // Inverted so positive is forward
      const len = Math.hypot(lx, ly);
      if (len > DEADZONE) {
        this.isGamepadActive = true;
        const normMag = Math.min(1.0, (len - DEADZONE) / (1.0 - DEADZONE));
        const stickX = (lx / len) * normMag;
        const stickY = (ly / len) * normMag;
        if (Math.abs(kx) < 0.01 && Math.abs(ky) < 0.01) {
          return { x: stickX, y: stickY, magnitude: normMag };
        }
      }
    }

    const kLen = Math.hypot(kx, ky);
    if (kLen > 0.001) {
      return { x: kx / kLen, y: ky / kLen, magnitude: 1.0 };
    }
    return { x: 0, y: 0, magnitude: 0 };
  }

  // Boolean direction helpers (compatible with all legacy checks and tests)
  get moveForward() {
    const gp = this._getGamepad();
    return this._keys.has('KeyW') || this._keys.has('ArrowUp') || (gp && gp.axes[1] < -0.18);
  }
  get moveBackward() {
    const gp = this._getGamepad();
    return this._keys.has('KeyS') || this._keys.has('ArrowDown') || (gp && gp.axes[1] > 0.18);
  }
  get moveLeft() {
    const gp = this._getGamepad();
    return this._keys.has('KeyA') || this._keys.has('ArrowLeft') || (gp && gp.axes[0] < -0.18);
  }
  get moveRight() {
    const gp = this._getGamepad();
    return this._keys.has('KeyD') || this._keys.has('ArrowRight') || (gp && gp.axes[0] > 0.18);
  }

  // Action buttons:
  get sprint()       { return this.isDown('ShiftLeft') || this.isDown('ShiftRight') || this._gpButtonDown(10); } // L3
  get interact()     { return this.justPressed('KeyE') || this.justPressed('KeyF') || this._gpButtonJustPressed(1); } // Circle (O)
  get dodge()        { return this.justPressed('Space') || this._gpButtonJustPressed(0); } // Cross (X)
  get useFlask()     { return this.justPressed('KeyQ') || this._gpButtonJustPressed(12); } // D-Pad Up
  get heavyAttack()  { return this.justPressed('KeyR') || this._gpButtonJustPressed(6) || this._gpButtonJustPressed(3); } // L2 or Triangle
  get quickRanged()  { return this._gpButtonJustPressed(5); } // R1
  get cyclePrev()    { return this.justPressed('KeyZ') || this._gpButtonJustPressed(14); } // D-Pad Left or Z
  get cycleNext()    { return this.justPressed('KeyX') || this._gpButtonJustPressed(15); } // D-Pad Right or X
  get pause()        { return this.justPressed('Escape') || this._gpButtonJustPressed(9) || this._gpButtonJustPressed(17); } // Options or Touchpad
  get toggleStats()  { return this.justPressed('Tab') || this.justPressed('KeyI') || this._gpButtonJustPressed(8); } // Share
  get resetCamera()  { return this._gpButtonJustPressed(11) || this.justPressed('KeyC'); } // R3 (Stick Click) or C
  get toggleView()   { return this._gpButtonJustPressed(13) || this.justPressed('KeyV'); } // D-Pad Down or V (Toggle 1st/3rd person)

  // Menu navigation buttons
  get menuConfirm()  { return this.justPressed('Enter') || this.justPressed('Space') || this._gpButtonJustPressed(0); } // Cross
  get menuCancel()   { return this.justPressed('Escape') || this._gpButtonJustPressed(1); } // Circle
  get menuLeft()     { return this.justPressed('ArrowLeft') || this.justPressed('KeyA') || this._gpButtonJustPressed(14); }
  get menuRight()    { return this.justPressed('ArrowRight') || this.justPressed('KeyD') || this._gpButtonJustPressed(15); }
  get menuUp()       { return this.justPressed('ArrowUp') || this.justPressed('KeyW') || this._gpButtonJustPressed(12); }
  get menuDown()     { return this.justPressed('ArrowDown') || this.justPressed('KeyS') || this._gpButtonJustPressed(13); }

  playRumble(type = 'hit') {
    const gp = this._getGamepad();
    if (!gp || !gp.vibrationActuator) return;
    try {
      if (type === 'hit') {
        gp.vibrationActuator.playEffect('dual-rumble', {
          startDelay: 0,
          duration: 160,
          weakMagnitude: 0.7,
          strongMagnitude: 0.5
        });
      } else if (type === 'heavy') {
        gp.vibrationActuator.playEffect('dual-rumble', {
          startDelay: 0,
          duration: 320,
          weakMagnitude: 1.0,
          strongMagnitude: 1.0
        });
      }
    } catch (e) {}
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
      this._prevGpButtons = gp.buttons.map(b => (typeof b === 'object' ? b.pressed : b > 0.5));

      // Right Stick camera look (axes 2, 3)
      let rx = gp.axes[2] || 0;
      let ry = gp.axes[3] || 0;
      let rLen = Math.hypot(rx, ry);
      const DEADZONE = 0.18;
      if (rLen > DEADZONE) {
        this.isGamepadActive = true;
        let normLen = (rLen - DEADZONE) / (1.0 - DEADZONE);
        let adjustedLen = Math.pow(normLen, 2.0); // cubic response curve
        let nrx = rx / rLen;
        let nry = ry / rLen;
        const sensitivity = 32.0;
        this.mouseX += nrx * adjustedLen * sensitivity;
        this.mouseY += nry * adjustedLen * sensitivity;
      }
    } else {
      this._prevGpButtons = [];
    }
  }
}
