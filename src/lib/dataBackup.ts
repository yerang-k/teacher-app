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

  // 백업 파일에 포함된 테이블만 복원 (없는 테이블은 기존 데이터 유지)
  const tableMap = [
    { key: "classes", table: db.classes },
    { key: "students", table: db.students },
    { key: "lessons", table: db.lessons },
    { key: "attendance", table: db.attendance },
    { key: "behaviorNotes", table: db.behaviorNotes },
    { key: "tasks", table: db.tasks },
    { key: "settings", table: db.settings },
    { key: "timetable", table: db.timetable },
    { key: "assessments", table: db.assessments },
    { key: "assessmentRecords", table: db.assessmentRecords },
  ] as const;

  const includedTables = tableMap.filter(({ key }) => key in data);

  await db.transaction(
    "rw",
    includedTables.map(({ table }) => table),
    async () => {
      for (const { key, table } of includedTables) {
        await table.clear();
        const rows = data[key as keyof typeof data];
        if (rows?.length) await table.bulkAdd(rows as never[]);
      }
    }
  );
}
