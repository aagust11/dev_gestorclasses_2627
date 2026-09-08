import {AppState} from '../types';
import {recordKey} from './termRecords';

const equal=(a:any,b:any):boolean=>{
  if(a===b)return true;
  if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;
  if(Array.isArray(a)!==Array.isArray(b))return false;
  const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&equal(a[k],b[k]));
};
export class EditConflict extends Error {
  constructor(public paths:string[]){super('Dues pestanyes han modificat les mateixes dades. Cal escollir quins canvis es conserven.');}
}
/** Three-way merge: equal changes converge, unrelated changes survive; deletion vs edit conflicts. */
export function mergeEdits(base:AppState,local:AppState,remote:AppState,preferLocal=false):AppState {
  const conflicts:string[]=[];
  const merge=(b:any,l:any,r:any,path:string):any=>{
    if(equal(l,b))return r;if(equal(r,b)||equal(l,r))return l;
    if(b!==undefined&&l!==undefined&&r!==undefined&&b!==null&&l!==null&&r!==null&&typeof b==='object'&&typeof l==='object'&&typeof r==='object'){
      if(Array.isArray(b)&&Array.isArray(l)&&Array.isArray(r)){
        const key=(v:any)=>path==='termGradesRecords'?recordKey(v):v.id;
        const keyed=[b,l,r].every(a=>a.every((v:any)=>v&&typeof v==='object'&&typeof v.id==='string')&&new Set(a.map(key)).size===a.length);
        if(keyed){
          const maps=[b,l,r].map(a=>new Map(a.map((v:any)=>[key(v),v])));
          // Explicit concurrent reorders conflict; independent additions preserve both orders.
          const common=b.map(key).filter((id:string)=>maps[1].has(id)&&maps[2].has(id));
          const order=(a:any[])=>a.map(key).filter((id:string)=>common.includes(id));
          const bo=order(b),lo=order(l),ro=order(r);
          if(!equal(lo,bo)&&!equal(ro,bo)&&!equal(lo,ro)){conflicts.push(path+'.ordre');}
          const primary=!equal(lo,bo)?l:r;
          return [...new Set([...primary.map(key),...l.map(key),...r.map(key),...b.map(key)])].map(id=>merge(maps[0].get(id),maps[1].get(id),maps[2].get(id),`${path}[${id}]`)).filter(v=>v!==undefined);
        }
      }else if(!Array.isArray(b)&&!Array.isArray(l)&&!Array.isArray(r)){
        return Object.fromEntries([...new Set([...Object.keys(b),...Object.keys(l),...Object.keys(r)])].map(k=>[k,merge(b[k],l[k],r[k],path?`${path}.${k}`:k)]).filter(([,v])=>v!==undefined));
      }
    }
    // New dictionaries may independently acquire distinct entries.
    if(b===undefined&&l&&r&&typeof l==='object'&&typeof r==='object'&&!Array.isArray(l)&&!Array.isArray(r))return merge({},l,r,path);
    conflicts.push(path);return preferLocal?l:r;
  };
  const result=merge(base,local,remote,'');
  if(conflicts.length&&!preferLocal)throw new EditConflict(conflicts.slice(0,30));
  return result;
}

export async function withSharedWrite<T>(locks:Pick<LockManager,'request'>|undefined,work:()=>Promise<T>):Promise<T>{
  if(!locks)throw Error('Aquest navegador no permet coordinar l’edició entre pestanyes. Fes servir un navegador compatible amb Web Locks.');
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),8000);
  try{return await locks.request('docentsuite-editor-v1',{mode:'exclusive',signal:controller.signal},async()=>{clearTimeout(timer);return work();});}
  catch(e){if((e as Error).name==='AbortError')throw Error('Una altra pestanya manté el desat ocupat. Tanca o actualitza les pestanyes antigues i torna a desar.');throw e;}
  finally{clearTimeout(timer);}
}

export function combineSharedState(base:AppState,next:AppState,latest:AppState,replace=false,preferLocal=false):AppState {
  if(!replace&&(base as any).workspaceGeneration!==(latest as any).workspaceGeneration)throw new EditConflict(['S’han substituït les dades compartides (importació o restauració). Descarrega els pendents i carrega la versió nova.']);
  if(replace){if(!equal(base,latest))throw new EditConflict(['Substitució completa: les dades han canviat en una altra pestanya.']);return next;}
  // These are projections, not independently editable records.
  const withoutProjection=(s:AppState)=>{const copy={...s};delete copy.enrolments;return copy;};
  return mergeEdits(withoutProjection(base),withoutProjection(next),withoutProjection(latest),preferLocal);
}
