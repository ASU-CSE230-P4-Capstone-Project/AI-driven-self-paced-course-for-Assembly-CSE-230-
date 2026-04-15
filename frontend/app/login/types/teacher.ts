// frontend/app/login/types/teacher.ts

/**
 * Question-level analytics data
 */
export interface QuestionAnalytics {
  questionId: string;
  question: string;
  accuracy: number; // Percentage (0-100)
  totalAttempts: number;
  correctAnswers: number;
  topic: string;
  subTopic?: string;
}

/**
 * Module-level analytics data
 */
export interface ModuleAnalytics {
  moduleId: string;
  moduleName: string;
  questions: QuestionAnalytics[];
  completedStudents: number;
  totalStudents: number;
  completionRate: number; // Percentage (0-100)
  averageScore: number; // Percentage (0-100)
}

