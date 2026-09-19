/**
 * HitDetection.js — Raycasting utilities + damage number spawner
 */

const _tmpVec = new THREE.Vector2(0, 0);

/**
 * Spawn a floating damage number at a world position
 * Converts 3D world position to screen coords
 */
export function spawnDamageNumber(worldPos, amount, camera, color = '#ffdd44') {
  const el = document.createElement('div');
  el.className = 'dmg-num';
  el.textContent = Math.round(amount);
  el.style.color = color;

  let x, y;
  if (camera && worldPos) {
    // Project world → screen
    const pos = worldPos.clone();
    pos.project(camera);
    x = ((pos.x + 1) / 2) * window.innerWidth;
    y = ((-pos.y + 1) / 2) * window.innerHeight;

    // Skip if behind camera
    if (pos.z > 1) return;
  } else {
    // Default to center-ish
    x = window.innerWidth / 2 + (Math.random() - 0.5) * 100;
    y = window.innerHeight / 2 + (Math.random() - 0.5) * 60;
  }

  // Randomize horizontal scatter
  x += (Math.random() - 0.5) * 40;

  el.style.left = x + 'px';
  el.style.top  = y + 'px';

  const container = document.getElementById('damage-numbers');
  if (container) {
    container.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }
}

/**
 * Simple AABB intersection test
 * a, b: { x, y, z, w, h, d } (center + half-extents × 2)
 */
export function aabbIntersects(a, b) {
  return (
    Math.abs(a.x - b.x) < (a.w + b.w) / 2 &&
    Math.abs(a.y - b.y) < (a.h + b.h) / 2 &&
    Math.abs(a.z - b.z) < (a.d + b.d) / 2
  );
}
