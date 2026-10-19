import test from 'node:test';
import assert from 'node:assert/strict';
import {getInitialState} from '../src/initialState';
import {AppState,CurricularActivity,Subject} from '../src/types';
import {registerRecovery,closeEvaluation,reopenEvaluation,annulRecovery,prepareRecovery,createRecoveryTask,setRecoveryPending} from '../src/utils/recoveries';
import {recoveryScore,recoveryQual,DEFAULT_RECOVERY,closedPeriod} from '../src/utils/recoveryModel';
import {periodGrades} from '../src/utils/gradeSelectors';
import {getActivityScore,getCriterionScore,activitySummary,buildActivitiesWorkbook,DEFAULT_COMP_SETTINGS} from '../src/utils/gradeCalculations';
import {inspectImport} from '../src/utils/importValidation';
import {mergeEdits,combineSharedState} from '../src/utils/sharedEditing';
import {normalizeState} from '../src/storage';
import {deleteStudent} from '../src/utils/deleteStudent';
const date=new Date().toISOString().slice(0,10);
function fixture(numeric=false):AppState{
 const state=getInitialState();
 const subject:Subject={id:'s',name:'Tecnologia',color:'#123456',isGeneral:false,parentId:null,evaluationType:numeric?'numeric':'competencial',compSettings:{...structuredClone(DEFAULT_COMP_SETTINGS),maxFailedCompetencies:0},students:[{id:'u',name:'Alumne U'},{id:'v',name:'Alumne V'}],numericItems:numeric?[{id:'i',code:'I1',name:'Proves',weight:100}]:undefined};
 state.subjects=[subject];state.studentRegistry={u:subject.students[0],v:subject.students[1]};state.schedule=[];state.sessionLogs=[];state.plans=[];state.competencies=[{id:'ce',subjectId:'s',key:'CE1',description:''}];state.criteria=[{id:'ca',competencyId:'ce',key:'CA1',description:''}];
 state.config.terms=[{id:'pre',name:'Preavaluació',startDate:'2026-09-01',endDate:'2026-10-15',isPreassessment:true,parentTermId:'t1'},{id:'t1',name:'Primer trimestre',startDate:'2026-09-01',endDate:'2026-12-20'}];
 state.activities=[{id:'a',subjectId:'s',code:'A1',title:'Dossier',description:'',startDate:'2026-09-01',endDate:'2026-10-01',termId:'pre',status:'auto',weight:2,resources:[],criteriaIds:['ca'],criteriaGradingType:{ca:'numeric'},criteriaMaxScores:{ca:20},numericItemId:numeric?'i':undefined,grades:{u:{status:'not_submitted'},v:{criteriaGrades:{ca:{rawScore:5}}}}}];
 return state;
}
const input=(score=20)=>({date,originalDate:'2026-10-01',observations:'Nova evidència',exceptionReason:'',waive:false,evidence:{'criterion:ca':{rawScore:score,maxScore:20}}});
const activity=(s:AppState)=>s.activities![0];
const grade=(s:AppState,p='t1',m:'mean'|'median'|'mode'='mean')=>periodGrades(s,s.subjects[0],p,m).u.finalGrade;

