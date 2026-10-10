/**
 * MinotaurStalker.js — Alien: Isolation Jump Scare & Nemesis Stalker Mechanics
 * 
 * Features:
 * 1. Pacing & Tension System (Dread Meter): Gradual tension buildup across any labyrinth floor (Z > 18).
 * 2. Alien: Isolation Audio Cues: Raspy breathing getting closer, sinister cardiac pulses, and psychological taunts.
 * 3. Full Sanctuary & Escape Rules:
 *    - Reaching the Beach (Z <= 2) ends hunt.
 *    - Reaching Beach Shelter ends hunt ONLY IF the shelter has been constructed (isBuilt === true).
 *    - Reaching ANY Bonfire / Save Point / Shrine (Shrine of Ash on Floor 2, High Sanctum on Floor 4, or active checkpoint)
 *      immediately repels the Minotaur with sacred fire.
 * 4. Jumpscare Ambush: Screen shake, heavy controller haptics, deafening roar, and sudden beast charge.
 */

/* global THREE */

export class MinotaurStalker {
  constructor(scene, audio, enemyManager) {
    this.scene = scene;
    this.audio = audio;
    this.enemyManager = enemyManager;
    this.player = null;
    this.camera = null;

    this.activeMinotaur = null;
    this.isHunting = false;
    this.tension = 0;          // 0 to 100 Dread Meter
    this.cooldownTimer = 0;     // Relief period after escape
    this.shakeTimer = 0;
    this.shakeIntensity = 0;

    // Audio & Psychological timers
    this.breatheTimer = 3.0;
    this.heartbeatTimer = 2.0;
    this.tauntTimer = 6.0;

    this.tauntList = [
      '"I SMELL YOUR MORTAL BLOOD, INTRUDER..."',
      '"THIS LABYRINTH IS MY DOMAIN... YOU CANNOT ESCAPE!"',
      '"I HEAR THE FRANTIC BEATING OF YOUR HEART..."',
      '"TURN BACK TO THE SEA OR DIE IN MY HALLS!"',
      '"RUN, LITTLE RAT... I AM CLOSING IN!"',
      '"NO HUMAN LEAVES MINOS\'S MAZE ALIVE!"'
    ];

    // UI elements
    this._jumpScareOverlay = null;
    this._jumpScareAlert = null;
    this._dreadContainer = null;
    this._dreadBar = null;
    this._tauntText = null;
    this._ensureUIElements();
  }

