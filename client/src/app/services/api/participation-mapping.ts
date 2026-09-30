import { ParticipationAnswer, ParticipationRecord, ParticipationValidation } from '../../models';
import { ApiParticipation, ApiParticipationAnswer, ApiParticipationSummary, ApiValidationStatus, idString } from './api-models';

/**
 * The API's participations → the app's `ParticipationRecord`. Only submitted
 * attempts exist on the server, so every record is `completed`. A bank quiz
 * keeps its id in `quizId`; a teacher quiz has `0` there, as it always did.
 */
export function toParticipationRecord(participation: ApiParticipationSummary): ParticipationRecord {
  return {
    ...common(participation),
    validation: participation.validationStatus
      ? { status: toValidationStatus(participation.validationStatus), validatedBy: '', validatedAt: 0 }
      : undefined
  };
}

/** One attempt in full, with the teacher's verdict and every answer. */
export function toParticipationDetail(participation: ApiParticipation): ParticipationRecord {
  return {
    ...common(participation),
    parentId: idString(participation.parentId),
    stageId: idString(participation.stageId) ?? '',
    gradeId: idString(participation.gradeId),
    validation: participation.validation ? toValidation(participation.validation) : undefined,
    resultsAvailable: participation.resultsAvailable,
    metadata: { answers: participation.answers.map(toAnswer) }
  };
}

function common(participation: ApiParticipationSummary | ApiParticipation): ParticipationRecord {
  return {
    id: String(participation.id),
    type: participation.type === 'Homework' ? 'homework' : 'quiz',
    quizId: participation.bankQuizId ?? 0,
    quizName: participation.quizName,
    homeworkId: idString(participation.homeworkId),
    homeworkTitle: participation.homeworkTitle ?? undefined,
    childId: String(participation.childId),
    teacherId: idString(participation.reviewerId) ?? null,
    stageId: '',
    classId: idString(participation.classId) ?? '',
    score: participation.score,
    status: 'completed',
    startedAt: new Date(participation.startedOn).getTime(),
    endedAt: new Date(participation.endedOn).getTime(),
    correctCount: participation.correctCount,
    wrongCount: participation.wrongCount,
    scorePercent: participation.scorePercent,
    pendingReviewCount: participation.pendingReviewCount
  };
}

const toValidationStatus = (status: ApiValidationStatus): ParticipationValidation['status'] =>
  status === 'Rejected' ? 'rejected' : 'approved';

function toValidation(validation: NonNullable<ApiParticipation['validation']>): ParticipationValidation {
  return {
    status: toValidationStatus(validation.status),
    feedback: validation.feedback ?? undefined,
    validatedBy: String(validation.validatedById),
    validatedAt: new Date(validation.validatedOn).getTime()
  };
}

function toAnswer(answer: ApiParticipationAnswer): ParticipationAnswer {
  return {
    questionId: answer.questionId,
    questionName: answer.questionName,
    selectedOptionId: answer.selectedOptionId,
    selectedOptionText: answer.selectedOptionText,
    correctOptionId: answer.correctOptionId,
    correctOptionText: answer.correctOptionText,
    isCorrect: answer.isCorrect,
    blanks: answer.blanks ?? undefined,
    responseText: answer.responseText,
    referenceAnswer: answer.referenceAnswer,
    weightPercent: answer.weightPercent,
    earnedPercent: answer.earnedPercent,
    requiresReview: answer.requiresReview,
    manualGrade: answer.manualGrade
      ? {
          awardedPercent: answer.manualGrade.awardedPercent,
          comment: answer.manualGrade.comment ?? undefined,
          gradedBy: String(answer.manualGrade.gradedById),
          gradedAt: new Date(answer.manualGrade.gradedOn).getTime()
        }
      : undefined
  };
}
