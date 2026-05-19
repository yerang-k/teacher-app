import { useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { exportData, importData } from "@/lib/dataBackup";

export default function BackupPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const handleExport = async () => {
    try {
      await exportData();
      toast.success("백업 파일이 다운로드됐습니다.");
    } catch (e) {
      toast.error("내보내기 중 오류가 발생했습니다.");
      console.error(e);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const confirmed = confirm(
      "가져오기를 하면 현재 모든 데이터가 백업 파일로 대체됩니다.\n계속하시겠습니까?"
    );
    if (!confirmed) {
      e.target.value = "";
      return;
    }

    setImporting(true);
    try {
      await importData(file);
      toast.success("데이터를 성공적으로 복원했습니다. 앱을 새로고침합니다.");
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "알 수 없는 오류";
      toast.error(`가져오기 실패: ${msg}`);
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">데이터 백업 / 복원</h1>
        <p className="text-muted-foreground text-sm mt-1">
          새 기능을 추가하기 전에 반드시 백업을 해두세요.
        </p>
      </div>

      <div className="space-y-4">
        {/* 내보내기 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">📥 데이터 내보내기 (백업)</CardTitle>
            <CardDescription>
              현재 앱의 모든 데이터를 JSON 파일로 저장합니다. 새 기능을 추가하기
              전, 또는 주기적으로 백업해두세요.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleExport} className="w-full">
              백업 파일 다운로드
            </Button>
          </CardContent>
        </Card>

        {/* 가져오기 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">📤 데이터 가져오기 (복원)</CardTitle>
            <CardDescription>
              이전에 내보낸 백업 파일로 데이터를 복원합니다.{" "}
              <strong className="text-destructive">
                현재 데이터가 모두 백업 파일로 대체되니 주의하세요.
              </strong>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              variant="outline"
              className="w-full"
              disabled={importing}
              onClick={() => fileInputRef.current?.click()}
            >
              {importing ? "복원 중..." : "백업 파일 선택해서 복원"}
            </Button>
          </CardContent>
        </Card>

        {/* 안내 */}
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6 text-sm text-amber-900 space-y-1.5">
            <p className="font-semibold">💡 언제 백업해야 하나요?</p>
            <ul className="list-disc list-inside space-y-1 text-amber-800">
              <li>새 기능을 추가하기 바로 전</li>
              <li>중요한 데이터 입력 후 (수행평가 점수 등)</li>
              <li>매주 한 번씩 정기적으로</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
