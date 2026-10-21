import { create } from 'zustand';
import { db, uid, now } from '@/db';
import type { Club, ClubMember } from '@/types';

interface ClubState {
  clubs: Club[];
  loaded: boolean;

  loadAll: () => Promise<void>;
  add: (input: { name: string; year: number; members: ClubMember[] }) => Promise<string>;
  update: (id: string, patch: Partial<Pick<Club, 'name' | 'year' | 'members' | 'archived'>>) => Promise<void>;
  /** 동아리와 그 출결 기록을 함께 삭제한다. */
  remove: (id: string) => Promise<void>;
}

function sortClubs(rows: Club[]): Club[] {
  return [...rows].sort((a, b) => b.year - a.year || a.name.localeCompare(b.name));
}

export const useClubStore = create<ClubState>((set, get) => ({
  clubs: [],
  loaded: false,

  async loadAll() {
    const rows = await db.clubs.toArray();
    set({ clubs: sortClubs(rows), loaded: true });
  },

  async add(input) {
    const club: Club = {
      id: uid(),
      name: input.name,
      year: input.year,
      members: input.members,
      createdAt: now(),
      updatedAt: now(),
    };
    await db.clubs.add(club);
    set({ clubs: sortClubs([...get().clubs, club]) });
    return club.id;
  },

  async update(id, patch) {
    const updated = { ...patch, updatedAt: now() };
    await db.clubs.update(id, updated);
    set({
      clubs: sortClubs(get().clubs.map((c) => (c.id === id ? { ...c, ...updated } : c))),
    });
  },

  async remove(id) {
    await db.transaction('rw', [db.clubs, db.attendance], async () => {
      await db.attendance.where('classId').equals(id).delete();
      await db.clubs.delete(id);
    });
    set({ clubs: get().clubs.filter((c) => c.id !== id) });
  },
}));
