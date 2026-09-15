import {parseUicon} from './uicons';
import {validBookmarkImage} from './bookmarkImages';
import {AppState,Subject} from '../types';
export type Bookmark=NonNullable<Subject['generalLinks']>[number];
export const bookmarkIcons=['link','sheet','file','folder','calendar','users','book','star','video','chart','check','globe'] as const;
export const bookmarkColors=['blue','green','amber','purple','rose','slate'] as const;
export function safeBookmarkUrl(raw:string):string|null{
 const value=raw.trim();if(!value)return null;
 try{const url=new URL(/^[a-z][a-z0-9+.-]*:/i.test(value)?value:'https://'+value);
 return ['https:','http:'].includes(url.protocol)&&!!url.hostname&&!url.username&&!url.password?url.href:null;}catch{return null;}
}
export function bookmarkFamily(state:AppState,subject:Subject){return subject.parentId&&state.subjects.some(s=>s.id===subject.parentId)?subject.parentId:subject.id;}
export function visibleBookmarks(state:AppState,subject:Subject){
 const family=bookmarkFamily(state,subject);
 return state.subjects.flatMap(owner=>(owner.generalLinks||[]).filter(link=>owner.id===subject.id||(link.shared&&bookmarkFamily(state,owner)===family)).map(link=>({owner,link})));
}
export function saveBookmark(state:AppState,ownerId:string,link:Bookmark):AppState{
 const url=safeBookmarkUrl(link.url);if(!link.label.trim()||!url)throw Error('Posa un nom i un enllaç web HTTP o HTTPS vàlid.');
 if(!state.subjects.some(s=>s.id===ownerId))throw Error('L’assignatura ja no existeix.');
 if(link.image!==undefined&&!validBookmarkImage(link.image))throw Error('La icona personalitzada no és vàlida. Torna-la a carregar.');
 if(link.uicon!==undefined&&!parseUicon(link.uicon))throw Error('La classe UIcons no és vàlida. Exemple: fi fi-ss-bell');
 const value={...link,label:link.label.trim(),url};
 return {...state,subjects:state.subjects.map(s=>s.id!==ownerId?s:{...s,generalLinks:(s.generalLinks||[]).some(l=>l.id===link.id)?s.generalLinks!.map(l=>l.id===link.id?value:l):[...(s.generalLinks||[]),value]})};
}
