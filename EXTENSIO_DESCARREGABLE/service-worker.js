const APP='https://aagust11.github.io/dev_gestorclasses_2627/';
let auxiliary=null,closeTimer=null,tail=Promise.resolve();
const isApp=url=>{try{const u=new URL(url);return u.origin==='https://aagust11.github.io'&&u.pathname.startsWith('/dev_gestorclasses_2627/');}catch{return false;}};
const request=(action,payload={})=>({version:1,requestId:crypto.randomUUID(),action,payload});
const send=(id,req)=>chrome.tabs.sendMessage(id,{channel:'aula-route',request:req});
async function appTab(create=true){
  const tabs=(await chrome.tabs.query({url:APP+'*'})).filter(t=>isApp(t.url));
  if(tabs.length)return tabs.find(t=>t.active)||tabs[0];
  if(!create)return null;
  const tab=await chrome.tabs.create({url:APP,active:false});auxiliary=tab.id;return tab;
}
async function ready(tab){
  let last;const deadline=Date.now()+15000;
  while(Date.now()<deadline){
    try{last=await send(tab.id,request('GET_CONTEXT'));if(last?.ok)return last;}catch{}
    await new Promise(r=>setTimeout(r,400));
  }
  throw Error(last?.error||'Àula no està preparada. Obre-la i revisa el desat o actualitza la pàgina.');
}
function scheduleClose(tab,response){
  clearTimeout(closeTimer);
  if(tab.id!==auxiliary||!response.safeToClose)return;
  closeTimer=setTimeout(async()=>{
    try{
      const current=await chrome.tabs.get(tab.id);
      if(current.active){auxiliary=null;return;}
      const check=await send(tab.id,request('GET_CONTEXT'));
      if(check.safeToClose){await chrome.tabs.remove(tab.id);auxiliary=null;}
    }catch{}
  },5000);
}
function updateBadge(context){
  if(!context?.current)return;
  chrome.action.setBadgeText({text:context.current.length?'CL':''});
  chrome.action.setBadgeBackgroundColor({color:'#172554'});
}
async function route(message){
  clearTimeout(closeTimer);
  const tab=await appTab(!message.passive);
  if(!tab)return {ok:true,idle:true};
  if(message.open){
    auxiliary=null;await chrome.tabs.update(tab.id,{active:true});await chrome.windows.update(tab.windowId,{focused:true});
    if(message.payload?.sessionId){await ready(tab);return send(tab.id,request('OPEN_SESSION',message.payload));}
    return {ok:true};
  }
  if(message.passive){
    try{const result=await send(tab.id,message.request);if(result.ok&&message.request.action==='GET_CONTEXT')updateBadge(result.data);scheduleClose(tab,result);return result;}catch{return {ok:true,idle:true};}
  }
  await ready(tab);
  // Never retry a mutation: a disconnected reply does not mean it was not saved.
  const result=await send(tab.id,message.request);
  if(result.ok&&message.request.action==='GET_CONTEXT')updateBadge(result.data);
  if(result.ok&&result.data?.summary?.pending)chrome.action.setBadgeText({text:'!'});
  if(result.ok&&message.request.action!=='GET_CONTEXT'&&message.request.action!=='GET_SESSION')chrome.runtime.sendMessage({channel:'aula-refresh'}).catch(()=>{});
  scheduleClose(tab,result);return result;
}
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(message?.channel==='aula-changed'&&sender.tab&&isApp(sender.tab.url)){
    chrome.runtime.sendMessage({channel:'aula-refresh'}).catch(()=>{});return;
  }
  if(sender.id!==chrome.runtime.id||sender.tab||message?.channel!=='aula-ui')return;
  const operation=tail.then(()=>route(message));tail=operation.catch(()=>{});
  operation.then(reply).catch(e=>reply({ok:false,error:e.message||'Connexió interrompuda. Comprova el resultat a Àula abans de repetir el canvi.'}));return true;
});
chrome.runtime.onInstalled.addListener(()=>{chrome.contextMenus.create({id:'quick-note',title:'Àula → Incidència ràpida',contexts:['action','page']});});
chrome.contextMenus.onClicked.addListener((info,tab)=>{if(info.menuItemId==='quick-note'&&tab?.windowId!=null){chrome.sidePanel.open({windowId:tab.windowId});chrome.sidePanel.setOptions({path:'sidepanel.html?quick=1'});}});
chrome.commands.onCommand.addListener(async command=>{if(command==='open-panel'){const win=await chrome.windows.getLastFocused();chrome.sidePanel.open({windowId:win.id});}});
