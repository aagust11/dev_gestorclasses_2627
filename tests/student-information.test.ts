import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {getInitialState} from '../src/initialState';
import {studentInformation,updateStudentInformation} from '../src/utils/studentInformation';
import {buildStudentReport} from '../src/utils/studentReport';
import {normalizeState} from '../src/storage';
import StudentsView from '../src/components/StudentsView';

test('unified public information retains both legacy texts, saves once and preserves private fields',()=>{
 const state=getInitialState();state.subjects=[{id:'s',name:'Classe',isGeneral:false,parentId:null,color:'#123456',students:[{id:'u',name:'Alumne'}]}];state.studentProfiles={u:{notes:'Informació anterior',additionalComments:'Comentari anterior',internalNotes:'TRASPAS_SECRET',psi:'PSI_SECRET',supportMeasures:'Suport'}};
 const text=studentInformation(state.studentProfiles.u);assert.equal(text,'Informació anterior\n\nComentari anterior');
 const next=updateStudentInformation(state,'u',text+'\nNou text');
 assert.equal(studentInformation(next.studentProfiles!.u),text+'\nNou text');assert.equal(next.studentProfiles!.u.additionalComments,'');assert.equal(state.studentProfiles.u.additionalComments,'Comentari anterior');
 assert.equal(next.studentProfiles!.u.internalNotes,'TRASPAS_SECRET');assert.equal(next.studentProfiles!.u.psi,'PSI_SECRET');assert.equal(next.studentProfiles!.u.supportMeasures,'Suport');
 assert.equal(studentInformation(normalizeState(JSON.parse(JSON.stringify(next))).studentProfiles!.u),text+'\nNou text');
 assert.equal(studentInformation(buildStudentReport(state,'u')),text);assert.equal(studentInformation(buildStudentReport(next,'u')),text+'\nNou text');
 assert.equal(studentInformation(updateStudentInformation(next,'u','').studentProfiles!.u),'');
 const html=renderToStaticMarkup(React.createElement(StudentsView,{state,onChange:()=>{},selectedId:'u',onSelect:()=>{},onSession:()=>{},onDelete:async()=>{}}));
 assert.ok(html.includes(text));assert.ok(!html.includes('TRASPAS_SECRET'));assert.ok(!html.includes('PSI_SECRET'));
 const order=['Editar noms','Eliminar alumne','Informació de l’alumne','Comentaris interns de traspàs','PSI i mesures de suport','Matrícules actives','Notes i comentaris del trimestre / curs','Seguiment de les activitats','Avaluació de les competències','Assistència i seguiment de les sessions'];
 for(let i=1;i<order.length;i++)assert.ok(html.indexOf(order[i])>html.indexOf(order[i-1]),order[i]);
 assert.equal((html.match(/<textarea/g)||[]).length,1);
});
