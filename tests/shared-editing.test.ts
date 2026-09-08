import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {getInitialState} from '../src/initialState';
import {combineSharedState,EditConflict,withSharedWrite} from '../src/utils/sharedEditing';
import {noticeKey,reviewedNotices,reviewNotice} from '../src/utils/noticePreferences';
import Sidebar from '../src/components/Sidebar';
import DataManagement from '../src/components/DataManagement';

const fixture=():any=>({...getInitialState(),activities:[{id:'a',title:'A',grades:{st1:{score:1},st2:{score:2}}}],termGradesRecords:[],studentProfiles:{st1:{notes:'original',psi:'original'}}});
test('two tabs changing separate students and profile fields retain every change',()=>{
  const b=fixture(),l=structuredClone(b),r=structuredClone(b);l.activities[0].grades.st1.score=7;r.activities[0].grades.st2.score=9;l.studentProfiles.st1.notes='local';r.studentProfiles.st1.psi='remote';
  const merged=combineSharedState(b,l,r);assert.equal(merged.activities![0].grades!.st1.score,7);assert.equal(merged.activities![0].grades!.st2.score,9);assert.equal(merged.studentProfiles!.st1.psi,'remote');assert.equal(merged.studentProfiles!.st1.notes,'local');assert.equal(b.activities[0].grades.st1.score,1);
});
test('same field conflicts, convergent edits do not; explicit resolution retains unrelated remote changes',()=>{
  const b=fixture(),l=structuredClone(b),r=structuredClone(b);l.studentProfiles.st1.notes='local';r.studentProfiles.st1.notes='remote';r.studentProfiles.st1.psi='keep';
  assert.throws(()=>combineSharedState(b,l,r),EditConflict);const resolved=combineSharedState(b,l,r,false,true);assert.equal(resolved.studentProfiles!.st1.notes,'local');assert.equal(resolved.studentProfiles!.st1.psi,'keep');
  r.studentProfiles.st1.notes='local';assert.doesNotThrow(()=>combineSharedState(b,l,r));
});
test('independent additions merge by ID, deletion vs modification conflicts',()=>{
  const b=fixture(),l=structuredClone(b),r=structuredClone(b);l.activities.push({id:'new-l',title:'L'});r.activities.push({id:'new-r',title:'R'});assert.equal(combineSharedState(b,l,r).activities!.length,3);
  l.activities=[];r.activities[0].title='changed';assert.throws(()=>combineSharedState(b,l,r),EditConflict);
});
test('rapid local edits merge with remote edits across successive commits',()=>{
  const b=fixture(),one=structuredClone(b),two=structuredClone(b),remote=structuredClone(b);one.studentProfiles.st1.notes='a';two.studentProfiles.st1.notes='ab';remote.studentProfiles.st1.psi='remote';
  const afterOne=combineSharedState(b,one,remote);const afterTwo=combineSharedState(one,two,afterOne);assert.equal(afterTwo.studentProfiles!.st1.notes,'ab');assert.equal(afterTwo.studentProfiles!.st1.psi,'remote');
});
test('an editor opened before remote changes detects stale draft conflicts',()=>{
  const opened=fixture(),latest=structuredClone(opened);latest.activities[0].title='remote title';const submitted=structuredClone(latest);submitted.activities[0].title='my draft';assert.throws(()=>combineSharedState(opened,submitted,latest),EditConflict);
});
test('logical term records merge students despite different record IDs',()=>{
  const b=fixture(),l=structuredClone(b),r=structuredClone(b);b.termGradesRecords=[{id:'old',subjectId:'s',periodId:'annual',calculationMode:'mean',students:{}}];l.termGradesRecords=[{...b.termGradesRecords[0],id:'local',students:{a:{finalGrade:{score:1}}}}];r.termGradesRecords=[{...b.termGradesRecords[0],students:{b:{finalGrade:{score:3}}}}];const result=combineSharedState(b,l,r);assert.equal(result.termGradesRecords!.length,1);assert.equal(Object.keys(result.termGradesRecords![0].students).length,2);
});
test('restores/imports form a new generation; stale edits cannot merge into it even with force',()=>{
  const b=fixture(),l=structuredClone(b),r={...fixture(),workspaceGeneration:'new'};l.studentProfiles.st1.notes='local';assert.throws(()=>combineSharedState(b,l,r),EditConflict);assert.throws(()=>combineSharedState(b,l,r,false,true),EditConflict);
  assert.throws(()=>combineSharedState(b,l,r,true),EditConflict);
});
test('transaction lock serializes writes across tabs and releases on failure',async()=>{
  let tail=Promise.resolve(),active=0,max=0;
  const locks={request:(_n:any,_o:any,fn:any)=>{const result=tail.then(fn);tail=result.catch(()=>{});return result;}} as unknown as LockManager;
  let value=0;await Promise.all(Array.from({length:10},()=>withSharedWrite(locks,async()=>{active++;max=Math.max(max,active);const old=value;await Promise.resolve();value=old+1;active--;})));assert.equal(value,10);assert.equal(max,1);
  await assert.rejects(withSharedWrite(locks,async()=>{throw Error('failed');}));await withSharedWrite(locks,async()=>{value++;});assert.equal(value,11);
});
test('reviewed notices persist without changing application data and new messages remain new',()=>{
  const memory=new Map();globalThis.localStorage={getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>memory.set(k,v)} as any;
  memory.set('gestor_classes_app_state','unchanged');const id=noticeKey('file','old.json');reviewNotice([],id);assert.ok(reviewedNotices().includes(id));assert.ok(!reviewedNotices().includes(noticeKey('file','new.json')));assert.equal(memory.get('gestor_classes_app_state'),'unchanged');
});
test('data menu exposes recovery actions and reviewed notices are hidden by default',()=>{
  assert.match(renderToStaticMarkup(React.createElement(Sidebar,{activeView:'horari',onViewChange:()=>{},dataBadge:'2'})),/Dades i desat/);
  const noop=()=>{};const props:any={status:'saved',busy:false,canEdit:true,linkedFileName:null,availableName:'old.json',notices:[{kind:'file',key:'seen',message:'unique reviewed message'}],reviewed:['seen'],conflicts:[],copies:[],onReview:noop,onRetry:noop,onKeepLocal:noop,onDiscard:noop,onDownload:noop,onForget:noop,onConnect:noop,onKeepCurrent:noop,onChooseFile:noop,onRenew:noop,onOpenRecovery:noop,onClearCopies:noop,onRestore:noop,onImport:noop,onDownloadOriginal:noop};
  const html=renderToStaticMarkup(React.createElement(DataManagement,props));assert.doesNotMatch(html,/unique reviewed message/);assert.match(html,/Oblidar l’enllaç/);assert.match(html,/Arxivar i eliminar/);
});
