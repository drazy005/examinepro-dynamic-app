
import { Exam, Submission, Question, QuestionType, GradingStatus, QuestionResult } from './types';

export const gradingService = {
  gradeSubmission: (exam: Exam, answers: Record<string, string>): {
    score: number;
    totalPoints: number;
    questionResults: Record<string, QuestionResult>;
    gradingStatus: GradingStatus;
  } => {
    let rawScore = 0;
    let totalPoints = 0;
    const questionResults: Record<string, QuestionResult> = {};
    let requiresManualGrading = false;

    exam.questions.forEach(q => {
      const userAnswer = answers[q.id];
      const isIncorrect = !userAnswer; // unanswered counts as incorrect for now

      // Calculate total possible points
      totalPoints += q.points;

      if (q.type === QuestionType.THEORY) {
        // Theory questions require manual review
        requiresManualGrading = true;
        questionResults[q.id] = {
          score: 0, // Placeholder until graded
          isCorrect: false,
          feedback: "Requires manual grading"
        };
      } else {
        // Auto-grade MCQ/SBA
        // Standardize strings for comparison (trim, case-insensitive if needed, though usually IDs/Options are exact)
        const isCorrect = userAnswer === q.correctAnswer;

        let score = 0;
        if (isCorrect) {
          score = q.points;
        } else if (exam.gradingPolicy.negativeMarkingEnabled && userAnswer) {
          // Apply negative marking for wrong answers (not unanswered)
          score = -exam.gradingPolicy.negativeMarksPerQuestion;
        }

        rawScore += score;
        questionResults[q.id] = {
          score,
          isCorrect,
          feedback: isCorrect ? "Correct" : "Incorrect"
        };
      }
    });

    // Ensure score doesn't drop below 0 if not allowed (optional, but good practice)
    // For now we allow negative if that's the policy, but usually total exam score >= 0
    const finalScore = Math.max(0, rawScore);

    return {
      score: finalScore,
      totalPoints,
      questionResults,
      gradingStatus: requiresManualGrading ? GradingStatus.PENDING_MANUAL_REVIEW : GradingStatus.GRADED
    };
  }
};
