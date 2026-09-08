import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {getInitialState} from '../src/initialState';
import {findOrphanData,removeOrphanData} from '../src/utils/orphanData';
import OrphanDataReview from '../src/components/OrphanDataReview';

const fixture=():any=>({...getInitialState(),subjects:[{id:'s',name:'Matemàtiques',students:[{id:'known',name:'Alumne conegut'}]}],studentRegistry:{},criteria:[],schedule:[{id:'slot',subjectId:'s',dayOfWeek:1,timeSlotId:'missing'}],activities:[{id:'a',subjectId:'s',code:'P1',title:'Fraccions',description:'Exercicis',endDate:'2026-10-01',criteriaIds:['one','two'],criteriaReferences:{one:'deleted',two:'deleted'},criteriaCustomLabels:{one:'Primer aspecte',two:'Segon aspecte'},criteriaWeights:{one:1,two:2},grades:{known:{comment:'Conservar',criteriaGrades:{one:{rawScore:4},two:{rawScore:7}}}}}],sessionLogs:[{id:'log',subjectId:'s',scheduleItemId:'gone',date:'2026-09-08',comments:'Diari important',attendance:{unknown:{status:'absent',incidentComment:'Seguiment pendent'},known:{status:'present',posComment:'Bona feina'}}},{id:'keep',subjectId:'s',scheduleItemId:'slot',date:'2026-09-09',comments:'Següent',attendance:{known:{status:'present'}}}]});
test('groups missing session references while retaining separate unknown pupil review',()=>{
  const s=fixture();s.sessionLogs[0].subjectId='gone';const items=findOrphanData(s);
  assert.equal(items.filter(i=>i.kind==='session').length,1);
  assert.equal(items.filter(i=>i.kind==='attendance').length,1);
  assert.equal(items.filter(i=>i.kind==='criterion').length,2);
  const log=items.find(i=>i.kind==='session')!;assert.match(log.reason,/Assignatura.*horari/);assert.ok(log.details.some(([,v])=>v.includes('Diari important')));assert.ok(log.details.some(([,v])=>v.includes('Seguiment pendent')));
});
test('deleting one repeated criterion removes only its occurrence, config and grade',()=>{
  const s=fixture();const next=removeOrphanData(s,findOrphanData(s).find(i=>i.childId==='one')!);
  assert.deepEqual(next.activities![0].criteriaIds,['two']);assert.equal(next.activities![0].criteriaWeights!.one,undefined);assert.equal(next.activities![0].grades!.known.criteriaGrades!.one,undefined);assert.equal(next.activities![0].grades!.known.criteriaGrades!.two.rawScore,7);assert.equal(next.activities![0].grades!.known.comment,'Conservar');assert.equal(s.activities[0].criteriaIds.length,2);
});
test('unknown attendance deletion preserves session comments and other pupils; full session is explicit',()=>{
  const s=fixture();const items=findOrphanData(s);const next=removeOrphanData(s,items.find(i=>i.kind==='attendance')!);
  assert.equal(next.sessionLogs[0].attendance.unknown,undefined);assert.equal(next.sessionLogs[0].comments,'Diari important');assert.equal(next.sessionLogs[0].attendance.known.posComment,'Bona feina');assert.equal(next.sessionLogs.length,2);
  const removed=removeOrphanData(s,items.find(i=>i.kind==='session')!);assert.deepEqual(removed.sessionLogs.map(l=>l.id),['keep']);assert.deepEqual(removed.activities,s.activities);
});
test('deleting an orphan schedule preserves all diary logs',()=>{
  const s=fixture();const next=removeOrphanData(s,findOrphanData(s).find(i=>i.kind==='schedule')!);assert.equal(next.schedule.length,0);assert.deepEqual(next.sessionLogs,s.sessionLogs);assert.ok(findOrphanData(next).some(i=>i.kind==='session'&&i.parentId==='keep'));
});
test('stale review, repaired references and replaced datasets cannot be deleted',()=>{
  const s=fixture();const item=findOrphanData(s).find(i=>i.kind==='attendance')!;
  const changed=structuredClone(s);changed.sessionLogs[0].attendance.unknown.incidentComment='Nou';assert.throws(()=>removeOrphanData(changed,item),/ha canviat/);
  const repaired=structuredClone(s);repaired.studentRegistry.unknown={id:'unknown',name:'Recuperat'};assert.throws(()=>removeOrphanData(repaired,item),/ha canviat/);
  assert.throws(()=>removeOrphanData({...s,workspaceGeneration:'replacement'} as any,item),/ha canviat/);
  s.sessionLogs.reverse();assert.equal(removeOrphanData(s,item).sessionLogs.find(l=>l.id==='log')!.attendance.unknown,undefined);
});
test('unrelated changes survive targeted cleanup and list does not expose diary comments',()=>{
  const s=fixture();const item=findOrphanData(s).find(i=>i.kind==='attendance')!;s.sessionLogs[1].comments='Canvi en una altra pestanya';assert.equal(removeOrphanData(s,item).sessionLogs[1].comments,'Canvi en una altra pestanya');
  const html=renderToStaticMarkup(React.createElement(OrphanDataReview,{state:s,disabled:false,onRemove:async()=>{}}));assert.match(html,/Veure i decidir/);assert.match(html,/Fraccions/);assert.doesNotMatch(html,/Seguiment pendent/);
});
