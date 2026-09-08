import test from 'node:test';
import assert from 'node:assert/strict';
import {getInitialState} from '../src/initialState';
import {assertValidImport,inspectImport} from '../src/utils/importValidation';
import {periodGrades} from '../src/utils/gradeSelectors';
import {findTermRecord,putTermRecord,recordMethod} from '../src/utils/termRecords';
import {acquireEditorLease,RevisionGuard} from '../src/utils/editorLease';
import {normalizeState,saveStateToLocalStorage,loadStateFromLocalStorage,saveToFileHandle} from '../src/storage';

function fixture():any {
  return {...getInitialState(),subjects:[{id:'s',name:'Subject',color:'#fff',isGeneral:false,parentId:null,students:[{id:'st',name:'Student'}]}],competencies:[{id:'ce',subjectId:'s',key:'CE1',description:''}],criteria:[{id:'ca',competencyId:'ce',key:'CA1',description:''}],schedule:[],plans:[],activities:[{id:'act',title:'Activity',subjectId:'s',startDate:'2026-09-01',endDate:'2026-09-07',criteriaIds:['ca'],criteriaMaxScores:{ca:10},grades:{st:{criteriaGrades:{ca:{rawScore:8,maxScore:10}}}}}],termGradesRecords:[]};
}
const manual=(id:string,calculationMode:any='mean'):any=>({id,subjectId:'s',periodId:'annual',calculationMode,students:{st:{criteria:{},competencies:{},finalGrade:{score:1,qual:'NA',isManual:true}}}});
test('arbitrary imported record IDs preserve manual final grades through save and reload in every method',()=>{
  let raw='';globalThis.localStorage={getItem:()=>raw||null,setItem:(k,v)=>{raw=v;}} as any;
  for(const method of ['mean','median','mode'] as const){const d=fixture();d.termGradesRecords=[manual('external-'+method,method)];assertValidImport(d);saveStateToLocalStorage(d);const reopened=loadStateFromLocalStorage();assert.equal(periodGrades(reopened,reopened.subjects[0],'annual',method).st.finalGrade.score,1);assert.equal(periodGrades(reopened,reopened.subjects[0],'annual',method,true).st.finalGrade.score,3.2);}
});
test('duplicate logical records and contradictions are rejected; replacement targets the logical record',()=>{
  const d=fixture();d.termGradesRecords=[manual('external'),manual('s_annual_mean')];assert.equal(inspectImport(d).valid,false);
  const updated=putTermRecord([manual('external')],manual('s_annual_mean'));assert.equal(updated.length,1);assert.equal(findTermRecord(updated,'s','annual','mean')!.id,'s_annual_mean');
  d.termGradesRecords=[manual('s_annual_median','mode')];assert.equal(inspectImport(d).valid,false);
  assert.equal(recordMethod({...manual('s_annual_median'),calculationMode:undefined}),'median');
  assert.equal(recordMethod({...manual('s_annual'),calculationMode:undefined}),'mean');
});
test('the shared edit gate rejects incompatible maximum and date changes before persisted state changes',()=>{
  const initial=fixture();let saved=JSON.stringify(initial);
  for(const mutate of [(d:any)=>{d.activities[0].criteriaMaxScores.ca=5;},(d:any)=>{d.config.startDate='2028-01-01';}]){const draft=structuredClone(initial);mutate(draft);assert.throws(()=>{assertValidImport(draft);saved=JSON.stringify(draft);});assert.equal(saved,JSON.stringify(initial));}
  const good=structuredClone(initial);good.activities[0].criteriaMaxScores.ca=20;assertValidImport(good);const reopened=normalizeState(JSON.parse(JSON.stringify(good)));assert.equal(periodGrades(reopened,reopened.subjects[0],'annual','mean').st.finalGrade.score,1.6);
});
test('a cleared arbitrary-ID record stays cleared, including after reload',()=>{
  const d=fixture();d.termGradesRecords=[{...manual('external'),cleared:true,students:{}}];const next=normalizeState(JSON.parse(JSON.stringify(d)));assert.deepEqual(periodGrades(next,next.subjects[0],'annual','mean'),{});
});
test('revision guard rejects stale tabs and read-only writes, and advances after own commits',()=>{
  let raw='initial',owner=true;const guard=new RevisionGuard(()=>raw,()=>owner);guard.assertCurrent();raw='own write';guard.committed();guard.assertCurrent();raw='external write';assert.throws(()=>guard.assertCurrent(),/altra pestanya/);owner=false;assert.throws(()=>guard.assertCurrent(),/consulta/);
});
test('queued writes check the revision again and abort when ownership changes during write',async()=>{
  let allow=true,aborts=0,closes=0;const handle={async createWritable(){return {async write(){allow=false;},async close(){closes++;},async abort(){aborts++;}};}};
  await assert.rejects(saveToFileHandle(handle,fixture(),()=>{if(!allow)throw Error('lost ownership');}),/lost ownership/);assert.equal(closes,0);assert.equal(aborts,1);
});
function mockLocks(){
  let held=false;
  return {request:async(_name:string,_options:any,callback:any)=>{await Promise.resolve();if(held)return callback(null);held=true;try{return await callback({name:_name});}finally{held=false;}}} as unknown as LockManager;
}
const tick=()=>new Promise<void>(r=>setTimeout(r,0));
test('only one tab owns the lease, a second can acquire after release, and disposed requests cannot acquire',async()=>{
  const locks=mockLocks();let editors=0,readers=0;
  const first=acquireEditorLease(locks,()=>editors++,()=>readers++,e=>{throw e;});await tick();
  const second=acquireEditorLease(locks,()=>editors++,()=>readers++,e=>{throw e;});await tick();assert.equal(editors,1);assert.equal(readers,1);assert.equal(first.owns(),true);assert.equal(second.owns(),false);
  first.dispose();await tick();const third=acquireEditorLease(locks,()=>editors++,()=>readers++,e=>{throw e;});await tick();assert.equal(third.owns(),true);third.dispose();await tick();
  const cancelled=acquireEditorLease(locks,()=>editors++,()=>readers++,e=>{throw e;});cancelled.dispose();await tick();assert.equal(editors,2);
});
test('unsupported lock API keeps the app read-only instead of permitting unprotected writes',()=>{
  let acquired=false,readonly=false;const lease=acquireEditorLease(undefined,()=>{acquired=true;},()=>{readonly=true;},()=>{});assert.equal(acquired,false);assert.equal(readonly,true);assert.equal(lease.owns(),false);
});
