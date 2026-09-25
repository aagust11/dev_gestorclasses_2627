import {subjectAttendance} from '../src/utils/attendance';
import {getProgrammedSessionsForSubject} from '../src/utils/dateHelpers';
import {studentSessionHistory} from '../src/utils/studentProfile';
import {getSessionSnapshot} from '../src/utils/sessionMutations';
import test from 'node:test';
import assert from 'node:assert/strict';
import {getInitialState} from '../src/initialState';
import {addSubstitution,substitutionSlots} from '../src/utils/substitutions';
import {getDayBlocks,storeBlockLog,effectiveSessionLogs} from '../src/utils/sessionBlocks';
import {validateState} from '../src/storage';
function fixture(){const s=getInitialState();s.config={...s.config,startDate:'2026-09-14',endDate:'2027-06-30',holidays:[],substitutions:[],timeSlots:[{id:'old',name:'Antiga',startTime:'09:00',endTime:'10:00'},{id:'active',name:'Nova',startTime:'09:00',endTime:'10:00'}]};s.subjects=[{id:'s',name:'Classe',students:[],isGeneral:false,parentId:null,color:'#123456'},{id:'r',name:'Altra',students:[],isGeneral:false,parentId:null,color:'#123456'}];s.schedule=[{id:'a',subjectId:'s',dayOfWeek:1,timeSlotId:'active'}];s.sessionLogs=[];return s;}
const input={date:'2026-09-14',timeSlotId:'active',type:'subject' as const,subjectId:'r'};
test('substitution uses current day slots, replaces class and preserves source timetable',()=>{
 const state=fixture();assert.deepEqual(substitutionSlots(state,input.date).map(s=>s.id),['a']);
 const next=addSubstitution(state,input);assert.equal(getDayBlocks(next,input.date)[0].subjectId,'r');assert.equal(next.schedule[0].subjectId,'s');assert.equal(validateState(next),true);
 assert.throws(()=>addSubstitution(next,input),/ja té un canvi/);
 assert.throws(()=>addSubstitution(state,{...input,timeSlotId:'old'}),/vigent/);
 assert.throws(()=>addSubstitution(state,{...input,date:'2026-09-15'}),/vigent/);
 state.sessionLogs=[{id:'l',scheduleItemId:'a',subjectId:'s',date:input.date,comments:'Històric',attendance:{}}];
 const replaced=addSubstitution(state,input);assert.equal(effectiveSessionLogs(replaced).length,0);assert.equal(replaced.sessionLogs[0].comments,'Històric');
});


test('reason replacement uses the entire displayed block on a 20-minute grid and excludes stored records',()=>{
 let state=fixture();state.config.timetable={startTime:'08:00',endTime:'18:00',slotMinutes:20};
 state.config.timeSlots=[{id:'active',name:'Primera',startTime:'09:20',endTime:'10:20'},{id:'second',name:'Segona',startTime:'10:20',endTime:'11:00'}];
 state.schedule.push({id:'b',subjectId:'s',dayOfWeek:1,timeSlotId:'second'});
 state.subjects[0].students=[{id:'p',name:'Prova'}];
 const block=getDayBlocks(state,input.date)[0];
 state=storeBlockLog(state,block,input.date,{id:'old-log',scheduleItemId:'a',subjectId:'s',date:input.date,comments:'Diari original',attendance:{p:{status:'absent',incidentComments:['Històric']}}});
 const choice=substitutionSlots(state,input.date)[0];assert.equal(choice.startTime,'09:20');assert.equal(choice.endTime,'11:00');
 const next=addSubstitution(state,{date:input.date,timeSlotId:choice.timeSlotId,scheduleItemId:choice.id,type:'other',customReason:'Sortida del grup'});
 const shown=getDayBlocks(next,input.date);assert.equal(shown.length,1);assert.equal(shown[0].subjectId,'');assert.equal(shown[0].reason,'Sortida del grup');assert.equal(shown[0].startTime,'09:20');assert.equal(shown[0].endTime,'11:00');
 assert.equal(getProgrammedSessionsForSubject(next,'s',input.date,input.date).length,0);
 assert.equal(subjectAttendance(next,next.subjects[0],'annual',input.date).p.total,0);assert.equal(subjectAttendance(next,next.subjects[0],'annual',input.date).p.absent,0);
 assert.equal(studentSessionHistory(next,'p').length,0);assert.throws(()=>getSessionSnapshot(next,{date:input.date,sessionId:'a'}),/no està disponible/);
 assert.equal(validateState(JSON.parse(JSON.stringify(next))),true);assert.deepEqual(next.sessionLogs,state.sessionLogs);
 const restored={...next,config:{...next.config,substitutions:[]}};
 assert.equal(getDayBlocks(restored,input.date)[0].subjectId,'s');assert.equal(subjectAttendance(restored,restored.subjects[0],'annual',input.date).p.absent,1);assert.equal(restored.sessionLogs[0].comments,'Diari original');
});
test('legacy slot replacements exclude historical attendance without changing the source JSON',()=>{
 const state=fixture();state.subjects[0].students=[{id:'p',name:'Prova'}];
 state.sessionLogs=[{id:'l',scheduleItemId:'a',subjectId:'s',date:input.date,comments:'old',attendance:{p:{status:'absent'}}}];
 state.config.substitutions=[{id:'legacy',date:input.date,timeSlotId:'active',type:'other',customReason:'Vaga'}];
 assert.equal(effectiveSessionLogs(state).length,0);assert.equal(subjectAttendance(state,state.subjects[0],'annual',input.date).p.total,0);assert.equal(state.sessionLogs.length,1);
});
