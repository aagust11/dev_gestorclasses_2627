import {AppState,SessionLog,StudentLog} from '../types';

export const minutes=(time:string)=>{if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))return NaN;const [h,m]=time.split(':').map(Number);return h*60+m;};
export const clock=(value:number)=>String(Math.floor(value/60)).padStart(2,'0')+':'+String(value%60).padStart(2,'0');
export type SessionBlock={id:string;subjectId:string;memberIds:string[];timeSlotId:string;startTime:string;endTime:string;substitution:boolean;reason?:string};
export function getDayBlocks(state:AppState,date:string):SessionBlock[]{
  const day=new Date(date+'T12:00:00').getDay();
  const slots=new Map(state.config.timeSlots.map(s=>[s.id,s]));
  const substitutions=(state.config.substitutions||[]).filter(s=>s.date===date);
  const entries:SessionBlock[]=[];
  for(const item of state.schedule.filter(s=>s.dayOfWeek===day)){
    if(substitutions.some(s=>s.timeSlotId===item.timeSlotId))continue;
    const slot=slots.get(item.timeSlotId);
    entries.push({id:item.id,subjectId:item.subjectId,memberIds:[item.id],timeSlotId:item.timeSlotId,startTime:slot?.startTime||'',endTime:slot?.endTime||'',substitution:false});
  }
  for(const sub of substitutions){const slot=slots.get(sub.timeSlotId);entries.push({id:sub.id,subjectId:sub.type==='subject'?sub.subjectId||'':'',memberIds:[sub.id],timeSlotId:sub.timeSlotId,startTime:slot?.startTime||'',endTime:slot?.endTime||'',substitution:true,reason:sub.type==='other'?sub.customReason:undefined});}
  // Once saved, a block retains the original members and times for that date.
  const frozen:SessionBlock[]=[];const used=new Set<string>();
  for(const log of state.sessionLogs.filter(l=>l.date===date&&l.blockMemberIds?.length)){
    const match=entries.find(e=>e.memberIds.some(id=>log.blockMemberIds!.includes(id)));
    if(!match)continue;
    const ids=log.blockMemberIds!.filter(id=>entries.some(e=>e.id===id));
    ids.forEach(id=>used.add(id));
    frozen.push({...match,id:log.scheduleItemId,subjectId:log.subjectId,memberIds:ids,startTime:log.startTime||match.startTime,endTime:log.endTime||match.endTime});
  }
  const remaining=entries.filter(e=>!used.has(e.id)).sort((a,b)=>(minutes(a.startTime)||0)-(minutes(b.startTime)||0)||a.id.localeCompare(b.id));
  const blocks:SessionBlock[]=[];
  for(const entry of remaining){
    const prev=blocks[blocks.length-1];
    const interrupted=entries.some(e=>e.id!==entry.id&&!prev?.memberIds.includes(e.id)&&minutes(e.startTime)<minutes(entry.endTime)&&minutes(e.endTime)>minutes(prev?.startTime||''));
    if(prev&&prev.subjectId&&prev.subjectId===entry.subjectId&&!prev.substitution&&!entry.substitution&&prev.endTime===entry.startTime&&Number.isFinite(minutes(entry.startTime))&&!interrupted){
      prev.memberIds.push(entry.id);prev.endTime=entry.endTime;
    }else blocks.push({...entry,memberIds:[...entry.memberIds]});
  }
  return [...frozen,...blocks].map(block=>{
    const logs=state.sessionLogs.filter(l=>l.date===date&&l.subjectId===block.subjectId&&block.memberIds.includes(l.scheduleItemId));
    if(logs.length===1)return {...block,id:logs[0].scheduleItemId};
    return block;
  }).sort((a,b)=>(minutes(a.startTime)||0)-(minutes(b.startTime)||0)||a.id.localeCompare(b.id));
}

