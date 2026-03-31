//PROF VIEW COMPONENT

import { Question } from '../types/quiz';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Label } from './ui/label';

interface QuizCardProps {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  selectedAnswer: number | null;
  onAnswerSelect: (answer: number) => void;
  showResult?: boolean;
}

export function QuizCard({
  question,
  questionNumber,
  totalQuestions,
  selectedAnswer,
  onAnswerSelect,
  showResult = false
}: QuizCardProps) {
  return (
    <Card className="w-full shadow-sm">
      <CardHeader className="bg-gradient-to-r from-gray-50 to-white border-b">
        <CardDescription className="text-gray-800">
          Question {questionNumber} of {totalQuestions} • {question.topic}{question.subTopic ? ` - ${question.subTopic}` : ''}
        </CardDescription>
        <CardTitle className="text-gray-900">{question.question}</CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <RadioGroup
          value={selectedAnswer?.toString()}
          onValueChange={(value) => onAnswerSelect(parseInt(value))}
        >
          <div className="space-y-3">
            {question.options.map((option, index) => {
              const isCorrect = index === question.correctAnswer;
              const isSelected = index === selectedAnswer;
              
              let className = "flex items-center space-x-2 p-4 rounded-lg border-2 cursor-pointer transition-colors";
              
              if (showResult) {
                if (isCorrect) {
                  className += " border-green-500 bg-green-50";
                } else if (isSelected && !isCorrect) {
                  className += " border-red-500 bg-red-50";
                } else {
                  className += " border-gray-200 bg-white";
                }
              } else {
                className += isSelected 
                  ? " border-[#800020] bg-amber-50" 
                  : " border-gray-200 bg-white hover:border-[#800020]/40";
              }
              
              return (
                <div key={index} className={className}>
                  <RadioGroupItem
                    value={index.toString()}
                    id={`option-${index}`}
                    disabled={showResult}
                    className="!border-gray-400 !text-[#800020] data-[state=checked]:!border-[#800020]"
                  />
                  <Label 
                    htmlFor={`option-${index}`} 
                    className="flex-1 cursor-pointer text-gray-900"
                  >
                    {option}
                  </Label>
                </div>
              );
            })}
          </div>
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
