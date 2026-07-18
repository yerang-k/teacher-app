import { db, runWithoutChangeEvents } from "@/db";

/**
 * 백업/복원과 클라우드 동기화가 공유하는 스냅샷 로직.
 * reports(AI 보고서)는 재생성 가능한 파생물이라 기존 정책대로 제외합니다.
 */
const TABLE_KEYS = [
  "classes",
  "students",
  "lessons",
  "attendance",
  "behaviorNotes",
  "tasks",
  "settings",
  "timetable",
  "assessments",
  "assessmentRecords",
] as const;

export interface BackupFile {
  version: number;
  exportedAt: string;
  data: Record<string, unknown[]>;
}

/** 현재 DB 전체를 백업 객체로 만듭니다. */
export async function buildBackup(): Promise<BackupFile> {
  const data: Record<string, unknown[]> = {};
  for (const key of TABLE_KEYS) {
    data[key] = await db.table(key).toArray();
  }
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  };
}

export async function exportData(): Promise<void> {
  const backup = await buildBackup();
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

/**
 * 백업 객체를 DB에 복원합니다 (백업에 포함된 테이블만 덮어쓰기).
 * 복원으로 인한 쓰기가 자동 동기화를 되튀기지 않도록 변경 알림을 끄고 수행합니다.
 */
export async function importBackupObject(parsed: BackupFile): Promise<void> {
  if (parsed?.version !== 1 || typeof parsed.data !== "object" || parsed.data === null) {
    throw new Error("지원하지 않는 백업 파일 형식입니다.");
  }
  const included = TABLE_KEYS.filter((key) => key in parsed.data);
  await runWithoutChangeEvents(async () => {
    await db.transaction(
      "rw",
      included.map((key) => db.table(key)),
      async () => {
        for (const key of included) {
          await db.table(key).clear();
          const rows = parsed.data[key];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (rows?.length) await (db.table(key) as any).bulkAdd(rows);
        }
      }
    );
  });
}

export async function importData(file: File): Promise<void> {
  const text = await file.text();
  let parsed: BackupFile;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("올바른 JSON 파일이 아닙니다.");
  }
  await importBackupObject(parsed);
}
