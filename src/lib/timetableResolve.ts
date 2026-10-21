/**
 * 한 날짜·교시 칸에 실제로 무슨 수업이 있는지 판단하는 공통 규칙.
 * 시간표 화면(격자·사이드 패널)과 위젯용 요약이 같은 결과를 내도록 한 곳에서만 정의한다.
 *
 * - regularClassId: 정규 시간표(주간 반복)에 배정된 학급 (없으면 undefined)
 * - override: 그 날짜·교시에 기록된 수업(Lesson)의 학급과 상태 (없으면 undefined)
 */
export type CellResolution =
  | { kind: "empty" }
  | { kind: "regular"; classId: string }
  /** 이 날짜만 휴강. 정규 학급이 있었다면 classId에 담긴다. */
  | { kind: "cancelled"; classId?: string }
  /** 이 날짜만 다른 학급으로 교체·대체(정규 칸이 비어 있던 임시 수업 포함). */
  | { kind: "substitute"; classId: string; replacedClassId?: string };

export function resolveCell(
  regularClassId: string | undefined,
  override: { classId: string; status: string } | undefined
): CellResolution {
  if (override?.status === "취소") {
    return { kind: "cancelled", classId: regularClassId };
  }
  if (override && override.classId !== regularClassId) {
    return { kind: "substitute", classId: override.classId, replacedClassId: regularClassId };
  }
  if (regularClassId) return { kind: "regular", classId: regularClassId };
  return { kind: "empty" };
}