  _ensureUIElements() {
    if (typeof document === 'undefined') return;

    // Horror red vignette overlay
    if (!document.getElementById('jumpscare-overlay')) {
      const el = document.createElement('div');
      el.id = 'jumpscare-overlay';
      el.style.position = 'fixed';
      el.style.top = '0';
      el.style.left = '0';
      el.style.width = '100vw';
      el.style.height = '100vh';
      el.style.pointerEvents = 'none';
      el.style.zIndex = '950';
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.25s ease';
      el.style.boxShadow = 'inset 0 0 120px 40px rgba(180, 0, 0, 0.85)';
      document.body.appendChild(el);
      this._jumpScareOverlay = el;
    } else {
      this._jumpScareOverlay = document.getElementById('jumpscare-overlay');
    }

    // Centered Jump Scare Alert
    if (!document.getElementById('jumpscare-alert')) {
      const alert = document.createElement('div');
      alert.id = 'jumpscare-alert';
      alert.style.position = 'fixed';
      alert.style.top = '14%';
      alert.style.left = '50%';
      alert.style.transform = 'translateX(-50%)';
      alert.style.fontFamily = "'MedievalSharp', serif";
      alert.style.fontSize = '1.8em';
      alert.style.color = '#ff2222';
      alert.style.textShadow = '0 0 25px #ff0000, 2px 2px 4px #000';
      alert.style.letterSpacing = '0.14em';
      alert.style.pointerEvents = 'none';
      alert.style.zIndex = '960';
      alert.style.padding = '12px 36px';
      alert.style.background = 'rgba(20, 0, 0, 0.88)';
      alert.style.border = '2px solid #ff2222';
      alert.style.borderRadius = '6px';
      alert.style.display = 'none';
      alert.style.textAlign = 'center';
      document.body.appendChild(alert);
      this._jumpScareAlert = alert;
    } else {
      this._jumpScareAlert = document.getElementById('jumpscare-alert');
    }

    // Alien: Isolation Tension / Dread Meter in HUD
    if (!document.getElementById('dread-meter-container')) {
      const d = document.createElement('div');
      d.id = 'dread-meter-container';
      d.style.position = 'fixed';
      d.style.top = '18px';
      d.style.left = '50%';
      d.style.transform = 'translateX(-50%)';
      d.style.display = 'none';
      d.style.flexDirection = 'column';
      d.style.alignItems = 'center';
      d.style.pointerEvents = 'none';
      d.style.zIndex = '800';

      d.innerHTML = `
        <div id="dread-title" style="font-family:'MedievalSharp', serif; font-size:13px; color:#ff6655; letter-spacing:2px; text-shadow:0 0 10px #ff0000; font-weight:bold;">
          ⚠️ DREAD METER
        </div>
        <div style="width:220px; height:8px; background:rgba(15,10,12,0.85); border:1px solid #aa2222; border-radius:4px; margin-top:4px; overflow:hidden; box-shadow:0 0 10px rgba(255,0,0,0.3);">
          <div id="dread-meter-bar" style="width:0%; height:100%; background:linear-gradient(90deg, #ffaa00, #ff2200); transition:width 0.25s ease;"></div>
        </div>
        <div id="minotaur-taunt-text" style="font-family:'MedievalSharp', serif; font-size:15px; color:#ffddbb; font-style:italic; margin-top:6px; text-shadow:0 0 12px #ff2200, 1px 1px 2px #000; min-height:18px;"></div>
      `;
      document.body.appendChild(d);
      this._dreadContainer = d;
      this._dreadBar = d.querySelector('#dread-meter-bar');
      this._tauntText = d.querySelector('#minotaur-taunt-text');
    } else {
      this._dreadContainer = document.getElementById('dread-meter-container');
      this._dreadBar = document.getElementById('dread-meter-bar');
      this._tauntText = document.getElementById('minotaur-taunt-text');
    }
  }

  setPlayer(player, camera) {
    this.player = player;
    this.camera = camera;
  }

  isNearSanctuary(px, py, pz) {
    // 1. Beach threshold
    if (pz <= 2) return true;

    // 2. Beach Shelter: ONLY IF BUILT!
    const map = window.GAME && window.GAME.map ? window.GAME.map : null;
    if (map && map.shelterInteractable && map.shelterInteractable.isBuilt) {
      if (pz < -80 && Math.abs(px - (-5)) < 14) return true;
    }

    // 3. Shrine of Ash on Floor 2: (-16, 4, 159)
    const distShrineAsh = Math.hypot(px - (-16), pz - 159);
    if (distShrineAsh <= 12.0 && Math.abs(py - 4) <= 4.0) return true;

    // 4. High Sanctum Bonfire on Floor 4: (8, 12, 282)
    const distHighSanctum = Math.hypot(px - 8, pz - 282);
    if (distHighSanctum <= 12.0 && Math.abs(py - 12) <= 4.0) return true;

    // 5. Any active checkpoint interactable
    if (map && Array.isArray(map.interactables)) {
      for (const item of map.interactables) {
        if (item.prompt && (item.prompt.includes('REST') || item.prompt.includes('SHRINE'))) {
          const d = Math.hypot(px - item.position.x, pz - item.position.z);
          if (d <= 10.0) return true;
        }
      }
    }

    return false;
  }

