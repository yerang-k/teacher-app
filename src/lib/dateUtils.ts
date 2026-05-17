// 학사 일정 관련 유틸

/** YYYY-MM-DD 형식으로 포맷 */
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 오늘 날짜 */
export function todayKey(): string {
  return toDateKey(new Date());
}

/** 이번 주 월요일 ~ 금요일 날짜 배열 */
export function weekdaysOfThisWeek(base = new Date()): string[] {
  const d = new Date(base);
  const day = d.getDay(); // 0=일, 1=월 ...
  const diffToMon = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMon);
  const days: string[] = [];
  for (let i = 0; i < 5; i++) {
    const x = new Date(d);
    x.setDate(d.getDate() + i);
    days.push(toDateKey(x));
  }
  return days;
}

/** from~to 까지 평일 날짜 배열 */
export function weekdaysBetween(from: string, to: string): string[] {
  const result: string[] = [];
  const start = new Date(from);
  const end = new Date(to);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const wd = d.getDay();
    if (wd >= 1 && wd <= 5) result.push(toDateKey(d));
  }
  return result;
}

/** 한국 학기 판별 (3~7월: 1학기, 8~2월: 2학기) */
export function semesterOf(date = new Date()): 1 | 2 {
  const m = date.getMonth() + 1;
  return m >= 3 && m <= 7 ? 1 : 2;
}

/** 두 날짜 사이 일수 */
export function daysBetween(from: string, to: string): number {
  return Math.round(
    (new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24)
  );
}
