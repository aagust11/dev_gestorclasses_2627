import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {sortRows,SortButton} from '../src/components/TableSort';
import {getInitialState} from '../src/initialState';
import {resolveActivityStatus,activitiesOverview} from '../src/utils/activityStatus';
import ActivitatsView from '../src/components/ActivitatsView';
const fixture=():any=>({...getInitialState(),subjects:[{id:'p',name:'3TEC',isParent:true,students:[]},{id:'s',name:'3A TEC',parentId:'p',students:[{id:'u',name:'Àngel'}],evaluationType:'numeric'},{id:'b',name:'3B TEC',parentId:'p',students:[{id:'u',name:'Àngel'}],evaluationType:'numeric'}],activities:[],competencies:[],criteria:[]});
const activity=(id:string,patch:any={}):any=>({id,code:id,title:id,subjectId:'s',criteriaIds:[],status:'auto',startDate:'2026-09-01',endDate:'2026-09-10',...patch});
test('sort toggles directions, handles Catalan and numeric identifiers without mutating data',()=>{
  const rows=[{name:'Zoe',n:10},{name:'Àngel',n:2},{name:'Anna',n:null}],original=structuredClone(rows);
  assert.deepEqual(sortRows(rows,{key:'name',direction:'asc'},r=>r.name).map(r=>r.name),['Àngel','Anna','Zoe']);
  assert.deepEqual(sortRows(rows,{key:'name',direction:'desc'},r=>r.name).map(r=>r.name),['Zoe','Anna','Àngel']);
  assert.deepEqual(sortRows(rows,{key:'n',direction:'desc'},r=>r.n).map(r=>r.n),[10,2,null]);assert.deepEqual(rows,original);
  assert.deepEqual(sortRows(['CA10','CA2'],{key:'x',direction:'asc'},r=>r),['CA2','CA10']);
});
test('sort button announces next direction and invokes column without changing rows',()=>{
  let key='';const props={label:'Alumne',column:'name',sort:{key:'name',direction:'asc' as const},onSort:(k:string)=>{key=k;}};
  const element=SortButton(props);element.props.onClick();assert.equal(key,'name');assert.match(renderToStaticMarkup(React.createElement(SortButton,props)),/descendent/);
});
test('overview status agrees with dates, manual states, NP and exempt completion',()=>{
  const s=fixture(),today='2026-09-08';
  const examples=[activity('future',{startDate:'2026-10-01'}),activity('open'),activity('late',{endDate:'2026-09-01'}),activity('done',{grades:{u:{status:'exempt'}}}),activity('np',{grades:{u:{status:'not_submitted'}}}),activity('manual',{status:'not_open',grades:{u:{score:10}}})];
  s.activities=examples;assert.deepEqual(examples.map(a=>resolveActivityStatus(s,a,today).effectiveStatus),['not_open','open','pending_correction','corrected','corrected','not_open']);
  const row=activitiesOverview(s,'annual',today).find(r=>r.subject.id==='s')!;assert.equal(row.total,6);assert.equal(row.not_open,2);assert.equal(row.corrected,2);
});
test('inherited activities are separate and parent completion respects each child enrolment',()=>{
  const s=fixture();s.activities=[activity('parent',{subjectId:'p',code:'P1'}),activity('copy',{subjectId:'s',code:'P1',grades:{u:{score:8}}})];
  assert.equal(resolveActivityStatus(s,s.activities[0],'2026-09-08').gradedStudents,1);assert.equal(resolveActivityStatus(s,s.activities[0],'2026-09-08').effectiveStatus,'open');
  const overview=activitiesOverview(s);assert.equal(overview.find(r=>r.subject.id==='s')!.inherited,0);assert.equal(overview.find(r=>r.subject.id==='b')!.inherited,1);assert.equal(overview.find(r=>r.subject.id==='b')!.total,0);
  s.config.terms=[{id:'t',name:'T',startDate:'2026-10-01',endDate:'2026-12-01'}];assert.ok(activitiesOverview(s,'t').every(r=>r.total===0&&r.inherited===0));
});
test('activities initially opens the class overview instead of dossier and coverage',()=>{
  const html=renderToStaticMarkup(React.createElement(ActivitatsView,{state:fixture(),onChangeState:()=>{}}));assert.match(html,/Resum de classes/);assert.match(html,/3A TEC/);assert.match(html,/Pendents d’obrir/);assert.doesNotMatch(html,/Dossier d.Activitats/);
});
