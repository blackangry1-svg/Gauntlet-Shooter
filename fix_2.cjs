const fs = require('fs');

let content = fs.readFileSync('src/engine/InputManager.js', 'utf8').replace(/\r\n/g, '\n');

const constr = `
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
`;
content = content.replace(/constructor\(\) \{[\s\S]*?\}\n/, constr.trim() + '\n');

const downRe = `
  isDown(code) { return this._keys.has(code) || this._gpButtonDown(this._mapCodeToGp(code)); }
  justPressed(code) { return this._pressed.has(code) || this._gpButtonJustPressed(this._mapCodeToGp(code)); }
  justReleased(code) { return this._released.has(code) || this._gpButtonJustReleased(this._mapCodeToGp(code)); }

  mouseDown(btn) { return this.mouseButtons.has(btn) || (btn === 2 && this._gpButtonDown(4)) || (btn === 0 && this._gpButtonDown(7)); }
  mouseJustDown(btn) { return this._mouseJustDown.has(btn) || (btn === 2 && this._gpButtonJustPressed(4)) || (btn === 0 && this._gpButtonJustPressed(7)); }
  mouseJustUp(btn) { return this._mouseJustUp.has(btn) || (btn === 2 && this._gpButtonJustReleased(4)) || (btn === 0 && this._gpButtonJustReleased(7)); }
`;
content = content.replace(/isDown\(code\) \{[\s\S]*?mouseJustUp\(btn\) \{[\s\S]*?\}\n/, downRe.trim() + '\n');

const getRe = `
  get moveForward()  { const gp = this._getGamepad(); return this._keys.has('KeyW') || this._keys.has('ArrowUp') || (gp && gp.axes[1] < -0.15); }
  get moveBackward() { const gp = this._getGamepad(); return this._keys.has('KeyS') || this._keys.has('ArrowDown') || (gp && gp.axes[1] > 0.15); }
  get moveLeft()     { const gp = this._getGamepad(); return this._keys.has('KeyA') || this._keys.has('ArrowLeft') || (gp && gp.axes[0] < -0.15); }
  get moveRight()    { const gp = this._getGamepad(); return this._keys.has('KeyD') || this._keys.has('ArrowRight') || (gp && gp.axes[0] > 0.15); }
  get sprint()       { return this.isDown('ShiftLeft') || this.isDown('ShiftRight'); }
  get interact()     { return this.justPressed('KeyE') || this.justPressed('KeyF'); }
  get dodge()        { return this.justPressed('Space'); }
  get useFlask()     { return this.justPressed('KeyQ'); }
  get heavyAttack()  { return this.justPressed('KeyR') || this._gpButtonJustPressed(6); } // L2 heavy attack
`;
content = content.replace(/get moveForward\(\)[\s\S]*?get heavyAttack\(\)[\s\S]*?\}\n/, getRe.trim() + '\n');

const endFrameRe = `
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
`;
content = content.replace(/endFrame\(\) \{[\s\S]*?\}\n/, endFrameRe.trim() + '\n');

fs.writeFileSync('src/engine/InputManager.js', content, 'utf8');
