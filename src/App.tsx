import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import { useEffect, useState } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import Layout from "./components/Layout";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import LessonsPage from "./pages/LessonsPage";
import TasksPage from "./pages/TasksPage";
import AttendancePage from "./pages/AttendancePage";
import BehaviorNotesPage from "./pages/BehaviorNotesPage";
import ClassManagementPage from "./pages/ClassManagementPage";
import AIReportPage from "./pages/AIReportPage";
import TimetablePage from "./pages/TimetablePage";
import AssessmentPage from "./pages/AssessmentPage";
import MemosPage from "./pages/MemosPage";
import BackupPage from "./pages/BackupPage";
import {
  useClassStore,
  useTaskStore,
  useSettingsStore,
} from "@/stores";
import { seedIfEmpty } from "@/lib/seed";
import { autoSyncOnLaunch, enableAutoSync } from "@/lib/cloudSync";
import { toast } from "sonner";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/lessons" component={LessonsPage} />
      <Route path="/tasks" component={TasksPage} />
      <Route path="/attendance" component={AttendancePage} />
      <Route path="/behavior" component={BehaviorNotesPage} />
      <Route path="/ai-report" component={AIReportPage} />
      <Route path="/timetable" component={TimetablePage} />
      <Route path="/assessment" component={AssessmentPage} />
      <Route path="/memos" component={MemosPage} />
      <Route path="/backup" component={BackupPage} />
      <Route path="/settings" component={ClassManagementPage} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppInitializer({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  const loadSettings = useSettingsStore((s) => s.load);
  const loadClasses = useClassStore((s) => s.loadAll);
  const loadTasks = useTaskStore((s) => s.loadAll);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // 1) 로컬(IndexedDB) 데이터만으로 화면을 즉시 띄운다 — 네트워크(구글 드라이브) 대기 없음
      try {
        await seedIfEmpty();
        await Promise.all([loadSettings(), loadClasses(), loadTasks()]);
      } catch (e) {
        console.error("앱 초기화 실패:", e);
      } finally {
        // 초기 적재가 끝난 뒤부터만 변경을 감지해, 시드/적재가 동기화를 유발하지 않게 함
        enableAutoSync();
        setReady(true);
      }

      // 2) 클라우드 동기화는 백그라운드에서 (화면 렌더를 막지 않는다).
      //    Apps Script 콜드 스타트가 느려도 앱은 이미 로컬 데이터로 떠 있다.
      try {
        const sync = await autoSyncOnLaunch();
        if (!cancelled && sync === "pulled") {
          // 다른 기기의 최신 기록을 받아왔으면 스토어를 다시 적재해 화면을 갱신
          await Promise.all([loadSettings(), loadClasses(), loadTasks()]);
          toast.success("다른 기기의 최신 기록을 불러왔습니다.");
        }
      } catch (e) {
        console.error("백그라운드 동기화 실패:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadSettings, loadClasses, loadTasks]);

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        데이터를 불러오는 중입니다…
      </div>
    );
  }
  return <>{children}</>;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <AppInitializer>
            <Layout>
              <Router />
            </Layout>
          </AppInitializer>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