test('NP recovery replaces one weighted evidence, freezes preassessment, and preserves raw original and attempt',()=>{
 let s=fixture();s=closeEvaluation(s,s.subjects[0],'pre','Preavaluació');const frozen=JSON.stringify(grade(s,'pre'));
 s=registerRecovery(s,'a','u',input());
 const r=activity(s).recoveries!.u,attempt=r.attempts[0];assert.equal(r.original.status,'not_submitted');assert.equal(activity(s).grades!.u.status,'not_submitted');assert.equal(attempt.results[0].evidence.rawScore,20);assert.equal(attempt.results[0].demonstratedQual,'AE');assert.equal(attempt.results[0].computableQual,'AN');
 assert.equal(s.activities!.length,1);for(const m of ['mean','median','mode'] as const){assert.equal(grade(s,'t1',m).qual,'AN');assert.equal(JSON.stringify(grade(s,'pre',m)),frozen);}
 assert.equal(activitySummary(s.activities!,'u',s.subjects[0]).np,0);assert.equal(activitySummary(s.activities!,'u',s.subjects[0]).evaluated,1);
 assert.ok(inspectImport(s).valid,JSON.stringify(inspectImport(s).issues));
});
test('NA is unpenalized by default, NP before closure too; exceptions require justification',()=>{
 let s=fixture();assert.equal(prepareRecovery(s,activity(s),'u',input()).policy,'none');s=closeEvaluation(s,s.subjects[0],'pre','Close');assert.equal(prepareRecovery(s,activity(s),'v',input()).policy,'none');
 s.subjects[0]={...s.subjects[0],recoverySettings:{...DEFAULT_RECOVERY,applyToNA:true}};assert.equal(prepareRecovery(s,activity(s),'v',input()).policy,'lower_level');
 assert.throws(()=>prepareRecovery(s,activity(s),'u',{...input(),waive:true}),/justificació/);
 assert.equal(prepareRecovery(s,activity(s),'u',{...input(),waive:true,exceptionReason:'Absència justificada'}).policy,'none');
});
test('every mapping follows custom thresholds, including exact boundaries, zero and cap AS',()=>{
 const t={AS:1.4,AN:2.3,AE:3.2};for(const [s,q] of [[0,'NA'],[1.39,'NA'],[1.4,'AS'],[2.3,'AS'],[3.2,'AN'],[4,'AN']] as const)assert.equal(recoveryQual(recoveryScore(s,'lower_level',t),t),q);
 for(const s of [2.3,3.2,4])assert.equal(recoveryQual(recoveryScore(s,'cap_as',t),t),'AS');
 assert.equal(recoveryScore(4,'none',t),4);
});
test('numeric activity uses normalized custom scales and latest attempt once, annul restores previous',()=>{
 let s=fixture(true);s.subjects[0].compSettings!.thresholds={AS:1.4,AN:2.3,AE:3.2};s=closeEvaluation(s,s.subjects[0],'pre','Close');s=registerRecovery(s,'a','u',input());
 assert.equal(grade(s).qual,'AN');assert.equal(grade(s).score,getActivityScore(activity(s),'u',s.subjects[0])!*2.5);
 s=registerRecovery(s,'a','u',input(0));assert.equal(grade(s).qual,'NA');assert.equal(grade(s).score,0);
 const attempts=activity(s).recoveries!.u.attempts;s=annulRecovery(s,'a','u',attempts[1].id,'Error de transcripció');assert.equal(grade(s).qual,'AN');assert.equal(activity(s).recoveries!.u.attempts.length,2);
 s=annulRecovery(s,'a','u',attempts[0].id,'Rectificació');assert.equal(grade(s).score,0);assert.equal(activitySummary(s.activities!,'u',s.subjects[0]).np,1);
});
test('partial recovery keeps other criteria and their weight, repeated occurrences remain independent',()=>{
 let s=fixture();activity(s).criteriaIds=['x','y'];activity(s).criteriaReferences={x:'ca',y:'ca'};activity(s).criteriaGradingType={x:'numeric',y:'numeric'};activity(s).criteriaMaxScores={x:10,y:10};activity(s).criteriaWeights={x:1,y:3};
 s.subjects[0].recoverySettings={...DEFAULT_RECOVERY,policy:'none'};
 s=registerRecovery(s,'a','u',{...input(),evidence:{'criterion:x':{rawScore:10}}});
 assert.equal(getCriterionScore(activity(s),'u','x',s.subjects[0]),4);assert.equal(getCriterionScore(activity(s),'u','y',s.subjects[0]),0);assert.equal(grade(s).score,1);
});
test('policies are snapshotted; changes do not rewrite attempts or closed annual periods',()=>{
 let s=fixture();s=closeEvaluation(s,s.subjects[0],'pre','Close');s=registerRecovery(s,'a','u',input());s=closeEvaluation(s,s.subjects[0],'annual','Close');const score=grade(s).score;
 s={...s,subjects:[{...s.subjects[0],recoverySettings:{...DEFAULT_RECOVERY,policy:'none'}}]};assert.equal(grade(s).score,score);
 s=registerRecovery(s,'a','u',input(0));assert.equal(grade(s,'annual').score,score);
 s=reopenEvaluation(s,'s','annual','Rectificació autoritzada');assert.equal(grade(s,'annual').score,0);assert.equal(s.periodSnapshots!.filter(x=>x.periodId==='annual').length,2);
});
test('pending is independent, exemption and completion cannot be recovered',()=>{
 let s=fixture();s=setRecoveryPending(s,activity(s),'u',true);assert.equal(grade(s).score,0);assert.equal(activity(s).recoveries!.u.pending,true);
 activity(s).grades!.u.status='exempt';assert.throws(()=>registerRecovery(s,'a','u',input()));delete activity(s).grades!.u.status;activity(s).assessmentType='completion';assert.throws(()=>registerRecovery(s,'a','u',input()));
});
test('linked task uses explicit target mapping, no extra weight and no nonparticipant exemption',()=>{
 let s=fixture();s=createRecoveryTask(s,{subjectId:'s',title:'Prova conjunta',date,studentIds:['u'],targets:[{activityId:'a',slotKeys:['criterion:ca']}]});const task=s.recoveryTasks![0];
 assert.throws(()=>registerRecovery(s,'a','v',{...input(),sourceTaskId:task.id}),/correspondència/);
 s=registerRecovery(s,'a','u',{...input(),sourceTaskId:task.id});assert.equal(s.activities!.length,1);assert.equal(activity(s).weight,2);assert.equal(activity(s).grades!.v.status,undefined);assert.equal(grade(s).score,4);
});
test('JSON roundtrip retains attempts, snapshots and tasks; rejects corrupt computed grades and duplicate attempts',()=>{
 let s=fixture();s=closeEvaluation(s,s.subjects[0],'pre','Close');s=registerRecovery(s,'a','u',input());const roundtrip=normalizeState(JSON.parse(JSON.stringify(s)));assert.deepEqual(roundtrip.activities,JSON.parse(JSON.stringify(s.activities)));assert.deepEqual(roundtrip.periodSnapshots,s.periodSnapshots);assert.ok(inspectImport(roundtrip).valid);
 const corrupt=structuredClone(s);activity(corrupt).recoveries!.u.attempts[0].results[0].computable=4;assert.equal(inspectImport(corrupt).valid,false);
 const duplicate=structuredClone(s);activity(duplicate).recoveries!.u.attempts.push(activity(duplicate).recoveries!.u.attempts[0]);assert.equal(inspectImport(duplicate).valid,false);
});
test('concurrent students preserve recovery attempts; closures reject stale changes',()=>{
 const base=fixture();const left=registerRecovery(base,'a','u',input()),right=registerRecovery(base,'a','v',input());const merged=mergeEdits(base,left,right);assert.ok(activity(merged).recoveries!.u);assert.ok(activity(merged).recoveries!.v);
 const closed=closeEvaluation(base,base.subjects[0],'pre','Close');assert.throws(()=>combineSharedState(base,left,closed));assert.throws(()=>combineSharedState(base,closed,left));
});
test('disabling application records evidence without changing grades and export preserves all attempts',()=>{
 let s=fixture();s.subjects[0].recoverySettings={...DEFAULT_RECOVERY,updateOpenPeriods:false};s=registerRecovery(s,'a','u',input());assert.equal(grade(s).score,0);assert.equal(activity(s).recoveries!.u.attempts[0].applied,false);
 assert.ok(buildActivitiesWorkbook(s.subjects[0],s.activities!,s.criteria,s.subjects[0].students).SheetNames.includes('Recuperacions'));
 const deleted=deleteStudent(s,'u','Alumne U');assert.equal(activity(deleted).recoveries?.u,undefined);
});

