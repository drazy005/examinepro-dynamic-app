import { Exam, Question, Submission } from '@prisma/client';

export interface GradeResult {
    score: number;
    questionResults: Record<string, { score: number; isCorrect: boolean }>;
    status: 'GRADED' | 'PENDING_MANUAL_REVIEW';
    graded: boolean;
    totalPoints: number;
    maxScore: number;
}

/**
 * Calculates the score for a submission based on the exam and answers.
 * Handles MCQ, SBA, and THEORY question types.
 */
export function calculateGrade(exam: Exam & { questions: Question[] }, answers: Record<string, any>, existingQuestionResults: Record<string, any> = {}): GradeResult {
    let totalScore = 0;
    const questionResults: Record<string, { score: number; isCorrect: boolean }> = {};
    let requiresManualGrading = false;
    let maxScore = 0;

    for (const q of exam.questions) {
        const userAnswer = answers[q.id];
        const result = { score: 0, isCorrect: false };
        maxScore += q.points;

        if (q.type === 'MCQ' || q.type === 'SBA') {
            // Loose comparison: trim whitespace and ensure string comparison, CASE INSENSITIVE
            const normalizedUser = String(userAnswer || '').trim().toLowerCase();
            const normalizedCorrect = String(q.correctAnswer || '').trim().toLowerCase();

            if (normalizedUser === normalizedCorrect && normalizedUser !== '') {
                result.score = q.points;
                result.isCorrect = true;
                totalScore += q.points;
            }
        } else if (q.type === 'THEORY') {
            // Check for existing manual grade
            const existing = existingQuestionResults[q.id];
            if (existing && typeof existing.score === 'number') {
                result.score = existing.score;
                result.isCorrect = existing.isCorrect || (result.score >= q.points / 2); // Heuristic if isCorrect missing
                totalScore += result.score;
            } else {
                result.score = 0;
                requiresManualGrading = true;
            }
        }

        questionResults[q.id] = result;
    }

    return {
        score: totalScore,
        questionResults,
        status: requiresManualGrading ? 'PENDING_MANUAL_REVIEW' : 'GRADED',
        graded: !requiresManualGrading,
        totalPoints: maxScore, // Return the maximum possible points for the exam
        maxScore
    };
}
