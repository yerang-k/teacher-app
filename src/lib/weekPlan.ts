// 진도 기반 주간 일괄 등록의 배치 계산 (순수 로직, UI/DB 비의존).

export type RowStatus = "assign" | "skipped" | "exists" | "noitem";

export interface PreviewRow {
  slotKey: string; // "date|classId|period"
  classId: string;
  classLabel: string;
  period: number;
  status: RowStatus;
  item?: { unit: string; topic: string };
}

export interface DayBlock {
  date: string;
  appliedDay: number; // 1~5, 0=휴업
  rows: PreviewRow[];
}

export interface PlanSlot {
  dayOfWeek: number;
  period: number;
  classId: string;
}

export interface PlanInput {
  weekDays: string[];
  dayApplied: Record<string, number>; // 날짜 → 적용 요일(1~5) 또는 0(휴업)
  slots: PlanSlot[];
  classLabels: Record<string, string>; // 그룹 대상 반: id → 표시명
  existing: Set<string>; // 이미 등록된 칸 "date|classId|period"
  skip: Record<string, boolean>; // 개별 건너뛴 칸
  items: { unit: string; topic: string }[]; // 진도 순서
  progress: Record<string, number>; // 반별 시작 진도 위치
  weekdayOf: (date: string) => number;
  shortageStrategy?: "repeat" | "skip" | "empty"; // 진도 부족 시 처리 전략
}

/**
 * 주 전체를 한 번에 훑으며 반별 진도 카운터를 이어붙여 배치를 계산한다.
 * - 이미 등록된 칸/건너뛴 칸/진도 순서 부족 칸은 차시를 소비하지 않는다 → 다음 차시로 밀림.
 * - 카운터는 날짜(오름차순)·교시(오름차순) 순으로 진행하므로 요일 교체·휴업이 섞여도 순서가 유지된다.
 */
export function planWeek(p: PlanInput): DayBlock[] {
  const counters: Record<string, number> = { ...p.progress };
  const result: DayBlock[] = [];
  const groupClassIds = new Set(Object.keys(p.classLabels));
  for (const date of p.weekDays) {
    const appliedDay = p.dayApplied[date] ?? p.weekdayOf(date);
    if (appliedDay === 0) {
      result.push({ date, appliedDay: 0, rows: [] });
      continue;
    }
    const daySlots = p.slots
      .filter((s) => s.dayOfWeek === appliedDay && groupClassIds.has(s.classId))
      .sort((a, b) => a.period - b.period);
    const rows: PreviewRow[] = daySlots.map((s) => {
      const slotKey = `${date}|${s.classId}|${s.period}`;
      const base = {
        slotKey,
        classId: s.classId,
        classLabel: p.classLabels[s.classId],
        period: s.period,
      };
      if (p.existing.has(slotKey)) return { ...base, status: "exists" as const };
      if (p.skip[slotKey]) return { ...base, status: "skipped" as const };
      
      const idx = counters[s.classId] ?? 0;
      const strategy = p.shortageStrategy ?? "skip";

      if (p.items.length === 0) {
        if (strategy === "empty") {
          return { ...base, status: "assign" as const, item: { unit: "", topic: "" } };
        }
        return { ...base, status: "noitem" as const };
      }

      if (idx >= p.items.length) {
        if (strategy === "repeat") {
          const repeatIdx = idx % p.items.length;
          counters[s.classId] = idx + 1;
          return { ...base, status: "assign" as const, item: p.items[repeatIdx] };
        } else if (strategy === "empty") {
          counters[s.classId] = idx + 1;
          return { ...base, status: "assign" as const, item: { unit: "", topic: "" } };
        } else {
          return { ...base, status: "noitem" as const };
        }
      }

      counters[s.classId] = idx + 1;
      return { ...base, status: "assign" as const, item: p.items[idx] };
    });
    result.push({ date, appliedDay, rows });
  }
  return result;
}
