import { useState } from "react";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

import { useClassStore, useClubStore, useSettingsStore } from "@/stores";
import { uid } from "@/db";
import {
  memberKey,
  memberOriginLabel,
  parseMemberLines,
  sortMembers,
} from "@/lib/clubUtils";
import type { Club, ClubMember } from "@/types";

type Editing = { id: string | "new" } | null;

export default function ClubManagerDialog({
  open,
  onOpenChange,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (clubId: string) => void;
  onDeleted?: (clubId: string) => void;
}) {
  const settings = useSettingsStore((s) => s.settings);
  const classes = useClassStore((s) => s.classes);
  const getStudentsByClass = useClassStore((s) => s.getStudentsByClass);
  const clubs = useClubStore((s) => s.clubs);
  const addClub = useClubStore((s) => s.add);
  const updateClub = useClubStore((s) => s.update);
  const removeClub = useClubStore((s) => s.remove);

  const [editing, setEditing] = useState<Editing>(null);
  const [name, setName] = useState("");
  const [year, setYear] = useState(settings.currentYear);
  const [members, setMembers] = useState<ClubMember[]>([]);

  const [pickClassId, setPickClassId] = useState("");
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const [bulkText, setBulkText] = useState("");

  const activeClasses = classes.filter((c) => !c.archived);
  const pickStudents = pickClassId ? getStudentsByClass(pickClassId) : [];

  const startNew = () => {
    setEditing({ id: "new" });
    setName("");
    setYear(settings.currentYear);
    setMembers([]);
    setPickClassId("");
    setPickedIds([]);
    setBulkText("");
  };

  const startEdit = (club: Club) => {
    setEditing({ id: club.id });
    setName(club.name);
    setYear(club.year);
    setMembers(club.members);
    setPickClassId("");
    setPickedIds([]);
    setBulkText("");
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) setEditing(null);
    onOpenChange(next);
  };

  /** 이미 있는 사람은 건너뛰고 새 부원만 추가 */
  const addMembers = (incoming: Omit<ClubMember, "id">[]) => {
    const existing = new Set(members.map(memberKey));
    const fresh: ClubMember[] = [];
    for (const m of incoming) {
      const key = memberKey(m);
      if (existing.has(key)) continue;
      existing.add(key);
      fresh.push({ id: uid(), ...m });
    }
    if (fresh.length === 0) {
      toast.info("추가할 새 부원이 없습니다. (이미 등록된 부원)");
      return;
    }
    setMembers((prev) => sortMembers([...prev, ...fresh]));
    toast.success(`${fresh.length}명을 추가했습니다.`);
  };

  const addPicked = () => {
    const klass = classes.find((c) => c.id === pickClassId);
    if (!klass) return;
    const chosen = pickStudents.filter((s) => pickedIds.includes(s.id));
    addMembers(
      chosen.map((s) => ({
        name: s.name,
        grade: klass.grade,
        classNumber: klass.classNumber,
        number: s.number,
      }))
    );
    setPickedIds([]);
  };

  const addBulk = () => {
    const parsed = parseMemberLines(bulkText);
    if (parsed.length === 0) {
      toast.error("추가할 이름이 없습니다.");
      return;
    }
    addMembers(parsed);
    setBulkText("");
  };

  const save = async () => {
    if (!editing) return;
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("동아리 이름을 입력하세요.");
      return;
    }
    if (editing.id === "new") {
      const id = await addClub({ name: trimmed, year, members });
      toast.success("동아리를 만들었습니다.");
      onSaved?.(id);
    } else {
      await updateClub(editing.id, { name: trimmed, year, members });
      toast.success("동아리를 수정했습니다.");
      onSaved?.(editing.id);
    }
    setEditing(null);
  };

  const remove = async () => {
    if (!editing || editing.id === "new") return;
    if (
      !window.confirm(
        `'${name}' 동아리와 그 출결 기록을 모두 삭제할까요? 되돌릴 수 없습니다.`
      )
    )
      return;
    const id = editing.id;
    await removeClub(id);
    toast.success("동아리를 삭제했습니다.");
    onDeleted?.(id);
    setEditing(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>동아리 관리</DialogTitle>
          <DialogDescription>
            동아리를 만들고 부원을 등록하면, 출결 화면의 학급 목록에 동아리가 함께 나타납니다.
          </DialogDescription>
        </DialogHeader>

        {!editing ? (
          <div className="space-y-3">
            {clubs.length === 0 ? (
              <p className="text-sm text-muted-foreground border rounded-lg border-dashed p-6 text-center">
                아직 만든 동아리가 없습니다.
              </p>
            ) : (
              <div className="space-y-1.5">
                {clubs.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => startEdit(c)}
                    className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left hover:bg-muted/40"
                  >
                    <span className="font-medium text-sm">{c.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {c.year}학년도 · {c.members.length}명
                    </span>
                  </button>
                ))}
              </div>
            )}
            <Button onClick={startNew}>+ 새 동아리</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-[1fr_120px] gap-3">
              <div className="space-y-1.5">
                <Label>동아리 이름 *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="예) 독서토론반"
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
            </div>

            {/* 등록된 학생에서 선택 */}
            <div className="space-y-2 rounded-lg border p-3">
              <Label className="text-sm">등록된 학생에서 추가</Label>
              <Select
                value={pickClassId}
                onValueChange={(v) => {
                  setPickClassId(v);
                  setPickedIds([]);
                }}
              >
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="학급 선택" />
                </SelectTrigger>
                <SelectContent>
                  {activeClasses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.grade}학년 {c.classNumber}반 {c.homeroom ? "(담임)" : `(${c.subject})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {pickClassId && (
                <>
                  <div className="grid max-h-40 grid-cols-2 gap-1 overflow-y-auto sm:grid-cols-3">
                    {pickStudents.map((s) => (
                      <label key={s.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={pickedIds.includes(s.id)}
                          onChange={(e) =>
                            setPickedIds((prev) =>
                              e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id)
                            )
                          }
                        />
                        {s.number}. {s.name}
                      </label>
                    ))}
                    {pickStudents.length === 0 && (
                      <p className="col-span-full text-xs text-muted-foreground">
                        이 학급에 등록된 학생이 없습니다.
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pickedIds.length === 0}
                    onClick={addPicked}
                  >
                    선택한 {pickedIds.length}명 추가
                  </Button>
                </>
              )}
            </div>

            {/* 여러 명 한 번에 입력 */}
            <div className="space-y-2 rounded-lg border p-3">
              <Label className="text-sm">직접 입력 (다른 학급 학생 포함)</Label>
              <Textarea
                rows={4}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={"한 줄에 한 명씩\n3-6-12 홍길동\n2-9 김철수\n이영희"}
              />
              <p className="text-xs text-muted-foreground">
                "학년-반-번호 이름" 순서로 쓰면 됩니다. 학년-반-번호는 생략해도 되고, 번호만 빼도 됩니다.
              </p>
              <Button size="sm" variant="outline" onClick={addBulk}>
                추가
              </Button>
            </div>

            {/* 현재 부원 */}
            <div className="space-y-2">
              <Label className="text-sm">부원 {members.length}명</Label>
              {members.length === 0 ? (
                <p className="text-xs text-muted-foreground">아직 부원이 없습니다.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {members.map((m) => (
                    <Badge key={m.id} variant="secondary" className="gap-1.5 py-1">
                      <span>
                        {memberOriginLabel(m) && (
                          <span className="mr-1 opacity-60">{memberOriginLabel(m)}</span>
                        )}
                        {m.name}
                      </span>
                      <button
                        type="button"
                        title="부원에서 빼기"
                        onClick={() => setMembers((prev) => prev.filter((x) => x.id !== m.id))}
                        className="opacity-60 hover:opacity-100"
                      >
                        ✕
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                부원을 빼면 그 학생의 이전 출결 기록은 화면에서 보이지 않게 되지만 저장된 기록은 남아 있습니다.
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="flex justify-between sm:justify-between">
          <div>
            {editing && editing.id !== "new" && (
              <Button variant="destructive" onClick={remove}>
                동아리 삭제
              </Button>
            )}
          </div>
          <div className="space-x-2">
            {editing ? (
              <>
                <Button variant="outline" onClick={() => setEditing(null)}>
                  목록으로
                </Button>
                <Button onClick={save}>저장</Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                닫기
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
