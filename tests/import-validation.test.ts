import test from 'node:test';
import assert from 'node:assert/strict';
import {getInitialState} from '../src/initialState';
import {inspectImport,parseImportJson,readImportFile,ImportValidationError} from '../src/utils/importValidation';
import {normalizeState,prepareImportedState,loadFromFileHandle,loadStateFromLocalStorage,validateState,recoveryCopies} from '../src/storage';
const minimal=()=>({config:{},subjects:[],schedule:[]});
const fixture=():any=>({...minimal(),subjects:[{id:'s',name:'Subject',students:[{id:'st',name:'Student'}]}],competencies:[{id:'ce',key:'CE1',subjectId:'s'}],criteria:[{id:'ca',key:'CA1',competencyId:'ce'}],activities:[{id:'a',subjectId:'s',title:'Projecte',criteriaIds:['ca'],criteriaMaxScores:{ca:10},endDate:'2026-12-01',grades:{st:{criteriaGrades:{ca:{rawScore:8}}}}}]});
const reject=(d:any,path:string)=>{const report=inspectImport(d);assert.equal(report.valid,false);assert.ok(report.issues.some(i=>i.severity==='error'&&i.path.includes(path)),JSON.stringify(report));assert.throws(()=>normalizeState(d),ImportValidationError);};
test('current default export and central identities round-trip without validation errors',()=>{
  const d=getInitialState();assert.equal(validateState(d),true);assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(d))),{...d,termGradesRecords:[]});
});
test('legacy absent collections become empty, never demo data; explicit invalid fields are not repaired',()=>{
  const d=normalizeState(minimal());assert.deepEqual(d.competencies,[]);assert.deepEqual(d.criteria,[]);assert.deepEqual(d.plans,[]);assert.deepEqual(d.sessionLogs,[]);assert.deepEqual(d.activities,[]);
  for(const value of ['text',{},null,42])reject({...minimal(),activities:value},'activities');
  reject({...minimal(),config:[]},'config');reject({...minimal(),subjects:[null]},'subjects');
});
test('nested grades, attendance, PSI and comments are checked without exposing content in diagnostics',()=>{
  let d=fixture();d.activities[0].grades.st.criteriaGrades.ca.rawScore='eight';reject(d,'rawScore');
  d=fixture();d.studentProfiles={st:{psi:{secret:'private text'}}};reject(d,'psi');assert.ok(!JSON.stringify(inspectImport(d)).includes('private text'));
  d=fixture();d.periodComments={s:{t1:{st:17}}};reject(d,'periodComments');
  d=fixture();d.sessionLogs=[{id:'l',subjectId:'s',scheduleItemId:'slot',date:'2026-09-07',attendance:{st:{status:'unknown'}}}];reject(d,'status');
});
test('invalid numbers, impossible dates, ranges, thresholds and zero maxima are rejected',()=>{
  for(const weight of [-1,Infinity,NaN,'5']){const d=fixture();d.activities[0].weight=weight;reject(d,'weight');}
  for(const date of ['2026-02-30','2026-13-01','tomorrow']){const d=fixture();d.activities[0].endDate=date;reject(d,'endDate');}
  let d=fixture();d.activities[0].startDate='2027-01-01';reject(d,'activities');
  d=fixture();d.activities[0].criteriaMaxScores.ca=0;reject(d,'criteriaMaxScores');
  d=fixture();d.activities[0].grades.st.criteriaGrades.ca.rawScore=11;reject(d,'rawScore');
  d=fixture();d.subjects[0].compSettings={thresholds:{AS:3,AN:2,AE:4}};reject(d,'thresholds');
});
test('duplicates block structural entities but ambiguous students still reach identity review',()=>{
  let d=fixture();d.activities.push({...d.activities[0]});reject(d,'activities');
  d=fixture();d.subjects.push({id:'s2',name:'Other',students:[{id:'st',name:'Another student'}]});const result=inspectImport(d);assert.equal(result.valid,true);assert.ok(result.issues.some(i=>i.message.includes('Identitat ambigua')));
  d=fixture();d.studentRegistry={st:{id:'different',name:'Student'}};reject(d,'studentRegistry');
  d=fixture();d.subjects[0].parentId='s';reject(d,'parentId');
});
test('orphan historical references warn and survive; criteria of another subject block calculation contamination',()=>{
  const d=fixture();d.activities[0].subjectId='deleted';const before=structuredClone(d);const result=prepareImportedState(d);assert.equal(result.state.activities![0].subjectId,'deleted');assert.ok(result.report.issues.some(i=>i.severity==='warning'));assert.deepEqual(d,before);
  const other=fixture();other.competencies[0].subjectId='another';reject(other,'criteriaIds');
});
test('NP, exempt, zero, repeated aspects, pending calculated results and numeric /10 remain valid',()=>{
  const d=fixture();d.activities[0].criteriaIds=['occ1','occ2'];d.activities[0].criteriaReferences={occ1:'ca',occ2:'ca'};d.activities[0].grades={st:{status:'not_submitted',score:0},other:{status:'exempt'}};
  d.termGradesRecords=[{id:'s_annual_mean',subjectId:'s',periodId:'annual',students:{st:{criteria:{},competencies:{},finalGrade:{score:null,qual:''}}}}];assert.equal(inspectImport(d).valid,true);
  d.termGradesRecords[0].students.st.finalGrade.score=9;reject(d,'finalGrade');d.subjects[0].evaluationType='numeric';assert.equal(inspectImport(d).valid,true);
});
test('all load entry points reject invalid input without overwriting local or linked data',async()=>{
  const raw=JSON.stringify({...minimal(),activities:'text'});let writes=0;globalThis.localStorage={getItem:()=>raw,setItem:()=>{writes++;}} as any;
  assert.throws(()=>loadStateFromLocalStorage(),ImportValidationError);
  const handle={getFile:async()=>({text:async()=>raw}),createWritable:async()=>{writes++;}};
  await assert.rejects(loadFromFileHandle(handle),ImportValidationError);assert.equal(writes,0);assert.equal(localStorage.getItem('anything'),raw);
});
test('parser accepts BOM and blocks syntax, reserved keys, excessive depth and large files before reading',async()=>{
  assert.deepEqual(parseImportJson('\uFEFF'+JSON.stringify(minimal())),minimal());assert.throws(()=>parseImportJson('{'));
  const bad=JSON.parse('{"config":{},"subjects":[],"schedule":[],"__proto__":{"polluted":true}}');reject(bad,'dades');assert.equal(({} as any).polluted,undefined);
  const d:any=minimal();let nested=d;for(let i=0;i<65;i++){nested.extra={};nested=nested.extra;}reject(d,'extra');
  let read=false;await assert.rejects(readImportFile({size:21*1024*1024,text:async()=>{read=true;return '{}';}}),/20 MB/);assert.equal(read,false);
});
test('error diagnostics remain visible even after more than 100 historical warnings',()=>{
  const d=fixture();d.activities=Array.from({length:110},(_,i)=>({id:'a'+i,subjectId:'gone',title:'A'}));d.plans=[{id:'p',subjectId:'s',rows:1,cols:1}];d.subjects[0].compSettings={thresholds:{AS:4,AN:2,AE:3}};const r=inspectImport(d);assert.equal(r.valid,false);assert.ok(r.issues.some(i=>i.severity==='error'));assert.ok(r.issues.length<=100);
});
test('malformed recovery index fails without changing its stored contents',()=>{
  const raw='{"unexpected":"object"}';let writes=0;
  globalThis.localStorage={getItem:()=>raw,setItem:()=>{writes++;}} as any;
  assert.throws(recoveryCopies,/malmès/);assert.equal(writes,0);
});
test('unknown extension fields survive but prototype-colliding identities are rejected',()=>{
  const d:any=fixture();d.extension={future:'preserved'};assert.deepEqual((normalizeState(d) as any).extension,d.extension);
  d.subjects[0].students[0].id='toString';reject(d,'students');
});
test('legacy session comment without attendance status remains pending, not present',()=>{
  const d:any=fixture();d.sessionLogs=[{id:'l',scheduleItemId:'slot',subjectId:'s',date:'2026-09-07',attendance:{st:{posComment:'Good'}}}];
  assert.equal(normalizeState(d).sessionLogs[0].attendance.st.status,'pending');assert.equal(d.sessionLogs[0].attendance.st.status,undefined);
});
