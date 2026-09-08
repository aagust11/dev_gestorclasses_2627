import {AppState} from '../types';
import {sourceCriterionId, preserveLegacyCriterionGrades} from './activityCriteria';

export type OrphanKind='criterion'|'schedule'|'session'|'attendance';
export type OrphanItem={key:string;kind:OrphanKind;parentId:string;childId?:string;fingerprint:string;title:string;reason:string;impact:string;details:[string,string][]};
export const orphanLabels:Record<OrphanKind,string>={criterion:'Criteris d’activitats',schedule:'Horari',session:'Sessions del diari',attendance:'Registres d’alumnes'};
const fieldLabels:Record<string,string>={status:'Assistència / estat',score:'Puntuació',rawScore:'Nota introduïda',maxScore:'Màxim',normalizedScore:'Equivalent /4',competencialScore:'Qualificació',comment:'Comentari',posComment:'Comentari positiu',regularComment:'Observació',incidentComment:'Incidència',posComments:'Comentaris positius',regularComments:'Observacions',incidentComments:'Incidències',estat:'Estat',puntuacio:'Puntuació',comentari:'Comentari'};
const valueLabels:Record<string,string>={present:'Present',absent:'Absent',pending:'Pendent',late10:'Retard de fins a 10 minuts',lateMore10:'Retard de més de 10 minuts',not_submitted:'No presentat',exempt:'Exempt'};
const readable=(value:unknown):string=>{
  if(value==null)return '—';
  if(typeof value==='string')return valueLabels[value]||value;
  if(Array.isArray(value))return value.map(readable).join('\n');
  if(typeof value==='object')return Object.entries(value).filter(([,v])=>v!==undefined).map(([k,v])=>`${fieldLabels[k]||k}: ${readable(v)}`).join('\n')||'Sense informació';
  return String(value);
};
export function findOrphanData(state:AppState):OrphanItem[]{
  const result:OrphanItem[]=[];
  const subjects=new Map(state.subjects.map(s=>[s.id,s.name]));
  const students=new Map([...Object.values(state.studentRegistry||{}),...state.subjects.flatMap(s=>s.students)].map(s=>[s.id,s.name]));
  const criteria=new Set(state.criteria.map(c=>c.id));
  const slots=new Set(state.config.timeSlots.map(s=>s.id));
  const schedule=new Set(state.schedule.map(s=>s.id));
  const subject=(id:string)=>subjects.get(id)||`Assignatura no disponible (${id})`;
  const student=(id:string)=>students.get(id)||`Alumne no disponible (${id})`;
  const add=(kind:OrphanKind,parentId:string,childId:string|undefined,data:unknown,title:string,reason:string,impact:string,details:[string,string][])=>result.push({kind,parentId,childId,key:JSON.stringify([kind,parentId,childId]),fingerprint:JSON.stringify([(state as any).workspaceGeneration,data]),title,reason,impact,details});
  for(const a of state.activities||[])for(const id of a.criteriaIds||[])if(!criteria.has(sourceCriterionId(a,id))){
    add('criterion',a.id,id,a,`${a.code||''} · ${a.title} · ${a.criteriaCustomLabels?.[id]||id}`,'El criteri original ja no existeix a la configuració.',
      'S’eliminarà aquest aspecte de l’activitat, la seva configuració i les seves puntuacions. Es conservaran l’activitat, els altres aspectes i els comentaris. Els càlculs automàtics poden canviar; les notes manuals es conserven.',
      [['Assignatura',subject(a.subjectId)],['Lliurament',a.endDate],['Descripció',a.description],['Identificador del criteri original',sourceCriterionId(a,id)],['Identificador de l’aspecte',id],['Pes',readable(a.criteriaWeights?.[id])],['Escala màxima',readable(a.criteriaMaxScores?.[id])],['Guia dels nivells',readable(a.criteriaRubrics?.[id])],...Object.entries(preserveLegacyCriterionGrades(a)).map(([sid,g]):[string,string]=>[student(sid),readable({estat:g.status,puntuacio:g.criteriaGrades?.[id],comentari:g.comment})])]);
  }
  for(const s of state.schedule)if(!slots.has(s.timeSlotId)){
    const logs=state.sessionLogs.filter(l=>l.scheduleItemId===s.id);
    add('schedule',s.id,undefined,[s,logs],`${subject(s.subjectId)} · ${['','Dilluns','Dimarts','Dimecres','Dijous','Divendres'][s.dayOfWeek]||s.dayOfWeek}`,'La franja horària ja no existeix.',
      `S’eliminarà només aquesta entrada de l’horari. Es conservaran ${logs.length} sessions del diari, que quedaran desvinculades i es podran revisar per separat.`,[['Franja',s.timeSlotId],['Identificador de l’horari',s.id],['Sessions conservades',logs.map(l=>`${l.date} · ${Object.keys(l.attendance).length} alumnes · ${l.comments||'Sense comentari'}`).join('\n')||'Cap']]);
  }
  for(const l of state.sessionLogs){
    const context:[string,string][]=[['Data',l.date],['Assignatura',subject(l.subjectId)],['Identificador de sessió',l.id],['Referència d’horari',l.scheduleItemId],['Comentari de sessió',l.comments],['Notes per a la sessió següent',l.nextSessionNotes||'']];
    if(!subjects.has(l.subjectId)||!schedule.has(l.scheduleItemId))add('session',l.id,undefined,l,`${l.date} · ${subject(l.subjectId)}`,[!subjects.has(l.subjectId)?'Assignatura inexistent.':'',!schedule.has(l.scheduleItemId)?'Entrada d’horari inexistent.':''].filter(Boolean).join(' '),
      `S’eliminarà aquesta sessió completa: comentaris i ${Object.keys(l.attendance).length} registres d’alumnes (assistència, puntuacions i incidències). Les altres sessions i les qualificacions d’activitats es conservaran.`,[...context,...Object.entries(l.attendance).map(([id,entry]):[string,string]=>[student(id),readable(entry)])]);
    for(const [id,entry] of Object.entries(l.attendance))if(!students.has(id))add('attendance',l.id,id,l,`${l.date} · ${subject(l.subjectId)} · ${student(id)}`,'Aquest identificador d’alumne no figura al catàleg ni als grups.',
      'S’eliminarà només el registre d’aquest alumne en aquesta sessió: assistència, puntuació i comentaris. Es conservaran la sessió, el seu comentari general i els altres alumnes.',[...context,['Identificador d’alumne',id],['Assistència, puntuació i comentaris',readable(entry)]]);
  }
  return result;
}

