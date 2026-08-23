import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

import {
  useClassStore,
  useLessonStore,
  useTimetableStore,
  useSettingsStore,
  useCurriculumStore,
} from "@/stores";
import { db } from "@/db";
import type { SchoolClass } from "@/types";
import { planWeek, type DayBlock, type PreviewRow } from "@/lib/weekPlan";

const DOW_LABEL = ["일", "월", "화", "수", "목", "금", "토"];

/** 학급 → 진도 그룹 키 (같은 학년·교과는 진도를 공유) */
function groupKeyOf(c: SchoolClass): string {
  return `${c.grade}-${c.subject || "기타"}`;
}
function groupNameOf(c: SchoolClass): string {
  return `${c.grade}학년 ${c.subject || "기타"}`;
}

/** "단원 | 주제" 텍스트를 차시 목록으로 파싱 (구분자 없으면 전체가 주제) */
function parseItems(text: string): { unit: string; topic: string }[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const i = line.indexOf("|");
      if (i === -1) return { unit: "", topic: line };
      return { unit: line.slice(0, i).trim(), topic: line.slice(i + 1).trim() };
    });
}
function itemsToText(items: { unit: string; topic: string }[]): string {
  return items.map((it) => (it.unit ? `${it.unit} | ${it.topic}` : it.topic)).join("\n");
}

/** 요일(1~5) 목록 — 주말 제외 */
const WEEKDAY_OPTIONS = [1, 2, 3, 4, 5];

