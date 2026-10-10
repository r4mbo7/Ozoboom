import { describe, expect, it } from 'vitest';
import { loadPrefs, savePref } from './prefs';

const DEFAULTS = {
  calmMode: true,
  muted: false,
  volume: 10,
  autoFire: false,
  autoAim: false,
  classId: 'mage',
  stageId: 'soiree-v0',
  trackId: '',
};

function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => {
      items.clear();
    },
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => {
      items.delete(key);
    },
    setItem: (key, value) => {
      items.set(key, value);
    },
  };
}

const blocked = (): Storage => {
  throw new DOMException('The operation is insecure.', 'SecurityError');
};

describe('prefs', () => {
  it('uses the defaults on the first visit', () => {
    const storage = memoryStorage();

    expect(loadPrefs(() => storage, DEFAULTS)).toEqual(DEFAULTS);
  });

  it('remembers the choices of the last visit over the defaults', () => {
    const storage = memoryStorage();

    savePref(() => storage, 'calmMode', false);
    savePref(() => storage, 'muted', true);
    savePref(() => storage, 'volume', 4);
    savePref(() => storage, 'autoFire', true);
    savePref(() => storage, 'autoAim', true);
    savePref(() => storage, 'classId', 'tank');
    savePref(() => storage, 'stageId', 'dome');
    savePref(() => storage, 'trackId', 'soiree-ouverture');

    expect(loadPrefs(() => storage, DEFAULTS)).toEqual({
      calmMode: false,
      muted: true,
      volume: 4,
      autoFire: true,
      autoAim: true,
      classId: 'tank',
      stageId: 'dome',
      trackId: 'soiree-ouverture',
    });
  });

  it('ignores a value it did not write', () => {
    const storage = memoryStorage();
    storage.setItem('ozoboom.muted', 'yes');
    storage.setItem('ozoboom.volume', '11');

    expect(loadPrefs(() => storage, DEFAULTS)).toEqual(DEFAULTS);
  });

  it('plays with the defaults and forgets silently when the storage is blocked', () => {
    expect(() => {
      savePref(blocked, 'muted', true);
    }).not.toThrow();
    expect(loadPrefs(blocked, DEFAULTS)).toEqual(DEFAULTS);
  });
});