  triggerAmbush(pos = null) {
    if (!this.player || !this.camera || this.isHunting) return;

    this.isHunting = true;
    this.tension = 100;
    const playerPos = this.camera.position;

    // Spawn 13m in front of player
    let spawnPos = pos;
    if (!spawnPos) {
      const fwd = new THREE.Vector3();
      this.camera.getWorldDirection(fwd);
      fwd.y = 0;
      fwd.normalize();

      spawnPos = new THREE.Vector3()
        .copy(playerPos)
        .addScaledVector(fwd, 13);
      spawnPos.y = this.player.currentGroundY || 0;
    }

    // Import Minotaur and spawn through EnemyManager
    const enemyMgr = this.enemyManager;
    if (enemyMgr && typeof enemyMgr.spawnEnemy === 'function') {
      import('./Enemy.js').then(({ Minotaur }) => {
        this.activeMinotaur = enemyMgr.spawnEnemy(Minotaur, spawnPos, this.player, this.camera);
        if (this.activeMinotaur) {
          this.activeMinotaur.isBoss = false;
          this.activeMinotaur.isMinotaurStalker = true;
          this.activeMinotaur.setAnimation('roar');
          this.activeMinotaur.state = 'chase';
        }
      });
    }

    // Jump scare audiovisual sting
    if (this.audio) {
      this.audio.playSFX('bossRoar', 1.8);
      this.audio.playSFX('boom', 1.6);
    }

    // Gamepad heavy haptic terror rumble
    if (this.player.input && typeof this.player.input.playRumble === 'function') {
      this.player.input.playRumble('heavy');
    }

    // Intense screen tremor
    this.shakeTimer = 1.6;
    this.shakeIntensity = 0.28;

    // Show jump scare warning UI
    if (this._jumpScareOverlay) this._jumpScareOverlay.style.opacity = '1';
    if (this._jumpScareAlert) {
      this._jumpScareAlert.innerHTML = `⚠️ THE MINOTAUR HUNTS! RUN!<br><span style="font-size:0.65em;color:#ffaa44;">ESCAPE TO A SHRINE, BONFIRE, OR BUILT SHELTER!</span>`;
      this._jumpScareAlert.style.display = 'block';
      this._jumpScareAlert.style.borderColor = '#ff2222';
      this._jumpScareAlert.style.color = '#ff2222';
    }

    if (this._tauntText) {
      this._tauntText.textContent = '"I HAVE FOUND YOU, MORTAL!"';
    }
  }

  escapeMinotaur(reason = 'escape') {
    if (!this.isHunting) return;

    this.isHunting = false;
    this.tension = 0;
    this.cooldownTimer = 45.0; // Relief period

    if (this.activeMinotaur && !this.activeMinotaur.dead) {
      this.activeMinotaur.onDeath = null; // Escaped: not killed by player
      this.activeMinotaur.dead = true;
      this.activeMinotaur.dispose();
      this.activeMinotaur = null;
    }

    if (this._jumpScareOverlay) this._jumpScareOverlay.style.opacity = '0';
    if (this._jumpScareAlert) {
      const msg = reason === 'sanctuary'
        ? `✓ SANCTUARY REACHED<br><span style="font-size:0.65em;color:#44ff44;">The sacred flame repelled the Minotaur back into the shadows!</span>`
        : `✓ ESCAPED THE BEAST<br><span style="font-size:0.65em;color:#44ff44;">The Minotaur lost your scent in the labyrinth</span>`;

      this._jumpScareAlert.innerHTML = msg;
      this._jumpScareAlert.style.borderColor = '#44ff44';
      this._jumpScareAlert.style.color = '#44ff44';
      setTimeout(() => {
        if (this._jumpScareAlert) {
          this._jumpScareAlert.style.display = 'none';
          this._jumpScareAlert.style.borderColor = '#ff2222';
          this._jumpScareAlert.style.color = '#ff2222';
        }
      }, 4000);
    }

    if (this.audio) this.audio.playSFX('bossRoar', 0.8);
    if (this._tauntText) this._tauntText.textContent = '';
  }

  update(dt) {
    if (!this.player || !this.camera) return;

    const pz = this.camera.position.z;
    const px = this.camera.position.x;
    const py = this.camera.position.y;

    // Handle screen shake
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      const ox = (Math.random() - 0.5) * this.shakeIntensity;
      const oy = (Math.random() - 0.5) * this.shakeIntensity;
      this.camera.position.x += ox;
      this.camera.position.y += oy;
    }

    // Check sanctuary
    const nearSanctuary = this.isNearSanctuary(px, py, pz);

    // Active Hunt Phase
    if (this.isHunting) {
      if (this._jumpScareOverlay) {
        const pulse = 0.55 + Math.sin(Date.now() * 0.016) * 0.4;
        this._jumpScareOverlay.style.opacity = String(pulse);
      }

      // Check escape to beach, built shelter, or shrine
      if (nearSanctuary) {
        this.escapeMinotaur('sanctuary');
        return;
      }
      return;
    }

