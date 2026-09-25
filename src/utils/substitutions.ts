import {AppState,ScheduleSubstitution} from '../types';
import {getHolidayForDate,toIsoDate} from './dateHelpers';
import {getDayBlocks,minutes} from './sessionBlocks';
import {substitutionMembers} from './substitutionTargets';
/** Exactly the same lesson geometry as the timetable; grid ticks are not lessons. */
export function substitutionSlots(state:AppState,date:string){
 const original={...state,config:{...state.config,substitutions:[]}};
 return getDayBlocks(original,date).filter(b=>state.subjects.some(s=>s.id===b.subjectId)).map(b=>({...b,name:state.subjects.find(s=>s.id===b.subjectId)!.name}));
}
export function addSubstitution(state:AppState,input:Omit<ScheduleSubstitution,'id'|'replacedScheduleItemIds'> & {scheduleItemId?:string}):AppState{
 const {date,timeSlotId}=input;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||toIsoDate(new Date(date+'T12:00:00'))!==date||date<state.config.startDate||date>state.config.endDate||getHolidayForDate(date,state.config.holidays))throw Error('Tria un dia lectiu dins del curs.');
 const block=substitutionSlots(state,date).find(b=>input.scheduleItemId?b.id===input.scheduleItemId:b.timeSlotId===timeSlotId);
 if(!block)throw Error('Tria una classe de l’horari vigent del dia seleccionat.');
 if(!Number.isFinite(minutes(block.startTime))||!Number.isFinite(minutes(block.endTime))||minutes(block.endTime)<=minutes(block.startTime))throw Error('Defineix primer les hores d’aquesta classe a Configuració → Franges i Horari.');
 if(state.config.substitutions?.some(s=>s.date===date&&substitutionMembers(state,s).some(id=>block.memberIds.includes(id))))throw Error('Aquesta classe ja té un canvi. Elimina’l abans de crear-ne un altre.');
 if(input.type==='subject'&&!state.subjects.some(s=>s.id===input.subjectId&&!s.isParent))throw Error('Tria una assignatura activa, no un grup mare.');
 if(input.type==='other'&&!input.customReason?.trim())throw Error('Indica el motiu de la substitució.');
 const slot={id:'slot_'+crypto.randomUUID(),name:block.startTime+'–'+block.endTime,startTime:block.startTime,endTime:block.endTime};
 const replacement:ScheduleSubstitution={id:'sub_'+crypto.randomUUID(),date,timeSlotId:slot.id,type:input.type,replacedScheduleItemIds:[...block.memberIds],...(input.type==='subject'?{subjectId:input.subjectId}:{customReason:input.customReason!.trim()})};
 // Original timetable and logs stay intact. Removing the replacement restores them.
 return {...state,config:{...state.config,timeSlots:[...state.config.timeSlots,slot],substitutions:[...(state.config.substitutions||[]),replacement]}};
}
