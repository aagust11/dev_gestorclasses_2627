import test from 'node:test';
import {AppState} from '../src/types';
import assert from 'node:assert/strict';
import {getInitialState} from '../src/initialState';
import {getCurrentClassContext,sessionsOnDate} from '../src/utils/currentClass';
import {setStudentAttendance,markAllPresent,markPendingStudentsPresent,addStudentAnnotation,getSessionSnapshot,statuses} from '../src/utils/sessionMutations';
import {createExtensionDispatcher} from '../src/extension/extensionBridge';
import {ExtensionRequest} from '../src/extension/extensionTypes';
import {validateState} from '../src/storage';
const date='2026-09-14',target={date,sessionId:'a'};
function fixture():AppState{
  const state=getInitialState();
  return {...state,config:{...state.config,startDate:date,endDate:'2027-06-30',holidays:[],substitutions:[],timeSlots:[{id:'t1',name:'1',startTime:'09:00',endTime:'10:00'},{id:'t2',name:'2',startTime:'10:00',endTime:'11:00'}]},subjects:[{id:'s',name:'Tecnologia',color:'#123456',isGeneral:false,parentId:null,students:[{id:'p',name:'Alumne Oficial',preferredName:'Àlex'},{id:'q',name:'Alumne Dos'}]}],schedule:[{id:'a',subjectId:'s',dayOfWeek:1,timeSlotId:'t1'},{id:'b',subjectId:'s',dayOfWeek:1,timeSlotId:'t2'}],sessionLogs:[],activities:[],competencies:[],criteria:[],plans:[],termGradesRecords:[]};
}
test('extension context: local boundaries, next class and merged consecutive hours',()=>{
 const state=fixture();assert.equal(getCurrentClassContext(state,new Date(date+'T08:59:59')).current.length,0);
 assert.equal(getCurrentClassContext(state,new Date(date+'T09:00:00')).current.length,1);
 const context=getCurrentClassContext(state,new Date(date+'T10:00:00'));assert.equal(context.current[0].endTime,'11:00');
 assert.equal(getCurrentClassContext(state,new Date(date+'T11:00:00')).current.length,0);
 assert.equal(getCurrentClassContext(state,new Date(date+'T11:00:00')).next?.date,'2026-09-21');
 assert.equal(sessionsOnDate(state,'2026-08-31').length,0);assert.equal(sessionsOnDate(state,'2027-07-05').length,0);
 state.config.holidays.push({date,label:'Festa'});assert.equal(getCurrentClassContext(state,new Date(date+'T09:00:00')).current.length,0);
});
test('overlapping and substituted classes stay selectable; general actions have no attendance',()=>{
 const state=fixture();state.config.timeSlots[1].startTime='09:30';
 assert.equal(getCurrentClassContext(state,new Date(date+'T09:45:00')).current.length,2);
 state.config.substitutions.push({id:'replacement',date,timeSlotId:'t1',type:'subject',subjectId:'s'});
 assert.ok(getCurrentClassContext(state,new Date(date+'T09:00:00')).current.some(s=>s.id==='replacement'));
 state.subjects[0].isGeneral=true;assert.equal(getSessionSnapshot(state,{date,sessionId:'replacement'}).students.length,0);
 assert.throws(()=>setStudentAttendance(state,{date,sessionId:'replacement'},'p','present'),/matrícula/);
});
test('snapshot is read-only and excludes all private profile data',()=>{
 const state=fixture();state.studentProfiles={p:{psi:'secret PSI',internalNotes:'secret transfer',supportMeasures:'secret support',notes:'private'}};
 const before=JSON.stringify(state),snapshot=getSessionSnapshot(state,target);
 assert.equal(JSON.stringify(state),before);assert.equal(snapshot.summary.pending,2);assert.equal(snapshot.students[0].name,'Àlex');
 assert.doesNotMatch(JSON.stringify(snapshot),/secret|private|studentProfiles/);
});
test('each attendance status round-trips; pending-all preserves exceptions, scores, diary and annotations',()=>{
 let state=fixture();for(const status of statuses){state=setStudentAttendance(state,target,'p',status);assert.equal(getSessionSnapshot(state,target).students[0].status,status);assert.equal(validateState(state),true);}
 state=setStudentAttendance(state,target,'p','absent');state.sessionLogs[0].comments='diari';state.sessionLogs[0].nextSessionNotes='demà';state.sessionLogs[0].attendance.p.score=3;
 state=addStudentAnnotation(state,target,'p','regular','històric');
 assert.throws(()=>markAllPresent(state,target),/pendents/);
 state=markPendingStudentsPresent(state,target);assert.equal(state.sessionLogs.length,1);
 assert.equal(state.sessionLogs[0].attendance.p.status,'absent');assert.equal(state.sessionLogs[0].attendance.q.status,'present');
 assert.equal(state.sessionLogs[0].attendance.p.score,3);assert.equal(state.sessionLogs[0].comments,'diari');assert.equal(state.sessionLogs[0].nextSessionNotes,'demà');assert.deepEqual(state.sessionLogs[0].blockMemberIds,['a','b']);
 assert.deepEqual(state.sessionLogs[0].attendance.p.regularComments,['històric']);
});
test('annotations migrate legacy fields without losing text or implicitly marking present',()=>{
 let state=fixture();state=setStudentAttendance(state,target,'p','pending');
 state.sessionLogs[0].attendance.p.posComment='legacy';
 for(const kind of ['pos','regular','incident'] as const)state=addStudentAnnotation(state,target,'p',kind,' new ');
 const entry=state.sessionLogs[0].attendance.p;assert.equal(entry.status,'pending');assert.deepEqual(entry.posComments,['legacy','new']);assert.equal(entry.posComment,undefined);
 assert.deepEqual(entry.regularComments,['new']);assert.deepEqual(entry.incidentComments,['new']);
 assert.throws(()=>addStudentAnnotation(state,target,'p','pos',' '));assert.throws(()=>setStudentAttendance(state,target,'removed','present'));
 assert.throws(()=>setStudentAttendance(state,{...target,date:'2026-09-15'},'p','present'));
});
test('contradictory legacy block records cannot be silently merged by extension',()=>{
 const state=fixture();state.sessionLogs=[{id:'1',scheduleItemId:'a',subjectId:'s',date,comments:'a',attendance:{p:{status:'present'}}},{id:'2',scheduleItemId:'b',subjectId:'s',date,comments:'b',attendance:{p:{status:'absent'}}}];
 assert.throws(()=>setStudentAttendance(state,target,'p','present'),/contradictoris/);assert.equal(state.sessionLogs.length,2);
});
const req=(action:ExtensionRequest['action'],payload:Record<string,unknown>={},id=crypto.randomUUID()):ExtensionRequest=>({version:1,requestId:id,action,payload});
test('bridge waits for save, serializes mutations and deduplicates retried request IDs',async()=>{
 let state=fixture(),commits=0,release:()=>void=()=>{};
 const barrier=new Promise<void>(r=>release=r);
 const dispatch=createExtensionDispatcher({getState:()=>state,ready:()=>true,safeToClose:()=>true,openSession:()=>{},commit:async next=>{commits++;await barrier;state=next;return {};}});
 const request=req('ADD_ANNOTATION',{...target,studentId:'p',kind:'pos',text:'Un cop'});
 let done=false;const first=dispatch(request).then(r=>{done=true;return r;});const duplicate=dispatch(request);
 await new Promise(r=>setImmediate(r));assert.equal(done,false);assert.equal(commits,1);release();
 assert.equal((await first).ok,true);assert.equal((await duplicate).ok,true);assert.deepEqual(state.sessionLogs[0].attendance.p.posComments,['Un cop']);
 assert.equal((await dispatch({...request,payload:{...request.payload,text:'Diferent'}})).ok,false);
});
test('bridge rejects protocol/invalid input, reports save failures and soft file warnings truthfully',async()=>{
 let state=fixture(),ready=true,mode='warning';
 const dispatch=createExtensionDispatcher({getState:()=>state,ready:()=>ready,safeToClose:()=>false,openSession:()=>{},commit:async next=>{if(mode==='error')throw Error('Quota');state=next;return {warning:'Fitxer pendent'};}});
 assert.equal((await dispatch({...req('GET_CONTEXT'),version:9})).ok,false);
 ready=false;assert.equal((await dispatch(req('GET_CONTEXT'))).ok,false);ready=true;
 assert.equal((await dispatch(req('SET_ATTENDANCE',{...target,studentId:'p',status:'invalid'}))).ok,false);
 const result=await dispatch(req('SET_ATTENDANCE',{...target,studentId:'p',status:'present'}));assert.equal(result.ok,true);assert.equal(result.warning,'Fitxer pendent');assert.equal(result.safeToClose,false);
 mode='error';const error=await dispatch(req('ADD_ANNOTATION',{...target,studentId:'p',kind:'pos',text:'Fail'}));assert.equal(error.ok,false);assert.equal(error.error,'Quota');
 assert.equal(state.sessionLogs[0].attendance.p.posComments,undefined);
});

