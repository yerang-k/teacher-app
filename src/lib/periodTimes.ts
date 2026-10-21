import type { AppSettings } from "@/types";

export const PERIOD_COUNT = 7;
export const DEFAULT_PERIOD_START_TIMES = [
  "08:30",
  "09:30",
  "10:30",
  "11:30",
  "13:25",
  "14:25",
  "15:25",
];
export const DEFAULT_PERIOD_MINUTES = 50;

/** "HH:MM" + 분 → "HH:MM" */
export function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** 설정에 저장된 값(없으면 기본값)으로 교시별 시작 시각과 수업 시간을 돌려준다. */
export function getPeriodTimes(settings: Pick<AppSettings, "periodStartTimes" | "periodMinutes">) {
  const saved = settings.periodStartTimes;
  const starts = DEFAULT_PERIOD_START_TIMES.map((d, i) => saved?.[i] || d);
  const minutes = settings.periodMinutes ?? DEFAULT_PERIOD_MINUTES;
  return { starts, minutes };
}

/** period(1~7)의 시작·종료 시각 */
export function periodRange(
  settings: Pick<AppSettings, "periodStartTimes" | "periodMinutes">,
  period: number
): { start: string; end: string } | null {
  const { starts, minutes } = getPeriodTimes(settings);
  const start = starts[period - 1];
  return start ? { start, end: addMinutes(start, minutes) } : null;
}
