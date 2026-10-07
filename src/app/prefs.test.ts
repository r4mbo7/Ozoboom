import { describe, expect, it } from 'vitest';
import { loadPrefs, savePref } from './prefs';

const DEFAULTS = {
  calmMode: true,
  muted: false,
  autoFire: false,
  autoAim: false,
  classId: 'mage',
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
    savePref(() => storage, 'autoFire', true);
    savePref(() => storage, 'autoAim', true);
    savePref(() => storage, 'classId', 'tank');

    expect(loadPrefs(() => storage, DEFAULTS)).toEqual({
      calmMode: false,
      muted: true,
      autoFire: true,
      autoAim: true,
      classId: 'tank',
    });
  });

  it('ignores a value it did not write', () => {
    const storage = memoryStorage();
    storage.setItem('ozoboom.muted', 'yes');

    expect(loadPrefs(() => storage, DEFAULTS)).toEqual(DEFAULTS);
  });

  it('plays with the defaults and forgets silently when the storage is blocked', () => {
    expect(() => {
      savePref(blocked, 'muted', true);
    }).not.toThrow();
    expect(loadPrefs(blocked, DEFAULTS)).toEqual(DEFAULTS);
  });
});