test('extension students sort alphabetically by displayed name without changing the roster',()=>{
 const state=fixture();state.subjects[0].students=[{id:'z',name:'Zoe'},{id:'b',name:'Bernat'},{id:'a',name:'Oficial',preferredName:'Àlex'}];
 assert.deepEqual(getSessionSnapshot(state,target).students.map(s=>s.name),['Àlex','Bernat','Zoe']);assert.deepEqual(state.subjects[0].students.map(s=>s.id),['z','b','a']);
});
test('bridge refreshes the shared file before reading and responds with the refreshed state',async()=>{
 let state=fixture(),prepared=false;
 const dispatch=createExtensionDispatcher({getState:()=>state,ready:()=>true,safeToClose:()=>true,openSession:()=>{},commit:async()=>({}),prepare:async()=>{await new Promise(r=>setImmediate(r));state=setStudentAttendance(state,target,'p','absent');prepared=true;}});
 const result=await dispatch(req('GET_SESSION',target));assert.equal(prepared,true);assert.equal((result.data as any).students[0].status,'absent');
});

test('read and navigation remain available while a mutation is waiting for durable save',async()=>{
 let state=fixture(),release:()=>void=()=>{},saving=false,opened=false;
 const barrier=new Promise<void>(r=>release=r);
 const dispatch=createExtensionDispatcher({getState:()=>state,ready:()=>!saving,readReady:()=>true,safeToClose:()=>!saving,warning:()=>saving?'Desant…':'',openSession:()=>{opened=true;},commit:async next=>{saving=true;state=next;await barrier;saving=false;return {};}});
 const mutation=dispatch(req('SET_ATTENDANCE',{...target,studentId:'p',status:'absent'}));
 await new Promise(r=>setImmediate(r));assert.equal(saving,true);
 const snapshot=await dispatch(req('GET_SESSION',target));assert.equal(snapshot.ok,true);assert.equal(snapshot.warning,'Desant…');assert.equal(snapshot.safeToClose,false);
 assert.equal((await dispatch(req('OPEN_SESSION',target))).ok,true);assert.equal(opened,true);
 release();assert.equal((await mutation).ok,true);
});
test('opening a session for review does not require consistent attendance records',async()=>{
 const state=fixture();state.sessionLogs=[{id:'1',scheduleItemId:'a',subjectId:'s',date,comments:'a',attendance:{p:{status:'present'}}},{id:'2',scheduleItemId:'b',subjectId:'s',date,comments:'b',attendance:{p:{status:'absent'}}}];
 let opened=false;
 const dispatch=createExtensionDispatcher({getState:()=>state,ready:()=>false,readReady:()=>true,safeToClose:()=>false,openSession:()=>{opened=true;},commit:async()=>{throw Error('No mutation expected');}});
 assert.equal((await dispatch(req('OPEN_SESSION',target))).ok,true);assert.equal(opened,true);
 assert.equal((await dispatch(req('SET_ATTENDANCE',{...target,studentId:'p',status:'present'}))).ok,false);
});

test('not-held classes stay selectable for review but cannot receive extension attendance',()=>{
 let state=setStudentAttendance(fixture(),target,'p','absent');state.sessionLogs[0].notHeld=true;
 assert.equal(getCurrentClassContext(state,new Date(date+'T09:30:00')).current.length,0);
 assert.equal(sessionsOnDate(state,date)[0].notHeld,true);
 assert.equal(getSessionSnapshot(state,target).canAttend,false);
 assert.equal(getSessionSnapshot(state,target).summary.total,0);
 assert.throws(()=>setStudentAttendance(state,target,'p','present'),/no feta/);
 assert.equal(state.sessionLogs[0].attendance.p.status,'absent');
});
