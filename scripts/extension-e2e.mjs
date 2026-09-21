// Isolated Chromium profile; synthetic pupils only. No real repository/user data.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {getInitialState} from '../src/initialState.ts';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const APP='https://aagust11.github.io/dev_gestorclasses_2627/';
const extension=path.resolve('EXTENSIO_DESCARREGABLE'),profile=await mkdtemp(path.join(tmpdir(),'aula-extension-'));
const context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
let fail=false;
try{
 context.on('page',page=>{page.on('pageerror',e=>console.error('BROWSER ERROR',page.url(),e.message));page.on('console',m=>{if(m.type()==='error')console.error('CONSOLE',page.url(),m.text());});page.on('requestfailed',r=>console.error('REQUEST FAILED',r.url(),r.failure()));});
 await context.route(APP+'**',async route=>{
  const relative=new URL(route.request().url()).pathname.slice('/dev_gestorclasses_2627/'.length)||'index.html';
  const filename=path.resolve('dist',relative);if(!filename.startsWith(path.resolve('dist')+path.sep))return route.abort();
  const types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
  try{await route.fulfill({body:await readFile(filename),contentType:types[path.extname(filename)]||'application/octet-stream'});}catch(e){console.error('MISSING ASSET',filename,e.message);await route.fulfill({status:404,body:'Not found'});}
 });
 const state=getInitialState(),now=new Date(),date=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
 state.config={...state.config,startDate:date,endDate:date,holidays:[],substitutions:[],timeSlots:[{id:'slot',name:'Prova',startTime:'00:00',endTime:'23:59'}]};
 state.subjects=[{id:'subject',name:'Grup de prova',color:'#123456',parentId:null,students:[{id:'p',name:'Alumne Prova',preferredName:'Àlex'},{id:'q',name:'Segon Prova'}]}];
 state.studentRegistry=Object.fromEntries(state.subjects[0].students.map(s=>[s.id,s]));
 state.schedule=[{id:'session',subjectId:'subject',timeSlotId:'slot',dayOfWeek:now.getDay()}];state.sessionLogs=[];state.activities=[];state.competencies=[];state.criteria=[];
 state.studentProfiles={p:{psi:'SECRET_PSI',internalNotes:'SECRET_INTERNAL',supportMeasures:'SECRET_SUPPORT'}};
 await context.addInitScript(({state,origin})=>{if(location.origin===origin&&!localStorage.getItem('gestor_classes_app_state'))localStorage.setItem('gestor_classes_app_state',JSON.stringify(state));},{state,origin:new URL(APP).origin});
 let worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');const extensionId=new URL(worker.url()).host;
 const panel=await context.newPage();await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
 await panel.getByRole('heading',{name:'Àlex',exact:true}).waitFor({timeout:40000});
 const pupil=panel.locator('article').filter({has:panel.getByRole('heading',{name:'Àlex',exact:true})});
 await pupil.getByRole('button',{name:'F',exact:true}).click();await panel.getByText('Desat',{exact:true}).waitFor();
 await panel.getByRole('button',{name:'Marcar pendents com a presents',exact:true}).click();await panel.getByText('Desat',{exact:true}).waitFor();
 assert.equal(await pupil.getByRole('button',{name:'F',exact:true}).getAttribute('aria-pressed'),'true');
 await pupil.locator('summary').click();await pupil.locator('textarea').fill('Anotació de prova');await pupil.locator('select').selectOption('incident');await pupil.getByRole('button',{name:'Desar anotació'}).click();await panel.getByText('Incidència: Anotació de prova',{exact:true}).waitFor();
 const rpc=async(action,payload={})=>panel.evaluate(async({action,payload})=>chrome.runtime.sendMessage({channel:'aula-ui',request:{version:1,requestId:crypto.randomUUID(),action,payload}}),{action,payload});
 let result=await rpc('GET_SESSION',{date,sessionId:'session'});assert.equal(result.ok,true);assert.doesNotMatch(JSON.stringify(result),/SECRET_/);assert.equal(result.data.summary.absent,1);assert.equal(result.data.summary.present,1);
 // Activate real app and verify extension -> web, then web -> extension.
 await panel.getByRole('button',{name:'Obrir Àula',exact:true}).click();
 let app=context.pages().find(p=>p.url().startsWith(APP));assert.ok(app);
 await app.getByRole('heading',{name:/Control d’Assistència|Control d'Assistència/}).waitFor({timeout:15000});
 assert.match(await app.locator('body').innerText(),/Anotació de prova/);
 const webPupil=app.locator('tr').filter({hasText:'Àlex'}).first();await webPupil.getByRole('button',{name:'Pres.',exact:true}).click();
 await panel.waitForFunction(()=>document.querySelector('article .present')?.getAttribute('aria-pressed')==='true',{timeout:15000});
 // Persist a genuine FileSystemFileHandle (OPFS) through the same IndexedDB handle store.
 await app.evaluate(async()=>{
  const state=JSON.parse(localStorage.getItem('gestor_classes_app_state'));
  const root=await navigator.storage.getDirectory(),handle=await root.getFileHandle('aula-test.json',{create:true});
  const stream=await handle.createWritable();await stream.write(JSON.stringify(state));await stream.close();
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('GestorClassesDB',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  await new Promise((resolve,reject)=>{const tx=db.transaction('handles','readwrite');tx.objectStore('handles').put(handle,'active_file_handle');tx.objectStore('handles').put({handle,state},'file_sync_base');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();localStorage.setItem('docentsuite_file_link_enabled','yes');
 });
 await app.reload();await app.locator('#nav-item-horari').waitFor();
 result=await rpc('SET_ATTENDANCE',{date,sessionId:'session',studentId:'p',status:'late10'});assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.warning,undefined,JSON.stringify(result));
 const file=await app.evaluate(async()=>JSON.parse(await(await(await(await navigator.storage.getDirectory()).getFileHandle('aula-test.json')).getFile()).text()));assert.equal(file.sessionLogs[0].attendance.p.status,'late10');
 // Closed app: a new operation must reopen invisibly, retain data and close safely.
 await app.close();result=await rpc('ADD_ANNOTATION',{date,sessionId:'session',studentId:'q',kind:'pos',text:'Àula tancada'});assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.warning,undefined);
 await new Promise(r=>setTimeout(r,6500));assert.equal(context.pages().filter(p=>p.url().startsWith(APP)).length,0);
 // Broken file link: browser commit succeeds but response warns and keeps auxiliary app.
 await rpc('GET_SESSION',{date,sessionId:'session'});app=context.pages().find(p=>p.url().startsWith(APP));assert.ok(app);
 await app.evaluate(async()=>{const db=await new Promise(resolve=>{const r=indexedDB.open('GestorClassesDB',1);r.onsuccess=()=>resolve(r.result);});await new Promise(resolve=>{const tx=db.transaction('handles','readwrite');tx.objectStore('handles').delete('active_file_handle');tx.oncomplete=resolve;});db.close();});
 result=await rpc('SET_ATTENDANCE',{date,sessionId:'session',studentId:'q',status:'absent'});assert.equal(result.ok,true);assert.match(result.warning,/pendent/i);assert.equal(result.safeToClose,false);
 await new Promise(r=>setTimeout(r,6500));assert.ok(context.pages().some(p=>p.url().startsWith(APP)));
 console.log('PASS extension UI, auxiliary lifecycle, web ↔ extension, real handle write, file failure warning, privacy');
}catch(e){fail=true;console.error(e);for(const p of context.pages())console.error('PAGE',p.url(),await p.locator('body').innerText().catch(()=>''));}
finally{await context.close();await rm(profile,{recursive:true,force:true});}
if(fail)process.exit(1);
