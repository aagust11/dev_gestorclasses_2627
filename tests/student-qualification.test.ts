import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import StudentQualificationPage from '../src/components/StudentQualificationPage';
import {getInitialState} from '../src/initialState';
import {filterActivitiesForPeriod} from '../src/utils/gradeCalculations';
import {AppState,CurricularActivity,Subject} from '../src/types';

function fixture(){
 const state=getInitialState() as AppState;
 const subject:Subject={id:'s',name:'Classe de prova',color:'#123456',isGeneral:false,parentId:null,evaluationType:'competencial',students:[{id:'u',name:'Alumne A'},{id:'v',name:'Alumne B'}]};
 state.subjects=[subject];state.competencies=[{id:'ce',subjectId:'s',key:'CE1',description:'Competència de prova'}];state.criteria=[{id:'ca',competencyId:'ce',key:'CA1',description:'Criteri de prova'}];
 state.config.terms=[{id:'pre',name:'Preavaluació',isPreassessment:true,parentTermId:'t1',startDate:'2026-09-01',endDate:'2026-10-15'},{id:'t1',name:'Primer trimestre',startDate:'2026-09-01',endDate:'2026-12-20'}];
 const activity=(id:string,date:string,score:number):CurricularActivity=>({id,code:id,title:id,subjectId:'s',description:'',startDate:date,endDate:date,status:'corrected',termId:'pre',weight:1,resources:[],criteriaIds:['ca'],criteriaGradingType:{ca:'numeric'},criteriaMaxScores:{ca:4},grades:{u:{criteriaGrades:{ca:{rawScore:score}},comment:'Observació individual'}}});
 state.activities=[activity('ACT_PRE','2026-10-01',2),activity('ACT_RESTA','2026-11-01',4),activity('ACT_FORA','2027-02-01',0)];
 state.periodComments={s:{t1:{u:'Comentari compartit'}}};
 state.termGradesRecords=[{id:'s_t1_mean',subjectId:'s',periodId:'t1',calculationMode:'mean',students:{u:{criteria:{},competencies:{},finalGrade:{score:4,qual:'AE',isManual:true}}}}];
 return {state,subject};
}
function render(state:AppState,subject:Subject,periodId:string,studentId='u'){
 return renderToStaticMarkup(React.createElement(StudentQualificationPage,{state,subject,student:subject.students.find(s=>s.id===studentId)!,students:subject.students,activities:filterActivitiesForPeriod(state.activities!,subject.id,periodId,state.config.terms),periodId,method:'mean',onPeriod:()=>{},onMethod:()=>{},onStudent:()=>{},onBack:()=>{},onComment:()=>{},onEdit:()=>{},onActivity:()=>{}}));
}
test('Individual review includes preassessment once, shared period and activity comments, manual and calculated totals',()=>{
 const {state,subject}=fixture();const html=render(state,subject,'t1');
 assert.match(html,/Activitats del període \(2\)/);assert.match(html,/ACT_PRE/);assert.match(html,/ACT_RESTA/);assert.doesNotMatch(html,/ACT_FORA/);
 assert.match(html,/Comentari compartit/);assert.match(html,/Observació individual/);assert.match(html,/4.00/);assert.match(html,/Calculada: 3.00/);
 for(const name of ['Mitjana total','Mediana total','Moda total','CE1','Següent'])assert.ok(html.includes(name));
 state.periodComments!.s.t1.u='Comentari canviat des de la taula';
 assert.match(render(state,subject,'t1'),/Comentari canviat des de la taula/);
 assert.match(render(state,subject,'pre'),/Activitats del període \(1\)/);
 assert.match(render(state,subject,'annual'),/Activitats del període \(3\)/);
});
test('Review preserves NP, exemption, pending results and cleared period semantics',()=>{
 const {state,subject}=fixture();state.activities![0].grades!.u.status='not_submitted';state.activities![1].grades!.u.status='exempt';
 const html=render(state,subject,'t1');assert.match(html,/NP/);assert.match(html,/Exempt/);
 state.termGradesRecords![0].cleared=true;state.termGradesRecords![0].students={};assert.match(render(state,subject,'t1'),/Notes esborrades/);
 const empty=render(state,subject,'t1','v');assert.doesNotMatch(empty,/>Comentari compartit<|Observació individual/);
});
