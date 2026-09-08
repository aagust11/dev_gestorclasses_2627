import {periodGrades} from './gradeSelectors';
import {studentSubjects} from './studentEnrolment';
import { AppState, CalculationMode, Subject, StudentLog } from '../types';
import { calculateCompetencialTermGrades, calculateNumericTermGrades, filterActivitiesForPeriod } from './gradeCalculations';

export function studentPeriodGrade(state:AppState, subject:Subject, studentId:string, periodId:string, mode:CalculationMode, automatic=false) {
  return periodGrades(state,subject,periodId,mode,automatic)[studentId];
}
export const sessionComments=(log:StudentLog,kind:'pos'|'regular'|'incident'):string[]=>log[`${kind}Comments`] ?? (log[`${kind}Comment`] ? [log[`${kind}Comment`]] : []);
export function studentSessionHistory(state:AppState,studentId:string,periodId='annual',subjectId='all') {
  const subjects=studentSubjects(state,studentId);
  const term=state.config.terms.find(t=>t.id===periodId);
  return state.sessionLogs.filter(log=>subjects.some(s=>s.id===log.subjectId) && (subjectId==='all'||subjectId===log.subjectId) && (periodId==='annual'||!!term&&log.date>=term.startDate&&log.date<=term.endDate))
    .flatMap(log=>log.attendance[studentId]?[{...log,studentLog:log.attendance[studentId]}]:[])
    .sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
}

export function hasStudentSupport(state:AppState,studentId:string):boolean {
  const profile=state.studentProfiles?.[studentId];
  return !!(profile?.psi?.trim()||profile?.supportMeasures?.trim());
}