    // If near sanctuary, dread rapidly dissipates
    if (nearSanctuary) {
      this.tension = Math.max(0, this.tension - dt * 45);
      this._updateHUD(false);
      return;
    }

    // Cooldown management
    if (this.cooldownTimer > 0) {
      this.cooldownTimer -= dt;
      this.tension = 0;
      this._updateHUD(false);
      return;
    }

    // Only stalk within the Labyrinth proper (Z > 18) and outside boss arenas
    const inSecretLair = (px <= -75 && pz >= 35 && pz <= 85);
    const inCathedralBoss = (pz >= 326);
    if (pz <= 18 || inSecretLair || inCathedralBoss) {
      this.tension = Math.max(0, this.tension - dt * 25);
      this._updateHUD(false);
      return;
    }

    // Gradual tension accumulation (Alien: Isolation tension mechanic)
    const isSprinting = this.player.input && this.player.input.sprint;
    const accumulationRate = isSprinting ? 4.2 : 2.5; // Running raises tension faster
    this.tension = Math.min(100, this.tension + dt * accumulationRate);

    this._updateHUD(true);

    // Audio Cue 1: Raspy breathing (Tension >= 25)
    this.breatheTimer -= dt;
    if (this.breatheTimer <= 0 && this.tension >= 25) {
      const vol = Math.min(1.2, 0.4 + (this.tension / 100) * 0.8);
      if (this.audio) this.audio.playSFX('minotaurBreathe', vol);
      this.breatheTimer = 5.0 - (this.tension / 100) * 2.5; // Breaths quicken
    }

    // Audio Cue 2: Cardiac Heartbeat (Tension >= 45)
    this.heartbeatTimer -= dt;
    if (this.heartbeatTimer <= 0 && this.tension >= 45) {
      const vol = Math.min(1.0, 0.3 + (this.tension / 100) * 0.7);
      if (this.audio) this.audio.playSFX('heartbeat', vol);
      if (this.player.input && typeof this.player.input.playRumble === 'function') {
        this.player.input.playRumble('hit');
      }
      this.heartbeatTimer = 2.4 - (this.tension / 100) * 1.2;
    }

    // Psychological Taunt Cues (Tension >= 50)
    this.tauntTimer -= dt;
    if (this.tauntTimer <= 0 && this.tension >= 50) {
      const randomTaunt = this.tauntList[Math.floor(Math.random() * this.tauntList.length)];
      if (this._tauntText) this._tauntText.textContent = randomTaunt;
      if (this.audio) this.audio.playSFX('minotaurTaunt', 0.9);
      this.tauntTimer = 11.0;
    }

    // Light tremor & rumble at high tension (Tension >= 80)
    if (this.tension >= 80) {
      if (this._jumpScareOverlay) {
        const warningPulse = (this.tension - 80) / 20 * (0.3 + Math.sin(Date.now() * 0.01) * 0.2);
        this._jumpScareOverlay.style.opacity = String(warningPulse);
      }
    }

    // Jump scare ambush at 100% tension!
    if (this.tension >= 100) {
      this.triggerAmbush();
    }
  }

  _updateHUD(active) {
    if (!this._dreadContainer || !this._dreadBar) return;

    if (!active || this.tension < 5) {
      this._dreadContainer.style.display = 'none';
      if (this._jumpScareOverlay && !this.isHunting) this._jumpScareOverlay.style.opacity = '0';
      return;
    }

    this._dreadContainer.style.display = 'flex';
    this._dreadBar.style.width = `${Math.round(this.tension)}%`;
  }

  clear() {
    this.isHunting = false;
    this.tension = 0;
    this.cooldownTimer = 0;
    if (this.activeMinotaur && !this.activeMinotaur.dead) {
      this.activeMinotaur.onDeath = null;
      this.activeMinotaur.dead = true;
      this.activeMinotaur.dispose();
      this.activeMinotaur = null;
    }
    if (this._jumpScareOverlay) this._jumpScareOverlay.style.opacity = '0';
    if (this._jumpScareAlert) this._jumpScareAlert.style.display = 'none';
    if (this._dreadContainer) this._dreadContainer.style.display = 'none';
  }
}
