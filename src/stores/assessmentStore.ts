import { create } from "zustand";
import { db } from "@/db";
import type { Assessment, AssessmentRecord } from "@/types";
import { nanoid } from "nanoid";

interface AssessmentState {
  assessments: Assessment[];
  records: AssessmentRecord[];
  loadAll: () => Promise<void>;
  loadRecordsByAssessment: (assessmentId: string) => Promise<void>;
  addAssessment: (
    data: Omit<Assessment, "id" | "createdAt" | "updatedAt">
  ) => Promise<string>;
  updateAssessment: (id: string, data: Partial<Assessment>) => Promise<void>;
  removeAssessment: (id: string) => Promise<void>;
  upsertRecord: (
    data: Omit<AssessmentRecord, "id" | "createdAt" | "updatedAt">
  ) => Promise<void>;
}

export const useAssessmentStore = create<AssessmentState>((set, get) => ({
  assessments: [],
  records: [],

  loadAll: async () => {
    const assessments = await db.assessments
      .orderBy("createdAt")
      .reverse()
      .toArray();
    set({ assessments });
  },

  loadRecordsByAssessment: async (assessmentId: string) => {
    const records = await db.assessmentRecords
      .where("assessmentId")
      .equals(assessmentId)
      .toArray();
    set({ records });
  },

  addAssessment: async (data) => {
    const now = Date.now();
    const id = nanoid();
    const assessment: Assessment = { ...data, id, createdAt: now, updatedAt: now };
    await db.assessments.add(assessment);
    set((s) => ({ assessments: [assessment, ...s.assessments] }));
    return id;
  },

  updateAssessment: async (id, data) => {
    const now = Date.now();
    await db.assessments.update(id, { ...data, updatedAt: now });
    set((s) => ({
      assessments: s.assessments.map((a) =>
        a.id === id ? { ...a, ...data, updatedAt: now } : a
      ),
    }));
  },

  removeAssessment: async (id) => {
    await db.assessments.delete(id);
    await db.assessmentRecords.where("assessmentId").equals(id).delete();
    set((s) => ({
      assessments: s.assessments.filter((a) => a.id !== id),
      records: s.records.filter((r) => r.assessmentId !== id),
    }));
  },

  upsertRecord: async (data) => {
    const now = Date.now();
    const existing = get().records.find(
      (r) => r.assessmentId === data.assessmentId && r.studentId === data.studentId
    );
    if (existing) {
      const updated = { ...existing, ...data, updatedAt: now };
      await db.assessmentRecords.put(updated);
      set((s) => ({
        records: s.records.map((r) => (r.id === existing.id ? updated : r)),
      }));
    } else {
      const id = nanoid();
      const record: AssessmentRecord = {
        ...data,
        id,
        createdAt: now,
        updatedAt: now,
      };
      await db.assessmentRecords.add(record);
      set((s) => ({ records: [...s.records, record] }));
    }
  },
}));