test('recovery and original grading cannot cross silently in either write order',()=>{
 const base=fixture(),recovered=registerRecovery(base,'a','u',input()),changed=structuredClone(base);
 changed.activities![0].grades!.u={criteriaGrades:{ca:{rawScore:2}}};
 assert.throws(()=>combineSharedState(base,recovered,changed));
 assert.throws(()=>combineSharedState(base,changed,recovered));
});
test('pending marker can be removed before an attempt without freezing ordinary grading',()=>{
 let s=fixture();s=setRecoveryPending(s,activity(s),'u',true);s=setRecoveryPending(s,activity(s),'u',false);
 assert.equal(activity(s).recoveries?.u,undefined);
});
test('competencial evidence is retained while policy adjusts only computable results',()=>{
 let s=fixture();activity(s).criteriaGradingType={ca:'competencial'};s=closeEvaluation(s,s.subjects[0],'pre','Close');
 s=registerRecovery(s,'a','u',{...input(),evidence:{'criterion:ca':{competencialScore:'AE'}}});
 assert.equal(activity(s).recoveries!.u.attempts[0].results[0].evidence.competencialScore,'AE');assert.equal(grade(s).qual,'AN');
 assert.ok(inspectImport(s).valid);
});

test('test and numeric aspect recoveries keep their own raw evidence and weighting',()=>{
 let s=fixture(true);activity(s).numericAspects=[{id:'test',label:'Test',weight:2,format:'test',maxScore:10,test:{questions:10,correct:1,blank:0,incorrect:-0.25}},{id:'exercise',label:'Exercici',weight:1,format:'numeric',maxScore:20}];
 s=closeEvaluation(s,s.subjects[0],'pre','Close');
 s=registerRecovery(s,'a','u',{...input(),evidence:{'aspect:test':{testAnswers:{correct:10,blank:0,incorrect:0}},'aspect:exercise':{rawScore:20,maxScore:20}}});
 const results=activity(s).recoveries!.u.attempts[0].results;
 assert.equal(results[0].evidence.testAnswers!.correct,10);assert.equal(results[1].evidence.rawScore,20);assert.equal(grade(s).qual,'AN');assert.ok(inspectImport(s).valid,JSON.stringify(inspectImport(s).issues));
});
