//PROF VIEW COMPONENT

import { Question } from '../types/quiz';
import { ModuleAnalytics } from '../types/teacher';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { MasteryCheckBuilder } from './MasteryCheckBuilder';

interface TeacherModuleSelectorProps {
  modules: ModuleAnalytics[];
  totalStudents: number;
  onSelectModule: (moduleName: string) => void;
  onCreateMasteryTest: (questions: Question[], moduleName: string) => void;
}

export function TeacherModuleSelector({ modules, totalStudents, onSelectModule, onCreateMasteryTest }: TeacherModuleSelectorProps) {
  // Calculate overall statistics
  const totalCompleted = modules.reduce((sum, m) => sum + m.completedStudents, 0);
  const avgCompletionRate = modules.length
    ? Math.round(modules.reduce((sum, m) => sum + m.completionRate, 0) / modules.length)
    : 0;
  const avgScore = modules.length
    ? Math.round(modules.reduce((sum, m) => sum + m.averageScore, 0) / modules.length)
    : 0;
  const highPerformingModules = modules.filter(m => m.averageScore >= 70).length;

  return (
    <div className="space-y-6">
      <div className="border-l-4 border-yellow-600 pl-4">
        <h1 className="text-[#800020]">Professor Analytics Dashboard</h1>
        <p className="text-gray-600">
          Arizona State University - CSE 230: Computer Org / Assemb Lang Prog
        </p>
      </div>

      {/* Overall Statistics */}
      <Card className="border-2 border-yellow-600 bg-amber-50/30 shadow-sm">
        <CardHeader className="border-b border-yellow-600/20">
          <CardTitle className="text-[#800020]">
            Class Performance Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-4 border-2 border-red-900/30 shadow-sm">
              <div className="text-2xl text-[#800020]">{totalStudents}</div>
              <div className="text-sm text-gray-600">Total Students</div>
            </div>
            <div className="bg-white rounded-lg p-4 border-2 border-yellow-600/30 shadow-sm">
              <div className="text-2xl text-yellow-700">{avgCompletionRate}%</div>
              <div className="text-sm text-gray-600">Avg Completion</div>
              <Progress value={avgCompletionRate} className="h-2 mt-2" />
            </div>
            <div className="bg-white rounded-lg p-4 border-2 border-green-600/30 shadow-sm">
              <div className="text-2xl text-green-600">{avgScore}%</div>
              <div className="text-sm text-gray-600">Avg Score</div>
              <Progress value={avgScore} className="h-2 mt-2" />
            </div>
            <div className="bg-white rounded-lg p-4 border-2 border-green-600/30 shadow-sm">
              <div className="text-2xl text-green-600">{highPerformingModules}</div>
              <div className="text-sm text-gray-600">Modules ≥70%</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Module Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {modules.map(module => {
          const completionStatus = 
            module.completionRate >= 80 ? 'high' :
            module.completionRate >= 60 ? 'medium' : 'low';
          
          const scoreStatus =
            module.averageScore >= 70 ? 'high' :
            module.averageScore >= 60 ? 'medium' : 'low';

          return (
            <Card 
              key={module.moduleName} 
              className={`shadow-sm ${
                completionStatus === 'high' ? 'border-l-4 border-l-green-600' :
                completionStatus === 'medium' ? 'border-l-4 border-l-yellow-600' :
                'border-l-4 border-l-red-600'
              }`}
            >
              <CardHeader>
                  <CardTitle className="text-[#800020]">
                  {module.moduleName}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Completion Rate */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-700">Completion Rate</span>
                    <Badge 
                      className={
                        completionStatus === 'high' ? 'bg-green-600' :
                        completionStatus === 'medium' ? 'bg-yellow-600' :
                        'bg-red-600'
                      }
                    >
                      {module.completedStudents}/{module.totalStudents} students
                    </Badge>
                  </div>
                  <Progress value={module.completionRate} className="h-2" />
                  <span className="text-xs text-gray-500">{module.completionRate}% completed</span>
                </div>

                {/* Average Score */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-700">Average Score</span>
                    <Badge 
                      className={
                        scoreStatus === 'high' ? 'bg-green-600' :
                        scoreStatus === 'medium' ? 'bg-yellow-600' :
                        'bg-red-600'
                      }
                    >
                      {module.averageScore}%
                    </Badge>
                  </div>
                  <Progress value={module.averageScore} className="h-2" />
                </div>

                <Button 
                  onClick={() => onSelectModule(module.moduleName)} 
                  variant="default"
                  className="w-full !bg-[#800020] !text-white hover:!bg-[#5f0018] focus-visible:!ring-[#800020]/30"
                >
                  View Students
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Question Generator Section */}
      <MasteryCheckBuilder modules={modules} onCreateTest={onCreateMasteryTest} />
    </div>
  );
}