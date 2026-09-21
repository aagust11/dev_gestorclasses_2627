// Transport only. No AppState, localStorage, IndexedDB or file access here.
const pending=new Map();
chrome.runtime.onMessage.addListener((message,_sender,reply)=>{
  if(message?.channel!=='aula-route')return;
  if(message.ping){reply({transport:true});return;}
  const request=message.request;
  if(!request?.requestId)return;
  const timer=setTimeout(()=>{pending.delete(request.requestId);reply({version:1,requestId:request.requestId,ok:false,error:'Àula no ha respost. Obre-la i comprova el resultat abans de repetir el canvi.',safeToClose:false});},20000);
  pending.set(request.requestId,{reply,timer});
  window.postMessage({channel:'aula-extension-request',request},location.origin);
  return true;
});
window.addEventListener('message',event=>{
  if(event.source!==window||event.origin!==location.origin)return;
  if(event.data?.channel==='aula-extension-response'){
    const response=event.data.response,p= pending.get(response?.requestId);
    if(p){clearTimeout(p.timer);pending.delete(response.requestId);p.reply(response);}
  }
  if(event.data?.channel==='aula-extension-event')chrome.runtime.sendMessage({channel:'aula-changed'}).catch(()=>{});
});
