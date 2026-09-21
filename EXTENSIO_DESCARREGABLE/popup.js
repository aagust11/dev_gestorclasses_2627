const $=id=>document.getElementById(id);
let windowId;chrome.windows.getCurrent().then(w=>windowId=w.id);
const rpc=(action,payload={})=>chrome.runtime.sendMessage({channel:'aula-ui',request:{version:1,requestId:crypto.randomUUID(),action,payload}});
$('clock').textContent=new Date().toLocaleString('ca-ES',{dateStyle:'full',timeStyle:'short'});
async function load(){try{
  $('status').textContent='Connectant amb Àula…';const res=await rpc('GET_CONTEXT');if(!res.ok)throw Error(res.error);
  $('current').replaceChildren();
  for(const session of res.data.current){const p=document.createElement('p');p.textContent=`${session.name} · ${session.startTime}–${session.endTime}`;$('current').append(p);
    const snap=await rpc('GET_SESSION',{date:session.date,sessionId:session.id});
    if(snap.ok){const s=snap.data.summary;p.append(document.createElement('br'),`${s.recorded}/${s.total} registrades · ${s.pending} pendents`);}
  }
  $('status').textContent=res.warning|| (res.data.current.length?'Sessió actual':res.data.next?`Propera: ${res.data.next.name} · ${res.data.next.date} ${res.data.next.startTime}`:'No hi ha cap classe programada.');
}catch(e){$('status').textContent=e.message;}}
for(const [id,quick] of [['attendance',false],['quick',true]])$(id).onclick=()=>{
  // open must remain directly attached to the user gesture.
  if(windowId==null)return;
  chrome.sidePanel.open({windowId}).then(()=>chrome.sidePanel.setOptions({path:quick?'sidepanel.html?quick=1':'sidepanel.html'})).then(()=>window.close()).catch(e=>$('status').textContent=e.message);
};
$('open').onclick=()=>chrome.runtime.sendMessage({channel:'aula-ui',open:true}).catch(e=>$('status').textContent=e.message);
$('retry').onclick=load;load();
