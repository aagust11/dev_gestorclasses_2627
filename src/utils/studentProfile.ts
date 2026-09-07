import { AppState, CalculationMode, Subject, StudentLog } from '../types';
import { calculateCompetencialTermGrades, calculateNumericTermGrades, filterActivitiesForPeriod } from './gradeCalculations';

export function studentPeriodGrade(state:AppState, subject:Subject, studentId:string, periodId:string, mode:CalculationMode, automatic=false) {
  const record=state.termGradesRecords?.find(r=>r.id===`${subject.id}_${periodId}_${mode}`) || (mode==='mean'?state.termGradesRecords?.find(r=>r.id===`${subject.id}_${periodId}`):undefined);
  const existing=automatic || record?.cleared ? undefined : record?.students;
  const activities=filterActivitiesForPeriod(state.activities||[],subject.id,periodId,state.config.terms);
  const competencies=state.competencies.filter(c=>c.subjectId===subject.id||c.subjectId===subject.parentId);
  const criteria=state.criteria.filter(c=>competencies.some(ce=>ce.id===c.competencyId));
  // Calculate only this student, preserving the same overrides as the gradebook.
  const scoped={...subject,students:subject.students.filter(s=>s.id===studentId)};
  const competencyGrades=calculateCompetencialTermGrades(scoped,activities,competencies,criteria,existing,mode)[studentId];
  if(subject.evaluationType!=='numeric')return competencyGrades;
  const numericGrades=calculateNumericTermGrades(scoped,activities,existing,mode)[studentId];
  return numericGrades ? {...numericGrades,criteria:competencyGrades.criteria,competencies:competencyGrades.competencies} : undefined;
}
export const sessionComments=(log:StudentLog,kind:'pos'|'regular'|'incident'):string[]=>log[`${kind}Comments`] ?? (log[`${kind}Comment`] ? [log[`${kind}Comment`]] : []);
export function studentSessionHistory(state:AppState,studentId:string,periodId='annual',subjectId='all') {
  const subjects=state.subjects.filter(s=>s.students.some(st=>st.id===studentId));
  const term=state.config.terms.find(t=>t.id===periodId);
  return state.sessionLogs.filter(log=>subjects.some(s=>s.id===log.subjectId) && (subjectId==='all'||subjectId===log.subjectId) && (periodId==='annual'||!!term&&log.date>=term.startDate&&log.date<=term.endDate))
    .flatMap(log=>log.attendance[studentId]?[{...log,studentLog:log.attendance[studentId]}]:[])
    .sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
}

export function hasStudentSupport(state:AppState,studentId:string):boolean {
  const profile=state.studentProfiles?.[studentId];
  return !!(profile?.psi?.trim()||profile?.supportMeasures?.trim());
}
