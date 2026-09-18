import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {getInitialState} from '../src/initialState';
import {saveStateToLocalStorage,loadStateFromLocalStorage} from '../src/storage';
import {inspectImport} from '../src/utils/importValidation';
import {buildStudentReport,reportSections} from '../src/utils/studentReport';
import {buildClassReport} from '../src/utils/classReport';
import {buildActivitiesWorkbook,buildTermGradesWorkbook} from '../src/utils/gradeCalculations';
import {hasStudentSupport} from '../src/utils/studentProfile';
import StudentsView from '../src/components/StudentsView';
const secret='TRASPAS_INTERN_RESERVAT_123';
function fixture(){
 const state=getInitialState();state.subjects=[{id:'s',name:'Classe',isGeneral:false,parentId:null,color:'#123456',students:[{id:'u',name:'Alumne Prova'}]}];state.activities=[];state.sessionLogs=[];state.competencies=[];state.criteria=[];state.termGradesRecords=[];state.studentProfiles={u:{internalNotes:secret,additionalComments:'Comentari visible'}};return state;
}
test('internal notes persist and validate independently from PSI',()=>{
 const state=fixture(),values=new Map<string,string>();
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>values.get(k)||null,setItem:(k:string,v:string)=>values.set(k,v)}});
 saveStateToLocalStorage(state);assert.equal(loadStateFromLocalStorage().studentProfiles!.u.internalNotes,secret);
 assert.equal(hasStudentSupport(state,'u'),false);
 assert.equal(inspectImport({...state,studentProfiles:{u:{internalNotes:42}}}).valid,false);
});
test('profile hides internal content by default and reports/workbooks never include it',()=>{
 const state=fixture(),subject=state.subjects[0];
 const html=renderToStaticMarkup(React.createElement(StudentsView,{state,onChange:()=>{},selectedId:'u',onSelect:()=>{},onSession:()=>{}}));
 assert.match(html,/Mostrar comentaris interns/);assert.match(html,/aria-expanded="false" aria-controls="student-internal-notes"/);assert.ok(!html.includes(secret));assert.ok(!html.includes('id="student-internal-notes"'));assert.ok(html.includes('Comentari visible'));
 const report=buildStudentReport(state,'u');
 for(const output of [report,reportSections(report),buildClassReport(state,subject,'annual','mean'),buildActivitiesWorkbook(subject,[],[],subject.students),buildTermGradesWorkbook(subject,'Curs',[],[],{})])assert.ok(!JSON.stringify(output).includes(secret));
 assert.equal(report.additionalComments,'Comentari visible');
});
