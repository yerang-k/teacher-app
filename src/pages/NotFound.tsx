import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center space-y-3">
        <h1 className="text-5xl font-bold text-muted-foreground">404</h1>
        <p className="text-lg">페이지를 찾을 수 없습니다.</p>
        <Link href="/">
          <Button>홈으로 돌아가기</Button>
        </Link>
      </div>
    </div>
  );
}
