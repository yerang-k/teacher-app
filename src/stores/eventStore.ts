import { create } from 'zustand';
import { db, now, uid } from '@/db';
import type { SchoolEvent, EventCategory, EventScope } from '@/types';

interface EventFilters {
  category?: EventCategory;
  keyword?: string;
}

interface EventState {
  events: SchoolEvent[];
  loading: boolean;
  error: string | null;
  filters: EventFilters;

  loadAll: () => Promise<void>;
  setFilters: (patch: Partial<EventFilters>) => void;
  clearFilters: () => void;
  filtered: () => SchoolEvent[];
  /** 필터가 적용된 목록 중 scope(행사/개인)만 뽑기 */
  byScope: (scope: EventScope) => SchoolEvent[];

  addEvent: (input: Omit<SchoolEvent, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateEvent: (id: string, patch: Partial<SchoolEvent>) => Promise<void>;
  removeEvent: (id: string) => Promise<void>;

  toggleChecklistItem: (eventId: string, itemId: string) => Promise<void>;
  addChecklistItem: (eventId: string, text: string) => Promise<void>;
  removeChecklistItem: (eventId: string, itemId: string) => Promise<void>;

  /** 특정 날짜(dateKey)에 걸치는 행사 */
  onDate: (dateKey: string) => SchoolEvent[];
}

export const useEventStore = create<EventState>((set, get) => ({
  events: [],
  loading: false,
  error: null,
  filters: {},

  async loadAll() {
    set({ loading: true, error: null });
    try {
      const rows = await db.events.toArray();
      rows.sort((a, b) => a.startDate.localeCompare(b.startDate));
      set({ events: rows, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  setFilters(patch) {
    set((s) => ({ filters: { ...s.filters, ...patch } }));
  },
  clearFilters() {
    set({ filters: {} });
  },

  filtered() {
    const { events, filters } = get();
    const k = filters.keyword?.toLowerCase().trim();
    return events.filter((e) => {
      if (filters.category && e.category !== filters.category) return false;
      if (k) {
        const hay = (e.title + ' ' + (e.description ?? '') + ' ' + (e.location ?? '')).toLowerCase();
        if (!hay.includes(k)) return false;
      }
      return true;
    });
  },

  byScope(scope) {
    return get()
      .filtered()
      .filter((e) => e.scope === scope);
  },

  async addEvent(input) {
    const item: SchoolEvent = {
      ...input,
      id: uid(),
      createdAt: now(),
      updatedAt: now(),
    };
    await db.events.add(item);
    set((s) => ({ events: [...s.events, item].sort((a, b) => a.startDate.localeCompare(b.startDate)) }));
    return item.id;
  },

  async updateEvent(id, patch) {
    const updated = { ...patch, updatedAt: now() };
    await db.events.update(id, updated);
    set((s) => ({
      events: s.events
        .map((e) => (e.id === id ? { ...e, ...updated } : e))
        .sort((a, b) => a.startDate.localeCompare(b.startDate)),
    }));
  },

  async removeEvent(id) {
    await db.events.delete(id);
    set((s) => ({ events: s.events.filter((e) => e.id !== id) }));
  },

  async toggleChecklistItem(eventId, itemId) {
    const e = get().events.find((x) => x.id === eventId);
    if (!e?.checklist) return;
    const next = e.checklist.map((c) => (c.id === itemId ? { ...c, done: !c.done } : c));
    await get().updateEvent(eventId, { checklist: next });
  },

  async addChecklistItem(eventId, text) {
    const e = get().events.find((x) => x.id === eventId);
    if (!e) return;
    const next = [...(e.checklist ?? []), { id: uid(), text, done: false }];
    await get().updateEvent(eventId, { checklist: next });
  },

  async removeChecklistItem(eventId, itemId) {
    const e = get().events.find((x) => x.id === eventId);
    if (!e?.checklist) return;
    const next = e.checklist.filter((c) => c.id !== itemId);
    await get().updateEvent(eventId, { checklist: next });
  },

  onDate(dateKey) {
    return get().events.filter((e) => e.startDate <= dateKey && dateKey <= e.endDate);
  },
}));
