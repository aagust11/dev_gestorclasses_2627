import {AppState,ScheduleSubstitution,SessionLog} from '../types';
/** Explicit block members for new replacements; old JSONs still use their slot. */
export function substitutionMembers(state:AppState,sub:ScheduleSubstitution):string[]{
 return sub.replacedScheduleItemIds||state.schedule.filter(s=>s.timeSlotId===sub.timeSlotId&&s.dayOfWeek===new Date(sub.date+'T12:00:00').getDay()).map(s=>s.id);
}
export function isReplacedLog(state:AppState,log:SessionLog):boolean{
 const removed=new Set((state.config.substitutions||[]).filter(s=>s.date===log.date).flatMap(s=>substitutionMembers(state,s)));
 return (log.blockMemberIds?.length?log.blockMemberIds:[log.scheduleItemId]).every(id=>removed.has(id));
}
