"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { ComponentProps } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Progress } from "./ui/progress";

export type TeacherStudentRow = {
  userid: string;
  best_score_pct: number;
  last_score_pct: number;
  attempts: number;
  grade: string;
};

type TeacherStudentsListProps = {
  moduleName: string;
  students: TeacherStudentRow[];
  onBack: () => void;
};

export default function TeacherStudentsList({
  moduleName,
  students,
  onBack,
}: TeacherStudentsListProps) {
  const completedCount = useMemo(() => students.filter((s) => (s.attempts ?? 0) > 0).length, [students]);
  const totalCount = students.length;
  const completionPct = totalCount === 0 ? 0 : Math.round((100 * completedCount) / totalCount);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Button variant="outline" onClick={onBack}>
          Back to Modules
        </Button>
        <div className="flex-1 border-l-4 border-yellow-600 pl-4">
          <h1 className="text-[#800020]">{moduleName}</h1>
          <p className="text-gray-600 text-sm">
            Student grades based on mastery quiz completion
          </p>
        </div>
        <Link href="/login/teacher" className="hidden" />
      </div>

      <Card className="border-2 border-yellow-600 bg-amber-50/30 shadow-sm">
          <CardHeader className="border-b border-yellow-600/20">
          <CardTitle className="text-[#800020]">Class Completion</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              {completedCount}/{totalCount} completed
            </div>
            <div className="text-sm font-semibold text-[#800020]">{completionPct}%</div>
          </div>
          <Progress value={completionPct} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-[#800020]">All Students</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Table className="text-gray-900">
            <TableHeader>
              <TableRow>
                <TableHead className="text-[#800020] font-semibold">Student</TableHead>
                <TableHead className="text-[#800020] font-semibold">Best %</TableHead>
                <TableHead className="text-[#800020] font-semibold">Last %</TableHead>
                <TableHead className="text-[#800020] font-semibold">Attempts</TableHead>
                <TableHead className="text-[#800020] font-semibold">Grade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((s) => (
                <TableRow key={s.userid}>
                  <TableCell className="font-medium text-gray-900">{s.userid}</TableCell>
                  <TableCell className="text-gray-900">{Math.round(s.best_score_pct)}%</TableCell>
                  <TableCell className="text-gray-900">{Math.round(s.last_score_pct)}%</TableCell>
                  <TableCell className="text-gray-900">{s.attempts}</TableCell>
                  <TableCell className="text-gray-900">
                    <span
                      className={`inline-flex items-center rounded px-2 py-1 text-xs font-semibold ${
                        s.grade === "A"
                          ? "bg-green-600 text-white"
                          : s.grade === "B"
                            ? "bg-yellow-600 text-white"
                            : s.grade === "C"
                              ? "bg-orange-500 text-white"
                              : s.grade === "D"
                                ? "bg-red-600 text-white"
                                : "bg-gray-200 text-gray-800"
                      }`}
                    >
                      {s.grade}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
              {!students.length && (
                <TableRow>
                  <TableCell colSpan={5} className="text-gray-900">
                    No students found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

