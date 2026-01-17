
import { Exam, Question, QuestionType, QuestionResult, ResultRelease } from './types';
import { sanitize } from './securityService';
import { gradeTheoryAnswer } from './geminiService';

export const calculateGrading = async (
  exam: Exam, 
  answers: Record<string, string>, 
  aiEnabled: boolean = true
): Promise<{
  questionResults: Record<string, QuestionResult>;
  rawScore: number;
  negativeDeduction: number;
}> => {
  const questionResults: Record<string, QuestionResult> = {};
  let totalScore = 0;
  let wrongAnswerCount = 0;

  for (const q of exam.questions) {
    const studentAnswer = sanitize(answers[q.id] || '');
    
    if (q.type === QuestionType.THEORY) {
      // Use AI only if enabled, otherwise fallback to keyword analysis
      const res = await gradeTheoryAnswer(
        q.text, 
        studentAnswer, 
        q.correctAnswer, 
        q.points,
        aiEnabled
      );
      
      questionResults[q.id] = { 
        score: res.score, 
        feedback: sanitize(res.feedback), 
        isCorrect: res.score > (q.points * 0.5) 
      };
      totalScore += res.score;
    } else {
      const isCorrect = studentAnswer.trim().toUpperCase() === q.correctAnswer.trim().toUpperCase();
      const score = isCorrect ? q.points : 0;
      
      if (!isCorrect && studentAnswer.trim() !== '') {
        wrongAnswerCount++;
      }
      
      questionResults[q.id] = { score, isCorrect };
      totalScore += score;
    }
  }

  const calculatedPenalty = exam.gradingPolicy.negativeMarkingEnabled 
    ? Math.min(wrongAnswerCount * exam.gradingPolicy.negativeMarksPerQuestion, exam.gradingPolicy.maxNegativeDeduction)
    : 0;

  return { 
    questionResults, 
    rawScore: totalScore, 
    negativeDeduction: calculatedPenalty 
  };
};

export const getFinalScore = (raw: number, negative: number, late: number) => {
  return Math.max(0, raw - negative - late);
};
