import test from 'node:test';
import assert from 'node:assert/strict';
import {getInitialState} from '../src/initialState';
import {withdrawStudent} from '../src/utils/studentEnrolment';
import {buildStudentReport} from '../src/utils/studentReport';
import {studentAttendance} from '../src/utils/attendance';
import {inspectImport} from '../src/utils/importValidation';
import {findOrphanData} from '../src/utils/orphanData';

function fixture():any {
  const state=getInitialState();
  return {...state,config:{...state.config,startDate:'2026-09-01',endDate:'2027-06-30'},subjects:[{id:'s',name:'Matemàtiques',color:'#2563eb',isGeneral:false,parentId:null,students:[{id:'u',name:'Alumne'}],evaluationType:'numeric',numericItems:[{id:'i',name:'Proves',code:'P',weight:100}]}],competencies:[],criteria:[],schedule:[],plans:[],activities:[{id:'a',subjectId:'s',code:'P1',title:'Prova',description:'',startDate:'2026-09-01',endDate:'2026-09-08',status:'auto',termId:'',weight:1,resources:[],criteriaIds:[],numericItemId:'i',grades:{u:{score:8,comment:'Comentari conservat'}}}],sessionLogs:[{id:'l',subjectId:'s',scheduleItemId:'old',date:'2026-09-08',comments:'Diari',attendance:{u:{status:'absent',incidentComment:'Incidència'}}}],termGradesRecords:[],studentProfiles:{u:{psi:'PSI',supportMeasures:'Suport'}},periodComments:{s:{annual:{u:'Comentari anual'}}}};
}
test('withdrawal retains identity, diary, grades and PSI after last enrolment and reload',()=>{
  const s=fixture(),next=withdrawStudent(s,'u','s');
  assert.equal(next.subjects[0].students.length,0);assert.equal(next.studentRegistry!.u.name,'Alumne');assert.deepEqual(next.enrolments!.s,[]);
  for(const key of ['activities','sessionLogs','studentProfiles','periodComments'])assert.deepEqual(next[key],s[key]);
  assert.equal(s.subjects[0].students.length,1);
  const loaded=JSON.parse(JSON.stringify(next));assert.ok(inspectImport(loaded).valid);assert.ok(!findOrphanData(loaded).some(i=>i.kind==='attendance'));
  const report=buildStudentReport(loaded,'u');assert.equal(report.history.length,1);assert.equal(report.evaluations.find(e=>e.period.id==='annual')!.actual.mean.finalGrade.score,8);assert.equal(report.supportMeasures,'Suport');
  const attendance=studentAttendance(loaded,'u','annual','all','2026-09-10');assert.equal(attendance.absent,1);assert.equal(attendance.pending,0);
});
test('withdrawal only affects selected subject and its seating, keeps other enrolments',()=>{
  const s=fixture();s.subjects.push({...s.subjects[0],id:'other',name:'Altra assignatura'});s.plans=[{id:'p',subjectId:'s',seats:{'0,0':'u','0,1':'other-pupil'}},{id:'q',subjectId:'other',seats:{'0,0':'u'}}];
  const next=withdrawStudent(s,'u','s');assert.equal(next.subjects[1].students.length,1);assert.deepEqual(next.plans[0].seats,{'0,1':'other-pupil'});assert.deepEqual(next.plans[1].seats,{'0,0':'u'});assert.throws(()=>withdrawStudent(next,'u','s'),/ja no/);
});
