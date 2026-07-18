import { toast } from "sonner";
import { db, setChangeListener, runWithoutChangeEvents } from "@/db";
import { buildBackup, importBackupObject, type BackupFile } from "./dataBackup";

/**
 * 구글 드라이브 동기화.
 *
 * 사용자의 Apps Script 웹앱(/exec?key=...)이 저장 창구입니다.
 * - GET  : 드라이브에 저장된 백업 JSON을 돌려줌 (비어 있으면 version 0)
 * - POST : 본문의 백업 JSON을 드라이브 파일에 저장
 *
 * 동기화 주소는 기기별 설정이므로 localStorage에 둡니다 (백업 파일이나
 * 클라우드 데이터에 섞여 다른 기기로 복사되지 않도록).
 *
 * 시점 추적:
 * - LAST_KEY  : 마지막으로 성공한 동기화 시점의 클라우드 exportedAt.
 *               "이 기기가 마지막으로 알고 있는 클라우드 상태"의 지문.
 * - DIRTY_KEY : 마지막 동기화 이후 이 기기에서 변경이 있었는지.
 * 켤 때 클라우드 지문이 LAST_KEY와 다르면 다른 기기가 올린 것입니다.
 */

const URL_KEY = "teacher_sync_url";
const LAST_KEY = "teacher_sync_last";
const DIRTY_KEY = "teacher_sync_dirty";

export function getSyncUrl(): string | null {
  return localStorage.getItem(URL_KEY);
}

export function setSyncUrl(url: string | null): void {
  if (url) localStorage.setItem(URL_KEY, url);
  else localStorage.removeItem(URL_KEY);
}

export function getLastSyncedAt(): string | null {
  return localStorage.getItem(LAST_KEY);
}

export function hasPendingChanges(): boolean {
  return localStorage.getItem(DIRTY_KEY) === "1";
}

function markSynced(cloudExportedAt: string): void {
  localStorage.setItem(LAST_KEY, cloudExportedAt);
  localStorage.removeItem(DIRTY_KEY);
}

// ---- 자동 올리기 (변경 후 4초 잠잠해지면 실행) ----

let pushTimer: number | null = null;

function onLocalChange(): void {
  localStorage.setItem(DIRTY_KEY, "1");
  if (!getSyncUrl()) return;
  if (pushTimer !== null) clearTimeout(pushTimer);
  pushTimer = window.setTimeout(() => {
    pushTimer = null;
    pushNow().catch((e) => {
      // 실패해도 DIRTY가 남아 있어 다음 실행/접속 때 다시 올라갑니다
      console.error("자동 동기화 실패:", e);
    });
  }, 4000);
}

/** 변경 감지를 켭니다. 앱 초기 로딩(시드/스토어 적재)이 끝난 뒤 한 번 호출. */
export function enableAutoSync(): void {
  setChangeListener(onLocalChange);
}

// ---- 올리기 / 내려받기 ----

function cacheBust(url: string): string {
  return url + (url.includes("?") ? "&" : "?") + "t=" + Date.now();
}

/** API 키는 "이 컴퓨터에만 저장" 약속이 있으므로 클라우드로 내보내지 않습니다. */
function stripLocalOnlyFields(backup: BackupFile): BackupFile {
  const settings = (backup.data.settings as Array<Record<string, unknown>> | undefined)?.map(
    (row) => {
      const copy = { ...row };
      delete copy.aiApiKey;
      return copy;
    }
  );
  return {
    ...backup,
    data: { ...backup.data, ...(settings ? { settings } : {}) },
  };
}

export async function pushNow(): Promise<string> {
  const url = getSyncUrl();
  if (!url) throw new Error("동기화 주소가 설정되지 않았습니다.");
  const backup = stripLocalOnlyFields(await buildBackup());
  const res = await fetch(url, {
    method: "POST",
    body: JSON.stringify(backup),
    headers: { "Content-Type": "text/plain" }, // GAS: preflight 회피
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`서버 응답 ${res.status}`);
  const out = await res.json();
  if (out.status !== "success") throw new Error(out.message || "클라우드 저장 실패");
  markSynced(backup.exportedAt);
  return backup.exportedAt;
}

export async function pullNow(): Promise<void> {
  const url = getSyncUrl();
  if (!url) throw new Error("동기화 주소가 설정되지 않았습니다.");
  const localApiKey = (await db.settings.get("singleton"))?.aiApiKey;
  const res = await fetch(cacheBust(url), { redirect: "follow" });
  if (!res.ok) throw new Error(`서버 응답 ${res.status}`);
  const cloud: BackupFile = await res.json();
  if (cloud?.version !== 1 || !cloud.data) {
    throw new Error("클라우드에 저장된 데이터가 아직 없습니다.");
  }
  await importBackupObject(cloud);
  if (localApiKey) {
    // 클라우드 스냅샷에는 API 키가 없으므로 이 기기의 키를 되살립니다
    await runWithoutChangeEvents(async () => {
      await db.settings.update("singleton", { aiApiKey: localApiKey });
    });
  }
  markSynced(cloud.exportedAt);
}

// ---- 켤 때 자동 판단 ----

export type LaunchSyncResult = "pulled" | "pushed" | "conflict" | "in-sync" | "off";

export async function autoSyncOnLaunch(): Promise<LaunchSyncResult> {
  const url = getSyncUrl();
  if (!url) return "off";
  try {
    const res = await fetch(cacheBust(url), { redirect: "follow" });
    if (!res.ok) throw new Error(`서버 응답 ${res.status}`);
    const cloud = (await res.json()) as Partial<BackupFile>;
    const cloudAt = cloud?.version === 1 && cloud.exportedAt ? cloud.exportedAt : null;
    const known = getLastSyncedAt();
    const dirty = hasPendingChanges();

    if (!cloudAt) {
      // 클라우드가 비어 있음 → 이 기기 내용으로 시작
      await pushNow();
      return "pushed";
    }
    if (cloudAt === known) {
      if (dirty) {
        await pushNow();
        return "pushed";
      }
      return "in-sync";
    }
    // 다른 기기가 클라우드를 갱신했음
    if (!dirty) {
      await pullNow();
      return "pulled";
    }
    // 양쪽 다 변경됨 → 자동으로 어느 쪽도 버리지 않고 사용자에게 맡김
    toast.warning(
      "다른 기기의 기록과 이 기기의 기록이 서로 달라졌습니다. 백업/복원 탭에서 어느 쪽을 쓸지 선택해주세요.",
      { duration: 10000 }
    );
    return "conflict";
  } catch (e) {
    console.error("클라우드 동기화 확인 실패:", e);
    toast.error(`클라우드 동기화 확인 실패: ${(e as Error).message}`);
    return "off";
  }
}
