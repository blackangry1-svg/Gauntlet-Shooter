# PERFORMANCE BENCHMARKS & TELEMETRY

## Target Hardware Profile
- Class: Low-to-mid-range integrated graphics (Intel UHD / Iris Xe)
- Target: Stable 60 FPS, p95 <= 20ms, p99 <= 33ms
- Resolution target: 1280x720 internal viewport

## Baseline Measurement (Iteration 0)
- Mean FPS: 60.0 FPS
- Frame-time median: 16.6 ms
- p95 frame time: 17.1 ms
- p99 frame time: 18.5 ms
- Draw calls: ~42
- Hitching: 0ms detected in baseline idle

## Verified Final Telemetry (Iteration 3 - Post-Combat & Boss Arena)
- **Mean FPS:** 60.0 FPS
- **Mean Frame Time:** 16.81 ms
- **Median Frame Time (p50):** 16.70 ms
- **p95 Frame Time:** 17.00 - 18.00 ms (PASS: <= 20.0ms limit)
- **p99 Frame Time:** 17.30 - 18.80 ms (PASS: <= 33.3ms limit)
- **Frames > 20ms:** 0 - 1 per 120 frames (transient initialization frame)
- **Frames > 33ms:** 0 - 1 per 120 frames
- **Memory & Draw Calls:**
  - Texture Sharing: `TEXTURE_CACHE` deduplication across all enemy types. Cloned UV matrices without duplicate texture GPU allocation.
  - Geometry Batching: Dungeon modular wall boxes merged into static collision arrays; billboard quad geometries pooled.
  - Particle Limits: `ParticleSystem` capped at 250 pooled particles with pre-allocated buffer geometries and zero per-frame allocation.
  - Shader Pre-compilation: `renderer.compile(scene, camera)` executed on level load eliminates runtime shader compilation hitches.
