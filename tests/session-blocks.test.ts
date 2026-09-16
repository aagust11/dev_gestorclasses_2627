import {sessionIndicators} from '../src/utils/sessionIndicators';
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {getInitialState} from '../src/initialState';
import {AppState,SessionLog} from '../src/types';
import {diaryBlock,getDayBlocks,combineBlockLogs,blockLogs,effectiveSessionLogs,storeBlockLog,saveTimetableEntry,timetableSettings} from '../src/utils/sessionBlocks';
import {getProgrammedSessionsForSubject} from '../src/utils/dateHelpers';
import {subjectAttendance} from '../src/utils/attendance';
import {studentSessionHistory} from '../src/utils/studentProfile';
import {normalizeState,validateState} from '../src/storage';
import TimetableSettings from '../src/components/TimetableSettings';
import HorariView from '../src/components/HorariView';
import SessionBlockPage from '../src/components/SessionBlockPage';
const date='2026-09-14';
function fixture():AppState{
  const state=getInitialState();
  return {...state,config:{...state.config,startDate:date,endDate:'2027-06-30',holidays:[],substitutions:[],timeSlots:[{id:'t1',name:'1',startTime:'09:00',endTime:'10:00'},{id:'t2',name:'2',startTime:'10:00',endTime:'11:00'}]},subjects:[{id:'s',name:'Tecnologia',color:'#123456',isGeneral:false,parentId:null,students:[{id:'p',name:'Alumne'}]}],schedule:[{id:'a',subjectId:'s',dayOfWeek:1,timeSlotId:'t1'},{id:'b',subjectId:'s',dayOfWeek:1,timeSlotId:'t2'}],sessionLogs:[],activities:[],competencies:[],criteria:[],plans:[],termGradesRecords:[]};
}
const log=(id:string,status:'present'|'absent'='present'):SessionLog=>({id:id+'_'+date,scheduleItemId:id,subjectId:'s',date,comments:'Diari '+id,nextSessionNotes:'Previsió '+id,attendance:{p:{status,regularComments:['Comentari '+id]}}});
test('two adjacent hours are one chronological block and one programmed session',()=>{
 const state=fixture(),blocks=getDayBlocks(state,date);assert.equal(blocks.length,1);assert.deepEqual(blocks[0].memberIds,['a','b']);assert.equal(blocks[0].endTime,'11:00');
 assert.equal(getProgrammedSessionsForSubject(state,'s',date,date).length,1);
 state.config.timeSlots.reverse();assert.equal(getDayBlocks(state,date)[0].startTime,'09:00');
});
test('breaks, groups and substitutions separate blocks and holidays exclude attendance',()=>{
 const state=fixture();state.config.timeSlots[1].startTime='10:15';assert.equal(getDayBlocks(state,date).length,2);
 state.config.timeSlots[1].startTime='10:00';state.schedule[1].subjectId='other';assert.equal(getDayBlocks(state,date).length,2);
 state.schedule[1].subjectId='s';state.config.substitutions=[{id:'sub_change',date,timeSlotId:'t2',type:'subject',subjectId:'s'}];assert.equal(getDayBlocks(state,date).length,2);
 state.config.holidays=[{date,label:'Festa'}];assert.equal(getProgrammedSessionsForSubject(state,'s',date,date).length,0);
});
test('a sole existing second-hour record remains the primary identity and is not duplicated',()=>{
 const state=fixture();state.sessionLogs=[log('b')];const block=getDayBlocks(state,date)[0];assert.equal(block.id,'b');
 const next=storeBlockLog(state,block,date,{...state.sessionLogs[0],comments:'Dues hores'});
 assert.equal(next.sessionLogs.length,1);assert.equal(next.sessionLogs[0].id,'b_'+date);assert.deepEqual(next.sessionLogs[0].blockMemberIds,['a','b']);
 assert.equal(getProgrammedSessionsForSubject(next,'s',date,date)[0].scheduleItemId,'b');
 assert.equal(subjectAttendance(next,next.subjects[0],'annual',date).p.recorded,1);
});
test('legacy notes and individual comments survive merging; contradictory attendance is pending and reviewed',()=>{
 const state=fixture();state.sessionLogs=[log('a'),log('b','absent')];const block=getDayBlocks(state,date)[0],merged=combineBlockLogs(block,date,blockLogs(state,block,date));
 assert.equal(merged.conflicts.length,1);assert.equal(merged.log.attendance.p.status,'pending');assert.match(merged.log.comments,/Diari a\n\nDiari b/);
 assert.deepEqual(merged.log.attendance.p.regularComments,['Comentari a','Comentari b']);
 const summary=subjectAttendance(state,state.subjects[0],'annual',date).p;assert.equal(summary.total,1);assert.equal(summary.pending,1);assert.equal(summary.absent,0);
 assert.equal(studentSessionHistory(state,'p').length,1);
 const html=renderToStaticMarkup(React.createElement(SessionBlockPage,{state,scheduleItemId:'b',dateStr:date,onBackToTimeline:()=>{},onNavigateToSession:()=>{},onChangeState:()=>{},onSaveSessionLog:()=>{}}));
 assert.match(html,/Unificar el registre/);assert.match(html,/disabled/);
 const next=storeBlockLog(state,block,date,{...merged.log,attendance:{p:{...merged.log.attendance.p,status:'present'}}});
 assert.equal(next.sessionLogs.length,1);assert.equal(state.sessionLogs.length,2);assert.equal(effectiveSessionLogs(next).length,1);assert.equal(validateState(next),true);
 const restored=normalizeState(JSON.parse(JSON.stringify(next)));assert.deepEqual(restored.sessionLogs[0].blockMemberIds,['a','b']);assert.equal(restored.sessionLogs[0].attendance.p.regularComments?.length,2);
});
test('time editor permits arbitrary duration, rejects overlap and never changes slot identities used by old logs',()=>{
 let state=fixture();state.schedule=[];const next=saveTimetableEntry(state,{subjectId:'s',dayOfWeek:1,startTime:'08:15',endTime:'10:15'});
 assert.equal(getDayBlocks(next,date)[0].endTime,'10:15');assert.equal(next.config.timeSlots.length,3);assert.equal(validateState(next),true);
 assert.throws(()=>saveTimetableEntry(next,{subjectId:'s',dayOfWeek:1,startTime:'09:00',endTime:'10:00'}),/solapa/);
 assert.throws(()=>saveTimetableEntry(next,{subjectId:'s',dayOfWeek:1,startTime:'10:00',endTime:'09:00'}),/posterior/);
 assert.equal(saveTimetableEntry(next,{subjectId:'s',dayOfWeek:1,startTime:'10:15',endTime:'11:15'}).schedule.length,2);
});
test('historical block membership and interval remain frozen when future schedule changes',()=>{
 let state=fixture();state.sessionLogs=[log('a')];const block=getDayBlocks(state,date)[0];state=storeBlockLog(state,block,date,state.sessionLogs[0]);
 const moved=saveTimetableEntry(state,{id:'b',subjectId:'s',dayOfWeek:1,startTime:'11:00',endTime:'12:00'});
 assert.equal(getDayBlocks(moved,date).length,1);assert.equal(getDayBlocks(moved,date)[0].endTime,'11:00');assert.equal(getDayBlocks(moved,'2026-09-21').length,2);
 assert.throws(()=>saveTimetableEntry(state,{id:'a',subjectId:'s',dayOfWeek:2,startTime:'09:00',endTime:'10:00'}),/històric/);
});
test('new timetable settings validate and leave existing records untouched',()=>{
 const state=fixture();state.config.timetable={startTime:'08:00',endTime:'18:00',slotMinutes:15};assert.equal(validateState(state),true);assert.equal(timetableSettings(state).slotMinutes,15);
 const invalid=structuredClone(state);invalid.config.timetable!.slotMinutes=0;assert.equal(validateState(invalid),false);
 invalid.config.timetable={startTime:'18:00',endTime:'08:00',slotMinutes:30};assert.equal(validateState(invalid),false);
 const html=renderToStaticMarkup(React.createElement(HorariView,{state,onChangeState:()=>{},onSelectSession:()=>{},onNavigateToConfig:()=>{}}));assert.doesNotMatch(html,/Configurar vista|Nova activitat docent|>Editar<|Definir hores/);
 const settings=renderToStaticMarkup(React.createElement(TimetableSettings,{state,onChangeState:()=>{}}));
 assert.match(settings,/Configurar vista d’horari/);assert.match(settings,/Nova activitat docent/);assert.match(settings,/>Editar</);assert.match(settings,/09:00/);
});
test('overlapping legacy entries never collapse into a single block',()=>{
 const state=fixture();state.config.timeSlots[1].startTime='09:30';assert.equal(getDayBlocks(state,date).length,2);
});

