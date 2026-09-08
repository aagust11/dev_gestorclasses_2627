import {AppState,StudentLog,Subject} from '../types';
import {studentSubjects} from './studentEnrolment';
import {getProgrammedSessionsForSubject,toIsoDate} from './dateHelpers';
export const attendanceLabels={present:'Present',late10:'Retard ≤10 min',lateMore10:'Retard >10 min',absent:'Falta',pending:'Pendent'};
export function summarizeAttendance(logs:(StudentLog|undefined)[]) {
  let present=0,late=0,absent=0;
  for(const log of logs){if(log?.status==='present')present++;else if(log?.status==='late10'||log?.status==='lateMore10'){present++;late++;}else if(log?.status==='absent')absent++;}
  const recorded=present+absent;
  return {present,late,absent,recorded,pending:logs.length-recorded,total:logs.length,rate:recorded?Math.round(present/recorded*100):null};
}
const caches=new WeakMap<Subject,{refs:unknown[];values:Map<string,Record<string,ReturnType<typeof summarizeAttendance>>>}>();
export function subjectAttendance(state:AppState,subject:Subject,periodId='annual',today=toIsoDate(new Date())) {
  const refs=[state.sessionLogs,state.schedule,state.config.startDate,state.config.endDate,state.config.terms,state.config.holidays,state.config.timeSlots,state.config.substitutions];
  let entry=caches.get(subject);if(!entry||!refs.every((r,i)=>r===entry.refs[i])){entry={refs,values:new Map()};caches.set(subject,entry);}
  const key=JSON.stringify([periodId,today]);const cached=entry.values.get(key);if(cached)return cached;
  const term=periodId==='annual'?state.config:state.config.terms.find(t=>t.id===periodId);
  const rows=new Map<string,Record<string,StudentLog>>();
  if(term){const end=term.endDate<today?term.endDate:today;
    if(term.startDate<=end){
      for(const session of getProgrammedSessionsForSubject(state,subject.id,term.startDate,end))rows.set(`${session.scheduleItemId}_${session.date}`,{});
      for(const log of state.sessionLogs)if(log.subjectId===subject.id&&log.date>=term.startDate&&log.date<=end)rows.set(`${log.scheduleItemId}_${log.date}`,log.attendance||{});
    }
  }
  const result=Object.fromEntries(subject.students.map(st=>[st.id,summarizeAttendance([...rows.values()].map(row=>row[st.id]))]));entry.values.set(key,result);return result;
}
export function studentAttendance(state:AppState,studentId:string,periodId='annual',subjectId='all',today=toIsoDate(new Date())) {
  const term=periodId==='annual'?state.config:state.config.terms.find(t=>t.id===periodId);
  const summaries=studentSubjects(state,studentId).filter(s=>!s.isGeneral&&!s.isParent&&(subjectId==='all'||s.id===subjectId)).map(s=>s.students.some(st=>st.id===studentId)?subjectAttendance(state,s,periodId,today)[studentId]:summarizeAttendance(state.sessionLogs.filter(l=>l.subjectId===s.id&&term&&l.date>=term.startDate&&l.date<=term.endDate&&l.date<=today&&Object.hasOwn(l.attendance,studentId)).map(l=>l.attendance[studentId])));
  const result={present:0,late:0,absent:0,recorded:0,pending:0,total:0,rate:null as number|null};
  for(const item of summaries)for(const key of ['present','late','absent','recorded','pending','total'] as const)result[key]+=item[key];
  result.rate=result.recorded?Math.round(result.present/result.recorded*100):null;return result;
}
