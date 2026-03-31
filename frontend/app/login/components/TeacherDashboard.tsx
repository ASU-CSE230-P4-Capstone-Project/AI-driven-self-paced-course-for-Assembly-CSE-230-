"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../hooks/useAuth";
import { Button } from "./ui/button";
import { LogOut } from "lucide-react";
import { Question } from "../types/quiz";
import { TeacherModuleSelector } from "./TeacherModuleSelector";
import { MasteryTestView } from "./MasteryTestView";
import { Toaster } from "./ui/sonner";
import TeacherStudentsList, { type TeacherStudentRow } from "./TeacherStudentsList";
import type { ModuleAnalytics } from "../types/teacher";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type AppState = "module-overview" | "module-students" | "mastery-test";

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

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  const parseModuleId = (moduleName: string) => {
    const m = moduleName.match(/^Module\s+(\d+)/i);
    return m ? m[1] : null;
  };

  const loadModules = useCallback(async () => {
    if (!token) return;
    const r = await fetch(`${API_URL}/progress/teacher/modules`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return;
    const data = await r.json();
    setTotalStudents(data.totalStudents ?? 0);
    setModules((data.modules ?? []) as ModuleAnalytics[]);
  }, [token]);

  const loadStudents = useCallback(
    async (moduleId: string, moduleName: string) => {
      if (!token) return;
      const r = await fetch(
        `${API_URL}/progress/teacher/module-students?module_id=${encodeURIComponent(moduleId)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!r.ok) return;
      const data = await r.json();
      setSelectedModuleName(moduleName);
      setSelectedModuleId(String(data.moduleId ?? moduleId));
      setStudents((data.students ?? []) as TeacherStudentRow[]);
      setAppState("module-students");
    },
    [token],
  );

  useEffect(() => {
    if (!token) return;
    loadModules();
  }, [token, loadModules]);

  const handleSelectModule = (moduleName: string) => {
    const moduleId = parseModuleId(moduleName) ?? "1";
    setSelectedModuleName(moduleName);
    setSelectedModuleId(moduleId);
    loadStudents(moduleId, moduleName);
  };

  const handleCreateMasteryTest = (questions: Question[], moduleName: string) => {
    setMasteryTestQuestions(questions);
    setMasteryTestModule(moduleName);
    setAppState("mastery-test");
  };

  const handleBackToModules = () => {
    setSelectedModuleName(null);
    setStudents([]);
    setAppState("module-overview");
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

        {appState === "module-overview" && (
          <TeacherModuleSelector
            modules={modules}
            totalStudents={totalStudents}
            onSelectModule={handleSelectModule}
            onCreateMasteryTest={handleCreateMasteryTest}
          />
        )}

        {appState === "module-students" && selectedModuleName && (
          <TeacherStudentsList
            moduleName={selectedModuleName}
            students={students}
            onBack={handleBackToModules}
          />
        )}

        {appState === "mastery-test" && masteryTestQuestions.length > 0 && (
          <MasteryTestView
            questions={masteryTestQuestions}
            moduleName={masteryTestModule}
            onBack={handleBackToModules}
          />
        )}
      </div>

      <Toaster />
    </div>
  );
}
