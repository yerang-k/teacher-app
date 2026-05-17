import { useEffect, useRef, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

import { db } from "@/db";
import {
  useClassStore,
  useSettingsStore,
  useTaskStore,
} from "@/stores";
import type { SchoolClass, Semester } from "@/types";

export default function ClassManagementPage() {
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.update);

  const classes = useClassStore((s) => s.classes);
  const students = useClassStore((s) => s.students);
  const loadClasses = useClassStore((s) => s.loadAll);
  const addClass = useClassStore((s) => s.addClass);
  const removeClass = useClassStore((s) => s.removeClass);
  const bulkAddStudents = useClassStore((s) => s.bulkAddStudents);
  const reloadTasks = useTaskStore((s) => s.loadAll);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 학교 정보
  const [teacherName, setTeacherName] = useState(settings.teacherName ?? "");
  const [schoolName, setSchoolName] = useState(settings.schoolName ?? "");
  const [year, setYear] = useState(settings.currentYear);
  const [semester, setSemester] = useState<Semester>(settings.currentSemester);
  const [apiKey, setApiKey] = useState(settings.aiApiKey ?? "");
  const [showKey, setShowKey] = useState(false);

  // 학급 추가 폼
  const [newClass, setNewClass] = useState({
    grade: 2 as 1 | 2 | 3,
    classNumber: 1,
    homeroom: false,
    subject: "국어",
  });

  // 학생 일괄 추가 폼
  const [bulkClassId, setBulkClassId] = useState<string>("");
  const [bulkText, setBulkText] = useState<string>("");

  useEffect(() => {
    setTeacherName(settings.teacherName ?? "");
    setSchoolName(settings.schoolName ?? "");
    setYear(settings.currentYear);
    setSemester(settings.currentSemester);
    setApiKey(settings.aiApiKey ?? "");
  }, [settings]);

  const saveSettings = async () => {
    await updateSettings({
      teacherName,
      schoolName,
      currentYear: year,
      currentSemester: semester,
      aiApiKey: apiKey || undefined,
    });
    toast.success("설정을 저장했습니다.");
  };

  const handleAddClass = async () => {
    await addClass({
      year,
      grade: newClass.grade,
      classNumber: newClass.classNumber,
      homeroom: newClass.homeroom,
      subject: newClass.homeroom ? "담임" : newClass.subject,
    });
    toast.success("학급을 추가했습니다.");
  };

  const handleRemoveClass = async (c: SchoolClass) => {
    if (
      !confirm(
        `${c.grade}-${c.classNumber} 학급을 삭제합니다. 소속 학생·출결·행동기록·수업도 함께 삭제됩니다. 진행할까요?`
      )
    )
      return;
    await removeClass(c.id);
    toast.success("학급을 삭제했습니다.");
  };

  /** "1 김민준\n2 이서연" 또는 "1,김민준,남" 형식 파싱 */
  const parseBulkStudents = (text: string) => {
    return text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(/[\s,\t]+/).filter(Boolean);
        const number = Number(parts[0]);
        const name = parts[1];
        const gender = parts[2] as "남" | "여" | undefined;
        return { number, name, gender };
      })
      .filter((s) => !isNaN(s.number) && s.name);
  };

  const handleBulkAdd = async () => {
    if (!bulkClassId) {
      toast.error("학급을 선택하세요.");
      return;
    }
    const rows = parseBulkStudents(bulkText);
    if (rows.length === 0) {
      toast.error("입력 형식을 확인하세요.");
      return;
    }
    await bulkAddStudents(bulkClassId, rows);
    toast.success(`${rows.length}명 추가 완료`);
    setBulkText("");
  };

  // ---------- 백업/복원 ----------
  const handleExport = async () => {
    try {
      const json = await db.exportJSON();
      const blob = new Blob([JSON.stringify(json, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `teacher-backup-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("백업 파일을 내려받았습니다.");
    } catch (e) {
      toast.error("내보내기 실패: " + (e as Error).message);
    }
  };

  const handleImport = async (file: File) => {
    if (
      !confirm(
        "기존 데이터가 모두 삭제되고 백업 파일의 내용으로 대체됩니다. 진행할까요?"
      )
    )
      return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      await db.importJSON(json);
      await Promise.all([loadClasses(), reloadTasks()]);
      toast.success("복원 완료. 페이지를 새로고침해주세요.");
    } catch (e) {
      toast.error("복원 실패: " + (e as Error).message);
    }
  };

  const handleReset = async () => {
    if (
      !confirm(
        "모든 데이터(학급/학생/수업/출결/행동/업무/보고서)를 삭제합니다. 되돌릴 수 없습니다."
      )
    )
      return;
    await db.resetAll();
    await Promise.all([loadClasses(), reloadTasks()]);
    toast.success("초기화 완료");
  };

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">설정 / 학급 관리</h1>
        <p className="text-muted-foreground">
          학교·학기 정보, 학급·학생 등록, 데이터 백업과 복원을 관리합니다.
        </p>
      </div>

      {/* 기본 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">기본 설정</CardTitle>
          <CardDescription>
            학년도와 학기는 새 학기마다 업데이트해주세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>교사 이름</Label>
              <Input
                value={teacherName}
                onChange={(e) => setTeacherName(e.target.value)}
                placeholder="홍길동"
              />
            </div>
            <div className="space-y-1.5">
              <Label>학교명</Label>
              <Input
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder="○○고등학교"
              />
            </div>
            <div className="space-y-1.5">
              <Label>학년도</Label>
              <Input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>학기</Label>
              <Select
                value={String(semester)}
                onValueChange={(v) => setSemester(Number(v) as Semester)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1학기</SelectItem>
                  <SelectItem value="2">2학기</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label>Claude API 키</Label>
            <div className="flex gap-2">
              <Input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ant-..."
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowKey((v) => !v)}
              >
                {showKey ? "숨기기" : "보이기"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              AI 보고서 생성에만 사용됩니다. 키는 이 컴퓨터의 브라우저(IndexedDB)에만 저장되며 외부로 전송되지 않습니다.
            </p>
          </div>

          <div className="flex justify-end">
            <Button onClick={saveSettings}>설정 저장</Button>
          </div>
        </CardContent>
      </Card>

      {/* 학급 관리 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">학급</CardTitle>
          <CardDescription>
            담임 학급과 교과 학급(국어)을 등록합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <div className="space-y-1.5">
              <Label>학년</Label>
              <Select
                value={String(newClass.grade)}
                onValueChange={(v) =>
                  setNewClass((c) => ({ ...c, grade: Number(v) as 1 | 2 | 3 }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1학년</SelectItem>
                  <SelectItem value="2">2학년</SelectItem>
                  <SelectItem value="3">3학년</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>반</Label>
              <Input
                type="number"
                value={newClass.classNumber}
                onChange={(e) =>
                  setNewClass((c) => ({
                    ...c,
                    classNumber: Number(e.target.value),
                  }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>구분</Label>
              <Select
                value={newClass.homeroom ? "homeroom" : "subject"}
                onValueChange={(v) =>
                  setNewClass((c) => ({ ...c, homeroom: v === "homeroom" }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="homeroom">담임</SelectItem>
                  <SelectItem value="subject">교과</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>교과</Label>
              <Input
                value={newClass.subject}
                onChange={(e) =>
                  setNewClass((c) => ({ ...c, subject: e.target.value }))
                }
                disabled={newClass.homeroom}
                placeholder="국어/문학/독서"
              />
            </div>
            <Button onClick={handleAddClass}>학급 추가</Button>
          </div>

          <Separator />

          <div className="space-y-2">
            {classes.length === 0 && (
              <p className="text-sm text-muted-foreground">
                등록된 학급이 없습니다.
              </p>
            )}
            {classes.map((c) => {
              const count = students.filter((s) => s.classId === c.id).length;
              return (
                <div
                  key={c.id}
                  className="flex items-center justify-between border rounded p-3"
                >
                  <div>
                    <div className="font-medium">
                      {c.year}학년도 {c.grade}-{c.classNumber}{" "}
                      <span className="text-xs text-muted-foreground ml-1">
                        {c.homeroom ? "담임" : c.subject}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      학생 {count}명
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveClass(c)}
                  >
                    삭제
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 학생 일괄 추가 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">학생 일괄 등록</CardTitle>
          <CardDescription>
            한 줄에 한 명씩, 「번호 이름 성별(선택)」 형식으로 입력하세요. 예) <code>1 김민준 남</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Select value={bulkClassId} onValueChange={setBulkClassId}>
              <SelectTrigger>
                <SelectValue placeholder="학급 선택" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.grade}-{c.classNumber}{" "}
                    {c.homeroom ? "(담임)" : `(${c.subject})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <textarea
            className="w-full min-h-32 border rounded p-2 font-mono text-sm"
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={"1 김민준 남\n2 이서연 여\n3 박지호 남"}
          />
          <div className="flex justify-end">
            <Button onClick={handleBulkAdd}>등록</Button>
          </div>
        </CardContent>
      </Card>

      {/* 백업/복원 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">데이터 백업·복원</CardTitle>
          <CardDescription>
            학기말마다 백업을 받아두시면 학기·학년이 바뀌어도 안전합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleExport}>
              JSON 백업 내려받기
            </Button>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              백업 파일 복원
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImport(f);
                e.target.value = "";
              }}
            />
            <Button variant="destructive" onClick={handleReset}>
              전체 초기화
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            ⚠️ 복원과 초기화는 기존 데이터를 모두 덮어씁니다.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