export default function WeeklyProgressFill({ weekDays }: { weekDays: string[] }) {
  const classes = useClassStore((s) => s.classes);
  const slots = useTimetableStore((s) => s.slots);
  const loadTimetable = useTimetableStore((s) => s.loadByTerm);
  const settings = useSettingsStore((s) => s.settings);
  const curricula = useCurriculumStore((s) => s.curricula);
  const loadCurricula = useCurriculumStore((s) => s.loadAll);
  const saveCurriculum = useCurriculumStore((s) => s.save);
  const bulkAddLessons = useLessonStore((s) => s.bulkAdd);

  const activeClasses = useMemo(
    () => classes.filter((c) => !c.archived),
    [classes]
  );

  // 진도 그룹 목록 (학년·교과별)
  const groups = useMemo(() => {
    const map = new Map<string, { key: string; name: string; count: number }>();
    for (const c of activeClasses) {
      const key = groupKeyOf(c);
      const g = map.get(key);
      if (g) g.count += 1;
      else map.set(key, { key, name: groupNameOf(c), count: 1 });
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [activeClasses]);

  const [groupKey, setGroupKey] = useState<string>("");
  const [itemsText, setItemsText] = useState("");
  const [dayApplied, setDayApplied] = useState<Record<string, number>>({});
  const [skip, setSkip] = useState<Record<string, boolean>>({});
  const [progressByClass, setProgressByClass] = useState<Record<string, number>>({});
  const [existing, setExisting] = useState<Set<string>>(new Set());
  const [refreshTick, setRefreshTick] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadCurricula();
    loadTimetable(settings.currentYear, settings.currentSemester);
  }, [loadCurricula, loadTimetable, settings.currentYear, settings.currentSemester]);

  // 첫 그룹 자동 선택
  useEffect(() => {
    if (!groupKey && groups.length) setGroupKey(groups[0].key);
  }, [groups, groupKey]);

  // 그룹 바뀌면 진도 순서 텍스트 로드
  useEffect(() => {
    const cur = curricula.find((c) => c.id === groupKey);
    setItemsText(cur ? itemsToText(cur.items) : "");
  }, [groupKey, curricula]);

  const items = useMemo(() => parseItems(itemsText), [itemsText]);

  const groupClasses = useMemo(
    () => activeClasses.filter((c) => groupKeyOf(c) === groupKey),
    [activeClasses, groupKey]
  );
  const groupClassIds = useMemo(
    () => new Set(groupClasses.map((c) => c.id)),
    [groupClasses]
  );

  // 반별 진도 위치 + 이번 주 이미 등록된 칸 조회
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!groupKey || groupClasses.length === 0 || weekDays.length === 0) {
        setProgressByClass({});
        setExisting(new Set());
        return;
      }
      // 진도 위치: 그 반의 curriculumKey 붙은 (취소 아닌) 수업 수
      const progress: Record<string, number> = {};
      await Promise.all(
        groupClasses.map(async (c) => {
          const rows = await db.lessons.where("classId").equals(c.id).toArray();
          progress[c.id] = rows.filter(
            (l) => l.curriculumKey === groupKey && l.status !== "취소"
          ).length;
        })
      );
      // 이번 주 이미 등록된 칸 (date|classId|period)
      const weekRows = await db.lessons
        .where("date")
        .between(weekDays[0], weekDays[weekDays.length - 1], true, true)
        .toArray();
      const occ = new Set<string>();
      for (const l of weekRows) {
        if (groupClassIds.has(l.classId)) {
          occ.add(`${l.date}|${l.classId}|${l.period}`);
        }
      }
      if (!cancelled) {
        setProgressByClass(progress);
        setExisting(occ);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupKey, groupClasses, weekDays, refreshTick]);

  const weekdayOf = (date: string) => {
    const dow = new Date(date + "T00:00:00").getDay();
    return dow >= 1 && dow <= 5 ? dow : 1;
  };

  const classLabel = (c: SchoolClass) =>
    `${c.grade}-${c.classNumber}${c.homeroom ? " (담임)" : ""}`;

  // 미리보기 계산 (순수 함수 planWeek 사용)
  const blocks = useMemo<DayBlock[]>(() => {
    const classLabels: Record<string, string> = {};
    for (const c of groupClasses) classLabels[c.id] = classLabel(c);
    return planWeek({
      weekDays,
      dayApplied,
      slots,
      classLabels,
      existing,
      skip,
      items,
      progress: progressByClass,
      weekdayOf,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekDays, dayApplied, slots, groupClasses, existing, skip, items, progressByClass]);

  const assignRows = useMemo(
    () => blocks.flatMap((b) => b.rows).filter((r) => r.status === "assign"),
    [blocks]
  );
  const hasAnySlot = useMemo(
    () => blocks.some((b) => b.rows.length > 0),
    [blocks]
  );

  const handleSaveCurriculum = async () => {
    if (!groupKey) return;
    const g = groups.find((x) => x.key === groupKey);
    await saveCurriculum(groupKey, g?.name ?? groupKey, items);
    toast.success("진도 순서를 저장했습니다.");
  };

  const handleConfirm = async () => {
    if (assignRows.length === 0) {
      toast.error("등록할 차시가 없습니다.");
      return;
    }
    setSaving(true);
    try {
      // 확정 전 진도 순서도 함께 저장 (편집만 하고 저장 안 한 경우 대비)
      const g = groups.find((x) => x.key === groupKey);
      await saveCurriculum(groupKey, g?.name ?? groupKey, items);
      await bulkAddLessons(
        assignRows.map((r) => ({
          classId: r.classId,
          date: r.slotKey.split("|")[0],
          period: r.period,
          unit: r.item!.unit,
          topic: r.item!.topic,
          status: "예정" as const,
          curriculumKey: groupKey,
        }))
      );
      toast.success(`${assignRows.length}개 차시를 등록했습니다.`);
      setSkip({});
      setRefreshTick((t) => t + 1);
    } catch (e) {
      toast.error("등록 실패: " + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">이번 주 진도 나가기</CardTitle>
        <CardDescription>
          진도 순서를 시간표에 맞춰 반별로 이어 등록합니다. 밀린 반은 자기 위치부터 이어지고,
          쉬는 날은 빼면 다음 차시로 넘어갑니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* 1단계: 진도 그룹 + 순서 */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label>진도 그룹</Label>
              <Select value={groupKey} onValueChange={setGroupKey}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="학년·교과 선택" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g.key} value={g.key}>
                      {g.name} ({g.count}반)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="text-xs text-muted-foreground pb-2">
              대상 반:{" "}
              {groupClasses.length
                ? groupClasses.map((c) => `${c.grade}-${c.classNumber}`).join(", ")
                : "없음"}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>진도 순서 (한 줄에 한 차시, "단원 | 주제")</Label>
              <Button variant="outline" size="sm" onClick={handleSaveCurriculum}>
                진도 순서 저장
              </Button>
            </div>
            <Textarea
              rows={5}
              value={itemsText}
              onChange={(e) => setItemsText(e.target.value)}
              placeholder={"1단원. 시의 세계 | 운율의 효과\n1단원. 시의 세계 | 비유와 상징\n2단원. 소설 읽기 | 인물과 갈등"}
            />
            <p className="text-xs text-muted-foreground">
              총 {items.length}차시 · 이 순서대로 각 반의 다음 차시부터 채워집니다.
            </p>
          </div>
        </div>

        {/* 2~3단계: 미리보기 (요일 교체 / 쉬는 날) */}
        <div className="space-y-2">
          <Label>미리보기 · 주간 배치</Label>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground border rounded p-3">
              진도 순서를 먼저 입력하세요.
            </p>
          ) : !hasAnySlot ? (
            <p className="text-sm text-muted-foreground border rounded p-3">
              이 그룹의 시간표가 이번 주에 없습니다. 시간표 탭에서 먼저 시간표를 등록해주세요.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
              {blocks.map((b) => (
                <div key={b.date} className="border rounded p-2 space-y-2">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold">
                      {new Date(b.date + "T00:00:00").toLocaleDateString("ko-KR", {
                        month: "short",
                        day: "numeric",
                        weekday: "short",
                      })}
                    </div>
                    <Select
                      value={String(b.appliedDay)}
                      onValueChange={(v) =>
                        setDayApplied((m) => ({ ...m, [b.date]: Number(v) }))
                      }
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {WEEKDAY_OPTIONS.map((d) => (
                          <SelectItem key={d} value={String(d)} className="text-xs">
                            {DOW_LABEL[d]}요일 시간표
                          </SelectItem>
                        ))}
                        <SelectItem value="0" className="text-xs">
                          휴업 (건너뛰기)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {b.appliedDay === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">휴업일</p>
                  ) : b.rows.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">수업 없음</p>
                  ) : (
                    <div className="space-y-1.5">
                      {b.rows.map((r) => (
                        <ProgressRowView
                          key={r.slotKey}
                          row={r}
                          onToggle={() =>
                            setSkip((m) => ({ ...m, [r.slotKey]: !m[r.slotKey] }))
                          }
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 4단계: 확정 */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            등록될 차시 <span className="font-semibold text-foreground">{assignRows.length}</span>개
          </p>
          <Button onClick={handleConfirm} disabled={saving || assignRows.length === 0}>
            {saving ? "등록 중…" : "이대로 등록"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ProgressRowView({
  row,
  onToggle,
}: {
  row: PreviewRow;
  onToggle: () => void;
}) {
  if (row.status === "exists") {
    return (
      <div className="text-xs rounded border border-dashed p-1.5 bg-muted/30 text-muted-foreground">
        <div className="font-medium">
          {row.classLabel} · {row.period}교시
        </div>
        <div>이미 등록됨</div>
      </div>
    );
  }
  if (row.status === "noitem") {
    return (
      <div className="text-xs rounded border border-amber-300 bg-amber-50 p-1.5 text-amber-800">
        <div className="font-medium">
          {row.classLabel} · {row.period}교시
        </div>
        <div>진도 순서 부족 — 목록을 더 채우세요</div>
      </div>
    );
  }
  const checked = row.status === "assign";
  return (
    <label
      className={`flex gap-1.5 text-xs rounded border p-1.5 cursor-pointer ${
        checked ? "bg-card" : "bg-muted/40 text-muted-foreground line-through"
      }`}
    >
      <input
        type="checkbox"
        className="mt-0.5"
        checked={checked}
        onChange={onToggle}
      />
      <span className="flex-1">
        <span className="font-medium block no-underline">
          {row.classLabel} · {row.period}교시
        </span>
        {row.item && (
          <span className="opacity-80">
            {row.item.unit ? `${row.item.unit} · ` : ""}
            {row.item.topic}
          </span>
        )}
        {!checked && <span className="block opacity-70">쉬는 날 (건너뜀)</span>}
      </span>
    </label>
  );
}
