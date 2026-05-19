import { db } from "@/db";

export async function exportData(): Promise<void> {
  const [
    classes,
    students,
    lessons,
    attendance,
    behaviorNotes,
    tasks,
    settings,
    timetable,
    assessments,
    assessmentRecords,
  ] = await Promise.all([
    db.classes.toArray(),
    db.students.toArray(),
    db.lessons.toArray(),
    db.attendance.toArray(),
    db.behaviorNotes.toArray(),
    db.tasks.toArray(),
    db.settings.toArray(),
    db.timetable.toArray(),
    db.assessments.toArray(),
    db.assessmentRecords.toArray(),
  ]);

  const backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      classes,
      students,
      lessons,
      attendance,
      behaviorNotes,
      tasks,
      settings,
      timetable,
      assessments,
      assessmentRecords,
    },
  };

  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `teacher-app-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importData(file: File): Promise<void> {
  const text = await file.text();
  let parsed: {
    version: number;
    exportedAt: string;
    data: Record<string, unknown[]>;
  };

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("올바른 JSON 파일이 아닙니다.");
  }

  if (parsed.version !== 1) {
    throw new Error("지원하지 않는 백업 파일 형식입니다.");
  }

  const { data } = parsed;

  await db.transaction(
    "rw",
    [
      db.classes,
      db.students,
      db.lessons,
      db.attendance,
      db.behaviorNotes,
      db.tasks,
      db.settings,
      db.timetable,
      db.assessments,
      db.assessmentRecords,
    ],
    async () => {
      await Promise.all([
        db.classes.clear(),
        db.students.clear(),
        db.lessons.clear(),
        db.attendance.clear(),
        db.behaviorNotes.clear(),
        db.tasks.clear(),
        db.settings.clear(),
        db.timetable.clear(),
        db.assessments.clear(),
        db.assessmentRecords.clear(),
      ]);

      if (data.classes?.length) await db.classes.bulkAdd(data.classes as never[]);
      if (data.students?.length) await db.students.bulkAdd(data.students as never[]);
      if (data.lessons?.length) await db.lessons.bulkAdd(data.lessons as never[]);
      if (data.attendance?.length) await db.attendance.bulkAdd(data.attendance as never[]);
      if (data.behaviorNotes?.length) await db.behaviorNotes.bulkAdd(data.behaviorNotes as never[]);
      if (data.tasks?.length) await db.tasks.bulkAdd(data.tasks as never[]);
      if (data.settings?.length) await db.settings.bulkAdd(data.settings as never[]);
      if (data.timetable?.length) await db.timetable.bulkAdd(data.timetable as never[]);
      if (data.assessments?.length) await db.assessments.bulkAdd(data.assessments as never[]);
      if (data.assessmentRecords?.length) await db.assessmentRecords.bulkAdd(data.assessmentRecords as never[]);
    }
  );
}
