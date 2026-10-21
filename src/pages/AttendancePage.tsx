import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

import { useClassStore, useAttendanceStore, useClubStore } from "@/stores";
import { todayKey } from "@/lib/dateUtils";
import { memberOriginLabel, sortMembers } from "@/lib/clubUtils";
import ClubManagerDialog from "@/components/ClubManagerDialog";
import type { AttendanceStatus } from "@/types";

/** 출결 명단 한 줄. 학급 학생과 동아리 부원을 같은 방식으로 다루기 위한 공통 모양. */
interface RosterRow {
  id: string;
  number: number;
  name: string;
  /** 동아리 부원의 원래 학년-반-번호 */
  origin?: string;
}

const STATUS_OPTIONS: AttendanceStatus[] = [
  "출석",
  "지각",
  "조퇴",
  "결과",
  "인정결석",
  "질병결석",
  "미인정결석",
  "기타결석",
  "결석",
];

const STATUS_VARIANT: Record<
  AttendanceStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  출석: "default",
  지각: "secondary",
  조퇴: "secondary",
  결과: "secondary",
  인정결석: "outline",
  질병결석: "outline",
  미인정결석: "destructive",
  기타결석: "outline",
  결석: "destructive",
};

export default function AttendancePage() {
  const classes = useClassStore((s) => s.classes);
  const getStudentsByClass = useClassStore((s) => s.getStudentsByClass);

  const records = useAttendanceStore((s) => s.records);
  const loadByClassDate = useAttendanceStore((s) => s.loadByClassDate);
  const upsertDaily = useAttendanceStore((s) => s.upsertDaily);

  const [classId, setClassId] = useState<string>("");
  const [date, setDate] = useState<string>(todayKey());
  const [draft, setDraft] = useState<
    Record<string, { status: AttendanceStatus; reason?: string }>
  >({});
  const [saving, setSaving] = useState(false);

  // 다중 선택 및 일괄 변경 상태 추가
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<AttendanceStatus | "">("");
  const [bulkReason, setBulkReason] = useState<string>("");

  const clubs = useClubStore((s) => s.clubs);
  const loadClubs = useClubStore((s) => s.loadAll);
  const [clubDialogOpen, setClubDialogOpen] = useState(false);

  useEffect(() => {
    loadClubs();
  }, [loadClubs]);

  // classId는 학급 id이거나 동아리 id다. 동아리 출결도 같은 방식(classId 칸에 동아리 id)으로 저장된다.
  const selectedClub = clubs.find((c) => c.id === classId);

  const students = useMemo<RosterRow[]>(() => {
    if (!classId) return [];
    if (selectedClub) {
      return sortMembers(selectedClub.members).map((m, i) => ({
        id: m.id,
        number: i + 1,
        name: m.name,
        origin: memberOriginLabel(m) || undefined,
      }));
    }
    return getStudentsByClass(classId).map((s) => ({
      id: s.id,
      number: s.number,
      name: s.name,
    }));
  }, [classId, selectedClub, getStudentsByClass]);

  // 학급/날짜 변경 시 기존 기록 로드 및 선택 해제
  useEffect(() => {
    if (classId && date) {
      loadByClassDate(classId, date);
      setSelectedStudentIds([]);
    }
  }, [classId, date, loadByClassDate]);

  // 로드된 기록을 draft에 반영, 없는 학생은 기본 '출석'
  useEffect(() => {
    if (!classId) return;
    const next: typeof draft = {};
    students.forEach((s) => {
      const rec = records.find((r) => r.studentId === s.id);
      next[s.id] = {
        status: rec?.status ?? "출석",
        reason: rec?.reason,
      };
    });
    setDraft(next);
  }, [records, students, classId]);

  // 통계 계산
  const stats = useMemo(() => {
    const result: Record<AttendanceStatus, number> = {
      출석: 0,
      결석: 0,
      지각: 0,
      조퇴: 0,
      결과: 0,
      인정결석: 0,
      질병결석: 0,
      미인정결석: 0,
      기타결석: 0,
    };
    Object.values(draft).forEach((v) => {
      result[v.status] += 1;
    });
    return result;
  }, [draft]);

  const absenceCount =
    stats.결석 +
    stats.인정결석 +
    stats.질병결석 +
    stats.미인정결석 +
    stats.기타결석;

  const setStatus = (studentId: string, status: AttendanceStatus) => {
    setDraft((d) => ({
      ...d,
      [studentId]: { ...d[studentId], status },
    }));
  };

  const setReason = (studentId: string, reason: string) => {
    setDraft((d) => ({
      ...d,
      [studentId]: { ...d[studentId], reason },
    }));
  };

  const markAllPresent = () => {
    const next: typeof draft = {};
    students.forEach((s) => {
      next[s.id] = { status: "출석" };
    });
    setDraft(next);
    toast.info("전체 출석으로 초기화했습니다.");
  };

  const isAllSelected =
    students.length > 0 && selectedStudentIds.length === students.length;
  const isSomeSelected =
    selectedStudentIds.length > 0 && selectedStudentIds.length < students.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(students.map((s) => s.id));
    }
  };

  const applyBulkUpdate = () => {
    if (!bulkStatus) {
      toast.error("변경할 출결 상태를 선택해주세요.");
      return;
    }
    setDraft((d) => {
      const next = { ...d };
      selectedStudentIds.forEach((id) => {
        next[id] = {
          status: bulkStatus,
          reason: bulkStatus === "출석" ? undefined : bulkReason,
        };
      });
      return next;
    });
    setSelectedStudentIds([]);
    setBulkStatus("");
    setBulkReason("");
    toast.success(
      `${selectedStudentIds.length}명의 출결 상태를 '${bulkStatus}'(으)로 일괄 변경했습니다.`
    );
  };

  const save = async () => {
    if (!classId) return;
    setSaving(true);
    try {
      const rows = students.map((s) => ({
        studentId: s.id,
        status: draft[s.id]?.status ?? "출석",
        reason: draft[s.id]?.reason,
      }));
      await upsertDaily(classId, date, rows);
      toast.success(`${date} 출결을 저장했습니다.`);
    } catch (e) {
      toast.error("저장 실패: " + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const selectedClass = classes.find((c) => c.id === classId);

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">출결 관리</h1>
        <p className="text-muted-foreground">
          학급(또는 동아리)과 날짜를 선택하고 학생별 출결을 입력하세요.
        </p>
      </div>

      {/* 학급/날짜 선택 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">조회 조건</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label>학급 / 동아리</Label>
            <div className="flex gap-2">
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="학급 또는 동아리를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>학급</SelectLabel>
                    {classes.filter((c) => !c.archived).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.grade}학년 {c.classNumber}반{" "}
                        {c.homeroom ? "(담임)" : `(${c.subject})`}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  {clubs.filter((c) => !c.archived).length > 0 && (
                    <SelectGroup>
                      <SelectLabel>동아리</SelectLabel>
                      {clubs.filter((c) => !c.archived).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} ({c.members.length}명)
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => setClubDialogOpen(true)}>
                동아리 관리
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>날짜</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-[180px]"
            />
          </div>
          {classId && (
            <Button variant="outline" onClick={markAllPresent}>
              전체 출석 초기화
            </Button>
          )}
        </CardContent>
      </Card>

      {/* 통계 */}
      {classId && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="전체 인원" value={students.length} />
          <StatCard
            label="출석"
            value={stats.출석}
            tone="text-emerald-600"
          />
          <StatCard
            label="지각·조퇴·결과"
            value={stats.지각 + stats.조퇴 + stats.결과}
            tone="text-amber-600"
          />
          <StatCard
            label="결석 합계"
            value={absenceCount}
            tone="text-rose-600"
          />
        </div>
      )}

      {/* 학생별 출결 입력 */}
      {classId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {selectedClub
                ? selectedClub.name
                : selectedClass
                ? `${selectedClass.grade}학년 ${selectedClass.classNumber}반`
                : ""}{" "}
              {selectedClub ? "부원 출결" : "학생 출결"}
            </CardTitle>
            <CardDescription>
              상태를 변경하고 우측 하단의 저장 버튼을 누르세요. 이미 저장된 기록은 자동으로 불러옵니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {students.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {selectedClub
                  ? "이 동아리에 등록된 부원이 없습니다. '동아리 관리'에서 부원을 먼저 추가해주세요."
                  : "이 학급에 등록된 학생이 없습니다. 설정에서 학생을 먼저 추가해주세요."}
              </p>
            ) : (
              <>
                {/* 일괄 변경 제어 바 */}
                {selectedStudentIds.length > 0 && (
                  <div className="flex flex-wrap items-center gap-3 p-3 mb-4 rounded-lg border bg-muted/40 text-sm animate-in fade-in slide-in-from-top-1 duration-200">
                    <span className="font-semibold text-primary">
                      {selectedStudentIds.length}명 선택됨
                    </span>
                    <div className="flex items-center gap-2">
                      <Select
                        value={bulkStatus}
                        onValueChange={(v) => {
                          const status = v as AttendanceStatus;
                          setBulkStatus(status);
                          if (status === "출석") {
                            setBulkReason("");
                          }
                        }}
                      >
                        <SelectTrigger className="w-[120px] h-9">
                          <SelectValue placeholder="상태 선택" />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((v) => (
                            <SelectItem key={v} value={v}>
                              {v}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1 min-w-[200px]">
                      <Input
                        placeholder={
                          bulkStatus === "출석"
                            ? "출석은 사유를 입력할 수 없습니다"
                            : !bulkStatus
                            ? "상태를 선택해주세요"
                            : "사유 입력 (선택)"
                        }
                        value={bulkReason}
                        onChange={(e) => setBulkReason(e.target.value)}
                        disabled={bulkStatus === "출석" || !bulkStatus}
                        className="h-9"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={applyBulkUpdate} disabled={!bulkStatus}>
                        일괄 변경
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedStudentIds([]);
                          setBulkStatus("");
                          setBulkReason("");
                        }}
                      >
                        선택 취소
                      </Button>
                    </div>
                  </div>
                )}

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 text-center">
                        <input
                          type="checkbox"
                          checked={isAllSelected}
                          ref={(el) => {
                            if (el) {
                              el.indeterminate = isSomeSelected;
                            }
                          }}
                          onChange={toggleSelectAll}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer align-middle"
                        />
                      </TableHead>
                      <TableHead className="w-16">번호</TableHead>
                      <TableHead className="w-32">이름</TableHead>
                      <TableHead className="w-40">상태</TableHead>
                      <TableHead>사유 (선택)</TableHead>
                      <TableHead className="w-24 text-right">표시</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((s) => {
                      const cur = draft[s.id]?.status ?? "출석";
                      const isSelected = selectedStudentIds.includes(s.id);
                      return (
                        <TableRow key={s.id} className={isSelected ? "bg-muted/30" : ""}>
                          <TableCell className="text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedStudentIds((prev) => [...prev, s.id]);
                                } else {
                                  setSelectedStudentIds((prev) =>
                                    prev.filter((id) => id !== s.id)
                                  );
                                }
                              }}
                              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer align-middle"
                            />
                          </TableCell>
                          <TableCell>{s.number}</TableCell>
                          <TableCell className="font-medium">
                            {s.name}
                            {s.origin && (
                              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                                {s.origin}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={cur}
                              onValueChange={(v) =>
                                setStatus(s.id, v as AttendanceStatus)
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {STATUS_OPTIONS.map((v) => (
                                  <SelectItem key={v} value={v}>
                                    {v}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              placeholder={
                                cur === "출석"
                                  ? "—"
                                  : "예) 병결, 학교장 허가 등"
                              }
                              value={draft[s.id]?.reason ?? ""}
                              onChange={(e) => setReason(s.id, e.target.value)}
                              disabled={cur === "출석"}
                            />
                          </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={STATUS_VARIANT[cur]}>{cur}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </>)}
          </CardContent>
        </Card>
      )}

      <ClubManagerDialog
        open={clubDialogOpen}
        onOpenChange={setClubDialogOpen}
        onSaved={(id) => setClassId(id)}
        onDeleted={(id) => {
          if (classId === id) setClassId("");
        }}
      />

      {/* 저장 버튼 (sticky) */}
      {classId && students.length > 0 && (
        <div className="sticky bottom-4 flex justify-end">
          <Button onClick={save} disabled={saving} size="lg">
            {saving ? "저장 중..." : `${date} 출결 저장`}
          </Button>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className={`text-3xl font-bold ${tone ?? ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