/** Resolve stable IDs against the latest state, never against an array position. */
export function removeOrphanData(state:AppState,reviewed:Pick<OrphanItem,'key'|'fingerprint'>):AppState{
  const item=findOrphanData(state).find(i=>i.key===reviewed.key);
  if(!item||item.fingerprint!==reviewed.fingerprint)throw Error('Aquesta dada ha canviat o ja està vinculada. Torna a obrir-ne el detall abans d’eliminar-la.');
  const next=structuredClone(state);
  if(item.kind==='session')next.sessionLogs=next.sessionLogs.filter(l=>l.id!==item.parentId);
  if(item.kind==='schedule')next.schedule=next.schedule.filter(s=>s.id!==item.parentId);
  if(item.kind==='attendance')delete next.sessionLogs.find(l=>l.id===item.parentId)!.attendance[item.childId!];
  if(item.kind==='criterion'){
    const a=next.activities!.find(a=>a.id===item.parentId)!;const id=item.childId!;
    a.grades=preserveLegacyCriterionGrades(a);
    a.criteriaIds=a.criteriaIds.filter(c=>c!==id);
    for(const map of [a.criteriaReferences,a.criteriaRubrics,a.criteriaWeights,a.criteriaMaxScores,a.criteriaGradingType,a.criteriaCustomLabels])if(map)delete map[id];
    for(const grade of Object.values(a.grades))if(grade.criteriaGrades)delete grade.criteriaGrades[id];
  }
  return next;
}
