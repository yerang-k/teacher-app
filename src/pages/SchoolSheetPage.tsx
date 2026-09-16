import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

import { useSettingsStore } from "@/stores";
import { uid } from "@/db";
import type { ScheduleSheetLink } from "@/types";

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.1;

/** 어떤 형태의 구글시트 링크든(edit/pubhtml/이미 preview) 뷰어용 preview 링크로 변환 */
function toEmbedUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  if (/\/pubhtml|\/htmlembed|\/preview/.test(trimmed)) return trimmed;

  const m = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!m) return null;

  const id = m[1];
  const gidMatch = trimmed.match(/[?#&]gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : null;
  return `https://docs.google.com/spreadsheets/d/${id}/preview${gid ? `?gid=${gid}` : ""}`;
}

/** 원본 편집 링크(새 탭에서 열기용) */
function toEditUrl(rawUrl: string): string {
  const m = rawUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (m) return `https://docs.google.com/spreadsheets/d/${m[1]}/edit`;
  return rawUrl;
}

export default function SchoolSheetPage() {
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.update);

  // 예전 단일 링크(scheduleSheetUrl)가 있고 새 목록이 비어 있으면 1개짜리 목록으로 보여준다.
  // 실제 저장은 사용자가 뭔가 바꿀 때(추가/수정/삭제) scheduleSheets로 이뤄진다.
  const sheets: ScheduleSheetLink[] = useMemo(() => {
    // scheduleSheets가 한 번이라도 저장된 적 있으면(빈 배열 포함) 그게 우선.
    // 한 번도 저장된 적 없을 때만(undefined) 예전 단일 링크를 임시로 보여준다.
    if (settings.scheduleSheets !== undefined) {
      return settings.scheduleSheets;
    }
    if (settings.scheduleSheetUrl) {
      return [{ id: "legacy", name: "학교 일정", url: settings.scheduleSheetUrl }];
    }
    return [];
  }, [settings.scheduleSheets, settings.scheduleSheetUrl]);

  const [activeId, setActiveId] = useState<string | null>(sheets[0]?.id ?? null);
  const activeSheet = sheets.find((s) => s.id === activeId) ?? sheets[0] ?? null;

  const [zoom, setZoom] = useState(1);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [urlDraft, setUrlDraft] = useState("");

  const saveSheets = async (next: ScheduleSheetLink[]) => {
    await updateSettings({ scheduleSheets: next });
  };

  const openAdd = () => {
    setEditingId(null);
    setNameDraft("");
    setUrlDraft("");
    setDialogOpen(true);
  };

  const openEdit = (sheet: ScheduleSheetLink) => {
    setEditingId(sheet.id);
    setNameDraft(sheet.name);
    setUrlDraft(sheet.url);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const embed = toEmbedUrl(urlDraft);
    if (!embed) {
      toast.error("구글시트 링크가 맞는지 확인해주세요.");
      return;
    }
    const name = nameDraft.trim() || "학교 일정";
    let next: ScheduleSheetLink[];
    if (editingId) {
      next = sheets.map((s) =>
        s.id === editingId ? { ...s, name, url: urlDraft.trim() } : s
      );
    } else {
      const item: ScheduleSheetLink = { id: uid(), name, url: urlDraft.trim() };
      next = [...sheets, item];
      setActiveId(item.id);
    }
    await saveSheets(next);
    setDialogOpen(false);
    toast.success(editingId ? "수정했습니다." : "시트를 추가했습니다.");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("이 시트를 목록에서 지울까요?")) return;
    const next = sheets.filter((s) => s.id !== id);
    await saveSheets(next);
    if (activeId === id) setActiveId(next[0]?.id ?? null);
    toast.success("지웠습니다.");
  };

  const zoomIn = () => setZoom((z) => Math.min(ZOOM_MAX, Math.round((z + ZOOM_STEP) * 10) / 10));
  const zoomOut = () => setZoom((z) => Math.max(ZOOM_MIN, Math.round((z - ZOOM_STEP) * 10) / 10));
  const zoomReset = () => setZoom(1);

  const embedUrl = activeSheet ? toEmbedUrl(activeSheet.url) : null;

  return (
    <div className="flex h-screen flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-6 pb-3 shrink-0">
        <div>
          <h1 className="text-2xl font-bold">학교 일정</h1>
          <p className="text-sm text-muted-foreground">
            학교 일정이 정리된 구글시트를 그대로 볼 수 있어요.
          </p>
        </div>
        <Button size="sm" onClick={openAdd}>
          + 시트 추가
        </Button>
      </div>

      {sheets.length > 0 && (
        <div className="flex items-center gap-1.5 px-4 sm:px-6 pb-2 flex-wrap shrink-0">
          {sheets.map((s) => (
            <div
              key={s.id}
              className={`flex items-center gap-1 rounded-full border pl-3 pr-1.5 py-1 text-xs ${
                s.id === activeSheet?.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/40 hover:bg-muted"
              }`}
            >
              <button type="button" onClick={() => setActiveId(s.id)} className="font-medium">
                {s.name}
              </button>
              <button
                type="button"
                title="수정"
                onClick={() => openEdit(s)}
                className="opacity-70 hover:opacity-100 px-1"
              >
                ✎
              </button>
              <button
                type="button"
                title="삭제"
                onClick={() => handleDelete(s.id)}
                className="opacity-70 hover:opacity-100 px-1"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {!activeSheet ? (
        <div className="px-4 sm:px-6">
          <div className="text-sm text-muted-foreground border rounded-lg border-dashed p-8 text-center">
            아직 등록된 시트가 없어요. "+ 시트 추가"를 눌러 구글시트 링크를 등록하세요.
          </div>
        </div>
      ) : embedUrl ? (
        <div className="relative flex-1 min-h-0">
          <div className="absolute inset-0 overflow-auto">
            <iframe
              key={activeSheet.id}
              src={embedUrl}
              title={activeSheet.name}
              style={{ zoom, width: "100%", height: "100%" }}
              className="border-0"
            />
          </div>

          {/* 확대/축소 툴바 */}
          <div className="absolute bottom-4 right-4 flex items-center gap-1 rounded-lg border bg-background shadow-sm p-1">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={zoomOut}>
              −
            </Button>
            <button
              type="button"
              onClick={zoomReset}
              className="text-xs w-12 text-center text-muted-foreground hover:text-foreground"
              title="100%로 되돌리기"
            >
              {Math.round(zoom * 100)}%
            </button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={zoomIn}>
              +
            </Button>
          </div>

          <a
            href={toEditUrl(activeSheet.url)}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute top-4 right-4 rounded-lg border bg-background shadow-sm px-3 py-1.5 text-xs hover:bg-accent"
          >
            구글시트에서 열기 ↗
          </a>
        </div>
      ) : (
        <div className="px-4 sm:px-6">
          <p className="text-sm text-muted-foreground">
            링크를 불러올 수 없습니다. 이 시트를 수정해서 링크를 다시 확인해주세요.
          </p>
        </div>
      )}

      {/* 추가/수정 다이얼로그 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "시트 수정" : "시트 추가"}</DialogTitle>
            <DialogDescription>
              구글시트에서 <strong className="text-foreground">공유 → 링크가 있는 모든 사용자 → 뷰어</strong>로
              설정한 뒤, 주소창의 링크를 그대로 붙여넣으세요. (edit 링크도 괜찮습니다)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>탭 이름</Label>
              <Input
                placeholder="예) 학사일정, 급식표, 동아리 시간표"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>구글시트 링크</Label>
              <Input
                placeholder="https://docs.google.com/spreadsheets/d/..."
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleSave}>{editingId ? "저장" : "추가"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
