/** One editor per origin. No timer-based lease that can expire in a sleeping tab. */
export function acquireEditorLease(locks:Pick<LockManager,'request'>|undefined,onAcquire:()=>void,onUnavailable:()=>void,onError:(e:unknown)=>void){
  let active=false,disposed=false,release:()=>void=()=>{};
  if(!locks){onUnavailable();return {owns:()=>false,dispose:()=>{}};}
  void locks.request('docentsuite-editor-v1',{mode:'exclusive',ifAvailable:true},async lock=>{
    if(disposed)return;
    if(!lock){onUnavailable();return;}
    active=true;
    const held=new Promise<void>(resolve=>{release=resolve;});
    try{onAcquire();await held;}finally{active=false;}
  }).catch(onError);
  return {owns:()=>active&&!disposed,dispose:()=>{disposed=true;active=false;release();}};
}

/** Compare the actual stored snapshot, also detecting writes by older app versions. */
export class RevisionGuard {
  private expected:string|null;
  constructor(private read:()=>string|null,private owns:()=>boolean){this.expected=read();}
  assertCurrent(){
    if(!this.owns())throw Error('Aquesta pestanya és de consulta. Obre l’edició en una única pestanya.');
    if(this.read()!==this.expected)throw Error('Les dades han canviat en una altra pestanya. Descarrega els canvis d’aquesta pestanya i recarrega abans de continuar.');
  }
  committed(){this.expected=this.read();}
}
