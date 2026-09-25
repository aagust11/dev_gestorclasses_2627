import './connection.js';
const $=id=>document.getElementById(id),fold=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase();
const now=new Date();$('date').value=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
let snapshot=null,busy=false,refreshTimer,hasError=false,readSequence=0;
const draftSessions=new Map();let displayedTarget=null;
function captureDrafts(){if(!displayedTarget)return;draftSessions.set(displayedTarget,new Map([...$('students').querySelectorAll('article')].map(row=>[row.dataset.id,{text:row.querySelector('textarea').value,kind:row.querySelector('select').value,open:row.querySelector('details').open}])));}
const rpc=(action,payload={},passive=false)=>chrome.runtime.sendMessage({channel:'aula-ui',passive,request:{version:1,requestId:crypto.randomUUID(),action,payload}});
const target=()=>({date:$('date').value,sessionId:$('session').value});
const status=(text,error=false)=>{$('status').textContent=text;$('status').className=error?'warning':'';};
const button=(text,fn)=>{const b=document.createElement('button');b.textContent=text;b.onclick=fn;return b;};
function lock(value){busy=value;document.querySelectorAll('#students button,#students textarea,#students select,#all,#session,#date').forEach(e=>e.disabled=value);}
async function mutate(action,extra={}){
  if(busy||!snapshot)return false;
  if(snapshot.date!==$('date').value||snapshot.sessionId!==$('session').value){status('Espera que es carregui la sessió seleccionada.',true);return false;}
  ++readSequence;lock(true);status('Desant…');
  try{const res=await rpc(action,{...target(),...extra});if(!res.ok)throw Error(res.error);
    snapshot=res.data;hasError=false;render();status(res.warning||'Desat',!!res.warning);return true;
  }catch(e){hasError=true;status(e.message+' Obre Àula per comprovar-ho abans de repetir el canvi.',true);return false;}finally{lock(false);}
}
function render(){
  const root=$('students');
  // Preserve drafts and open editors during live updates; never discard unsent text.
  captureDrafts();displayedTarget=JSON.stringify(target());const drafts=draftSessions.get(displayedTarget)||new Map();
  root.replaceChildren();if(!snapshot)return;
  const s=snapshot.summary;$('summary').textContent=snapshot.notHeld?('Classe no feta'+(snapshot.notHeldReason?' · '+snapshot.notHeldReason:'')):`${s.present} presents (inclou ${s.late} retards) · ${s.absent} faltes · ${s.pending} pendents`;
  $('all').hidden=!snapshot.canAttend;
  $('all').textContent=s.recorded===0?'Tots presents':'Marcar pendents com a presents';
  for(const student of snapshot.students){
    const row=document.createElement('article');row.dataset.id=student.id;row.dataset.search=fold(student.name+' '+student.officialName);
    const name=document.createElement('h2');name.textContent=student.name;name.title=student.officialName;row.append(name);
    const buttons=document.createElement('div');buttons.className='attendance';
    for(const [value,label] of [['present','Present'],['late10','R≤10'],['lateMore10','R>10'],['absent','F'],['pending','Pendent']]){
      const b=button(label,()=>mutate('SET_ATTENDANCE',{studentId:student.id,status:value}));b.className=value+(student.status===value?' selected':'');b.setAttribute('aria-pressed',String(student.status===value));b.title={late10:'Retard ≤10 min',lateMore10:'Retard >10 min',absent:'Falta'}[value]||label;buttons.append(b);
    }row.append(buttons);
    const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='+ Anotació';details.append(summary);
    const kind=document.createElement('select');kind.setAttribute('aria-label','Tipus d’anotació');for(const [id,label] of [['pos','Positiu'],['regular','Seguiment'],['incident','Incidència']])kind.add(new Option(label,id));
    const text=document.createElement('textarea');text.placeholder='Escriu l’anotació…';text.maxLength=10000;text.setAttribute('aria-label','Anotació de '+student.name);
    const draft=drafts.get(student.id);if(draft){text.value=draft.text;kind.value=draft.kind;details.open=draft.open;}else if(location.search.includes('quick'))kind.value='incident';
    const save=button('Desar anotació',async()=>{if(!text.value.trim()){text.focus();return;}if(await mutate('ADD_ANNOTATION',{studentId:student.id,kind:kind.value,text:text.value})){const replacement=[...root.querySelectorAll('article')].find(r=>r.dataset.id===student.id);if(replacement)replacement.querySelector('textarea').value='';}});
    details.append(kind,text,save);
    for(const [type,list] of Object.entries(student.annotations))for(const note of list){const p=document.createElement('p');p.className='note';p.textContent=({pos:'Positiu',regular:'Seguiment',incident:'Incidència'}[type])+': '+note;details.append(p);}
    row.append(details);root.append(row);
  }filter();
}
function filter(){const words=fold($('search').value).split(/\s+/).filter(Boolean);document.querySelectorAll('article').forEach(row=>row.hidden=!words.every(w=>row.dataset.search.includes(w)));}
async function loadSession(passive=false){
  if(busy||!$('session').value||(passive&&document.activeElement?.matches('textarea,select,input')))return;
  const selected=target(),sequence=++readSequence;
  try{const res=await rpc('GET_SESSION',selected,passive);if(busy||sequence!==readSequence||JSON.stringify(selected)!==JSON.stringify(target())||res.idle)return;if(!res.ok){if(passive)return;throw Error(res.error);}snapshot=res.data;render();if(res.warning)status(res.warning,true);else if(!hasError&&!passive)status('Sessió carregada.');}
  catch(e){hasError=true;status(e.message,true);}
}
async function load(){
  if(busy)return;captureDrafts();const selectedDate=$('date').value;status('Carregant dades en segon pla…');
  try{const res=await rpc('GET_CONTEXT',{date:selectedDate});if(selectedDate!==$('date').value)return;if(!res.ok)throw Error(res.error);
    const old=$('session').value;$('session').replaceChildren();
    for(const s of res.data.sessions)$('session').add(new Option(`${s.startTime}–${s.endTime} · ${s.name}${s.notHeld?' · No feta':''}`,s.id));
    if(res.data.sessions.some(s=>s.id===old))$('session').value=old;else if(res.data.current[0]&&res.data.date===$('date').value)$('session').value=res.data.current[0].id;
    hasError=false;
    if(!$('session').value){snapshot=null;$('students').replaceChildren();$('summary').textContent='';$('all').hidden=true;status('No hi ha sessions en aquesta data.');}else await loadSession();
  }catch(e){hasError=true;status(e.message,true);}
}
$('all').onclick=()=>mutate(snapshot?.summary.recorded===0?'MARK_ALL_PRESENT':'MARK_PENDING_PRESENT');
$('search').oninput=filter;$('date').onchange=()=>{captureDrafts();displayedTarget=null;snapshot=null;$('students').replaceChildren();$('summary').textContent='';$('all').hidden=true;load();};$('session').onchange=()=>{captureDrafts();displayedTarget=null;snapshot=null;$('students').replaceChildren();loadSession();};$('retry').onclick=load;
$('open').onclick=()=>chrome.runtime.sendMessage({channel:'aula-ui',open:true,payload:target()}).then(r=>{if(!r.ok)status(r.error,true);}).catch(e=>status(e.message,true));
chrome.runtime.onMessage.addListener(message=>{if(message.channel==='aula-refresh'){clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>loadSession(true),500);}});
// Passive refresh never creates a tab. Only an explicit user operation can do that.
setInterval(()=>loadSession(true),15000);load();
