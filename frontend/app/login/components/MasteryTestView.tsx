//PROF VIEW COMPONENT

import { useState } from 'react';
import { Question } from '../types/quiz';
import { QuizCard } from './QuizCard';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { ChevronLeft, ChevronRight, Send, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Badge } from './ui/badge';

interface MasteryTestViewProps {
  questions: Question[];
  moduleName: string;
  onBack: () => void;
}

export function MasteryTestView({ questions, moduleName, onBack }: MasteryTestViewProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(new Array(questions.length).fill(null));
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);

  const currentQuestion = questions[currentQuestionIndex];
  const currentAnswer = answers[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
  
  const canGoNext = currentQuestionIndex < questions.length - 1;
  const canGoPrev = currentQuestionIndex > 0;
  const allAnswered = answers.every(a => a !== null);

  const handleNext = () => {
    if (canGoNext) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrev = () => {
    if (canGoPrev) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleAnswerChange = (questionIndex: number, answer: number) => {
    const newAnswers = [...answers];
    newAnswers[questionIndex] = answer;
    setAnswers(newAnswers);
  };

  const handleSubmit = () => {
    let correct = 0;
    questions.forEach((question, index) => {
      if (answers[index] === question.correctAnswer) {
        correct++;
      }
    });
    const calculatedScore = (correct / questions.length) * 100;
    setScore(calculatedScore);
    setSubmitted(true);
  };

  if (submitted && score !== null) {
    return (
      <div className="space-y-6">
        <Button
          variant="outline"
          onClick={onBack}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Button>

        <Card className="border-2 border-green-600">
          <CardHeader className="border-b border-green-600/20 bg-green-50/50">
            <CardTitle className="flex items-center gap-2 text-green-900">
              <CheckCircle2 className="w-6 h-6" />
              Mastery Test Completed
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-center space-y-6">
              <div>
                <p className="text-gray-600 mb-2">Your Score</p>
                <div className="text-6xl text-green-600 mb-2">
                  {score.toFixed(1)}%
                </div>
                <p className="text-gray-600">
                  {answers.filter((ans, idx) => ans === questions[idx].correctAnswer).length} out of {questions.length} correct
                </p>
              </div>

              <div className="grid gap-4 max-w-2xl mx-auto">
                {questions.map((question, index) => {
                  const isCorrect = answers[index] === question.correctAnswer;
                  return (
                    <div
                      key={question.id}
                      className={`p-4 rounded-lg border-2 ${
                        isCorrect ? 'border-green-600 bg-green-50' : 'border-red-600 bg-red-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`flex items-center justify-center w-8 h-8 rounded-full text-white ${
                          isCorrect ? 'bg-green-600' : 'bg-red-600'
                        }`}>
                          {index + 1}
                        </div>
                        <div className="flex-1 text-left space-y-2">
                          <p className="text-red-900">{question.question}</p>
                          <div className="flex flex-wrap gap-2 text-sm">
                            <span className={isCorrect ? 'text-green-700' : 'text-red-700'}>
                              Your answer: {question.options[answers[index] ?? 0]}
                            </span>
                            {!isCorrect && (
                              <span className="text-green-700">
                                • Correct: {question.options[question.correctAnswer]}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <Button onClick={onBack} size="lg" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Return to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={onBack}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Button>
        <Badge className="bg-red-900 text-lg px-4 py-2">
          Mastery Test: {moduleName}
        </Badge>
      </div>

      <Card className="shadow-sm border-2 border-yellow-600">
        <CardContent className="pt-6">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-red-900">
                Progress: {answers.filter(a => a !== null).length} / {questions.length} answered
              </span>
              <span className="text-sm text-gray-600">
                Question {currentQuestionIndex + 1} of {questions.length}
              </span>
            </div>
            <Progress value={progress} className="h-3" />
          </div>
        </CardContent>
      </Card>

      <QuizCard
        question={currentQuestion}
        questionNumber={currentQuestionIndex + 1}
        totalQuestions={questions.length}
        selectedAnswer={currentAnswer}
        onAnswerSelect={(answer) => handleAnswerChange(currentQuestionIndex, answer)}
      />

      <div className="flex justify-between items-center gap-4">
        <Button
          variant="outline"
          onClick={handlePrev}
          disabled={!canGoPrev}
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Previous
        </Button>

        <div className="flex gap-2 flex-wrap justify-center">
          {questions.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentQuestionIndex(index)}
              className={`w-8 h-8 rounded-full text-sm transition-colors ${
                index === currentQuestionIndex
                  ? 'bg-red-900 text-white shadow-md'
                  : answers[index] !== null
                  ? 'bg-yellow-600 text-white'
                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
            >
              {index + 1}
            </button>
          ))}
        </div>

        {canGoNext ? (
          <Button
            onClick={handleNext}
            className="!bg-[#800020] !text-white hover:!bg-[#5f0018] focus-visible:!ring-[#800020]/30"
          >
            Next
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        ) : (
          <Button 
            onClick={handleSubmit} 
            disabled={!allAnswered}
            className="bg-green-600 hover:bg-green-700"
          >
            <Send className="w-4 h-4 mr-2" />
            Submit Test
          </Button>
        )}
      </div>

      {!allAnswered && currentQuestionIndex === questions.length - 1 && (
        <Card className="border-l-4 border-l-yellow-600 bg-yellow-50/50">
          <CardContent className="py-3">
            <p className="text-sm text-red-900 text-center">
              Please answer all questions before submitting.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
