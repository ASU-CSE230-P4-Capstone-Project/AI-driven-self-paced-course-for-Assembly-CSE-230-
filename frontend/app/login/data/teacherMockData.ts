// frontend/app/login/data/teacherMockData.ts

import { ModuleAnalytics } from "../types/teacher";

/**
 * Teacher dashboard data structure
 */
export interface TeacherDashboardData {
  modules: ModuleAnalytics[];
  totalStudents: number;
}

/**
 * Get mock teacher dashboard data
 * In production, this would come from an API
 */
export function getTeacherDashboardData(): TeacherDashboardData {
  return {
    totalStudents: 45,
    modules: [
      {
        moduleId: "1",
        moduleName: "Module 1: Introduction to Computer Architecture",
        questions: [],
        completedStudents: 38,
        totalStudents: 45,
        completionRate: 84,
        averageScore: 72,
      },
      {
        moduleId: "2",
        moduleName: "Module 2: MIPS Introduction, ALU and Data Transfer",
        questions: [],
        completedStudents: 35,
        totalStudents: 45,
        completionRate: 78,
        averageScore: 68,
      },
      {
        moduleId: "3",
        moduleName: "Module 3: Branch Instructions and Machine Code",
        questions: [],
        completedStudents: 32,
        totalStudents: 45,
        completionRate: 71,
        averageScore: 70,
      },
      {
        moduleId: "4",
        moduleName: "Module 4: Functions and Procedures",
        questions: [],
        completedStudents: 28,
        totalStudents: 45,
        completionRate: 62,
        averageScore: 65,
      },
      {
        moduleId: "5",
        moduleName: "Module 5: Arrays and Pointers",
        questions: [],
        completedStudents: 30,
        totalStudents: 45,
        completionRate: 67,
        averageScore: 67,
      },
    ],
  };
}

