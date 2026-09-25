import {AppState} from '../types';
import {getDayBlocks,minutes,blockLogs,diaryBlock} from './sessionBlocks';
import {getHolidayForDate,toIsoDate} from './dateHelpers';
export function sessionsOnDate(state:AppState,date:string){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||toIsoDate(new Date(date+'T12:00:00'))!==date||date<state.config.startDate||date>state.config.endDate||getHolidayForDate(date,state.config.holidays))return [];
  return getDayBlocks(state,date).filter(b=>state.subjects.some(s=>s.id===b.subjectId)).map(b=>{
    const subject=state.subjects.find(s=>s.id===b.subjectId)!;
    const notHeld=blockLogs(state,diaryBlock(state,b,date),date).some(log=>log.notHeld);
    return {notHeld,id:b.id,date,subjectId:b.subjectId,name:subject.name,startTime:b.startTime,endTime:b.endTime,canAttend:!notHeld&&!subject.isGeneral&&subject.students.length>0};
  });
}
export function getCurrentClassContext(state:AppState,now=new Date()){
  const date=toIsoDate(now),time=now.getHours()*60+now.getMinutes(),sessions=sessionsOnDate(state,date);
  const current=sessions.filter(s=>!s.notHeld&&minutes(s.startTime)<=time&&time<minutes(s.endTime));
  let next=sessions.find(s=>!s.notHeld&&minutes(s.startTime)>time)||null;
  // Bounded by the configured school year; also handles long holiday intervals.
  const day=new Date(now);day.setHours(12,0,0,0);
  for(let i=0;!next&&i<370;i++){
    day.setDate(day.getDate()+1);const d=toIsoDate(day);if(d>state.config.endDate)break;
    next=sessionsOnDate(state,d).find(s=>!s.notHeld)||null;
  }
  return {date,current,next,sessions};
}
