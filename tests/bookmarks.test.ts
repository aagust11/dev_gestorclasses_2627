import {parseUicon} from '../src/utils/uicons';
import {validBookmarkImage,compactBookmarkImage} from '../src/utils/bookmarkImages';
import {AppState} from '../src/types';
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {getInitialState} from '../src/initialState';
import {saveBookmark,visibleBookmarks,safeBookmarkUrl} from '../src/utils/bookmarks';
import {normalizeState,validateState} from '../src/storage';
import BookmarkBar from '../src/components/BookmarkBar';
function fixture():AppState{const state=getInitialState();return {...state,subjects:[
 {id:'parent',name:'TEC',isParent:true,isGeneral:false,color:'#000',parentId:null,students:[]},
 {id:'a',name:'3A',isGeneral:false,color:'#000',parentId:'parent',students:[]},
 {id:'b',name:'3B',isGeneral:false,color:'#000',parentId:'parent',students:[]},
 {id:'other',name:'Reunions',isGeneral:true,color:'#000',parentId:null,students:[]}
 ]};}
test('bookmarks are private by default and shared once across a subject family',()=>{
 let state=fixture();state=saveBookmark(state,'a',{id:'l',label:'Full A',url:'docs.google.com',icon:'sheet',color:'green'});
 assert.equal(visibleBookmarks(state,state.subjects[1]).length,1);assert.equal(visibleBookmarks(state,state.subjects[2]).length,0);
 state=saveBookmark(state,'a',{id:'l',label:'Full compartit',url:'https://docs.google.com',shared:true,icon:'sheet',color:'green'});
 assert.equal(visibleBookmarks(state,state.subjects[0]).length,1);assert.equal(visibleBookmarks(state,state.subjects[2]).length,1);assert.equal(visibleBookmarks(state,state.subjects[3]).length,0);
 assert.equal(state.subjects[2].generalLinks,undefined);
 assert.equal(validateState(state),true);
 const restored=normalizeState(JSON.parse(JSON.stringify(state)));
 assert.equal(visibleBookmarks(restored,restored.subjects[2])[0].link.color,'green');
 assert.equal(visibleBookmarks(restored,restored.subjects[2])[0].link.shared,true);
 state=saveBookmark(state,'a',{id:'l',label:'Privat',url:'https://example.com',shared:false});
 assert.equal(visibleBookmarks(state,state.subjects[2]).length,0);
});
test('bookmark URLs reject executable schemes, credentials and empty hosts',()=>{
 for(const url of ['javascript:alert(1)','data:text/html,test','file:///tmp/a','https://user:password@example.com',''])assert.equal(safeBookmarkUrl(url),null);
 assert.equal(safeBookmarkUrl('example.com'),'https://example.com/');
 assert.throws(()=>saveBookmark(fixture(),'a',{id:'l',label:'Test',url:'javascript:alert(1)'}));
});
test('legacy notes and links remain visible with safe fallback icons',()=>{
 const state=fixture();state.subjects[3]={...state.subjects[3],generalNotes:['Nota antiga'],generalLinks:[{id:'l',label:'Document',url:'https://example.com',icon:'unknown'}]};
 const html=renderToStaticMarkup(React.createElement(BookmarkBar,{state,subject:state.subjects[3]}));
 assert.match(html,/Nota antiga/);assert.match(html,/Document/);assert.match(html,/noopener noreferrer/);
});

test('custom icons survive JSON roundtrips and reject unsafe image sources',()=>{
 const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF9sAAAAASUVORK5CYII=';
 let state=saveBookmark(fixture(),'a',{id:'image',label:'Icona',url:'https://example.com',image:png});
 assert.equal(validateState(state),true);assert.equal(normalizeState(JSON.parse(JSON.stringify(state))).subjects[1].generalLinks![0].image,png);
 for(const bad of ['data:image/svg+xml;base64,AAAA','https://example.com/icon.png','javascript:alert(1)','data:image/png;base64,'+'A'.repeat(100001)]){
 assert.equal(validBookmarkImage(bad),false);assert.throws(()=>saveBookmark(state,'a',{id:'image',label:'Icona',url:'https://example.com',image:bad}));
 }
 state=saveBookmark(state,'a',{id:'image',label:'Campana',url:'https://example.com',uicon:'fi fi-ss-bell'});
 assert.equal(validateState(state),true);assert.equal(normalizeState(JSON.parse(JSON.stringify(state))).subjects[1].generalLinks![0].uicon,'fi fi-ss-bell');
});
test('UIcons accepts class names and only the supported HTML fragment',()=>{
 assert.equal(parseUicon('fi fi-ss-bell'),'fi fi-ss-bell');
 assert.equal(parseUicon('<i class="fi fi-ss-bell"></i>'),'fi fi-ss-bell');
 assert.equal(parseUicon('fi-brands-google'),'fi fi-brands-google');
 for(const bad of ['<script>alert(1)</script>','<i class="fi fi-ss-bell" onclick="alert(1)"></i>','fi fi-ss-bell hidden','fi fi-xx-bell'])assert.equal(parseUicon(bad),null);
});
test('image upload rejects oversized and unsupported files before decoding',async()=>{
 await assert.rejects(()=>compactBookmarkImage(new Blob(['<svg/>'],{type:'image/svg+xml'})),/PNG/);
 await assert.rejects(()=>compactBookmarkImage(new Blob([new Uint8Array(2*1024*1024+1)],{type:'image/png'})),/2 MB/);
});
