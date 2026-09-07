import test from 'node:test';
import assert from 'node:assert/strict';
import {getInitialState} from '../src/initialState';
import {saveToFileHandle,waitForFileWrites,saveStateToLocalStorage,loadStateFromLocalStorage,createRecoveryCopy,recoveryCopies} from '../src/storage';
import {identityConflicts,syncStudentRegistry,newStudent,resolveIdentityConflict,mergeStudents} from '../src/utils/studentIdentity';
import {buildStudentReport} from '../src/utils/studentReport';

const state=()=>({...getInitialState(),subjects:[],sessionLogs:[],activities:[],plans:[],termGradesRecords:[]});
const subject=(id:string,students:any[])=>({id,name:id,color:'#fff',isGeneral:false,parentId:null,students});
test('queued writes cannot complete out of order and freeze their snapshots',async()=>{
  let disk='',active=0,max=0;const events:string[]=[];
  let release!:()=>void;const gate=new Promise<void>(r=>release=r);let first=true;
  const handle={async createWritable(){active++;max=Math.max(max,active);const slow=first;first=false;let contents='';return {async write(s:string){contents=s;events.push(JSON.parse(s).config.startDate);if(slow)await gate;},async close(){disk=contents;active--;}};}};
  const a=state();a.config={...a.config,startDate:'2026-01-01'};
  const p1=saveToFileHandle(handle,a);a.config.startDate='2026-02-01';const p2=saveToFileHandle(handle,a);a.config.startDate='mutated';
  await Promise.resolve();assert.equal(active,1);release();await Promise.all([p1,p2]);
  assert.equal(max,1);assert.deepEqual(events,['2026-01-01','2026-02-01']);assert.equal(JSON.parse(disk).config.startDate,'2026-02-01');
});
test('write failure rejects, aborts and allows the next save',async()=>{
  let aborted=false,writes=0;const handle={async createWritable(){const n=++writes;return {async write(){if(n===1)throw Error('disk full');},async close(){},async abort(){aborted=true;}};}};
  const one=saveToFileHandle(handle,state());const two=saveToFileHandle(handle,state());await assert.rejects(one,/disk full/);assert.equal(await two,true);await waitForFileWrites();assert.equal(aborted,true);
});
test('local quota failure is visible; recovery ring is restorable; corrupt original is retained',()=>{
  const memory=new Map<string,string>();globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>{memory.set(k,String(v));}} as any;
  const original=state();saveStateToLocalStorage(original);for(let i=0;i<4;i++)createRecoveryCopy(original,'copy '+i);
  assert.equal(recoveryCopies().length,3);assert.equal(recoveryCopies()[0].reason,'copy 3');assert.deepEqual(JSON.parse(recoveryCopies()[0].raw),original);
  localStorage.setItem('gestor_classes_app_state','invalid');assert.throws(loadStateFromLocalStorage);assert.equal(localStorage.getItem('gestor_classes_app_state'),'invalid');
  localStorage.setItem=()=>{throw Error('quota exceeded');};assert.throws(()=>saveStateToLocalStorage(original),/quota/);assert.throws(()=>createRecoveryCopy(original,'blocked'),/quota/);
});
test('stable UUID identities do not depend on time, list positions or matching names',()=>{
  const saved=Date.now;Date.now=()=>1;
  try{const students=Array.from({length:1000},()=>newStudent('Same Name'));assert.equal(new Set(students.map(s=>s.id)).size,1000);
  const data=state();data.subjects=[subject('a',[students[0],students[1]]),subject('b',[students[1]])];const migrated=syncStudentRegistry(data);
  assert.equal(Object.keys(migrated.studentRegistry!).length,2);assert.equal(migrated.subjects[0].students[1],migrated.subjects[1].students[0]);assert.deepEqual(migrated.enrolments!.b,[students[1].id]);assert.deepEqual(syncStudentRegistry(migrated),migrated);
  }finally{Date.now=saved;}
});
function collisionFixture(){const d:any=state();d.subjects=[subject('a',[{id:'old',name:'Anna'}]),subject('b',[{id:'old',name:'Biel'}])];d.studentProfiles={old:{psi:'private',supportMeasures:'support'}};d.activities=[{id:'act',subjectId:'b',grades:{old:{score:7,status:'not_submitted'}}}];d.sessionLogs=[{id:'log',subjectId:'b',attendance:{old:{status:'absent'}}}];d.termGradesRecords=[{id:'term',subjectId:'b',students:{old:{finalGrade:{score:3,isManual:true}}}}];d.periodComments={b:{t1:{old:'comment'}}};d.plans=[{subjectId:'b',seats:{'1,1':'old'}}];return d;}
test('legacy collision blocks registry migration; explicit repair remaps every domain and archives unattributed PSI',()=>{
  const d=collisionFixture(),original=structuredClone(d);assert.equal(identityConflicts(d).length,1);assert.equal(syncStudentRegistry(d),d);
  const a=newStudent('Anna'),b=newStudent('Biel');const next=resolveIdentityConflict(d,'old',{'a:0':a.id,'b:0':b.id},{[a.id]:a,[b.id]:b},{},'');
  assert.equal(identityConflicts(next).length,0);assert.equal(next.activities![0].grades![b.id].score,7);assert.equal(next.sessionLogs[0].attendance[b.id].status,'absent');assert.equal(next.termGradesRecords![0].students[b.id].finalGrade.isManual,true);assert.equal(next.periodComments!.b.t1[b.id],'comment');assert.equal(next.plans[0].seats['1,1'],b.id);assert.equal(next.studentProfiles!.old,undefined);assert.equal(next.studentProfiles![b.id],undefined);assert.equal((next.identityArchive![0].profile as any).psi,'private');assert.deepEqual(d,original);
});
test('duplicate rows within a subject require an explicit owner of ambiguous grades',()=>{
  const d=collisionFixture();d.subjects=[subject('b',[{id:'old',name:'Anna'},{id:'old',name:'Biel'}])];const a=newStudent('Anna'),b=newStudent('Biel');const people={[a.id]:a,[b.id]:b},assignments={'b:0':a.id,'b:1':b.id};
  assert.throws(()=>resolveIdentityConflict(d,'old',assignments,people,{},''),/explícitament/);
  const fixed=resolveIdentityConflict(d,'old',assignments,people,{b:b.id},a.id);assert.equal(fixed.activities![0].grades![a.id],undefined);assert.equal(fixed.studentProfiles![a.id].psi,'private');
});
test('explicit merge moves enrolments and history, but conflicting records never overwrite',()=>{
  const a=newStudent('Person'),b=newStudent('Person');let d:any=state();d.subjects=[subject('a',[a]),subject('b',[b])];d.activities=[{subjectId:'b',grades:{[b.id]:{score:9}}}];d.studentProfiles={[b.id]:{psi:'support'}};d.sessionLogs=[{subjectId:'removed-subject',attendance:{[b.id]:{status:'absent'}}}];d=syncStudentRegistry(d);
  const merged=mergeStudents(d,b.id,a.id);assert.equal(merged.subjects[1].students[0].id,a.id);assert.equal(merged.activities![0].grades![a.id].score,9);assert.equal(merged.studentProfiles![a.id].psi,'support');assert.equal(merged.studentRegistry![b.id],undefined);assert.equal(merged.sessionLogs[0].attendance[a.id].status,'absent');
  d.activities[0].grades[a.id]={score:2};const original=structuredClone(d);assert.throws(()=>mergeStudents(d,b.id,a.id),/mateix registre/);assert.deepEqual(d,original);
  d.activities=[];d.studentProfiles[a.id]={psi:'different'};assert.throws(()=>mergeStudents(d,b.id,a.id),/informació personal/);
});
test('an unenrolled student retains their central profile and can export a report',()=>{
  const st=newStudent('Former student');const d:any=syncStudentRegistry({...state(),subjects:[subject('a',[st])]});d.subjects=[];const next=syncStudentRegistry(d);assert.equal(next.studentRegistry![st.id].name,st.name);assert.equal(buildStudentReport(next,st.id).name,st.name);
});
