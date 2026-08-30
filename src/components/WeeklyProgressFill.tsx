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
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

import {
  useClassStore,
  useLessonStore,
  useTimetableStore,
  useSettingsStore,
  useCurriculumStore,
} from "@/stores";
import { db, uid } from "@/db";
import type { SchoolClass } from "@/types";
import { planWeek, type DayBlock, type PreviewRow } from "@/lib/weekPlan";

const DOW_LABEL = ["일", "월", "화", "수", "목", "금", "토"];

/** 학급 → 진도 그룹 키 (같은 학년·교과는 진도를 공유) */
function groupKeyOf(c: SchoolClass): string {
  return `${c.grade}-${c.subject || "기타"}`;
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

/** YYYY-MM-DD 에 n일 더하기 (로컬 기준) */
function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export default function WeeklyProgressFill({ weekDays }: { weekDays: string[] }) {
  const classes = useClassStore((s) => s.classes);
  const slots = useTimetableStore((s) => s.slots);
  const loadTimetable = useTimetableStore((s) => s.loadByTerm);
  const settings = useSettingsStore((s) => s.settings);
  const curricula = useCurriculumStore((s) => s.curricula);
  const loadCurricula = useCurriculumStore((s) => s.loadAll);
  const saveCurriculum = useCurriculumStore((s) => s.save);
  const bulkAddLessons = useLessonStore((s) => s.bulkAdd);
  const bulkRemoveLessons = useLessonStore((s) => s.bulkRemove);

  const activeClasses = useMemo(
    () => classes.filter((c) => !c.archived),
    [classes]
  );

  const [groupKey, setGroupKey] = useState<string>("");
  const [itemsText, setItemsText] = useState("");
  const [dayApplied, setDayApplied] = useState<Record<string, number>>({});
  const [skip, setSkip] = useState<Record<string, boolean>>({});
  const [progressByClass, setProgressByClass] = useState<Record<string, number>>({});
  // 반별 시작 강 수동 지정(1-based). 비어 있으면 자동 감지된 진도 위치를 씀.
  const [startOverride, setStartOverride] = useState<Record<string, number>>({});
  const [existing, setExisting] = useState<Set<string>>(new Set());
  const [batches, setBatches] = useState<
    { batchId: string; ids: string[]; count: number; minDate: string; maxDate: string; createdAt: number }[]
  >([]);
  const [refreshTick, setRefreshTick] = useState(0);
  const [saving, setSaving] = useState(false);
  const [weekCount, setWeekCount] = useState(1);

  // 신규 진도 부족 처리 전략 상태 추가
  const [shortageStrategy, setShortageStrategy] = useState<"repeat" | "skip" | "empty">("repeat");

  // 진도 그룹 관리 상태 추가
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);

  // 기존 그룹의 학급 매핑 하위호환 마이그레이션.
  // 그룹은 사용자가 "그룹 설정"에서 직접 만든다. 여기서 새 그룹을 자동 생성하지 않는다.
  // (예전엔 학년·교과 조합마다 그룹을 자동 생성해서, 설정하지 않은 "3학년 고전읽기"
  //  같은 그룹이 저절로 만들어지는 버그가 있었다.)
  useEffect(() => {
    if (!curricula || activeClasses.length === 0) return;

    const migrateExistingGroups = async () => {
      for (const cur of curricula) {
        if (cur.classIds) continue;
        // classIds가 없는 기존 그룹만 학년-교과 키로 매칭해 채워 넣는다.
        const matchedClasses = activeClasses.filter((c) => groupKeyOf(c) === cur.id);
        if (matchedClasses.length > 0) {
          await saveCurriculum(cur.id, cur.name, cur.items, matchedClasses.map((c) => c.id));
        }
      }
    };

    migrateExistingGroups();
  }, [curricula, activeClasses, saveCurriculum]);

  // 진도 그룹 목록 (학년·교과별 자동 생성 대신 DB curricula 기반)
  const groups = useMemo(() => {
    return curricula
      .map((cur) => {
        const count = activeClasses.filter((c) => cur.classIds?.includes(c.id)).length;
        return {
          key: cur.id,
          name: cur.name,
          count,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [curricula, activeClasses]);

  // 선택한 주부터 weekCount주 만큼의 평일(월~금) 날짜. 진도가 남으면 다음 주로 이어 채운다.
  const allDays = useMemo(() => {
    if (weekDays.length === 0) return [];
    const base = weekDays[0];
    const out: string[] = [];
    for (let w = 0; w < weekCount; w++) {
      for (let i = 0; i < 5; i++) out.push(addDays(base, w * 7 + i));
    }
    return out;
  }, [weekDays, weekCount]);

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

  // 선택한 진도 그룹 정보
  const activeCurriculum = useMemo(
    () => curricula.find((c) => c.id === groupKey),
    [curricula, groupKey]
  );

  const groupClasses = useMemo(() => {
    if (!activeCurriculum) return [];
    if (activeCurriculum.classIds && activeCurriculum.classIds.length > 0) {
      const classIdsSet = new Set(activeCurriculum.classIds);
      return activeClasses.filter((c) => classIdsSet.has(c.id));
    }
    // 하위 호환
    return activeClasses.filter((c) => groupKeyOf(c) === groupKey);
  }, [activeClasses, activeCurriculum, groupKey]);

  const groupClassIds = useMemo(
    () => new Set(groupClasses.map((c) => c.id)),
    [groupClasses]
  );

  // 반별 진도 위치 + 이번 주 이미 등록된 칸 조회
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!groupKey || groupClasses.length === 0 || allDays.length === 0) {
        setProgressByClass({});
        setExisting(new Set());
        setBatches([]);
        return;
      }
      // 진도 위치: 그 반의 curriculumKey 붙은 (취소 아닌) 수업 수
      // + 되돌리기용 배치(batchId) 수집
      const progress: Record<string, number> = {};
      const batchMap = new Map<
        string,
        { batchId: string; ids: string[]; count: number; minDate: string; maxDate: string; createdAt: number }
      >();
      await Promise.all(
        groupClasses.map(async (c) => {
          const rows = await db.lessons.where("classId").equals(c.id).toArray();
          progress[c.id] = rows.filter(
            (l) => l.curriculumKey === groupKey && l.status !== "취소"
          ).length;
          for (const l of rows) {
            if (l.curriculumKey !== groupKey || !l.batchId) continue;
            const b = batchMap.get(l.batchId);
            if (b) {
              b.ids.push(l.id);
              b.count += 1;
              if (l.date < b.minDate) b.minDate = l.date;
              if (l.date > b.maxDate) b.maxDate = l.date;
              b.createdAt = Math.max(b.createdAt, l.createdAt);
            } else {
              batchMap.set(l.batchId, {
                batchId: l.batchId,
                ids: [l.id],
                count: 1,
                minDate: l.date,
                maxDate: l.date,
                createdAt: l.createdAt,
              });
            }
          }
        })
      );
      const batchList = [...batchMap.values()]
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 6);
      // 이번 주 이미 등록된 칸 (date|classId|period)
      const weekRows = await db.lessons
        .where("date")
        .between(allDays[0], allDays[allDays.length - 1], true, true)
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
        setBatches(batchList);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupKey, groupClasses, allDays, refreshTick]);

  const weekdayOf = (date: string) => {
    const dow = new Date(date + "T00:00:00").getDay();
    return dow >= 1 && dow <= 5 ? dow : 1;
  };

  const classLabel = (c: SchoolClass) =>
    `${c.grade}-${c.classNumber}${c.homeroom ? " (담임)" : ""}`;

  // 진도 그룹을 바꾸면 반별 시작 강 수동 지정은 리셋
  useEffect(() => {
    setStartOverride({});
  }, [groupKey]);

  // 자동 감지 위치 위에 수동 지정(1-based → 0-based 카운터)을 덮어씀
  const effectiveProgress = useMemo(() => {
    const out: Record<string, number> = { ...progressByClass };
    for (const [cid, oneBased] of Object.entries(startOverride)) {
      if (Number.isFinite(oneBased) && oneBased >= 1) out[cid] = oneBased - 1;
    }
    return out;
  }, [progressByClass, startOverride]);

  // 미리보기 계산 (순수 함수 planWeek 사용)
  const blocks = useMemo<DayBlock[]>(() => {
    const classLabels: Record<string, string> = {};
    for (const c of groupClasses) classLabels[c.id] = classLabel(c);
    return planWeek({
      weekDays: allDays,
      dayApplied,
      slots,
      classLabels,
      existing,
      skip,
      items,
      progress: effectiveProgress,
      weekdayOf,
      shortageStrategy,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDays, dayApplied, slots, groupClasses, existing, skip, items, effectiveProgress, shortageStrategy]);

  const assignRows = useMemo(
    () => blocks.flatMap((b) => b.rows).filter((r) => r.status === "assign"),
    [blocks]
  );
  const hasAnySlot = useMemo(
    () => blocks.some((b) => b.rows.length > 0),
    [blocks]
  );
  // 미리보기를 주 단위(5일)로 묶기
  const weeks = useMemo(() => {
    const out: DayBlock[][] = [];
    for (let i = 0; i < blocks.length; i += 5) out.push(blocks.slice(i, i + 5));
    return out;
  }, [blocks]);

  const handleSaveCurriculum = async () => {
    if (!groupKey) return;
    const g = groups.find((x) => x.key === groupKey);
    await saveCurriculum(groupKey, g?.name ?? groupKey, items, activeCurriculum?.classIds);
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
      await saveCurriculum(groupKey, g?.name ?? groupKey, items, activeCurriculum?.classIds);
      const batchId = uid();
      await bulkAddLessons(
        assignRows.map((r) => ({
          classId: r.classId,
          date: r.slotKey.split("|")[0],
          period: r.period,
          unit: r.item!.unit,
          topic: r.item!.topic,
          status: "예정" as const,
          curriculumKey: groupKey,
          batchId,
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

  // 진도 그룹 직접 관리 관련 핸들러들
  const handleEditGroup = (gId: string) => {
    const cur = curricula.find((c) => c.id === gId);
    if (!cur) return;
    setEditingGroupId(gId);
    setNewGroupName(cur.name);
    setSelectedClassIds(cur.classIds || []);
  };

  const handleSaveGroup = async () => {
    if (!newGroupName.trim()) {
      toast.error("그룹 이름을 입력하세요.");
      return;
    }
    const targetId = editingGroupId || uid();
    const existing = curricula.find((c) => c.id === targetId);
    const existingItems = existing ? existing.items : [];
    
    await saveCurriculum(targetId, newGroupName.trim(), existingItems, selectedClassIds);
    toast.success("진도 그룹을 저장했습니다.");
    
    // 신규 생성 시 생성한 그룹으로 자동 전환
    if (!editingGroupId) {
      setGroupKey(targetId);
    }
    
    setEditingGroupId(null);
    setNewGroupName("");
    setSelectedClassIds([]);
  };

  const handleDeleteGroup = async (gId: string) => {
    if (!confirm("이 진도 그룹을 삭제할까요? (진도 순서 데이터가 모두 지워집니다)")) return;
    await useCurriculumStore.getState().delete(gId);
    toast.success("그룹이 삭제되었습니다.");
    if (groupKey === gId) {
      setGroupKey("");
    }
  };

  const handleToggleClassSelection = (cId: string) => {
    setSelectedClassIds((prev) =>
      prev.includes(cId) ? prev.filter((id) => id !== cId) : [...prev, cId]
    );
  };

  // 진도 순서 생성 편의 핸들러
  const handleGeneratePlaceholderItems = () => {
    const countStr = prompt("몇 차시의 임시 진도를 생성할까요? (숫자만 입력)", "10");
    if (countStr === null) return;
    const count = parseInt(countStr, 10);
    if (isNaN(count) || count <= 0) {
      toast.error("올바른 숫자를 입력하세요.");
      return;
    }
    const lines: string[] = [];
    for (let i = 1; i <= count; i++) {
      lines.push(`${i}차시`);
    }
    if (itemsText && !confirm("이미 입력된 진도가 있습니다. 덮어쓸까요?")) {
      setItemsText((prev) => (prev ? prev + "\n" + lines.join("\n") : lines.join("\n")));
    } else {
      setItemsText(lines.join("\n"));
    }
  };

  const handleImportFromExistingLessons = async () => {
    if (groupClasses.length === 0) {
      toast.error("진도 그룹에 포함된 학급이 없습니다.");
      return;
    }
    if (itemsText && !confirm("이미 입력된 진도 순서가 덮어씌워집니다. 계속할까요?")) {
      return;
    }
    try {
      const allLessons: any[] = [];
      await Promise.all(
        groupClasses.map(async (c) => {
          const rows = await db.lessons.where("classId").equals(c.id).toArray();
          allLessons.push(...rows.filter((l) => l.curriculumKey === groupKey && l.status !== "취소"));
        })
      );
      
      allLessons.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.period - b.period;
      });

      const seen = new Set<string>();
      const itemsList: { unit: string; topic: string }[] = [];
      for (const l of allLessons) {
        const key = `${l.unit || ""}|${l.topic || ""}`;
        if (!seen.has(key)) {
          seen.add(key);
          itemsList.push({ unit: l.unit || "", topic: l.topic || "" });
        }
      }

      if (itemsList.length === 0) {
        toast.error("가져올 수 있는 기존 수업 기록이 없습니다.");
        return;
      }

      setItemsText(itemsToText(itemsList));
      toast.success(`${itemsList.length}개의 차시 정보를 수업 기록에서 가져왔습니다.`);
    } catch (e) {
      toast.error("불러오기 실패: " + (e as Error).message);
    }
  };

  const handleUndo = async (batch: (typeof batches)[number]) => {
    if (
      !confirm(
        `이 일괄 등록(${batch.count}개 차시)을 모두 삭제할까요? 되돌릴 수 없습니다.`
      )
    )
      return;
    try {
      await bulkRemoveLessons(batch.ids);
      toast.success(`${batch.count}개 차시를 삭제했습니다.`);
      setRefreshTick((t) => t + 1);
    } catch (e) {
      toast.error("삭제 실패: " + (e as Error).message);
    }
  };

  const fmtDate = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString("ko-KR", { month: "short", day: "numeric" });

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
              <div className="flex gap-2">
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

                <Dialog open={isManageModalOpen} onOpenChange={setIsManageModalOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="h-10">그룹 설정</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>진도 그룹 설정 및 관리</DialogTitle>
                      <DialogDescription>
                        원하는 반을 묶어 진도를 공유하는 그룹을 만듭니다.
                      </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4 py-4">
                      {/* 기존 그룹 목록 및 수정/삭제 */}
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-muted-foreground">현재 진도 그룹 목록</Label>
                        <div className="max-h-[160px] overflow-y-auto space-y-1 border rounded p-2 bg-muted/20">
                          {curricula.map((c) => (
                            <div key={c.id} className="flex items-center justify-between text-sm p-1.5 rounded hover:bg-muted/50">
                              <span className="font-medium">{c.name} <span className="text-xs text-muted-foreground">({c.classIds?.length || 0}개 반)</span></span>
                              <div className="flex gap-1.5">
                                <Button variant="ghost" className="h-7 text-xs px-2" onClick={() => handleEditGroup(c.id)}>수정</Button>
                                <Button variant="ghost" className="h-7 text-xs px-2 text-rose-600 hover:text-rose-700" onClick={() => handleDeleteGroup(c.id)}>삭제</Button>
                              </div>
                            </div>
                          ))}
                          {curricula.length === 0 && (
                            <p className="text-xs text-muted-foreground text-center py-4">등록된 그룹이 없습니다.</p>
                          )}
                        </div>
                      </div>

                      <hr className="my-1" />

                      {/* 그룹 추가/수정 폼 */}
                      <div className="space-y-3 border p-3 rounded bg-muted/10">
                        <h4 className="text-sm font-semibold">{editingGroupId ? "그룹 수정" : "새 그룹 생성"}</h4>
                        <div className="space-y-1">
                          <Label htmlFor="group-name" className="text-xs">그룹 이름</Label>
                           <Input
                             id="group-name"
                             value={newGroupName}
                             onChange={(e) => setNewGroupName(e.target.value)}
                             placeholder="예: 2학년 문학 A그룹, 방과후 국어"
                           />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs">포함할 학급 선택</Label>
                          <div className="grid grid-cols-2 gap-2 max-h-[140px] overflow-y-auto border rounded p-2 bg-white">
                            {activeClasses.map((c) => (
                              <label key={c.id} className="flex items-center gap-2 text-xs cursor-pointer p-1 rounded hover:bg-muted/30">
                                <input
                                  type="checkbox"
                                  checked={selectedClassIds.includes(c.id)}
                                  onChange={() => handleToggleClassSelection(c.id)}
                                />
                                <span>{classLabel(c)}</span>
                              </label>
                            ))}
                            {activeClasses.length === 0 && (
                              <p className="text-xs text-muted-foreground col-span-2 text-center py-4">등록된 학급이 없습니다.</p>
                            )}
                          </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-1">
                          {editingGroupId && (
                            <Button variant="outline" size="sm" onClick={() => { setEditingGroupId(null); setNewGroupName(""); setSelectedClassIds([]); }}>취소</Button>
                          )}
                          <Button size="sm" onClick={handleSaveGroup}>{editingGroupId ? "변경사항 저장" : "새 그룹 생성"}</Button>
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsManageModalOpen(false)}>닫기</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
            <div className="text-xs text-muted-foreground pb-2">
              대상 반:{" "}
              {groupClasses.length
                ? groupClasses.map((c) => `${c.grade}-${c.classNumber}`).join(", ")
                : "없음"}
            </div>
          </div>

          {/* 반별 시작 강: 반마다 이번에 시작할 차시를 다르게 지정 */}
          {groupClasses.length > 0 && (
            <div className="space-y-1.5">
              <Label>반별 시작 강</Label>
              <p className="text-xs text-muted-foreground">
                반마다 이번에 시작할 차시를 다르게 지정할 수 있습니다. 비워두면 지금까지 등록된 진도에서 이어집니다.
              </p>
              <div className="flex flex-wrap gap-2">
                {groupClasses.map((c) => {
                  const done = progressByClass[c.id] ?? 0;
                  const ov = startOverride[c.id];
                  return (
                    <div
                      key={c.id}
                      className="flex items-center gap-1.5 rounded border px-2 py-1"
                    >
                      <span className="text-sm font-medium">
                        {c.grade}-{c.classNumber}반
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {done > 0 ? `현재 ${done}강까지` : "시작 전"}
                      </span>
                      <Input
                        type="number"
                        min={1}
                        className="h-7 w-16 text-xs"
                        placeholder={String(done + 1)}
                        value={ov ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          setStartOverride((prev) => {
                            const next = { ...prev };
                            if (v === "") delete next[c.id];
                            else next[c.id] = Math.max(1, Math.floor(Number(v)));
                            return next;
                          });
                        }}
                      />
                      <span className="text-xs text-muted-foreground">강부터</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>진도 순서 (한 줄에 한 차시, "단원 | 주제")</Label>
              <div className="flex gap-1.5">
                <Button variant="outline" size="sm" onClick={handleGeneratePlaceholderItems}>
                  임시 차시 생성
                </Button>
                <Button variant="outline" size="sm" onClick={handleImportFromExistingLessons}>
                  기존 수업에서 가져오기
                </Button>
                <Button variant="outline" size="sm" onClick={handleSaveCurriculum}>
                  진도 순서 저장
                </Button>
              </div>
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

        {/* 2~3단계: 미리보기 (요일 교체 / 쉬는 날 / 여러 주 채우기) */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-2">
            <Label className="text-sm font-semibold">미리보기 · 주간 배치</Label>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1.5">
                <Label className="text-xs text-muted-foreground">채울 주 수</Label>
                <Select value={String(weekCount)} onValueChange={(v) => setWeekCount(Number(v))}>
                  <SelectTrigger className="h-8 w-[80px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <SelectItem key={n} value={String(n)} className="text-xs">
                        {n}주
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-1.5">
                <Label className="text-xs text-muted-foreground">진도 부족 시 처리</Label>
                <Select value={shortageStrategy} onValueChange={(v) => setShortageStrategy(v as any)}>
                  <SelectTrigger className="h-8 w-[140px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="repeat" className="text-xs">순환 반복 채우기</SelectItem>
                    <SelectItem value="empty" className="text-xs">빈 칸으로 등록</SelectItem>
                    <SelectItem value="skip" className="text-xs">등록 안 함 (건너뛰기)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            선택한 주에 진도가 다 안 들어가면 <b>채울 주 수</b>를 늘리세요. 남은 차시가 다음 주 시간표로 이어집니다.
          </p>
          {items.length === 0 && shortageStrategy !== "empty" ? (
            <p className="text-sm text-muted-foreground border rounded p-3">
              진도 순서를 먼저 입력하거나 진도 부족 시 처리를 "빈 칸으로 등록"으로 선택하세요.
            </p>
          ) : !hasAnySlot ? (
            <p className="text-sm text-muted-foreground border rounded p-3">
              이 그룹의 시간표가 없습니다. 시간표 탭에서 먼저 시간표를 등록해주세요.
            </p>
          ) : (
            <div className="space-y-3">
              {weeks.map((week, wi) => (
                <div key={wi} className="space-y-1">
                  {weekCount > 1 && (
                    <div className="text-xs font-semibold text-muted-foreground">
                      {wi + 1}주차 (
                      {new Date(week[0].date + "T00:00:00").toLocaleDateString("ko-KR", {
                        month: "short",
                        day: "numeric",
                      })}
                      ~)
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                    {week.map((b) => (
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

        {/* 되돌리기: 최근 일괄 등록 묶음 삭제 */}
        {batches.length > 0 && (
          <div className="space-y-2 border-t pt-3">
            <Label className="text-xs text-muted-foreground">
              최근 일괄 등록 · 잘못 등록했으면 묶음째 되돌리기
            </Label>
            <div className="space-y-1.5">
              {batches.map((b) => (
                <div
                  key={b.batchId}
                  className="flex items-center justify-between text-xs border rounded p-2"
                >
                  <span>
                    <span className="font-medium">{b.count}개 차시</span>{" "}
                    <span className="text-muted-foreground">
                      · {fmtDate(b.minDate)}
                      {b.maxDate !== b.minDate ? ` ~ ${fmtDate(b.maxDate)}` : ""} 등록
                    </span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-rose-600 hover:text-rose-700"
                    onClick={() => handleUndo(b)}
                  >
                    되돌리기
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
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
      <div className="text-xs rounded border border-dashed p-1.5 bg-muted/30 text-muted-foreground">
        <div className="font-medium">
          {row.classLabel} · {row.period}교시
        </div>
        <div>진도 부족 (등록 제외)</div>
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
