import {AppState,StudentLog} from '../types';
import {getDayBlocks,diaryBlock,blockLogs,combineBlockLogs,storeBlockLog} from './sessionBlocks';
import {sessionsOnDate} from './currentClass';
import {summarizeAttendance} from './attendance';
import {classroomName} from './studentNames';
export type SessionTarget={date:string;sessionId:string};
export type AnnotationKind='pos'|'regular'|'incident';
export const statuses=['present','late10','lateMore10','absent','pending'] as const;
export function attendanceEntry(previous:StudentLog|undefined,status:StudentLog['status']):StudentLog{
  if(!statuses.includes(status))throw Error('Assistència no vàlida.');
  return {...previous,status};
}
export function annotationEntry(previous:StudentLog|undefined,kind:AnnotationKind,text:string):StudentLog{
  if(!['pos','regular','incident'].includes(kind)||typeof text!=='string'||!text.trim()||text.length>10000)throw Error('Escriu una anotació vàlida (màxim 10.000 caràcters).');
  const next:StudentLog={status:'pending',...previous};
  const list=`${kind}Comments` as const,legacy=`${kind}Comment` as const;
  next[list]=[...(next[list]??(next[legacy]?[next[legacy]!]:[])),text.trim()];delete next[legacy];return next;
}
function resolve(state:AppState,target:SessionTarget){
  if(!sessionsOnDate(state,target.date).some(s=>s.id===target.sessionId))throw Error('La sessió no està disponible en aquesta data. Obre Àula per revisar l’horari.');
  const visual=getDayBlocks(state,target.date).find(b=>b.id===target.sessionId)!;
  const block=diaryBlock(state,visual,target.date),subject=state.subjects.find(s=>s.id===block.subjectId)!;
  const logs=blockLogs(state,block,target.date),combined=combineBlockLogs(block,target.date,logs);
  if(combined.conflicts.length)throw Error('Hi ha registres contradictoris. Unifica la sessió des d’Àula abans de continuar.');
  return {block,subject,log:combined.log};
}
export function getSessionSnapshot(state:AppState,target:SessionTarget){
  const {subject,log}=resolve(state,target);
  const students=subject.isGeneral?[]:subject.students.map(st=>{
    const entry=log.attendance[st.id];
    return {id:st.id,name:classroomName(st),officialName:st.name,status:entry?.status||'pending',annotations: Object.fromEntries((['pos','regular','incident'] as const).map(k=>[k,entry?.[`${k}Comments`]??(entry?.[`${k}Comment`]?[entry[`${k}Comment`]]:[])]))};
  });
  return {...target,subjectId:subject.id,name:subject.name,students,summary:summarizeAttendance(students.map(st=>({status:st.status}))),canAttend:!subject.isGeneral&&students.length>0};
}
function mutate(state:AppState,target:SessionTarget,studentIds:string[],fn:(entry:StudentLog|undefined)=>StudentLog){
  const {block,subject,log}=resolve(state,target);
  if(subject.isGeneral||!studentIds.length||studentIds.some(id=>!subject.students.some(st=>st.id===id)))throw Error('Alumne fora de la matrícula activa d’aquesta sessió.');
  const attendance={...log.attendance};for(const id of studentIds)attendance[id]=fn(attendance[id]);
  return storeBlockLog(state,block,target.date,{...log,attendance});
}
export function setStudentAttendance(state:AppState,target:SessionTarget,studentId:string,status:StudentLog['status']){return mutate(state,target,[studentId],prev=>attendanceEntry(prev,status));}
export function addStudentAnnotation(state:AppState,target:SessionTarget,studentId:string,kind:AnnotationKind,text:string){return mutate(state,target,[studentId],prev=>annotationEntry(prev,kind,text));}
export function markPendingStudentsPresent(state:AppState,target:SessionTarget){
  const {subject}=resolve(state,target);return mutate(state,target,subject.students.map(s=>s.id),prev=>!prev||prev.status==='pending'?attendanceEntry(prev,'present'):prev);
}
export function markAllPresent(state:AppState,target:SessionTarget){
  const {subject,log}=resolve(state,target);
  if(subject.students.some(s=>['absent','late10','lateMore10'].includes(log.attendance[s.id]?.status)))throw Error('Hi ha faltes o retards: fes servir «Marcar pendents com a presents».');
  return markPendingStudentsPresent(state,target);
}
