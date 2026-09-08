import {AppState} from '../types';
import {syncStudentRegistry} from './studentIdentity';

export function studentSubjects(state:AppState,id:string){
  const historical=new Set([
    ...state.sessionLogs.filter(l=>Object.hasOwn(l.attendance,id)).map(l=>l.subjectId),
    ...(state.activities||[]).filter(a=>Object.hasOwn(a.grades||{},id)).map(a=>a.subjectId),
    ...(state.termGradesRecords||[]).filter(r=>Object.hasOwn(r.students,id)).map(r=>r.subjectId),
    ...Object.entries(state.periodComments||{}).filter(([,periods])=>Object.values(periods).some(p=>Object.hasOwn(p,id))).map(([sid])=>sid),
  ]);
  return state.subjects.filter(s=>s.students.some(st=>st.id===id)||historical.has(s.id));
}

/** Withdraw only the enrolment. The canonical identity and all assessment/diary data survive. */
export function withdrawStudent(state:AppState,studentId:string,subjectId:string):AppState{
  const canonical=syncStudentRegistry(state);
  const subject=canonical.subjects.find(s=>s.id===subjectId);
  if(!subject?.students.some(st=>st.id===studentId))throw Error('L’alumne ja no està matriculat en aquesta assignatura.');
  return syncStudentRegistry({...canonical,
    subjects:canonical.subjects.map(s=>s.id===subjectId?{...s,students:s.students.filter(st=>st.id!==studentId)}:s),
    plans:canonical.plans.map(p=>p.subjectId===subjectId?{...p,seats:Object.fromEntries(Object.entries(p.seats).filter(([,id])=>id!==studentId))}:p),
  });
}
