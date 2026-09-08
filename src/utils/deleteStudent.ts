import {AppState} from '../types';
import {syncStudentRegistry} from './studentIdentity';

export function deleteStudent(state:AppState,id:string,typedName:string):AppState{
  const canonical=syncStudentRegistry(state);
  const student=canonical.studentRegistry?.[id];
  if(!student)throw Error('L’alumne ja no existeix.');
  if(typedName!==student.name)throw Error('Escriu el nom i cognoms exactament com apareixen a la fitxa.');
  const next=structuredClone(canonical);
  delete next.studentRegistry![id];
  if(next.studentProfiles)delete next.studentProfiles[id];
  next.identityArchive=next.identityArchive?.filter(entry=>entry.legacyId!==id);
  next.subjects.forEach(s=>{s.students=s.students.filter(st=>st.id!==id);});
  next.sessionLogs.forEach(l=>{delete l.attendance[id];});
  next.activities?.forEach(a=>{if(a.grades)delete a.grades[id];});
  next.termGradesRecords?.forEach(r=>{delete r.students[id];});
  Object.values(next.periodComments||{}).forEach(periods=>Object.values(periods).forEach(comments=>{delete comments[id];}));
  next.plans.forEach(p=>{p.seats=Object.fromEntries(Object.entries(p.seats).filter(([,studentId])=>studentId!==id));});
  return syncStudentRegistry(next);
}

export function prepareStudentDeletion(latest:AppState,reviewed:AppState,id:string,name:string):AppState{
  // Deletion spans every domain: a stale review must never erase newly entered data.
  const snapshot=(s:AppState)=>JSON.stringify(s,(_key,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().map(k=>[k,value[k]])):value);
  if(snapshot(latest)!==snapshot(reviewed))throw Error('Les dades han canviat des que has obert la confirmació. Cancel·la i torna a revisar l’eliminació.');
  const next=deleteStudent(latest,id,name);
  // Invalidate pending drafts in other tabs so they cannot recreate deleted records.
  return {...next,workspaceGeneration:crypto.randomUUID()} as AppState;
}
