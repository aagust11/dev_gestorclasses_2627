import {AppState,Student} from '../types';

export const newStudent = (name:string):Student => ({id:`student_${crypto.randomUUID()}`,name:name.trim()});
export function identityConflicts(state:AppState) {
  const occurrences=new Map<string,{subjectId:string;index:number;name:string}[]>();
  for(const s of state.subjects) s.students.forEach((st,index)=>{const a=occurrences.get(st.id)||[];a.push({subjectId:s.id,index,name:st.name});occurrences.set(st.id,a);});
  return [...occurrences].filter(([id,a])=>!id||new Set(a.map(x=>x.name.trim())).size>1||new Set(a.map(x=>x.subjectId)).size<a.length).map(([id,occurrences])=>({id,occurrences}));
}
// The registry owns identity; subject lists remain a compatibility projection of enrolments.
export function syncStudentRegistry(state:AppState):AppState {
  if(identityConflicts(state).length)return state;
  const registry={...state.studentRegistry};
  for(const s of state.subjects)for(const st of s.students)if(!registry[st.id])registry[st.id]={...st};
  const subjects=state.subjects.map(s=>{const students=s.students.map(st=>registry[st.id]);return students.every((st,i)=>st===s.students[i])?s:{...s,students};});
  return {...state,identityVersion:1,studentRegistry:registry,enrolments:Object.fromEntries(subjects.map(s=>[s.id,s.students.map(st=>st.id)])),subjects};
}
const moveKey=(obj:any,from:string,to:string)=>{if(!obj||!Object.hasOwn(obj,from)||from===to)return obj;if(Object.hasOwn(obj,to))throw Error('Hi ha dades de les dues identitats al mateix registre. Cal revisar-les abans de fusionar.');const result={...obj,[to]:obj[from]};delete result[from];return result;};
export function remapSubjectStudent(state:AppState,subjectId:string,from:string,to:string):AppState {
  return {...state,
    activities:state.activities?.map(a=>a.subjectId===subjectId?{...a,grades:moveKey(a.grades,from,to)}:a),
    sessionLogs:state.sessionLogs.map(l=>l.subjectId===subjectId?{...l,attendance:moveKey(l.attendance,from,to)}:l),
    termGradesRecords:state.termGradesRecords?.map(r=>r.subjectId===subjectId?{...r,students:moveKey(r.students,from,to)}:r),
    periodComments:{...state.periodComments,[subjectId]:Object.fromEntries(Object.entries(state.periodComments?.[subjectId]||{}).map(([period,comments])=>[period,moveKey(comments,from,to)]))},
    plans:state.plans.map(p=>p.subjectId===subjectId?{...p,seats:Object.fromEntries(Object.entries(p.seats).map(([seat,id])=>[seat,id===from?to:id]))}:p)};
}
// A user assigns every occurrence to a person, and names an owner for ambiguous data.
export function resolveIdentityConflict(state:AppState,id:string,assignments:Record<string,string>,people:Record<string,Student>,owners:Record<string,string>,profileOwner:string):AppState {
  const conflict=identityConflicts(state).find(c=>c.id===id);if(!conflict)throw Error('Conflicte inexistent');
  let next=structuredClone(state);
  const registry={...next.studentRegistry,...Object.fromEntries(Object.entries(people).filter(([key])=>Object.values(assignments).includes(key)))};delete registry[id];
  for(const sid of new Set(conflict.occurrences.map(o=>o.subjectId))){
    const occurrences=conflict.occurrences.filter(o=>o.subjectId===sid);
    const chosen=occurrences.map(o=>assignments[`${sid}:${o.index}`]);
    if(chosen.some(x=>!people[x]))throw Error('Cal assignar totes les files.');
    if(occurrences.length>1&&!owners[sid])throw Error('Cal assignar explícitament les dades compartides de l’assignatura.');
    const owner=owners[sid]||chosen[0];if(!chosen.includes(owner))throw Error('Cal indicar a qui corresponen les dades de cada assignatura.');
    next=remapSubjectStudent(next,sid,id,owner);
    next.subjects=next.subjects.map(s=>s.id===sid?{...s,students:s.students.map((st,i)=>st.id===id?people[assignments[`${sid}:${i}`]]:st).filter((st,i,a)=>a.findIndex(x=>x.id===st.id)===i)}:s);
  }
  const profiles={...next.studentProfiles};
  if(profiles[id]){
    if(profileOwner){if(!registry[profileOwner])throw Error('Destinatari del perfil invàlid');profiles[profileOwner]=profiles[id];}
    else next.identityArchive=[...(next.identityArchive||[]),{legacyId:id,profile:profiles[id]}];
    delete profiles[id];
  }
  return syncStudentRegistry({...next,studentProfiles:profiles,studentRegistry:registry});
}
export function mergeStudents(state:AppState,from:string,to:string):AppState {
  if(from===to||!state.studentRegistry?.[from]||!state.studentRegistry?.[to])throw Error('Selecciona dues identitats diferents.');
  let next=structuredClone(state);
  // Never choose between two populated profiles, grades or comments silently.
  const a=next.studentProfiles?.[from],b=next.studentProfiles?.[to];
  if(a&&b&&JSON.stringify(a)!==JSON.stringify(b)&&Object.values(a).some(Boolean)&&Object.values(b).some(Boolean))throw Error('Les dues fitxes tenen informació personal. Revisa i unifica el contingut abans de fusionar-les.');
  const subjectIds=new Set([...next.subjects.map(s=>s.id),...(next.activities||[]).map(a=>a.subjectId),...next.sessionLogs.map(l=>l.subjectId),...(next.termGradesRecords||[]).map(r=>r.subjectId),...next.plans.map(p=>p.subjectId),...Object.keys(next.periodComments||{})]);
  for(const subjectId of subjectIds){next=remapSubjectStudent(next,subjectId,from,to);}
  next.subjects=next.subjects.map(s=>({...s,students:s.students.map(st=>st.id===from?next.studentRegistry![to]:st).filter((st,i,arr)=>arr.findIndex(x=>x.id===st.id)===i)}));
  next.studentProfiles={...next.studentProfiles,[to]:Object.values(b||{}).some(Boolean)?b:a||b||{}};delete next.studentProfiles[from];
  delete next.studentRegistry![from];
  return syncStudentRegistry(next);
}
