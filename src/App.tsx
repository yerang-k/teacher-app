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
import {
  useClassStore,
  useTaskStore,
  useSettingsStore,
} from "@/stores";
import { seedIfEmpty } from "@/lib/seed";

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
    (async () => {
      try {
        await seedIfEmpty();
        await Promise.all([loadSettings(), loadClasses(), loadTasks()]);
      } catch (e) {
        console.error("앱 초기화 실패:", e);
      } finally {
        setReady(true);
      }
    })();
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
