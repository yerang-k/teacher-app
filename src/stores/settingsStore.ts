import { create } from 'zustand';
import { db, now } from '@/db';
import type { AppSettings } from '@/types';

const DEFAULT_SETTINGS: AppSettings = {
  id: 'singleton',
  currentYear: new Date().getFullYear(),
  currentSemester: new Date().getMonth() < 7 ? 1 : 2,
  theme: 'light',
  updatedAt: Date.now(),
};

interface SettingsState {
  settings: AppSettings;
  loaded: boolean;

  load: () => Promise<void>;
  update: (patch: Partial<AppSettings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,

  async load() {
    const row = await db.settings.get('singleton');
    if (row) {
      set({ settings: row, loaded: true });
    } else {
      await db.settings.put(DEFAULT_SETTINGS);
      set({ settings: DEFAULT_SETTINGS, loaded: true });
    }
  },

  async update(patch) {
    const next: AppSettings = {
      ...get().settings,
      ...patch,
      id: 'singleton',
      updatedAt: now(),
    };
    await db.settings.put(next);
    set({ settings: next });
  },
}));
