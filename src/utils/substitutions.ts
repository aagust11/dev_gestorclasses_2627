import {AppState,ScheduleSubstitution} from '../types';
import {getHolidayForDate,toIsoDate} from './dateHelpers';
export function substitutionSlots(state:AppState,date:string){
 const weekday=new Date(date+'T12:00:00').getDay();
 return state.config.timeSlots.filter(ts=>state.schedule.some(s=>s.timeSlotId===ts.id&&s.dayOfWeek===weekday)).sort((a,b)=>(a.startTime||'').localeCompare(b.startTime||''));
}
export function addSubstitution(state:AppState,input:Omit<ScheduleSubstitution,'id'>):AppState{
 const {date,timeSlotId}=input;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||toIsoDate(new Date(date+'T12:00:00'))!==date||date<state.config.startDate||date>state.config.endDate||getHolidayForDate(date,state.config.holidays))throw Error('Tria un dia lectiu dins del curs.');
 if(!substitutionSlots(state,date).some(s=>s.id===timeSlotId))throw Error('Tria una franja de l’horari vigent del dia seleccionat.');
 if(state.config.substitutions?.some(s=>s.date===date&&s.timeSlotId===timeSlotId))throw Error('Aquesta franja ja té un canvi. Elimina’l abans de crear-ne un altre.');
 if(input.type==='subject'&&!state.subjects.some(s=>s.id===input.subjectId&&!s.isParent))throw Error('Tria una assignatura activa, no un grup mare.');
 if(input.type==='other'&&!input.customReason?.trim())throw Error('Indica el motiu del canvi.');
 const originalIds=state.schedule.filter(s=>s.timeSlotId===timeSlotId&&s.dayOfWeek===new Date(date+'T12:00:00').getDay()).map(s=>s.id);
 if(state.sessionLogs.some(l=>l.date===date&&originalIds.some(id=>l.scheduleItemId===id||l.blockMemberIds?.includes(id))))throw Error('Aquesta sessió ja té un registre. Per indicar que no s’ha fet, obre-la i marca «Classe no feta»: així conservaràs l’històric.');
 return {...state,config:{...state.config,substitutions:[...(state.config.substitutions||[]),{...input,id:'sub_'+crypto.randomUUID()}]}};
}
