/**
 * ScreenFX.js — Screen shake, damage flash, and vignette effects
 * Uses a SEPARATE shake offset so it doesn't fight with Player camera position
 */

/* global THREE */

export class ScreenFX {
  constructor(camera) {
    this.camera   = camera;
    this._shakeT  = 0;
    this._shakeMag= 0;
    this._offsetX = 0;
    this._offsetZ = 0;
  }

  shake(magnitude = 0.08, duration = 0.25) {
    this._shakeMag = magnitude;
    this._shakeT   = duration;
  }

  pulse(color = '#ff0000', duration = 200) {
    const overlay = this._getOverlay();
    overlay.style.background = color;
    overlay.style.opacity = '0.25';
    overlay.style.transition = 'none';
    requestAnimationFrame(() => {
      overlay.style.transition = `opacity ${duration}ms ease-out`;
      overlay.style.opacity = '0';
    });
  }

  _getOverlay() {
    let el = document.getElementById('screen-fx-overlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'screen-fx-overlay';
      el.style.cssText =
        'position:fixed;inset:0;pointer-events:none;z-index:750;opacity:0;';
      document.body.appendChild(el);
    }
    return el;
  }

  update(dt) {
    // Remove previous frame's offset
    this.camera.position.x -= this._offsetX;
    this.camera.position.z -= this._offsetZ;
    this._offsetX = 0;
    this._offsetZ = 0;

    if (this._shakeT <= 0) return;
    this._shakeT -= dt;

    if (this._shakeT <= 0) {
      this._shakeT = 0;
      return;
    }

    // Apply new offset
    const mag = this._shakeMag * (this._shakeT / 0.25);
    this._offsetX = (Math.random() - 0.5) * mag;
    this._offsetZ = (Math.random() - 0.5) * mag;
    this.camera.position.x += this._offsetX;
    this.camera.position.z += this._offsetZ;
  }

  onPlayerHurt() {
    this.shake(0.06, 0.2);
    this.pulse('#ff0000', 300);
  }

  onBossHit() {
    this.shake(0.04, 0.12);
    this.pulse('#ffaa00', 150);
  }

  onRoomClear() {
    this.pulse('#ffffff', 600);
  }
}
