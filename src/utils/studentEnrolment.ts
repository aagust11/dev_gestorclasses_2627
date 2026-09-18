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


/** Applies only to new enrolments during an edit; never migrates or rewrites imported history. */
export function exemptExistingActivities(previous:AppState,next:AppState):AppState{
 const added=new Map(next.subjects.map(s=>[s.id,s.students.filter(st=>!previous.subjects.find(old=>old.id===s.id)?.students.some(x=>x.id===st.id)).map(st=>st.id)]));
 const existing=new Set((previous.activities||[]).map(a=>a.id));
 let changed=false;
 const activities=next.activities?.map(a=>{
  const ids=(added.get(a.subjectId)||[]).filter(id=>!Object.hasOwn(a.grades||{},id));
  if(!existing.has(a.id)||!ids.length)return a;
  changed=true;return {...a,grades:{...a.grades,...Object.fromEntries(ids.map(id=>[id,{status:'exempt' as const}]))}};
 });
 return changed?{...next,activities}:next;
}

/** Reuse the canonical pupil and retain all existing history when enrolling. */
export function enrolStudent(state:AppState,studentId:string,subjectId:string):AppState{
 const canonical=syncStudentRegistry(state),student=canonical.studentRegistry?.[studentId];
 const subject=canonical.subjects.find(s=>s.id===subjectId);
 if(!student)throw Error('L’alumne ja no existeix al catàleg.');
 if(!subject||subject.isGeneral||subject.isParent)throw Error('Selecciona una assignatura que admeti alumnat.');
 if(subject.students.some(s=>s.id===studentId))return state;
 const next={...canonical,subjects:canonical.subjects.map(s=>s.id===subjectId?{...s,students:[...s.students,student]}:s)};
 return syncStudentRegistry(exemptExistingActivities(canonical,next));
}
