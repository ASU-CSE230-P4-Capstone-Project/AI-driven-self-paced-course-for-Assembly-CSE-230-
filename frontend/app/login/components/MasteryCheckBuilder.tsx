//PROF VIEW COMPONENT

import { useState } from "react";
import { ModuleAnalytics } from "../types/teacher";
import { Question } from "../types/quiz";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Button } from "./ui/button";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface MasteryCheckBuilderProps {
  modules: ModuleAnalytics[];
  onCreateTest: (questions: Question[], moduleName: string) => void;
}

function parseModuleId(moduleName: string): string | null {
  const m = moduleName.match(/^Module\s+(\d+)/i);
  return m ? m[1] : null;
}

type ApiQuizChoice = { id: string; text: string; isCorrect: boolean };
type ApiQuizQuestion = {
  id: string;
  prompt: string;
  choices: ApiQuizChoice[];
  hint?: string;
};

function quizResponseToQuestions(
  questions: ApiQuizQuestion[],
  moduleName: string
): Question[] {
  return questions.map((q) => {
    const correctIdx = q.choices.findIndex((c) => c.isCorrect);
    return {
      id: String(q.id),
      question: q.prompt,
      options: q.choices.map((c) => c.text),
      correctAnswer: correctIdx >= 0 ? correctIdx : 0,
      topic: q.prompt.length > 48 ? `${q.prompt.slice(0, 45)}…` : q.prompt,
      subTopic: moduleName,
      module: moduleName,
    };
  });
}

export function MasteryCheckBuilder({ modules, onCreateTest }: MasteryCheckBuilderProps) {
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [selectedModule, setSelectedModule] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const selectedModuleData = modules.find((m) => m.moduleName === selectedModule);

  const handleCreateTest = async () => {
    if (!selectedModule) {
      toast.error("Select a module first.");
      return;
    }
    const moduleId = parseModuleId(selectedModule);
    if (!moduleId) {
      toast.error("Could not read module number from the selection.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/fetch/quiz`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module_id: moduleId,
          num_questions: questionCount,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(typeof data.detail === "string" ? data.detail : "Quiz generation failed");
      }
      const raw = data.questions as ApiQuizQuestion[] | undefined;
      if (!raw?.length) {
        throw new Error("No questions returned from the API.");
      }
      const questions = quizResponseToQuestions(raw, selectedModule);
      onCreateTest(questions, selectedModule);
      toast.success(`Generated ${questions.length} questions via CreateAI (quiz path).`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate quiz.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-2 border-yellow-600 shadow-sm">
      <CardHeader className="border-b border-yellow-600/20">
        <CardTitle className="text-red-900">Question Generator</CardTitle>
        <CardDescription>
          Uses the backend <code className="text-xs">POST /fetch/quiz</code> CreateAI path (separate from the student AI
          Tutor). Set optional <code className="text-xs">CREATEAI_QUIZ_MODEL_*</code> env vars to use a lighter model for
          quizzes.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="question-count" className="text-red-900">
              Number of questions
            </Label>
            <Input
              id="question-count"
              type="number"
              min={5}
              max={50}
              value={questionCount}
              onChange={(e) =>
                setQuestionCount(Math.max(5, Math.min(50, parseInt(e.target.value, 10) || 5)))
              }
              className="border-gray-300"
            />
            <p className="text-xs text-gray-500">5–50 (minimum 5 questions per mastery).</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="module-select" className="text-red-900">
              Select module
            </Label>
            <Select value={selectedModule} onValueChange={setSelectedModule}>
              <SelectTrigger id="module-select" className="border-gray-300">
                <SelectValue placeholder="Choose a module..." />
              </SelectTrigger>
              <SelectContent>
                {modules.map((module) => (
                  <SelectItem key={module.moduleName} value={module.moduleName}>
                    {module.moduleName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              {selectedModuleData?.questions.length ?? 0} analytics questions on file for this module
            </p>
          </div>
        </div>

        <div className="border-2 border-yellow-600/50 rounded-lg bg-gradient-to-br from-amber-50 to-yellow-50 p-6">
          <div className="space-y-3">
                <h3 className="text-red-900">CreateAI mastery quiz</h3>
            <p className="text-sm text-gray-700">
              Generates fresh multiple-choice items for preview in the mastery test view (for demos or classroom use).
            </p>
            <Button
              type="button"
              onClick={handleCreateTest}
              disabled={loading || !selectedModule}
              className="bg-[#800020] hover:bg-[#600018] text-white"
            >
              {loading ? "Generating…" : "Generate mastery quiz"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
