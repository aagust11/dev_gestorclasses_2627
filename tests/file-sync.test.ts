import test from 'node:test';
import assert from 'node:assert/strict';
import {getInitialState} from '../src/initialState';
import {AppState} from '../src/types';
import {mergeFileStates,synchronizeFile} from '../src/utils/fileSync';
import {EditConflict} from '../src/utils/sharedEditing';

const fixture=()=>({...getInitialState(),subjects:[],sessionLogs:[],activities:[],plans:[],termGradesRecords:[]});
function disk(state:AppState){
  const d={raw:JSON.stringify(state),writes:0,aborts:0,closes:0,onWrite:()=>{},onClose:()=>{},failClose:false};
  const handle={getFile:async()=>{const raw=d.raw;return {size:raw.length,text:async()=>raw};},createWritable:async()=>{
    d.writes++;let buffer='';return {write:async(raw:string)=>{buffer=raw;d.onWrite();},close:async()=>{if(d.failClose)throw Error('disk full');d.raw=buffer;d.closes++;d.onClose();},abort:async()=>{d.aborts++;}};
  }};
  return {d,handle};
}
function session(){let current:AppState|undefined;const backups:AppState[]=[];return {backups,get current(){return current;},options:{backup:(s:AppState)=>{backups.push(structuredClone(s));},commit:(s:AppState)=>{current=s;}}};}
test('new device adopts downloaded changes without rewriting the file; baseline survives restart',async()=>{
  const base=fixture(),remote=structuredClone(base);remote.config.teacherProfile={fullName:'Centre',email:'centre@example.com'};
  const {d,handle}=disk(remote),s=session();
  const merged=await synchronizeFile(handle,base,JSON.parse(JSON.stringify(base)),s.options);
  assert.equal(merged.config.teacherProfile.fullName,'Centre');assert.equal(d.writes,0);assert.equal(s.backups.length,2);
  await synchronizeFile(handle,merged,merged,s.options);assert.equal(d.writes,0);
});
test('different changes on two devices merge and persist, including after a failed local commit',async()=>{
  const base=fixture(),local=structuredClone(base),remote=structuredClone(base);
  local.config.teacherProfile={fullName:'Àngel',email:'angel@example.com'};remote.config.holidays=[{date:'2026-10-12',label:'Festa'}];
  const {d,handle}=disk(remote),s=session();
  await assert.rejects(synchronizeFile(handle,local,base,{...s.options,commit:()=>{throw Error('quota');}}),/quota/);
  assert.equal(JSON.parse(d.raw).config.teacherProfile.fullName,'Àngel');
  const recovered=await synchronizeFile(handle,local,base,s.options);
  assert.deepEqual(recovered.config.holidays,[{date:'2026-10-12',label:'Festa'}]);assert.equal(recovered.config.teacherProfile.fullName,'Àngel');assert.equal(d.writes,1);
});
test('conflicting same-field edits never write; explicit local choice retains other remote changes and backups',async()=>{
  const base=fixture();base.config.teacherProfile={fullName:'Inicial',email:'a@example.com'};
  const local=structuredClone(base),remote=structuredClone(base);local.config.teacherProfile.fullName='Casa';remote.config.teacherProfile.fullName='Centre';remote.config.holidays=[{date:'2026-10-12',label:'Festa'}];
  const {d,handle}=disk(remote),s=session(),original=d.raw;
  await assert.rejects(synchronizeFile(handle,local,base,s.options),EditConflict);assert.equal(d.raw,original);assert.equal(d.writes,0);assert.equal(s.current,undefined);
  const resolved=await synchronizeFile(handle,local,base,{...s.options,preferLocal:true});
  assert.equal(resolved.config.teacherProfile.fullName,'Casa');assert.deepEqual(resolved.config.holidays,remote.config.holidays);assert.equal(s.backups.length,2);
});
test('legacy links without a baseline cannot overwrite different data',async()=>{
  const local=fixture(),remote=structuredClone(local);remote.config.holidays=[{date:'2026-10-12',label:'Festa'}];const {d,handle}=disk(remote);
  await assert.rejects(synchronizeFile(handle,local,null,session().options),/referència segura/);assert.equal(d.writes,0);
  assert.doesNotThrow(()=>mergeFileStates(null,remote,remote));
});
test('invalid or truncated external JSON is never committed or overwritten',async()=>{
  for(const raw of ['{"config":',JSON.stringify({...fixture(),activities:'wrong'})]){
    const {d,handle}=disk(fixture());d.raw=raw;const s=session();await assert.rejects(synchronizeFile(handle,fixture(),fixture(),s.options));assert.equal(d.raw,raw);assert.equal(d.writes,0);assert.equal(s.current,undefined);
  }
});
test('external edit during writing aborts before close and does not advance browser or baseline',async()=>{
  const base=fixture(),local=structuredClone(base),remote=structuredClone(base);local.config.holidays=[{date:'2026-10-12',label:'Festa'}];remote.config.holidays=[{date:'2026-11-02',label:'Festa'}];
  const {d,handle}=disk(base),s=session();d.onWrite=()=>{d.raw=JSON.stringify(remote);};
  await assert.rejects(synchronizeFile(handle,local,base,s.options),/durant el desat/);assert.equal(d.closes,0);assert.equal(d.aborts,1);assert.equal(s.current,undefined);assert.deepEqual(JSON.parse(d.raw),remote);
});
test('close failure and external replacement after close are detected',async()=>{
  const base=fixture(),local=structuredClone(base);local.config.holidays=[{date:'2026-10-12',label:'Festa'}];
  const {d,handle}=disk(base),s=session();d.failClose=true;await assert.rejects(synchronizeFile(handle,local,base,s.options),/disk full/);assert.equal(s.current,undefined);
  d.failClose=false;d.onClose=()=>{d.raw=JSON.stringify(base);};await assert.rejects(synchronizeFile(handle,local,base,s.options),/just després/);assert.equal(s.current,undefined);
});
test('replacements and destructive generations cannot be merged into concurrent edits, even with local preference',()=>{
  const base=fixture(),local=structuredClone(base),remote={...structuredClone(base),workspaceGeneration:'deleted-student'};
  local.config.holidays=[{date:'2026-10-12',label:'Festa'}];
  assert.throws(()=>mergeFileStates(base,local,remote),EditConflict);assert.throws(()=>mergeFileStates(base,local,remote,true),EditConflict);
  assert.equal((mergeFileStates(base,base,remote) as any).workspaceGeneration,'deleted-student');
});
test('backup failure stops writes and commits',async()=>{
  const base=fixture(),local=structuredClone(base),remote=structuredClone(base);local.config.holidays=[{date:'2026-10-12',label:'Festa'}];remote.config.teacherProfile={fullName:'Docent',email:'a@example.com'};
  const {d,handle}=disk(remote),s=session();await assert.rejects(synchronizeFile(handle,local,base,{...s.options,backup:()=>{throw Error('quota');}}),/quota/);assert.equal(d.writes,0);assert.equal(s.current,undefined);
});
