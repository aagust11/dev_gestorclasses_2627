import { CurricularActivity, EvalCriterion, RubricDescriptions } from '../types';

// Existing activities use the criterion ID as the occurrence ID. New occurrences
// get independent IDs, so repeating a criterion never shares a student's grade.
export function sourceCriterionId(activity: CurricularActivity, occurrenceId: string): string {
  return activity.criteriaReferences?.[occurrenceId] ?? occurrenceId;
}

export function criterionRubric(activity: CurricularActivity, occurrenceId: string, criterion?: EvalCriterion): RubricDescriptions {
  return { ...criterion?.rubric, ...activity.criteriaRubrics?.[occurrenceId] };
}

export function preserveLegacyCriterionGrades(activity?: CurricularActivity) {
  if (!activity) return {};
  const grades = structuredClone(activity.grades || {});
  if (!activity.criteriaIds?.length) return grades;
  for (const grade of Object.values(grades)) {
    if (grade.criteriaGrades) continue;
    grade.criteriaGrades = {};
    for (const id of activity.criteriaIds) {
      if (activity.criteriaReferences?.[id]) continue;
      if (grade.competencialScore && (activity.numericGradingType === 'competencial' || typeof grade.score !== 'number')) {
        grade.criteriaGrades[id] = { competencialScore: grade.competencialScore };
      } else if (typeof grade.score === 'number') {
        grade.criteriaGrades[id] = { normalizedScore: grade.score / 10 * 4 };
      }
    }
  }
  return grades;
}
