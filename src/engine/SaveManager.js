/**
 * SaveManager.js
 * localStorage-based save/load system
 * Key: 'gauntlet_save_v1'
 */
const SAVE_KEY = 'gauntlet_save_v1';

export class SaveManager {
  save(data) {
    const saveObj = {
      ...data,
      savedAt: new Date().toISOString(),
      version: 1,
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(saveObj));
      console.log('[Save] Game saved:', saveObj);
      return true;
    } catch (e) {
      console.warn('[Save] Failed to save:', e);
      return false;
    }
  }

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (data.version !== 1) return null;
      console.log('[Save] Game loaded:', data);
      return data;
    } catch (e) {
      console.warn('[Save] Failed to load:', e);
      return null;
    }
  }

  hasSave() {
    return !!localStorage.getItem(SAVE_KEY);
  }

  clear() {
    localStorage.removeItem(SAVE_KEY);
  }
}
