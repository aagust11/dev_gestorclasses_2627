import {AppState,Student} from '../types';
import {syncStudentRegistry} from './studentIdentity';

// name remains the official name, preserving existing reports and JSON files.
export const classroomName=(student:Student)=>student.preferredName?.trim()||student.name;
export const searchableStudentName=(student:Student)=>`${student.name} ${student.preferredName||''}`;
export function updateStudentNames(state:AppState,id:string,name:string,preferredName:string):AppState{
  name=name.trim();preferredName=preferredName.trim();
  if(!name)throw Error('El nom oficial no pot quedar buit.');
  const current=syncStudentRegistry(state),student=current.studentRegistry?.[id];
  if(!student)throw Error('L’alumne ja no existeix. Torna a obrir la fitxa.');
  const updated={...student,name,preferredName};
  return syncStudentRegistry({...current,studentRegistry:{...current.studentRegistry,[id]:updated},subjects:current.subjects.map(s=>({...s,students:s.students.map(st=>st.id===id?updated:st)}))});
}
