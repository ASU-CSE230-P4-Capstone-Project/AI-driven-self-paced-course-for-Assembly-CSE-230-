"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../hooks/useAuth";
import { Button } from "./ui/button";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { Question } from "../types/quiz";
import { TeacherModuleSelector } from "./TeacherModuleSelector";
import { MasteryTestView } from "./MasteryTestView";
import { Toaster } from "./ui/sonner";
import TeacherStudentsList, { type TeacherStudentRow } from "./TeacherStudentsList";
import TeacherModuleManager from "./TeacherModuleManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Dialog, DialogContent } from "./ui/dialog";
import type { ModuleAnalytics } from "../types/teacher";
import { MasteryCheckBuilder } from "./MasteryCheckBuilder";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type AppState = "module-overview" | "module-students" | "mastery-test" | "manage-modules";

export function TeacherDashboard() {
  const { user, logout, token } = useAuth();
  const router = useRouter();
  const [appState, setAppState] = useState<AppState>("module-overview");
  const [selectedModuleName, setSelectedModuleName] = useState<string | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<string>("1");
  const [masteryTestQuestions, setMasteryTestQuestions] = useState<Question[]>([]);
  const [masteryTestModule, setMasteryTestModule] = useState<string>("");
  const [modules, setModules] = useState<ModuleAnalytics[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [students, setStudents] = useState<TeacherStudentRow[]>([]);
  const [backfillStatus, setBackfillStatus] = useState<string | null>(null);
  const [backfillReport, setBackfillReport] = useState<any[] | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "students" | "mastery" | "modules">("overview");
  const [studentsModalOpen, setStudentsModalOpen] = useState(false);

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  const loadModules = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(`${API_URL}/progress/teacher/modules`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) {
        toast.error("Failed to load module analytics.");
        return;
      }
      const data = await r.json();
      setTotalStudents(data.totalStudents ?? 0);
      setModules((data.modules ?? []) as ModuleAnalytics[]);
    } catch {
      toast.error("Failed to load module analytics.");
    }
  }, [token]);

  const backfillCanvasUsers = useCallback(async () => {
    if (!token) return;
    setBackfillStatus("Backfilling Canvas mappings…");
    setBackfillReport(null);
    try {
      const r = await fetch(`${API_URL}/pushback/backfill-users`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        const msg = typeof data?.detail === "string" ? data.detail : "Backfill failed.";
        setBackfillStatus(msg);
        toast.error(msg);
        return;
      }
      const linked = Number(data?.linked ?? 0);
      const skipped = Number(data?.skipped ?? 0);
      const unmatched = Number(data?.unmatched ?? 0);
      const report = Array.isArray(data?.report) ? data.report : [];
      setBackfillReport(report);
      const summary = `Backfill complete. Linked ${linked}, skipped ${skipped}, unmatched ${unmatched}.`;
      setBackfillStatus(summary);
      toast.success(summary);
      await loadModules();
    } catch {
      setBackfillStatus("Backfill failed.");
      toast.error("Backfill failed.");
    }
  }, [token, loadModules]);

  const loadStudents = useCallback(
    async (moduleId: string, moduleName: string) => {
      if (!token) return;
      try {
        const r = await fetch(
          `${API_URL}/progress/teacher/module-students?module_id=${encodeURIComponent(moduleId)}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (!r.ok) {
          toast.error("Failed to load students for module.");
          return;
        }
        const data = await r.json();
        setSelectedModuleName(moduleName);
        setSelectedModuleId(String(data.moduleId ?? moduleId));
        setStudents((data.students ?? []) as TeacherStudentRow[]);
        setAppState("module-students");
        setActiveTab("students");
        setStudentsModalOpen(true);
      } catch {
        toast.error("Failed to load students for module.");
      }
    },
    [token],
  );

  const overrideCanvasGrade = useCallback(
    async (userid: string, postedGrade: string) => {
      if (!token) return;
      const grade = String(postedGrade ?? "").trim();
      if (!grade) {
        toast.error("Enter a grade first.");
        return;
      }
      try {
        const r = await fetch(`${API_URL}/pushback/override-grade`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            module_id: selectedModuleId,
            userid,
            posted_grade: grade,
          }),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          const msg = typeof data?.detail === "string" ? data.detail : "Canvas grade update failed.";
          toast.error(msg);
          return;
        }
        toast.success(`Updated Canvas grade for ${userid}.`);
      } catch {
        toast.error("Canvas grade update failed.");
      }
    },
    [token, selectedModuleId],
  );

  useEffect(() => {
    if (!token) return;
    loadModules();
  }, [token, loadModules]);

  const handleSelectModule = (moduleId: string, moduleName: string) => {
    const mid = String(moduleId ?? "").trim() || "1";
    setSelectedModuleName(moduleName);
    setSelectedModuleId(mid);
    loadStudents(mid, moduleName);
  };

  const handleCreateMasteryTest = (questions: Question[], moduleName: string) => {
    setMasteryTestQuestions(questions);
    setMasteryTestModule(moduleName);
    setAppState("mastery-test");
    setActiveTab("mastery");
  };

  const handleCloseStudentsModal = () => {
    setStudentsModalOpen(false);
    setSelectedModuleName(null);
    setStudents([]);
    setAppState("module-overview");
  };

  const handleBackFromMasteryTest = () => {
    setMasteryTestQuestions([]);
    setMasteryTestModule("");
    setAppState("module-overview");
    setActiveTab("overview");
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-[#800020] px-6 py-4 shadow-md">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="bg-yellow-400 h-10 w-10 rounded flex items-center justify-center">
              <span className="text-[#800020] font-bold text-lg">CSE</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">CSE 230 Computer Systems</h1>
              <p className="text-sm text-white/90">Professor analytics</p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={handleLogout}
            className="bg-transparent border-white text-white hover:bg-white hover:text-[#800020]"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <p className="text-gray-600 mb-6">
          Welcome, {user?.name ?? user?.email ?? "Professor"} — class performance and AI-generated mastery quizzes.
        </p>
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={backfillCanvasUsers}
            className="border-[#800020] text-[#800020] hover:bg-[#800020] hover:text-white"
          >
            Backfill Canvas user mappings
          </Button>
          {backfillStatus && <span className="text-sm text-gray-700">{backfillStatus}</span>}
        </div>
        {backfillReport && backfillReport.length > 0 && (
          <details className="mb-6 rounded border border-gray-200 bg-white p-4">
            <summary className="cursor-pointer text-sm font-semibold text-gray-900">
              View backfill log ({backfillReport.length} rows)
            </summary>
            <div className="mt-3 max-h-64 overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-gray-600">
                  <tr>
                    <th className="py-1 pr-3">userid</th>
                    <th className="py-1 pr-3">status</th>
                    <th className="py-1 pr-3">reason</th>
                    <th className="py-1 pr-3">canvas_user_id</th>
                  </tr>
                </thead>
                <tbody className="text-gray-900">
                  {backfillReport.map((r, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="py-1 pr-3">{String(r?.userid ?? "")}</td>
                      <td className="py-1 pr-3">{String(r?.status ?? "")}</td>
                      <td className="py-1 pr-3">{String(r?.reason ?? "")}</td>
                      <td className="py-1 pr-3">{r?.canvas_user_id ? String(r.canvas_user_id) : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="mb-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="students">Students</TabsTrigger>
            <TabsTrigger value="mastery">Mastery</TabsTrigger>
            <TabsTrigger value="modules">Modules</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <TeacherModuleSelector
              modules={modules}
              totalStudents={totalStudents}
              onSelectModule={() => {}}
              onCreateMasteryTest={() => {}}
              mode="overview"
            />
          </TabsContent>

          <TabsContent value="students">
            <div className="space-y-6">
              <TeacherModuleSelector
                modules={modules}
                totalStudents={totalStudents}
                onSelectModule={handleSelectModule}
                onCreateMasteryTest={() => {}}
                mode="students"
              />

              <div className="rounded border border-gray-200 bg-white p-6 text-sm text-gray-700">
                Click <strong className="text-gray-900">View Students</strong> on a module card to open the roster and
                Canvas grade tools in a centered window.
              </div>
            </div>
          </TabsContent>

          <TabsContent value="mastery">
            <div className="space-y-6">
              <MasteryCheckBuilder modules={modules} onCreateTest={handleCreateMasteryTest} />

              {appState === "mastery-test" && masteryTestQuestions.length > 0 ? (
                <MasteryTestView questions={masteryTestQuestions} moduleName={masteryTestModule} onBack={handleBackFromMasteryTest} />
              ) : (
                <div className="rounded border border-gray-200 bg-white p-6 text-sm text-gray-700">
                  Generate a quiz above to preview it here.
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="modules">
            <TeacherModuleManager token={token ?? ""} onBack={() => setActiveTab("overview")} />
          </TabsContent>
        </Tabs>
      </div>

      <Dialog
        open={studentsModalOpen}
        onOpenChange={(open) => {
          if (!open) handleCloseStudentsModal();
        }}
      >
        <DialogContent className="!w-[min(96vw,1400px)] !max-w-[min(96vw,1400px)] max-h-[min(92vh,900px)] overflow-y-auto p-5 sm:p-8">
          {selectedModuleName ? (
            <TeacherStudentsList
              variant="modal"
              moduleName={selectedModuleName}
              students={students}
              onBack={handleCloseStudentsModal}
              onOverrideGrade={overrideCanvasGrade}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Toaster />
    </div>
  );
}
