// Transport only. No AppState, localStorage, IndexedDB or file access here.
const pending=new Map(),probes=new Map();
chrome.runtime.onMessage.addListener((message,_sender,reply)=>{
  if(message?.channel!=='aula-route')return;
  if(message.ping){
    const probeId=crypto.randomUUID();
    const timer=setTimeout(()=>{probes.delete(probeId);reply({transport:true,ready:false});},1000);
    probes.set(probeId,{reply,timer});
    window.postMessage({channel:'aula-extension-probe',probeId},location.origin);return true;
  }
  const request=message.request;
  if(!request?.requestId)return;
  const timer=setTimeout(()=>{pending.delete(request.requestId);reply({version:1,requestId:request.requestId,ok:false,error:'Àula no ha respost. Obre-la i comprova el resultat abans de repetir el canvi.',safeToClose:false});},30000);
  pending.set(request.requestId,{reply,timer});
  window.postMessage({channel:'aula-extension-request',request},location.origin);
  return true;
});
window.addEventListener('message',event=>{
  if(event.source!==window||event.origin!==location.origin)return;
  if(event.data?.channel==='aula-extension-probe-response'){
    const p=probes.get(event.data.probeId);
    if(p){clearTimeout(p.timer);probes.delete(event.data.probeId);p.reply({transport:true,ready:!!event.data.ready,readReady:event.data.readReady??!!event.data.ready,version:event.data.version,safeToClose:!!event.data.safeToClose});}
  }
  if(event.data?.channel==='aula-extension-response'){
    const response=event.data.response,p= pending.get(response?.requestId);
    if(p){clearTimeout(p.timer);pending.delete(response.requestId);p.reply(response);}
  }
  if(event.data?.channel==='aula-extension-event')chrome.runtime.sendMessage({channel:'aula-changed'}).catch(()=>{});
});
