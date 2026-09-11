import { create } from 'zustand';
import { db, uid, now } from '@/db';
import type { Memo, MemoCategory, MemoAttachment } from '@/types';

interface MemoState {
  memos: Memo[];
  loaded: boolean;

  loadAll: () => Promise<void>;
  add: (input: {
    category: MemoCategory;
    title: string;
    body: string;
    date: string;
    attachments?: MemoAttachment[];
  }) => Promise<string>;
  update: (id: string, patch: Partial<Omit<Memo, 'id' | 'createdAt'>>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

/** 최신순(날짜 → 생성시각 내림차순) 정렬 */
function sortMemos(rows: Memo[]): Memo[] {
  return [...rows].sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt
  );
}

export const useMemoStore = create<MemoState>((set, get) => ({
  memos: [],
  loaded: false,

  async loadAll() {
    const rows = await db.memos.toArray();
    set({ memos: sortMemos(rows), loaded: true });
  },

  async add(input) {
    const memo: Memo = {
      id: uid(),
      category: input.category,
      title: input.title,
      body: input.body,
      date: input.date,
      attachments: input.attachments ?? [],
      createdAt: now(),
      updatedAt: now(),
    };
    await db.memos.put(memo);
    set((s) => ({ memos: sortMemos([memo, ...s.memos]) }));
    return memo.id;
  },

  async update(id, patch) {
    const existing = get().memos.find((m) => m.id === id);
    if (!existing) return;
    const updated: Memo = { ...existing, ...patch, updatedAt: now() };
    await db.memos.put(updated);
    set((s) => ({ memos: sortMemos(s.memos.map((m) => (m.id === id ? updated : m))) }));
  },

  async remove(id) {
    await db.memos.delete(id);
    set((s) => ({ memos: s.memos.filter((m) => m.id !== id) }));
  },
}));
