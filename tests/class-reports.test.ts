import test from 'node:test';
import assert from 'node:assert/strict';
import {getInitialState} from '../src/initialState';
import {inspectImport} from '../src/utils/importValidation';
import {classPeriodSummary,buildClassReport} from '../src/utils/classReport';
import {annualProposals,buildStudentReport} from '../src/utils/studentReport';
import {buildStudentPdf,buildStudentWord} from '../src/utils/studentReportExport';
import {buildReportPdf,buildReportWord} from '../src/utils/reportDocument';
import {getTermForDate} from '../src/utils/dateHelpers';
import {filterActivitiesForPeriod} from '../src/utils/gradeCalculations';
import {writeFile,mkdir} from 'node:fs/promises';

function fixture():any{
  const s:any=getInitialState();s.config.terms=[{id:'preassessment',name:'Preavaluació',isPreassessment:true,parentTermId:'t1',startDate:'2026-09-01',endDate:'2026-10-15'},{id:'t1',name:'1r trimestre',startDate:'2026-09-01',endDate:'2026-12-20'},{id:'t2',name:'2n trimestre',startDate:'2027-01-01',endDate:'2027-03-30'},{id:'t3',name:'3r trimestre',startDate:'2027-04-01',endDate:'2027-06-30'}];s.config.teacherProfile={fullName:'Docent de prova',email:'docent@example.org'};
  s.subjects=[{id:'s',name:'Matemàtiques · 3r A',color:'#2563eb',isGeneral:false,parentId:null,evaluationType:'numeric',numericItems:[{id:'i',code:'P',name:'Proves',weight:100}],students:Array.from({length:5},(_,i)=>({id:'u'+i,name:'Alumne '+i+' Cognom'}))}];s.competencies=[];s.criteria=[];s.schedule=[];s.sessionLogs=[];s.plans=[];s.termGradesRecords=[];
  const activity=(id:string,date:string,score:number)=>({id,subjectId:'s',code:id,title:'Activitat de prova',description:'',startDate:'2026-09-01',endDate:date,termId:'t1',status:'auto',weight:1,resources:[],criteriaIds:[],numericItemId:'i',grades:{u0:{score},u1:{score:7},u2:{score:5},u3:{score:2}}});
  s.activities=[activity('a','2026-10-01',10),activity('b','2026-11-01',0)];return s;
}
test('preassessment stays inside first term, has separate grades and is excluded from annual term averaging',()=>{
  const s=fixture(),subject=s.subjects[0];assert.ok(inspectImport(s).valid);
  assert.equal(filterActivitiesForPeriod(s.activities,'s','preassessment',s.config.terms).length,1);assert.equal(filterActivitiesForPeriod(s.activities,'s','t1',s.config.terms).length,2);
  assert.equal(classPeriodSummary(s,subject,'preassessment','mean').grades.u0.finalGrade.score,10);assert.equal(classPeriodSummary(s,subject,'t1','mean').grades.u0.finalGrade.score,5);
  assert.equal(annualProposals(s,subject,'u0','mean').total,3);
  assert.equal(getTermForDate('2026-10-01',s.config.terms)?.name,'Preavaluació · 1r trimestre');assert.equal(getTermForDate('2026-11-01',s.config.terms)?.name,'1r trimestre');
  s.config.terms[0].endDate='2027-01-01';assert.ok(!inspectImport(s).valid);
});
test('class percentages include pending pupils in denominator and honor manual grades in each method',()=>{
  const s=fixture(),subject=s.subjects[0];let summary=classPeriodSummary(s,subject,'preassessment','mean');assert.deepEqual(summary.counts,{AE:1,AN:1,AS:1,NA:1});assert.equal(summary.pending,1);assert.equal(summary.percentages.NA,20);
  for(const mode of ['mean','median','mode'] as const){s.termGradesRecords=[{id:'manual-'+mode,subjectId:'s',periodId:'preassessment',calculationMode:mode,students:{u0:{criteria:{},competencies:{},items:{},finalGrade:{score:1,qual:'NA',isManual:true}}}}];summary=classPeriodSummary(s,subject,'preassessment',mode);assert.equal(summary.counts.NA,2);assert.equal(summary.percentages.NA,40);}
  const empty={...subject,students:[]};assert.equal(classPeriodSummary(s,empty,'annual','mean').percentages.NA,0);
});
test('teacher and preassessment survive JSON, malformed profile fails validation',()=>{
  const s=JSON.parse(JSON.stringify(fixture()));assert.ok(inspectImport(s).valid);s.config.teacherProfile.email='wrong';assert.ok(!inspectImport(s).valid);s.config.teacherProfile='text';assert.ok(!inspectImport(s).valid);
});
test('individual and class Word/PDF generate with teacher and footer, including multipage group report',async()=>{
  const s=fixture();s.studentProfiles={u0:{psi:'PRIVATE_PSI',supportMeasures:'Temps addicional',notes:'Seguiment docent'}};
  const student=buildStudentReport(s,'u0');assert.equal(student.teacher?.email,'docent@example.org');assert.ok(!JSON.stringify(student).includes('PRIVATE_PSI'));
  s.subjects[0].students=Array.from({length:35},(_,i)=>({id:'u'+i,name:`Alumne ${i} Cognom de prova`}));
  const group=buildClassReport(s,s.subjects[0],'annual','mean');assert.equal(group.sections[1].rows.length,5);
  const outputs=await Promise.all([buildStudentWord(student),buildStudentPdf(student),buildReportWord(group),buildReportPdf(group)]);outputs.forEach(b=>assert.ok(b.size>1000));
  const pdfText=Buffer.from(await outputs[3].arrayBuffer()).toString('latin1');assert.match(pdfText,/^%PDF/);assert.equal(group.teacher?.email,'docent@example.org');
  if(process.env.REPORT_QA_DIR){await mkdir(process.env.REPORT_QA_DIR,{recursive:true});for(let i=0;i<outputs.length;i++)await writeFile(`${process.env.REPORT_QA_DIR}/${['student.docx','student.pdf','class.docx','class.pdf'][i]}`,Buffer.from(await outputs[i].arrayBuffer()));}
});
