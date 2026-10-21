import { create } from 'zustand';
import { fetchCalendarEvents, fetchCalendarList } from '@/lib/googleCalendar';
import type { GoogleCalendarEvent, GoogleCalendarInfo } from '@/types';

/** 구글 캘린더에서 읽어온 값은 저장하지 않고 메모리에만 둔다(매번 최신을 읽어옴). */
interface GoogleCalendarState {
  calendars: GoogleCalendarInfo[];
  events: GoogleCalendarEvent[];
  loading: boolean;
  error: string | null;
  /** 마지막으로 불러온 범위+캘린더 조합. 같으면 다시 안 부른다. */
  loadedKey: string | null;

  loadCalendars: () => Promise<void>;
  loadRange: (from: string, to: string, calendarIds: string[], force?: boolean) => Promise<void>;
  clear: () => void;
}

export const useGoogleCalendarStore = create<GoogleCalendarState>((set, get) => ({
  calendars: [],
  events: [],
  loading: false,
  error: null,
  loadedKey: null,

  async loadCalendars() {
    set({ loading: true, error: null });
    try {
      const calendars = await fetchCalendarList();
      set({ calendars, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  async loadRange(from, to, calendarIds, force = false) {
    if (calendarIds.length === 0) {
      set({ events: [], loadedKey: null, error: null });
      return;
    }
    const key = `${from}|${to}|${[...calendarIds].sort().join(',')}`;
    if (!force && get().loadedKey === key) return;
    set({ loading: true, error: null });
    try {
      const events = await fetchCalendarEvents(from, to, calendarIds);
      set({ events, loading: false, loadedKey: key });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  clear() {
    set({ events: [], loadedKey: null, error: null });
  },
}));
