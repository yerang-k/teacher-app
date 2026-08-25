import { create } from 'zustand';
import { db, now } from '@/db';
import type { Curriculum } from '@/types';

interface CurriculumState {
  curricula: Curriculum[];
  loaded: boolean;

  loadAll: () => Promise<void>;
  get: (key: string) => Curriculum | undefined;
  /** 진도 순서 저장 (있으면 갱신, 없으면 생성) */
  save: (
    key: string,
    name: string,
    items: { unit: string; topic: string }[],
    classIds?: string[]
  ) => Promise<void>;
  /** 진도 그룹 삭제 */
  delete: (key: string) => Promise<void>;
}

export const useCurriculumStore = create<CurriculumState>((set, get) => ({
  curricula: [],
  loaded: false,

  async loadAll() {
    const rows = await db.curricula.toArray();
    set({ curricula: rows, loaded: true });
  },

  get(key) {
    return get().curricula.find((c) => c.id === key);
  },

  async save(key, name, items, classIds) {
    const existing = get().curricula.find((c) => c.id === key);
    const item: Curriculum = existing
      ? { ...existing, name, items, classIds: classIds ?? existing.classIds, updatedAt: now() }
      : { id: key, name, items, classIds, createdAt: now(), updatedAt: now() };
    await db.curricula.put(item);
    set((s) => ({
      curricula: existing
        ? s.curricula.map((c) => (c.id === key ? item : c))
        : [...s.curricula, item],
    }));
  },

  async delete(key) {
    await db.curricula.delete(key);
    set((s) => ({
      curricula: s.curricula.filter((c) => c.id !== key),
    }));
  },
}));
