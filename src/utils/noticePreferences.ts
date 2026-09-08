const KEY='docentsuite_reviewed_notices_v1';
export function noticeKey(kind:string,message:string):string{
  let hash=2166136261;for(const char of kind+'|'+message){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}return `${kind}:${hash>>>0}`;
}
export function reviewedNotices():string[]{try{const v=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(v)?v.filter(x=>typeof x==='string'):[];}catch{return [];}}
export function reviewNotice(keys:string[],key:string):string[]{const next=[...new Set([...keys,key])].slice(-200);localStorage.setItem(KEY,JSON.stringify(next));return next;}
