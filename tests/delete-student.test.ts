import test from 'node:test';
import assert from 'node:assert/strict';
import {getInitialState} from '../src/initialState';
import {deleteStudent,prepareStudentDeletion} from '../src/utils/deleteStudent';
import {combineSharedState} from '../src/utils/sharedEditing';
import {syncStudentRegistry} from '../src/utils/studentIdentity';
import {inspectImport} from '../src/utils/importValidation';
import {createRecoveryCopy,saveStateToLocalStorage,loadStateFromLocalStorage} from '../src/storage';

function fixture():any{
  const s:any=getInitialState();const pupils=[{id:'delete-me',name:'Anna Puig Soler'},{id:'keep-me',name:'Anna Puig Soler'}];
  s.subjects=[{id:'s',name:'Matemàtiques',color:'#fff',isGeneral:false,parentId:null,students:pupils}];
  s.studentProfiles=Object.fromEntries(pupils.map(p=>[p.id,{psi:'PSI',supportMeasures:'Mesures',additionalComments:'Comentaris'}]));
  s.activities=[{id:'a',subjectId:'s',code:'P',title:'Prova',description:'',startDate:'2026-09-01',endDate:'2026-09-08',status:'auto',termId:'',weight:1,resources:[],criteriaIds:[],grades:Object.fromEntries(pupils.map(p=>[p.id,{score:7,comment:'Nota'}]))}];
  s.sessionLogs=[{id:'l',subjectId:'s',scheduleItemId:'old',date:'2026-09-08',comments:'Comentari general',attendance:Object.fromEntries(pupils.map(p=>[p.id,{status:'absent',incidentComment:'Incidència'}]))}];
  s.termGradesRecords=[{id:'r',subjectId:'s',periodId:'annual',calculationMode:'mean',students:Object.fromEntries(pupils.map(p=>[p.id,{criteria:{},competencies:{},finalGrade:{score:3,qual:'AN',isManual:true}}]))}];
  s.periodComments={s:{annual:Object.fromEntries(pupils.map(p=>[p.id,'Comentari anual']))}};
  s.plans=[{id:'p',subjectId:'s',name:'Plànol',rows:1,cols:2,teacherDesk:null,seats:{'0,0':'delete-me','0,1':'keep-me'}}];
  s.identityArchive=[{legacyId:'delete-me',profile:{notes:'Arxiu'}},{legacyId:'keep-me',profile:{notes:'Conservar'}}];
  return syncStudentRegistry(s);
}
test('requires exact typed full name and removes only the chosen identity across all domains',()=>{
  const s=fixture();for(const name of ['','Anna','anna puig soler','Anna Puig Soler '])assert.throws(()=>deleteStudent(s,'delete-me',name),/exactament/);
  const next=deleteStudent(s,'delete-me','Anna Puig Soler');
  assert.ok(!JSON.stringify(next).includes('delete-me'));assert.ok(JSON.stringify(s).includes('delete-me'));
  assert.equal(next.subjects[0].students[0].id,'keep-me');assert.equal(next.sessionLogs[0].comments,'Comentari general');assert.equal(next.sessionLogs[0].attendance['keep-me'].incidentComment,'Incidència');assert.equal(next.activities![0].grades!['keep-me'].score,7);assert.equal(next.studentProfiles!['keep-me'].psi,'PSI');assert.ok(inspectImport(next).valid);
});
test('works after withdrawal and rejects changed data or stale tabs recreating records',()=>{
  const s=fixture();s.subjects[0].students=[];s.enrolments.s=[];
  const next=prepareStudentDeletion(s,structuredClone(s),'delete-me','Anna Puig Soler');assert.ok(!next.studentRegistry!['delete-me']);
  const changed=structuredClone(s);changed.sessionLogs[0].attendance['delete-me'].incidentComment='Nou';assert.throws(()=>prepareStudentDeletion(changed,s,'delete-me','Anna Puig Soler'),/han canviat/);
  assert.throws(()=>combineSharedState(s,changed,next));assert.throws(()=>combineSharedState(s,changed,next,false,true));
});
test('backup retains original while reload does not resurrect the deleted pupil',()=>{
  const memory=new Map<string,string>();globalThis.localStorage={getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>memory.set(k,v)} as any;
  const s=fixture();saveStateToLocalStorage(s);const remote=syncStudentRegistry(loadStateFromLocalStorage());
  const next=prepareStudentDeletion(remote,remote,'delete-me','Anna Puig Soler');
  createRecoveryCopy(remote,'Abans d’eliminar');saveStateToLocalStorage(next);
  const loaded=loadStateFromLocalStorage();assert.ok(!loaded.studentRegistry!['delete-me']);assert.ok(inspectImport(loaded).valid);assert.ok([...memory.entries()].some(([k,v])=>k.includes('recovery')&&v.includes('delete-me')));
});
