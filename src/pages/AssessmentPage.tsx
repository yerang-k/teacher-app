import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  useAssessmentStore,
  useClassStore,
  useSettingsStore,
} from "@/stores";
import type { Assessment, AssessmentRecord, Semester } from "@/types";

const DEFAULT_GRADES = ["A", "B", "C", "D", "E"];

function getSessionLabel(n: number) {
  return `${n}차시`;
}

export default function AssessmentPage() {
  const settings = useSettingsStore((s) => s.settings);
  const assessments = useAssessmentStore((s) => s.assessments);
  const loadAll = useAssessmentStore((s) => s.loadAll);
  const removeAssessment = useAssessmentStore((s) => s.removeAssessment);

  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<Assessment | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const grouped: Record<string, Assessment[]> = {};
  assessments.forEach((a) => {
    if (!grouped[a.subject]) grouped[a.subject] = [];
    grouped[a.subject].push(a);
  });

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold">수행평가</h1>
          <p className="text-muted-foreground text-sm">
            과목별 수행평가를 생성하고 학생별 점수·응시 현황을 기록하세요.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>+ 새 수행평가</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
        {/* 왼쪽: 수행평가 목록 */}
        <div className="space-y-3">
          {Object.keys(grouped).length === 0 && (
            <Card>
              <CardContent className="pt-6 text-sm text-muted-foreground text-center">
                수행평가가 없습니다.
                <br />
                우상단 버튼으로 추가하세요.
              </CardContent>
            </Card>
          )}
          {Object.entries(grouped).map(([subject, list]) => (
            <div key={subject}>
              <div className="text-xs font-semibold text-muted-foreground px-1 mb-1">
                {subject}
              </div>
              {list.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelected(a)}
                  className={`w-full text-left border rounded p-3 mb-1 transition-colors ${
                    selected?.id === a.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card hover:bg-accent/40"
                  }`}
                >
                  <div className="font-medium text-sm">{a.title}</div>
                  <div
                    className={`text-xs mt-0.5 ${
                      selected?.id === a.id
                        ? "opacity-80"
                        : "text-muted-foreground"
                    }`}
                  >
                    {a.totalSessions}차시 ·{" "}
                    {a.scoreType === "score"
                      ? `${a.maxScore ?? "?"}점 만점`
                      : "등급제"}{" "}
                    · 학급 {a.classIds.length}개
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* 오른쪽: 선택된 수행평가 상세 */}
        <div>
          {!selected && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">수행평가 사용법</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>
                  <strong className="text-foreground">수행평가 생성:</strong>{" "}
                  우상단 "+ 새 수행평가" 버튼으로 과목, 차시, 점수 방식을
                  설정하세요.
                </p>
                <p>
                  <strong className="text-foreground">점수 입력:</strong> 목록에서
                  수행평가를 선택하면 학급별로 학생 점수와 차시별 응시 여부를
                  입력할 수 있습니다.
                </p>
                <p>
                  <strong className="text-foreground">미응시 처리:</strong>{" "}
                  미응시로 표시한 학생은 나중에 점수를 따로 입력할 수 있습니다.
                </p>
              </CardContent>
            </Card>
          )}
          {selected && (
            <AssessmentDetail
              assessment={selected}
              onEdit={() => setEditOpen(true)}
              onDelete={async () => {
                if (!confirm(`"${selected.title}"을 삭제할까요?`)) return;
                await removeAssessment(selected.id);
                setSelected(null);
                toast.success("삭제했습니다.");
              }}
            />
          )}
        </div>
      </div>

      {/* 생성 다이얼로그 */}
      <AssessmentFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        year={settings.currentYear}
        semester={settings.currentSemester}
        onSaved={(id) => {
          loadAll().then(() => {
            const found = useAssessmentStore
              .getState()
              .assessments.find((a) => a.id === id);
            if (found) setSelected(found);
          });
        }}
      />

      {/* 수정 다이얼로그 */}
      {selected && (
        <AssessmentFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          initial={selected}
          year={settings.currentYear}
          semester={settings.currentSemester}
          onSaved={() => {
            loadAll().then(() => {
              const found = useAssessmentStore
                .getState()
                .assessments.find((a) => a.id === selected.id);
              if (found) setSelected(found);
            });
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* AssessmentDetail                                                     */
/* ------------------------------------------------------------------ */
function AssessmentDetail({
  assessment,
  onEdit,
  onDelete,
}: {
  assessment: Assessment;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const classes = useClassStore((s) => s.classes);
  const students = useClassStore((s) => s.students);
  const records = useAssessmentStore((s) => s.records);
  const loadRecordsByAssessment = useAssessmentStore(
    (s) => s.loadRecordsByAssessment
  );

  const [selectedClassId, setSelectedClassId] = useState<string>(
    assessment.classIds[0] ?? ""
  );

  useEffect(() => {
    loadRecordsByAssessment(assessment.id);
    setSelectedClassId(assessment.classIds[0] ?? "");
  }, [assessment.id, loadRecordsByAssessment]);

  const targetClasses = classes.filter((c) =>
    assessment.classIds.includes(c.id)
  );
  const classStudents = students.filter((s) => s.classId === selectedClassId);

  return (
    <div className="space-y-3">
      {/* 수행평가 정보 헤더 */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-base">{assessment.title}</CardTitle>
              <CardDescription className="text-xs">
                {assessment.subject} · {assessment.totalSessions}차시 ·{" "}
                {assessment.scoreType === "score"
                  ? `${assessment.maxScore ?? "?"}점 만점`
                  : `등급제 (${(assessment.grades ?? DEFAULT_GRADES).join("/")})`}
              </CardDescription>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={onEdit}>
                수정
              </Button>
              <Button size="sm" variant="destructive" onClick={onDelete}>
                삭제
              </Button>
            </div>
          </div>
        </CardHeader>
        {assessment.description && (
          <CardContent className="pt-0 text-sm text-muted-foreground">
            {assessment.description}
          </CardContent>
        )}
        {/* 차시 정보 */}
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-2">
            {assessment.sessions.map((s) => (
              <Badge key={s.sessionNumber} variant="outline">
                {s.sessionNumber}차시
                {s.date ? ` · ${s.date}` : ""}
                {s.description ? ` · ${s.description}` : ""}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 학급 탭 */}
      {targetClasses.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {targetClasses.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedClassId(c.id)}
              className={`px-3 py-1.5 rounded text-sm border transition-colors ${
                selectedClassId === c.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card hover:bg-accent/40"
              }`}
            >
              {c.grade}-{c.classNumber}반
            </button>
          ))}
        </div>
      )}

      {/* 점수 입력 테이블 */}
      {selectedClassId && (
        <ScoreTable
          assessment={assessment}
          classId={selectedClassId}
          students={classStudents}
          records={records.filter(
            (r) =>
              r.assessmentId === assessment.id && r.classId === selectedClassId
          )}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ScoreTable                                                           */
/* ------------------------------------------------------------------ */
function ScoreTable({
  assessment,
  classId,
  students,
  records,
}: {
  assessment: Assessment;
  classId: string;
  students: ReturnType<typeof useClassStore.getState>["students"];
  records: AssessmentRecord[];
}) {
  const upsertRecord = useAssessmentStore((s) => s.upsertRecord);

  // 로컬 편집 상태
  const [drafts, setDrafts] = useState<
    Record<
      string,
      {
        score?: string;
        grade?: string;
        sessionAttendance: Record<number, "응시" | "미응시">;
        notes?: string;
      }
    >
  >({});

  // records → drafts 초기화
  useEffect(() => {
    const init: typeof drafts = {};
    students.forEach((s) => {
      const rec = records.find((r) => r.studentId === s.id);
      init[s.id] = {
        score: rec?.score !== undefined ? String(rec.score) : "",
        grade: rec?.grade ?? "",
        sessionAttendance: rec?.sessionAttendance ?? {},
        notes: rec?.notes ?? "",
      };
    });
    setDrafts(init);
  }, [students, records]);

  const toggleAttendance = (
    studentId: string,
    session: number
  ) => {
    setDrafts((d) => {
      const prev = d[studentId]?.sessionAttendance ?? {};
      const current = prev[session] ?? "응시";
      return {
        ...d,
        [studentId]: {
          ...d[studentId],
          sessionAttendance: {
            ...prev,
            [session]: current === "응시" ? "미응시" : "응시",
          },
        },
      };
    });
  };

  const saveAll = async () => {
    for (const student of students) {
      const draft = drafts[student.id];
      if (!draft) continue;
      await upsertRecord({
        assessmentId: assessment.id,
        studentId: student.id,
        classId,
        score:
          assessment.scoreType === "score" && draft.score
            ? Number(draft.score)
            : undefined,
        grade:
          assessment.scoreType === "grade" && draft.grade
            ? draft.grade
            : undefined,
        sessionAttendance: draft.sessionAttendance,
        notes: draft.notes || undefined,
      });
    }
    toast.success("저장했습니다.");
  };

  const sessions = Array.from(
    { length: assessment.totalSessions },
    (_, i) => i + 1
  );
  const grades = assessment.grades ?? DEFAULT_GRADES;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">
            학생 점수 입력 ({students.length}명)
          </CardTitle>
          <Button size="sm" onClick={saveAll}>
            저장
          </Button>
        </div>
        <CardDescription className="text-xs">
          차시 버튼을 클릭해 응시/미응시를 전환하세요. 미응시 학생도 점수는
          나중에 입력할 수 있어요.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left px-3 py-2 font-medium text-xs w-8">
                번호
              </th>
              <th className="text-left px-3 py-2 font-medium text-xs w-20">
                이름
              </th>
              {sessions.map((s) => (
                <th
                  key={s}
                  className="text-center px-2 py-2 font-medium text-xs"
                >
                  {s}차시
                </th>
              ))}
              <th className="text-center px-2 py-2 font-medium text-xs">
                {assessment.scoreType === "score" ? "점수" : "등급"}
              </th>
              <th className="text-left px-2 py-2 font-medium text-xs">비고</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => {
              const draft = drafts[student.id] ?? {
                score: "",
                grade: "",
                sessionAttendance: {},
                notes: "",
              };
              const allAbsent = sessions.every(
                (s) => draft.sessionAttendance[s] === "미응시"
              );
              return (
                <tr
                  key={student.id}
                  className={`border-b last:border-0 ${
                    allAbsent ? "bg-rose-50" : ""
                  }`}
                >
                  <td className="px-3 py-1.5 text-xs text-muted-foreground">
                    {student.number}
                  </td>
                  <td className="px-3 py-1.5 font-medium">{student.name}</td>
                  {sessions.map((s) => {
                    const att = draft.sessionAttendance[s] ?? "응시";
                    return (
                      <td key={s} className="px-2 py-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => toggleAttendance(student.id, s)}
                          className={`px-2 py-0.5 rounded text-xs font-medium border transition-colors ${
                            att === "미응시"
                              ? "bg-rose-100 text-rose-700 border-rose-300"
                              : "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                          }`}
                        >
                          {att}
                        </button>
                      </td>
                    );
                  })}
                  <td className="px-2 py-1.5">
                    {assessment.scoreType === "score" ? (
                      <Input
                        type="number"
                        min={0}
                        max={assessment.maxScore}
                        value={draft.score ?? ""}
                        onChange={(e) =>
                          setDrafts((d) => ({
                            ...d,
                            [student.id]: {
                              ...d[student.id],
                              score: e.target.value,
                            },
                          }))
                        }
                        className="h-7 w-20 text-xs text-center"
                        placeholder={`/${assessment.maxScore ?? "?"}`}
                      />
                    ) : (
                      <Select
                        value={draft.grade ?? ""}
                        onValueChange={(v) =>
                          setDrafts((d) => ({
                            ...d,
                            [student.id]: { ...d[student.id], grade: v },
                          }))
                        }
                      >
                        <SelectTrigger className="h-7 w-20 text-xs">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">—</SelectItem>
                          {grades.map((g) => (
                            <SelectItem key={g} value={g}>
                              {g}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      value={draft.notes ?? ""}
                      onChange={(e) =>
                        setDrafts((d) => ({
                          ...d,
                          [student.id]: {
                            ...d[student.id],
                            notes: e.target.value,
                          },
                        }))
                      }
                      className="h-7 text-xs"
                      placeholder="비고"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* AssessmentFormDialog                                                 */
/* ------------------------------------------------------------------ */
function AssessmentFormDialog({
  open,
  onOpenChange,
  initial,
  year,
  semester,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Assessment;
  year: number;
  semester: Semester;
  onSaved: (id: string) => void;
}) {
  const classes = useClassStore((s) => s.classes);
  const addAssessment = useAssessmentStore((s) => s.addAssessment);
  const updateAssessment = useAssessmentStore((s) => s.updateAssessment);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [scoreType, setScoreType] = useState<"score" | "grade">(
    initial?.scoreType ?? "score"
  );
  const [maxScore, setMaxScore] = useState(
    initial?.maxScore !== undefined ? String(initial.maxScore) : "100"
  );
  const [gradesStr, setGradesStr] = useState(
    (initial?.grades ?? DEFAULT_GRADES).join(",")
  );
  const [totalSessions, setTotalSessions] = useState(
    initial?.totalSessions ?? 3
  );
  const [sessions, setSessions] = useState<
    { sessionNumber: number; date: string; description: string }[]
  >(
    initial?.sessions.map((s) => ({
      sessionNumber: s.sessionNumber,
      date: s.date ?? "",
      description: s.description ?? "",
    })) ??
      Array.from({ length: 3 }, (_, i) => ({
        sessionNumber: i + 1,
        date: "",
        description: "",
      }))
  );
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>(
    initial?.classIds ?? []
  );

  // totalSessions 변경 시 sessions 배열 동기화
  useEffect(() => {
    setSessions((prev) =>
      Array.from({ length: totalSessions }, (_, i) => ({
        sessionNumber: i + 1,
        date: prev[i]?.date ?? "",
        description: prev[i]?.description ?? "",
      }))
    );
  }, [totalSessions]);

  // initial 변경 시 초기화
  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? "");
    setSubject(initial?.subject ?? "");
    setDescription(initial?.description ?? "");
    setScoreType(initial?.scoreType ?? "score");
    setMaxScore(
      initial?.maxScore !== undefined ? String(initial.maxScore) : "100"
    );
    setGradesStr((initial?.grades ?? DEFAULT_GRADES).join(","));
    setTotalSessions(initial?.totalSessions ?? 3);
    setSessions(
      initial?.sessions.map((s) => ({
        sessionNumber: s.sessionNumber,
        date: s.date ?? "",
        description: s.description ?? "",
      })) ??
        Array.from({ length: 3 }, (_, i) => ({
          sessionNumber: i + 1,
          date: "",
          description: "",
        }))
    );
    setSelectedClassIds(initial?.classIds ?? []);
  }, [open, initial]);

  const toggleClass = (id: string) => {
    setSelectedClassIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("수행평가 이름을 입력하세요.");
      return;
    }
    if (!subject.trim()) {
      toast.error("과목을 입력하세요.");
      return;
    }
    if (selectedClassIds.length === 0) {
      toast.error("대상 학급을 하나 이상 선택하세요.");
      return;
    }

    const data = {
      title: title.trim(),
      subject: subject.trim(),
      description: description.trim() || undefined,
      year,
      semester,
      scoreType,
      maxScore: scoreType === "score" ? Number(maxScore) : undefined,
      grades:
        scoreType === "grade"
          ? gradesStr
              .split(",")
              .map((g) => g.trim())
              .filter(Boolean)
          : undefined,
      totalSessions,
      sessions: sessions.map((s) => ({
        sessionNumber: s.sessionNumber,
        date: s.date || undefined,
        description: s.description || undefined,
      })),
      classIds: selectedClassIds,
    };

    if (initial) {
      await updateAssessment(initial.id, data);
      toast.success("수정했습니다.");
      onSaved(initial.id);
    } else {
      const id = await addAssessment(data);
      toast.success("수행평가를 만들었습니다.");
      onSaved(id);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initial ? "수행평가 수정" : "새 수행평가 만들기"}
          </DialogTitle>
          <DialogDescription>
            과목, 차시, 점수 방식을 설정하세요.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 기본 정보 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>수행평가 이름 *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 1학기 수행평가 1회"
              />
            </div>
            <div className="space-y-1.5">
              <Label>과목 *</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="예: 국어"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>설명 (선택)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="수행평가 안내 내용"
              rows={2}
            />
          </div>

          <Separator />

          {/* 점수 방식 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>점수 방식</Label>
              <Select
                value={scoreType}
                onValueChange={(v) => setScoreType(v as "score" | "grade")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="score">점수제</SelectItem>
                  <SelectItem value="grade">등급제</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {scoreType === "score" ? (
              <div className="space-y-1.5">
                <Label>만점</Label>
                <Input
                  type="number"
                  value={maxScore}
                  onChange={(e) => setMaxScore(e.target.value)}
                  min={1}
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>등급 (쉼표로 구분)</Label>
                <Input
                  value={gradesStr}
                  onChange={(e) => setGradesStr(e.target.value)}
                  placeholder="A,B,C,D,E"
                />
              </div>
            )}
          </div>

          <Separator />

          {/* 차시 설정 */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Label>총 차시 수</Label>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setTotalSessions(n)}
                    className={`w-8 h-8 rounded border text-sm font-medium transition-colors ${
                      totalSessions === n
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card hover:bg-accent/40"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              {sessions.map((s, i) => (
                <div key={s.sessionNumber} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-12 shrink-0">
                    {s.sessionNumber}차시
                  </span>
                  <Input
                    type="date"
                    value={s.date}
                    onChange={(e) =>
                      setSessions((prev) =>
                        prev.map((p, pi) =>
                          pi === i ? { ...p, date: e.target.value } : p
                        )
                      )
                    }
                    className="h-8 text-xs w-40"
                  />
                  <Input
                    value={s.description}
                    onChange={(e) =>
                      setSessions((prev) =>
                        prev.map((p, pi) =>
                          pi === i ? { ...p, description: e.target.value } : p
                        )
                      )
                    }
                    className="h-8 text-xs"
                    placeholder="차시 설명 (선택)"
                  />
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* 대상 학급 */}
          <div className="space-y-2">
            <Label>대상 학급 *</Label>
            <div className="flex flex-wrap gap-2">
              {classes.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleClass(c.id)}
                  className={`px-3 py-1.5 rounded border text-sm transition-colors ${
                    selectedClassIds.includes(c.id)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card hover:bg-accent/40"
                  }`}
                >
                  {c.grade}-{c.classNumber}반
                  {c.homeroom ? " (담임)" : ` (${c.subject})`}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button onClick={handleSave}>
              {initial ? "수정" : "만들기"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
