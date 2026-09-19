/**
 * HUD.js — Heads-Up Display updater
 * Updates DOM bars, minimap canvas
 */
export class HUD {
  constructor() {
    this._healthBar  = document.getElementById('health-bar');
    this._manaBar    = document.getElementById('mana-bar');
    this._healthText = document.getElementById('health-text');
    this._manaText   = document.getElementById('mana-text');
    this._enemyCount = document.getElementById('enemy-count');
    this._minimap    = document.getElementById('minimap');
    this._minimapCtx = this._minimap.getContext('2d');
    this._roomNum    = document.getElementById('room-num');
    this._scoreEl    = document.getElementById('score-value');
  }

  update(player) {
    if (!player) return;

    const hpPct = player.health / player.maxHealth;
    const mpPct = player.mana   / player.maxMana;

    this._healthBar.style.width = Math.max(0, hpPct * 100) + '%';
    this._manaBar.style.width   = Math.max(0, mpPct * 100) + '%';
    this._healthText.textContent = Math.ceil(player.health);
    this._manaText.textContent   = Math.ceil(player.mana);

    // Low health pulsing
    this._healthBar.style.filter = hpPct < 0.25
      ? `brightness(${1.2 + Math.sin(Date.now() * 0.01) * 0.3})`
      : '';
  }

  setRoom(current, total) {
    this._roomNum.textContent = current;
  }

  updateEnemyCount(count) {
    this._enemyCount.textContent = count;
  }

  updateScore(score) {
    this._scoreEl.textContent = String(score).padStart(6, '0');
  }

  /**
   * Draw minimap — top-down view of current room + player position + enemies
   */
  drawMinimap(map, enemies, playerPos) {
    const ctx = this._minimapCtx;
    const W = this._minimap.width;
    const H = this._minimap.height;

    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, 0, W, H);

    if (!map || !map.currentRoomBounds) return;

    const bounds = map.currentRoomBounds;
    const scaleX = W / (bounds.maxX - bounds.minX + 2);
    const scaleZ = H / (bounds.maxZ - bounds.minZ + 2);
    const scale  = Math.min(scaleX, scaleZ) * 0.85;
    const offX   = W / 2 - (bounds.minX + (bounds.maxX - bounds.minX) / 2) * scale;
    const offZ   = H / 2 - (bounds.minZ + (bounds.maxZ - bounds.minZ) / 2) * scale;

    const wx = (x) => x * scale + offX;
    const wz = (z) => z * scale + offZ;

    // Draw walls
    ctx.fillStyle = '#3a3028';
    for (const wall of (map.miniWalls || [])) {
      ctx.fillRect(
        wx(wall.x - wall.w / 2), wz(wall.z - wall.d / 2),
        wall.w * scale, wall.d * scale
      );
    }

    // Draw floor area
    ctx.strokeStyle = 'rgba(200,168,75,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      wx(bounds.minX), wz(bounds.minZ),
      (bounds.maxX - bounds.minX) * scale,
      (bounds.maxZ - bounds.minZ) * scale
    );

    // Draw enemies
    if (enemies) {
      for (const e of enemies.getAll()) {
        if (e.dead) continue;
        ctx.fillStyle = e.isBoss ? '#ff2222' : '#ff6644';
        ctx.beginPath();
        ctx.arc(wx(e.mesh.position.x), wz(e.mesh.position.z), 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw player
    ctx.fillStyle = '#00ffcc';
    ctx.beginPath();
    ctx.arc(wx(playerPos.x), wz(playerPos.z), 3, 0, Math.PI * 2);
    ctx.fill();

    // Player direction indicator
    ctx.strokeStyle = '#00ffcc';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(wx(playerPos.x), wz(playerPos.z));
    ctx.lineTo(wx(playerPos.x), wz(playerPos.z) - 8);
    ctx.stroke();

    // Border
    ctx.strokeStyle = 'rgba(200,168,75,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, W, H);
  }
}
