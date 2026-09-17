import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as XLSX from 'xlsx';
import {AppState,CurricularActivity,Subject} from '../src/types';
import {getInitialState} from '../src/initialState';
import {normalizeState} from '../src/storage';
import {inspectImport} from '../src/utils/importValidation';
import {DEFAULT_TEST,testResult} from '../src/utils/testScoring';
import {getCriterionScore,getActivityScore,getAspectScore,activitySummary,activityGradeLabel,calculateNumericTermGrades,buildActivitiesWorkbook,buildTermGradesWorkbook} from '../src/utils/gradeCalculations';
import {periodGrades} from '../src/utils/gradeSelectors';
import {exemptExistingActivities,withdrawStudent} from '../src/utils/studentEnrolment';
import {buildStudentReport,reportSections} from '../src/utils/studentReport';
import {buildClassReport} from '../src/utils/classReport';
import {resolveActivityStatus} from '../src/utils/activityStatus';
import ActivityGradePage from '../src/components/ActivityGradePage';
const subject=():Subject=>({id:'s',name:'Classe',isGeneral:false,parentId:null,color:'#123456',students:[{id:'u',name:'Alumne Prova'}],evaluationType:'numeric',numericItems:[{id:'item',code:'EX',name:'Exercicis',weight:100}]});
const act=(patch:Partial<CurricularActivity>={}):CurricularActivity=>({id:'a',subjectId:'s',code:'A',title:'Activitat',description:'',startDate:'2026-09-01',endDate:'2026-10-01',termId:'t1',status:'auto',weight:1,resources:[],criteriaIds:[],numericItemId:'item',...patch});
function fixture():AppState {const s=getInitialState();return {...s,subjects:[subject()],schedule:[],sessionLogs:[],plans:[],activities:[],competencies:[{id:'ce',subjectId:'s',key:'CE1',description:''}],criteria:[{id:'ca',competencyId:'ce',key:'CA1',description:''}],termGradesRecords:[],config:{...s.config,terms:[{id:'t1',name:'T1',startDate:'2026-09-01',endDate:'2026-12-31'}]}};}
test('Fet/No fet remains distinct from pending, NP, Exempt and numeric grades',()=>{
 const s=subject(),activities=[act({id:'done',assessmentType:'completion',grades:{u:{completion:'done',score:9}}}),act({id:'notdone',assessmentType:'completion',grades:{u:{completion:'not_done'}}}),act({id:'np',grades:{u:{status:'not_submitted'}}}),act({id:'ex',grades:{u:{status:'exempt',score:8}}}),act({id:'pending'}),act({id:'partial',criteriaIds:['ca','missing'],grades:{u:{criteriaGrades:{ca:{rawScore:8}}}}}),act({id:'zero',grades:{u:{score:0}}})];
 assert.deepEqual(activitySummary(activities,'u',s),{evaluated:4,np:1,done:1,notDone:1,exempt:1});
 assert.equal(getActivityScore(activities[0],'u',s),null);assert.equal(getActivityScore(activities[1],'u',s),null);
 assert.equal(activityGradeLabel(activities[1],'u',s),'No fet');
 const state=fixture();state.activities=[activities[0]];assert.equal(resolveActivityStatus(state,activities[0]).effectiveStatus,'corrected');
});
test('test scoring uses configured weights, maximum and floor; incomplete answers are not grades',()=>{
 assert.deepEqual(testResult({correct:8,blank:1,incorrect:1}),{raw:7.75,score:7.75,max:10,normalized:3.1});
 assert.equal(testResult({correct:0,blank:0,incorrect:10})?.normalized,0);
 assert.equal(testResult({correct:0,blank:10,incorrect:0})?.normalized,0);
 assert.equal(testResult({correct:0,blank:0,incorrect:0}),null);
 assert.equal(testResult({correct:11,blank:0,incorrect:0}),null);
 assert.equal(testResult({correct:1.5,blank:0,incorrect:0}),null);
 assert.equal(testResult({correct:8,blank:1,incorrect:1},{questions:10,correct:2,blank:1,incorrect:-1})?.normalized,3.2);
});
test('test criteria and numeric subitems feed calculations, NP and exemptions consistently',()=>{
 const state=fixture(),s=state.subjects[0];
 const a=act({criteriaIds:['ca'],criteriaGradingType:{ca:'test'},criteriaTests:{ca:{...DEFAULT_TEST}},grades:{u:{criteriaGrades:{ca:{testAnswers:{correct:8,blank:1,incorrect:1}}}}}});
 assert.equal(getCriterionScore(a,'u','ca',s),3.1);assert.equal(getActivityScore(a,'u',s),3.1);
 state.activities=[a];assert.equal(periodGrades(state,s,'annual','mean').u.competencies.ce.score,3.1);
 const b=act({numericAspects:[{id:'one',label:'Primer exercici',weight:1,maxScore:20,format:'numeric'},{id:'two',label:'Segon exercici',weight:3,maxScore:10,format:'test',test:{...DEFAULT_TEST}}],grades:{u:{aspectGrades:{one:{rawScore:10},two:{testAnswers:{correct:10,blank:0,incorrect:0}}}}}});
 assert.equal(getAspectScore(b,'u','one',s),2);assert.equal(getActivityScore(b,'u',s),3.5);assert.equal(calculateNumericTermGrades(s,[b]).u.finalGrade.score,8.75);
 b.grades!.u.status='not_submitted';assert.equal(getAspectScore(b,'u','two',s),0);assert.equal(getActivityScore(b,'u',s),0);
 b.grades!.u.status='exempt';assert.equal(getActivityScore(b,'u',s),null);assert.equal(getAspectScore(b,'u','one',s),null);
});
test('grade cache updates for test configuration, subitem answers and completion mode',()=>{
 const state=fixture(),s=state.subjects[0];state.activities=[act({numericGradingType:'test',numericTest:{...DEFAULT_TEST},grades:{u:{testAnswers:{correct:8,blank:0,incorrect:2}}}})];
 assert.equal(periodGrades(state,s,'annual','mean').u.finalGrade.score,7.5);
 const changed={...state,activities:state.activities.map(a=>({...a,numericTest:{...DEFAULT_TEST,incorrect:-1}}))};assert.equal(periodGrades(changed,s,'annual','mean').u.finalGrade.score,6);
 const completion={...changed,activities:changed.activities.map(a=>({...a,assessmentType:'completion' as const}))};assert.equal(periodGrades(completion,s,'annual','mean').u.finalGrade.score,null);
 const template=act({numericAspects:[{id:'one',label:'Exercici',weight:1,maxScore:10,format:'numeric'}],grades:{u:{aspectGrades:{one:{rawScore:2}}}}});
 const parts={...state,activities:[template]};assert.equal(periodGrades(parts,s,'annual','mean').u.finalGrade.score,2);
 assert.equal(periodGrades({...parts,activities:[{...template,grades:{u:{aspectGrades:{one:{rawScore:8}}}}}]},s,'annual','mean').u.finalGrade.score,8);
});
test('new enrolments exempt only previously existing activities, preserving history and other pupils',()=>{
 const old=fixture();old.activities=[act({grades:{u:{score:7}}})];
 const next={...old,subjects:[{...old.subjects[0],students:[...old.subjects[0].students,{id:'new',name:'Nou Alumne'}]}],activities:[...old.activities,act({id:'newActivity'})]};
 const applied=exemptExistingActivities(old,next);assert.equal(applied.activities![0].grades!.new.status,'exempt');assert.equal(applied.activities![0].grades!.u.score,7);assert.equal(applied.activities![1].grades?.new,undefined);assert.equal(old.activities[0].grades?.new,undefined);
 assert.deepEqual(exemptExistingActivities(applied,applied),applied);
 const withdrawn=withdrawStudent(old,'u','s');const reenrolled={...withdrawn,subjects:old.subjects};assert.equal(exemptExistingActivities(withdrawn,reenrolled).activities![0].grades!.u.score,7);
});
test('new fields survive validated JSON reload, while corrupt test answers and duplicate subitems are rejected',()=>{
 const state=fixture();state.activities=[act({numericAspects:[{id:'x',label:'Test',format:'test',maxScore:10,weight:1,test:{...DEFAULT_TEST}}],grades:{u:{aspectGrades:{x:{testAnswers:{correct:8,blank:1,incorrect:1}}}}}})];
 assert.equal(inspectImport(state).valid,true);assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(state))).activities,state.activities);
 const duplicate=structuredClone(state);duplicate.activities![0].numericAspects!.push({...duplicate.activities![0].numericAspects![0]});assert.equal(inspectImport(duplicate).valid,false);
 const invalid=structuredClone(state);invalid.activities![0].grades!.u.aspectGrades!.x.testAnswers!.correct=99;assert.equal(inspectImport(invalid).valid,false);
 const config=structuredClone(state);config.activities![0].numericAspects![0].test!.correct=0;assert.equal(inspectImport(config).valid,false);
});
test('student/class reports and Excel include completion and individual NP ratios',()=>{
 const state=fixture(),s=state.subjects[0];state.activities=[act({id:'done',code:'DONE',assessmentType:'completion',grades:{u:{completion:'done'}}}),act({id:'notdone',code:'NO',assessmentType:'completion',grades:{u:{completion:'not_done'}}}),act({id:'np',code:'NP',grades:{u:{status:'not_submitted'}}}),act({id:'ex',code:'EX',grades:{u:{status:'exempt'}}})];
 const report=buildStudentReport(state,'u'),e=report.evaluations.find(e=>e.period.id==='t1')!;assert.equal(e.activitySummary.np,1);assert.equal(e.activitySummary.evaluated,3);assert.match(JSON.stringify(reportSections(report)),/No fet/);
 const group=buildClassReport(state,s,'t1','mean');assert.match(JSON.stringify(group.sections),/1 \/ 3/);assert.match(JSON.stringify(group.sections),/No fet/);
 const wb=buildActivitiesWorkbook(s,state.activities,state.criteria,s.students),rows=XLSX.utils.sheet_to_json<any[]>(wb.Sheets.Activitats,{header:1});assert.equal(rows[3][rows[2].indexOf('NP')],1);assert.equal(rows[3][rows[2].indexOf('Activitats avaluades')],3);assert.equal(rows[3][rows[2].indexOf('NO · Resultat')],'No fet');
 const term=buildTermGradesWorkbook(s,'T1',[],[],{}, {},state.activities),tr=XLSX.utils.sheet_to_json<any[]>(term.Sheets.Qualificacions,{header:1});assert.equal(tr[3][tr[2].indexOf('NP')],1);
 const html=renderToStaticMarkup(React.createElement(ActivityGradePage,{state,subject:s,activity:state.activities[1],onChange:()=>{},onBack:()=>{}}));assert.match(html,/No fet/);assert.match(html,/aria-pressed="true"/);
 state.activities[1].grades!.u.status='exempt';const exempt=renderToStaticMarkup(React.createElement(ActivityGradePage,{state,subject:s,activity:state.activities[1],onChange:()=>{},onBack:()=>{}}));assert.match(exempt,/bg-yellow-100/);
});