test('general actions share the daily diary across gaps without filling the timetable gap',()=>{
 const state=fixture();state.subjects[0].isGeneral=true;state.subjects[0].students=[];
 state.config.timeSlots[1].startTime='10:30';state.config.timeSlots[1].endTime='11:30';
 const visual=getDayBlocks(state,date);assert.equal(visual.length,2);
 const first=diaryBlock(state,visual[0],date),second=diaryBlock(state,visual[1],date);
 assert.deepEqual(first,second);
 const saved=storeBlockLog(state,first,date,log('a'));
 assert.equal(saved.sessionLogs.length,1);assert.equal(saved.sessionLogs[0].blockMemberIds,undefined);
 assert.equal(getDayBlocks(saved,date).length,2);
 const reopened=diaryBlock(saved,getDayBlocks(saved,date)[1],date);
 assert.equal(blockLogs(saved,reopened,date)[0].comments,'Diari a');
 const edited=storeBlockLog(saved,reopened,date,{...saved.sessionLogs[0],comments:'Diari compartit'});
 assert.equal(edited.sessionLogs.length,1);assert.equal(edited.sessionLogs[0].comments,'Diari compartit');
 assert.equal(validateState(edited),true);
 const projected={...edited,sessionLogs:effectiveSessionLogs(edited)};
 assert.equal(getDayBlocks(projected,date).length,2);
 const props={state:edited,scheduleItemId:'b',dateStr:date,onBackToTimeline:()=>{},onNavigateToSession:()=>{},onChangeState:()=>{},onSaveSessionLog:()=>{}};
 const html=renderToStaticMarkup(React.createElement(SessionBlockPage,props));
 assert.doesNotMatch(html,/Control d&#x27;Assistència|Control d'Assistència|Cercar alumne a la sessió/);
 assert.match(html,/Diari compartit per totes les franges/);
});
test('general daily diaries preserve legacy notes and remain isolated by day and action',()=>{
 const state=fixture();state.subjects[0].isGeneral=true;state.config.timeSlots[1].startTime='10:30';
 state.sessionLogs=[log('a'),log('b'),{...log('a'),id:'tomorrow',date:'2026-09-15'},{...log('b'),id:'other',subjectId:'other'}];
 const block=diaryBlock(state,getDayBlocks(state,date)[1],date),logs=blockLogs(state,block,date);
 assert.equal(logs.length,2);
 const merged=combineBlockLogs(block,date,logs).log;
 assert.match(merged.comments,/Diari a/);assert.match(merged.comments,/Diari b/);
 const saved=storeBlockLog(state,block,date,merged);
 assert.equal(saved.sessionLogs.length,3);
 assert.ok(saved.sessionLogs.some(l=>l.id==='tomorrow'));assert.ok(saved.sessionLogs.some(l=>l.id==='other'));
});

test('timetable indicators distinguish empty, partial and complete attendance and diary text',()=>{
 const state=fixture(),block=getDayBlocks(state,date)[0];
 assert.deepEqual(sessionIndicators(state,block,date),{hasDiary:false,recorded:0,total:1,complete:false});
 state.sessionLogs=[{...log('b'),comments:'  ',nextSessionNotes:'Preparar',attendance:{p:{status:'pending',regularComments:['Comentari']}}}];
 assert.equal(sessionIndicators(state,block,date).hasDiary,false);
 assert.equal(sessionIndicators(state,block,date).recorded,0);
 state.sessionLogs[0].attendance.p.status='absent';
 assert.equal(sessionIndicators(state,block,date).complete,true);
 state.subjects[0].students.push({id:'q',name:'Segon alumne'});
 assert.equal(sessionIndicators(state,block,date).complete,false);
 state.sessionLogs[0].attendance.q={status:'late10'};
 state.sessionLogs[0].comments='Diari escrit';
 assert.deepEqual(sessionIndicators(state,block,date),{hasDiary:true,recorded:2,total:2,complete:true});
 state.sessionLogs.push(log('a','present'));
 assert.equal(sessionIndicators(state,block,date).recorded,1); // conflicting legacy attendance remains pending
 assert.equal(sessionIndicators(state,block,'2026-09-21').recorded,0);
});
test('general action diary indicators appear in all daily slots without attendance',()=>{
 const state=fixture();state.subjects[0].isGeneral=true;state.config.timeSlots[1].startTime='10:30';
 state.sessionLogs=[log('a')];
 for(const block of getDayBlocks(state,date))assert.deepEqual(sessionIndicators(state,block,date),{hasDiary:true,recorded:0,total:0,complete:false});
 state.sessionLogs[0].comments='';
 assert.equal(sessionIndicators(state,getDayBlocks(state,date)[1],date).hasDiary,false);
});
