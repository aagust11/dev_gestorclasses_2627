import {AppState} from '../types';
import {SessionBlock,blockLogs,diaryBlock,combineBlockLogs} from './sessionBlocks';

/** Read existing records only: opening a session does not mean attendance was taken. */
export function sessionIndicators(state:AppState,visual:SessionBlock,date:string){
  const subject=state.subjects.find(s=>s.id===visual.subjectId);
  const block=diaryBlock(state,visual,date);
  const logs=blockLogs(state,block,date);
  const hasDiary=logs.some(log=>Boolean(log.comments?.trim()));
  const attendance=logs.length?combineBlockLogs(block,date,logs).log.attendance:{};
  const students=subject?.isGeneral?[]:subject?.students||[];
  const notHeld=logs.some(log=>log.notHeld);
  const recorded=notHeld?0:students.filter(student=>['present','absent','late10','lateMore10'].includes(attendance[student.id]?.status)).length;
  return {hasDiary,notHeld,notHeldReason:logs.find(log=>log.notHeld)?.notHeldReason||'',recorded,total:notHeld?0:students.length,complete:!notHeld&&students.length>0&&recorded===students.length};
}

