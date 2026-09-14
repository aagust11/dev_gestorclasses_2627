import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {getInitialState} from '../src/initialState';
import {updateStudentNames,classroomName,searchableStudentName} from '../src/utils/studentNames';
import {normalizeState,validateState} from '../src/storage';
import {buildStudentReport} from '../src/utils/studentReport';
import {combineSharedState,EditConflict} from '../src/utils/sharedEditing';
import {syncStudentRegistry} from '../src/utils/studentIdentity';
import StudentName from '../src/components/StudentName';
import StudentNamesEditor from '../src/components/StudentNamesEditor';

function fixture(){const student={id:'person',name:'Nom anterior'};return syncStudentRegistry({...getInitialState(),subjects:['a','b'].map(id=>({id,name:id,students:[student],color:'#fff',isGeneral:false,parentId:null})),activities:[],sessionLogs:[],plans:[],termGradesRecords:[],studentProfiles:{person:{psi:'Suport privat',additionalComments:'Seguiment'}},periodComments:{a:{annual:{person:'Comentari'}}}});}
test('rename keeps identity, both rosters and all student records; official and preferred names round-trip',()=>{
  const base=fixture(),next=updateStudentNames(base,'person','  Maria Oficial  ','  Mar  ');
  assert.equal(base.studentRegistry!.person.name,'Nom anterior');
  for(const subject of next.subjects){assert.equal(subject.students[0].id,'person');assert.equal(subject.students[0].name,'Maria Oficial');assert.equal(subject.students[0].preferredName,'Mar');}
  assert.deepEqual(next.studentProfiles,base.studentProfiles);assert.deepEqual(next.periodComments,base.periodComments);assert.deepEqual(next.enrolments,base.enrolments);
  const restored=normalizeState(JSON.parse(JSON.stringify(next)));assert.equal(restored.studentRegistry!.person.preferredName,'Mar');
  assert.equal(buildStudentReport(restored,'person').name,'Maria Oficial');
  const student=restored.studentRegistry!.person;
  assert.equal(classroomName(student),'Mar');assert.match(searchableStudentName(student),/Maria Oficial Mar/);
  assert.equal(renderToStaticMarkup(React.createElement(StudentName,{state:{...restored,studentProfiles:{}},student})),'Mar');
  assert.equal(renderToStaticMarkup(React.createElement(StudentName,{state:{...restored,studentProfiles:{}},student,official:true})),'Maria Oficial');
});
test('empty preferred name falls back, blank official and malformed preferred names are rejected',()=>{
  const base=fixture();assert.equal(classroomName(base.studentRegistry!.person),'Nom anterior');
  assert.throws(()=>updateStudentNames(base,'person','  ','Mar'),/buit/);
  assert.throws(()=>updateStudentNames(base,'missing','Nom',''),/existeix/);
  const next=updateStudentNames(base,'person','Oficial',' ');assert.equal(classroomName(next.studentRegistry!.person),'Oficial');
  assert.equal(validateState({...next,studentRegistry:{person:{...next.studentRegistry!.person,preferredName:42}}}),false);
});
test('renaming an archived pupil does not enroll them; concurrent edits preserve unrelated records and reject conflicting names',()=>{
  const base=fixture();base.subjects=base.subjects.map(s=>({...s,students:[]}));
  const local=updateStudentNames(base,'person','Oficial','Habitual');assert.equal(local.subjects[0].students.length,0);
  const remote={...base,studentProfiles:{person:{psi:'Nou suport'}}};
  const merged=combineSharedState(base,local,remote);assert.equal(merged.studentProfiles!.person.psi,'Nou suport');assert.equal(merged.studentRegistry!.person.name,'Oficial');
  assert.throws(()=>combineSharedState(base,local,updateStudentNames(base,'person','Altre','Habitual')),EditConflict);
});
test('profile displays both names and offers explicit editing',()=>{
  const state=updateStudentNames(fixture(),'person','Oficial','Habitual');
  const html=renderToStaticMarkup(React.createElement(StudentNamesEditor,{state,student:state.studentRegistry!.person,onChange:()=>{}}));
  assert.match(html,/Editar noms/);assert.match(html,/Oficial/);assert.match(html,/Habitual/);assert.match(html,/qualificacions i informes/);
});
