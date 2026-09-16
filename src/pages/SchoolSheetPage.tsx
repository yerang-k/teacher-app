import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

import { useSettingsStore } from "@/stores";

/** 어떤 형태의 구글시트 링크든(edit/pubhtml/이미 preview) 뷰어용 preview 링크로 변환 */
function toEmbedUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  // 이미 게시(pubhtml)되었거나 preview 링크면 그대로 사용
  if (/\/pubhtml|\/htmlembed|\/preview/.test(trimmed)) return trimmed;

  const m = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!m) return null;

  const id = m[1];
  const gidMatch = trimmed.match(/[?#&]gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : null;
  return `https://docs.google.com/spreadsheets/d/${id}/preview${gid ? `?gid=${gid}` : ""}`;
}

/** 임베드 링크에서 원본 편집 링크(새 탭에서 열기용)를 만들어봄 */
function toEditUrl(rawUrl: string): string {
  const m = rawUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (m) return `https://docs.google.com/spreadsheets/d/${m[1]}/edit`;
  return rawUrl;
}

export default function SchoolSheetPage() {
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.update);

  const savedUrl = settings.scheduleSheetUrl ?? "";
  const [draftUrl, setDraftUrl] = useState(savedUrl);
  const [editing, setEditing] = useState(!savedUrl);

  const embedUrl = toEmbedUrl(savedUrl);

  const handleSave = async () => {
    const embed = toEmbedUrl(draftUrl);
    if (!embed) {
      toast.error("구글시트 링크가 맞는지 확인해주세요.");
      return;
    }
    await updateSettings({ scheduleSheetUrl: draftUrl.trim() });
    setEditing(false);
    toast.success("학교 일정 시트를 연결했습니다.");
  };

  const handleDisconnect = async () => {
    if (!confirm("연결된 구글시트를 해제할까요?")) return;
    await updateSettings({ scheduleSheetUrl: undefined });
    setDraftUrl("");
    setEditing(true);
    toast.success("연결을 해제했습니다.");
  };

  return (
    <div className="flex h-screen flex-col">
      <div className="flex items-center justify-between gap-3 p-4 sm:p-6 pb-3 shrink-0">
        <div>
          <h1 className="text-2xl font-bold">학교 일정</h1>
          <p className="text-sm text-muted-foreground">
            학교 일정이 정리된 구글시트를 그대로 볼 수 있어요.
          </p>
        </div>
        {savedUrl && !editing && (
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" asChild>
              <a href={toEditUrl(savedUrl)} target="_blank" rel="noopener noreferrer">
                구글시트에서 열기 ↗
              </a>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              링크 변경
            </Button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="px-4 sm:px-6">
          <Card>
            <CardContent className="pt-6 space-y-3">
              <Label>구글시트 링크</Label>
              <p className="text-xs text-muted-foreground">
                구글시트에서 <strong className="text-foreground">공유 → 링크가 있는 모든 사용자 → 뷰어</strong>로
                설정한 뒤, 주소창의 링크를 그대로 붙여넣으세요. (edit 링크도 괜찮습니다)
              </p>
              <Input
                placeholder="https://docs.google.com/spreadsheets/d/..."
                value={draftUrl}
                onChange={(e) => setDraftUrl(e.target.value)}
              />
              <div className="flex gap-2">
                <Button onClick={handleSave}>연결</Button>
                {savedUrl && (
                  <Button variant="outline" onClick={() => setEditing(false)}>
                    취소
                  </Button>
                )}
                {savedUrl && (
                  <Button
                    variant="ghost"
                    className="text-rose-600 hover:text-rose-700 ml-auto"
                    onClick={handleDisconnect}
                  >
                    연결 해제
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : embedUrl ? (
        <iframe
          src={embedUrl}
          title="학교 일정 구글시트"
          className="flex-1 w-full border-0"
        />
      ) : (
        <div className="px-4 sm:px-6">
          <p className="text-sm text-muted-foreground">
            링크를 불러올 수 없습니다. 링크 변경을 눌러 다시 확인해주세요.
          </p>
        </div>
      )}
    </div>
  );
}