/** General teaching actions share a diary by subject and date, without merging timetable geometry. */
export function diaryBlock(state:AppState,block:SessionBlock,date:string):SessionBlock{
  if(!state.subjects.find(s=>s.id===block.subjectId)?.isGeneral)return block;
  const blocks=getDayBlocks(state,date).filter(b=>b.subjectId===block.subjectId);
  const first=blocks[0]||block;
  const historical=state.sessionLogs.filter(l=>l.date===date&&l.subjectId===block.subjectId);
  return {...first,memberIds:[...new Set([...blocks.flatMap(b=>b.memberIds),...historical.map(l=>l.scheduleItemId)])],startTime:'',endTime:''};
}

export function blockLogs(state:AppState,block:SessionBlock,date:string){
  return state.sessionLogs.filter(l=>l.date===date&&l.subjectId===block.subjectId&&block.memberIds.includes(l.scheduleItemId))
    .sort((a,b)=>block.memberIds.indexOf(a.scheduleItemId)-block.memberIds.indexOf(b.scheduleItemId)||a.id.localeCompare(b.id));
}
export type AttendanceConflict={studentId:string;statuses:StudentLog['status'][];scores:(number|null)[]};
export function combineBlockLogs(block:SessionBlock,date:string,logs:SessionLog[]){
  const conflicts:AttendanceConflict[]=[];
  const attendance:Record<string,StudentLog>={};
  const ids=[...new Set(logs.flatMap(l=>Object.keys(l.attendance||{})))];
  for(const id of ids){
    const parts=logs.flatMap(l=>l.attendance?.[id]?[l.attendance[id]]:[]);
    const statuses=[...new Set(parts.map(p=>p.status||'pending').filter(s=>s!=='pending'))];
    const scores=[...new Set(parts.map(p=>p.score).filter((s):s is number=>s!=null))];
    const merged:StudentLog={...parts[0],status:statuses.length===1?statuses[0]:'pending'};
    if(scores.length===1)merged.score=scores[0];else delete merged.score;
    for(const kind of ['pos','regular','incident'] as const){
      const comments=parts.flatMap(p=>p[`${kind}Comments`]??(p[`${kind}Comment`]?[p[`${kind}Comment`]!]:[]));
      delete merged[`${kind}Comment`];if(comments.length)merged[`${kind}Comments`]=comments;
    }
    attendance[id]=merged;
    if(statuses.length>1||scores.length>1)conflicts.push({studentId:id,statuses,scores});
  }
  const join=(key:'comments'|'nextSessionNotes')=>logs.map(l=>l[key]||'').filter(Boolean).join('\n\n');
  const log:SessionLog={...(logs[0]||{}),id:logs.length===1?logs[0].id:`${block.id}_${date}`,scheduleItemId:block.id,subjectId:block.subjectId,date,comments:join('comments'),nextSessionNotes:join('nextSessionNotes'),attendance,blockMemberIds:[...block.memberIds],startTime:block.startTime||undefined,endTime:block.endTime||undefined};
  return {log,conflicts};
}
const cache=new WeakMap<AppState,{refs:unknown[];logs:SessionLog[]}>();
export function effectiveSessionLogs(state:AppState):SessionLog[]{
  const refs=[state.sessionLogs,state.schedule,state.config.timeSlots,state.config.substitutions,state.subjects];
  const cached=cache.get(state);if(cached&&refs.every((r,i)=>r===cached.refs[i]))return cached.logs;
  const consumed=new Set<string>();const result:SessionLog[]=[];
  for(const date of new Set(state.sessionLogs.map(l=>l.date))){
    for(const visualBlock of getDayBlocks(state,date)){
      const block=diaryBlock(state,visualBlock,date);
      const logs=blockLogs(state,block,date).filter(l=>!consumed.has(l.id));if(!logs.length)continue;
      logs.forEach(l=>consumed.add(l.id));
      const general=state.subjects.find(s=>s.id===block.subjectId)?.isGeneral;
      const merged=logs.length===1&&!general?logs[0]:combineBlockLogs(block,date,logs).log;
      if(general){delete merged.blockMemberIds;delete merged.startTime;delete merged.endTime;}
      result.push(merged);
    }
  }
  result.push(...state.sessionLogs.filter(l=>!consumed.has(l.id)));cache.set(state,{refs,logs:result});return result;
}
export function storeBlockLog(state:AppState,block:SessionBlock,date:string,log:SessionLog):AppState{
  const old=blockLogs(state,block,date);const ids=new Set(old.map(l=>l.id));
  const next={...log,scheduleItemId:block.id,subjectId:block.subjectId,date,blockMemberIds:[...block.memberIds],startTime:block.startTime||undefined,endTime:block.endTime||undefined};
  if(state.subjects.find(s=>s.id===block.subjectId)?.isGeneral){delete next.blockMemberIds;delete next.startTime;delete next.endTime;}
  return {...state,sessionLogs:[...state.sessionLogs.filter(l=>!ids.has(l.id)),next]};
}
export function timetableSettings(state:AppState){
  const times=state.config.timeSlots.flatMap(s=>[s.startTime,s.endTime]).filter((s):s is string=>!!s&&Number.isFinite(minutes(s))).sort();
  return state.config.timetable||{startTime:times[0]||'08:00',endTime:times[times.length-1]||'18:00',slotMinutes:30};
}
export function saveTimetableEntry(state:AppState,input:{id?:string;subjectId:string;dayOfWeek:number;startTime:string;endTime:string}):AppState{
  const start=minutes(input.startTime),end=minutes(input.endTime);
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)throw Error('L’hora final ha de ser posterior a la inicial.');
  if(!Number.isInteger(input.dayOfWeek)||input.dayOfWeek<1||input.dayOfWeek>5)throw Error('Dia no vàlid.');
  if(!state.subjects.some(s=>s.id===input.subjectId&&!s.isParent))throw Error('Selecciona una assignatura o acció docent.');
  const previous=input.id?state.schedule.find(s=>s.id===input.id):undefined;
  if(input.id&&!previous)throw Error('L’activitat ja no existeix. Torna a obrir l’horari.');
  if(previous&&state.sessionLogs.some(l=>l.scheduleItemId===previous.id||l.blockMemberIds?.includes(previous.id))&&(previous.subjectId!==input.subjectId||previous.dayOfWeek!==input.dayOfWeek))throw Error('Aquest bloc té històric. Conserva el dia i l’assignatura; crea una activitat nova per al canvi.');
  for(const item of state.schedule.filter(s=>s.dayOfWeek===input.dayOfWeek&&s.id!==input.id)){
    const slot=state.config.timeSlots.find(s=>s.id===item.timeSlotId);
    if(slot?.startTime&&slot.endTime&&start<minutes(slot.endTime)&&end>minutes(slot.startTime))throw Error('L’activitat se solapa amb una altra del mateix dia.');
  }
  const slotId='slot_'+crypto.randomUUID(),id=previous?.id||'schedule_'+crypto.randomUUID();
  // Keep old slots: substitutions and historical references may still need them.
  const slot={id:slotId,name:input.startTime+'–'+input.endTime,startTime:input.startTime,endTime:input.endTime};
  const config={...state.config,timeSlots:[...state.config.timeSlots,slot]};
  const item={id,dayOfWeek:input.dayOfWeek,subjectId:input.subjectId,timeSlotId:slotId};
  if(previous&&state.config.substitutions?.some(s=>s.timeSlotId===previous.timeSlotId))throw Error('Aquesta franja té substitucions configurades. Revisa-les abans de canviar-la.');
  // Freeze existing session bounds before changing their timetable source.
  const sessionLogs=state.sessionLogs.map(l=>{
    if(!previous)return l;
    const block=getDayBlocks(state,l.date).find(b=>b.memberIds.includes(previous.id)&&b.memberIds.includes(l.scheduleItemId));
    if(block&&blockLogs(state,block,l.date).length>1)throw Error('Unifica primer els registres de les hores consecutives abans de canviar-ne l’horari.');
    return block?{...l,blockMemberIds:l.blockMemberIds||block.memberIds,startTime:l.startTime||block.startTime,endTime:l.endTime||block.endTime}:l;
  });
  return {...state,config,sessionLogs,schedule:previous?state.schedule.map(s=>s.id===id?item:s):[...state.schedule,item]};
}
