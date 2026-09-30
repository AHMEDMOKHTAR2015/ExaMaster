import { QuizConfig } from './quiz-config';
import { Question } from './question';

export interface Quiz {
    id: number;
    name: string;
    description: string;
    config: QuizConfig;
    questions: Question[];
}

export interface HomeworkQuiz extends Quiz {
    educationalStageId: string;
    score: number;
    status: 'not-started' | 'in-progress' | 'completed' | 'overdue';
    startedAt: number;
    endedAt: number;
    correctCount: number;
    wrongCount: number;
}
