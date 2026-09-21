import {AppState,StudentLog} from '../types';
import {getCurrentClassContext,sessionsOnDate} from '../utils/currentClass';
import {addStudentAnnotation,getSessionSnapshot,markAllPresent,markPendingStudentsPresent,setStudentAttendance,SessionTarget,AnnotationKind} from '../utils/sessionMutations';
import {EXTENSION_PROTOCOL,REQUEST_CHANNEL,RESPONSE_CHANNEL,EVENT_CHANNEL,actions,ExtensionRequest,ExtensionResponse} from './extensionTypes';
export type BridgeHost={getState:()=>AppState;ready:()=>boolean;readReady?:()=>boolean;commit:(next:AppState,base:AppState)=>Promise<{warning?:string}>;openSession:(id:string,date:string)=>void;safeToClose:()=>boolean;warning?:()=>string;prepare?:(action:ExtensionRequest['action'])=>Promise<void>};
const string=(value:unknown,max=200)=>{if(typeof value!=='string'||!value||value.length>max)throw Error('Paràmetre no vàlid.');return value;};
export function createExtensionDispatcher(host:BridgeHost){
  const requests=new Map<string,{body:string;result:Promise<ExtensionResponse>}>();
  let tail=Promise.resolve();
  return (request:ExtensionRequest):Promise<ExtensionResponse>=>{
    const error=(message:string):ExtensionResponse=>({version:EXTENSION_PROTOCOL,requestId:request?.requestId||'',ok:false,error:message,safeToClose:false});
    if(!request||request.version!==EXTENSION_PROTOCOL)return Promise.resolve(error('Actualitza Àula i l’extensió: les versions del protocol no coincideixen.'));
    try{string(request.requestId,100);}catch{return Promise.resolve(error('Identificador de petició no vàlid.'));}
    const body=JSON.stringify(request);if(body.length>16000)return Promise.resolve(error('Petició massa llarga.'));
    const previous=requests.get(request.requestId);if(previous)return previous.body===body?previous.result:Promise.resolve(error('Identificador reutilitzat amb contingut diferent.'));
    const run=async():Promise<ExtensionResponse>=>{try{
      if(!actions.includes(request.action))throw Error('Operació desconeguda.');
      const available=()=>request.action==='GET_CONTEXT'||request.action==='GET_SESSION'||request.action==='OPEN_SESSION' ? (host.readReady?.()??host.ready()) : host.ready();
      if(!available())throw Error('Àula està iniciant-se o té un desat pendent/error. Obre Àula o torna-ho a provar.');
      await host.prepare?.(request.action);
      if(!available())throw Error('El desat està ocupat. Torna-ho a provar quan acabi.');
      const state=host.getState(),p=request.payload||{};
      if(request.action==='GET_CONTEXT'){
        const context=getCurrentClassContext(state);
        const current=context.current.map(session=>{
          try{return {...session,summary:getSessionSnapshot(state,{date:session.date,sessionId:session.id}).summary};}
          catch{return {...session,needsReview:true};}
        });
        return {version:1,requestId:request.requestId,ok:true,data:{...context,current,...(p.date?{sessions:sessionsOnDate(state,string(p.date,10))}:{})},safeToClose:host.safeToClose(),warning:host.warning?.()||undefined};
      }
      const target:SessionTarget={date:string(p.date,10),sessionId:string(p.sessionId)};
      if(request.action==='OPEN_SESSION'){
        if(!sessionsOnDate(state,target.date).some(s=>s.id===target.sessionId))throw Error('La sessió ja no existeix en aquesta data.');
        host.openSession(target.sessionId,target.date);return {version:1,requestId:request.requestId,ok:true,safeToClose:false};
      }
      const snapshot=getSessionSnapshot(state,target);
      if(request.action==='GET_SESSION')return {version:1,requestId:request.requestId,ok:true,data:snapshot,safeToClose:host.safeToClose(),warning:host.warning?.()||undefined};
      let next:AppState;
      switch(request.action){
        case 'SET_ATTENDANCE':next=setStudentAttendance(state,target,string(p.studentId),p.status as StudentLog['status']);break;
        case 'ADD_ANNOTATION':next=addStudentAnnotation(state,target,string(p.studentId),p.kind as AnnotationKind,string(p.text,10000));break;
        case 'MARK_ALL_PRESENT':next=markAllPresent(state,target);break;
        case 'MARK_PENDING_PRESENT':next=markPendingStudentsPresent(state,target);break;
        default:throw Error('Operació desconeguda.');
      }
      const saved=await host.commit(next,state);
      return {version:1,requestId:request.requestId,ok:true,data:getSessionSnapshot(host.getState(),target),warning:saved.warning,safeToClose:host.safeToClose()};
    }catch(e){return error((e as Error).message);}};
    const read=request.action==='GET_CONTEXT'||request.action==='GET_SESSION'||request.action==='OPEN_SESSION';
    const result=read?run():tail.then(run);if(!read)tail=result.then(()=>{});requests.set(request.requestId,{body,result});
    // Keep completed request IDs while this app lives: never evict an in-flight mutation.
    if(requests.size>2000){const first=requests.keys().next().value;result.then(()=>{if(first)requests.delete(first);});}
    return result;
  };
}
export function installExtensionBridge(host:BridgeHost){
  const dispatch=createExtensionDispatcher(host);
  const listener=(event:MessageEvent)=>{
    if(event.source!==window||event.origin!==window.location.origin)return;
    if(event.data?.channel==='aula-extension-probe'){
      if(typeof event.data.probeId==='string'&&event.data.probeId.length<=100)window.postMessage({channel:'aula-extension-probe-response',probeId:event.data.probeId,version:EXTENSION_PROTOCOL,ready:host.ready(),readReady:host.readReady?.()??host.ready(),safeToClose:host.safeToClose()},window.location.origin);
      return;
    }
    if(event.data?.channel!==REQUEST_CHANNEL)return;
    void dispatch(event.data.request).then(response=>window.postMessage({channel:RESPONSE_CHANNEL,response},window.location.origin));
  };
  window.addEventListener('message',listener);
  return ()=>window.removeEventListener('message',listener);
}
export function publishExtensionChange(){window.postMessage({channel:EVENT_CHANNEL,version:EXTENSION_PROTOCOL},window.location.origin);}
