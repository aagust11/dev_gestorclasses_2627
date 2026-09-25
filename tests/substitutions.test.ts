import test from 'node:test';
import assert from 'node:assert/strict';
import {getInitialState} from '../src/initialState';
import {addSubstitution,substitutionSlots} from '../src/utils/substitutions';
import {getDayBlocks} from '../src/utils/sessionBlocks';
import {validateState} from '../src/storage';
function fixture(){const s=getInitialState();s.config={...s.config,startDate:'2026-09-14',endDate:'2027-06-30',holidays:[],substitutions:[],timeSlots:[{id:'old',name:'Antiga',startTime:'09:00',endTime:'10:00'},{id:'active',name:'Nova',startTime:'09:00',endTime:'10:00'}]};s.subjects=[{id:'s',name:'Classe',students:[],isGeneral:false,parentId:null,color:'#123456'},{id:'r',name:'Altra',students:[],isGeneral:false,parentId:null,color:'#123456'}];s.schedule=[{id:'a',subjectId:'s',dayOfWeek:1,timeSlotId:'active'}];s.sessionLogs=[];return s;}
const input={date:'2026-09-14',timeSlotId:'active',type:'subject' as const,subjectId:'r'};
test('substitution uses current day slots, replaces class and preserves source timetable',()=>{
 const state=fixture();assert.deepEqual(substitutionSlots(state,input.date).map(s=>s.id),['active']);
 const next=addSubstitution(state,input);assert.equal(getDayBlocks(next,input.date)[0].subjectId,'r');assert.equal(next.schedule[0].subjectId,'s');assert.equal(validateState(next),true);
 assert.throws(()=>addSubstitution(next,input),/ja té un canvi/);
 assert.throws(()=>addSubstitution(state,{...input,timeSlotId:'old'}),/vigent/);
 assert.throws(()=>addSubstitution(state,{...input,date:'2026-09-15'}),/vigent/);
 state.sessionLogs=[{id:'l',scheduleItemId:'a',subjectId:'s',date:input.date,comments:'Històric',attendance:{}}];
 assert.throws(()=>addSubstitution(state,input),/ja té un registre/);assert.equal(state.sessionLogs[0].comments,'Històric');
});
