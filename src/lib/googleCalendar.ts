import { getSyncUrl } from "@/lib/cloudSync";
import type { GoogleCalendarEvent, GoogleCalendarInfo } from "@/types";

/**
 * 구글 캘린더 읽기.
 * 이미 쓰고 있는 동기화용 Apps Script 웹앱(/exec?key=...)에 `part=calendars` / `part=calendar`
 * 요청을 보내 JSON을 받는다. 스크립트가 내 구글 계정으로 캘린더를 읽어주므로 앱에 별도 로그인은 없다.
 * 읽기 전용: 앱에서 구글 캘린더로 쓰거나 고치는 기능은 없다.
 */

export class CalendarSetupError extends Error {}

async function callScript<T>(params: Record<string, string>): Promise<T> {
  const base = getSyncUrl();
  if (!base) {
    throw new CalendarSetupError("구글 드라이브 동기화 주소가 설정되지 않았습니다. 백업/복원 탭에서 먼저 설정해주세요.");
  }
  const qs = new URLSearchParams({ ...params, t: String(Date.now()) }).toString();
  const res = await fetch(base + (base.includes("?") ? "&" : "?") + qs, { redirect: "follow" });
  if (!res.ok) throw new Error(`서버 응답 ${res.status}`);
  const body = await res.json();
  // 캘린더 코드가 아직 없는 예전 스크립트는 part를 무시하고 백업 파일 전체를 돌려준다.
  if (body?.status !== "success") {
    if (body?.status === "error") throw new Error(body.message || "구글 캘린더를 불러오지 못했습니다.");
    throw new CalendarSetupError("Apps Script에 캘린더 읽기 코드가 아직 적용되지 않았습니다.");
  }
  return body as T;
}

export async function fetchCalendarList(): Promise<GoogleCalendarInfo[]> {
  const body = await callScript<{ calendars: GoogleCalendarInfo[] }>({ part: "calendars" });
  return body.calendars ?? [];
}

export async function fetchCalendarEvents(
  from: string,
  to: string,
  calendarIds: string[]
): Promise<GoogleCalendarEvent[]> {
  if (calendarIds.length === 0) return [];
  const body = await callScript<{ events: GoogleCalendarEvent[] }>({
    part: "calendar",
    from,
    to,
    cals: calendarIds.join(","),
  });
  return (body.events ?? []).map((e) => ({
    ...e,
    location: e.location || undefined,
    time: !e.allDay && e.time ? e.time : undefined,
    endDate: e.endDate < e.startDate ? e.startDate : e.endDate,
  }));
}
