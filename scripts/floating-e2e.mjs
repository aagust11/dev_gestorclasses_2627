// Isolated Chromium profile; synthetic pupils only. No real repository/user data.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,mkdtemp,rm,cp,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {getInitialState} from '../src/initialState.ts';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const profile=await mkdtemp(path.join(tmpdir(),'aula-extension-'));
const types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
 const relative=new URL(req.url,'http://localhost').pathname.slice('/dev_gestorclasses_2627/'.length)||'index.html';
 const filename=path.resolve('dist',relative);
 if(!req.url.startsWith('/dev_gestorclasses_2627/')||!filename.startsWith(path.resolve('dist')+path.sep)){res.writeHead(404);res.end();return;}
 try{res.setHeader('Content-Type',types[path.extname(filename)]||'application/octet-stream');res.end(await readFile(filename));}catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`,APP=origin+'/dev_gestorclasses_2627/';
// Only the deployment origin is substituted in an isolated test copy. All extension and app code is real.
const extension=path.join(profile,'extension');await cp(path.resolve('EXTENSIO_DESCARREGABLE'),extension,{recursive:true});
for(const file of ['manifest.json','service-worker.js']){const filename=path.join(extension,file);await writeFile(filename,(await readFile(filename,'utf8')).replaceAll('https://aagust11.github.io',origin));}
const context=await chromium.launchPersistentContext(path.join(profile,'browser'),{channel:'chromium',headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});

try{
 const state=getInitialState();state.subjects=[{id:'s',name:'Classe de prova',color:'#123456',students:[{id:'u',name:'Alumne Prova'}]}];state.studentRegistry={u:state.subjects[0].students[0]};state.schedule=[];state.sessionLogs=[];state.activities=[];state.criteria=[];state.competencies=[];
 await context.addInitScript(({state,origin})=>{if(location.origin===origin&&!localStorage.getItem('gestor_classes_app_state'))localStorage.setItem('gestor_classes_app_state',JSON.stringify(state));},{state,origin});
 const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),id=new URL(worker.url()).host;
 const popup=await context.newPage();await popup.goto(`chrome-extension://${id}/popup.html`);
 await popup.getByRole('button',{name:'Finestra flotant',exact:true}).click();
 let floating;for(let i=0;i<150&&!floating;i++){floating=context.pages().find(p=>p.url()===APP+'?floating=1');if(!floating)await new Promise(r=>setTimeout(r,100));}assert.ok(floating,'Native floating page opens without waiting for data loading');
 await floating.waitForURL(APP+'?floating=1');await floating.locator('#nav-item-qualificacions').click();
 assert.equal(await floating.locator('#app-viewport').getAttribute('data-floating'),'true');
 let windows=await worker.evaluate(()=>chrome.windows.getAll());assert.equal(windows.filter(w=>w.type==='popup').length,1);
 // Opening again focuses the same native window instead of making duplicates.
 const again=await context.newPage();await again.goto(`chrome-extension://${id}/popup.html`);await again.getByRole('button',{name:'Finestra flotant',exact:true}).click();if(!again.isClosed())await again.waitForEvent('close');
 windows=await worker.evaluate(()=>chrome.windows.getAll());assert.equal(windows.filter(w=>w.type==='popup').length,1);
 // Use the group comment, shared between all methods and other app windows.
 await floating.getByRole('textbox',{name:/Comentari del grup/}).fill('Comentari des de finestra flotant');
 await floating.waitForFunction(()=>JSON.stringify(JSON.parse(localStorage.getItem('gestor_classes_app_state')).groupPeriodComments).includes('Comentari des de finestra flotant'));
 const main=await context.newPage();await main.goto(APP);await main.locator('#nav-item-qualificacions').click();
 assert.equal(await main.getByRole('textbox',{name:/Comentari del grup/}).inputValue(),'Comentari des de finestra flotant');
 await floating.close();
 const webOpened=main.waitForEvent('popup');await main.locator('#open-floating-window').click();const web=await webOpened;await web.waitForLoadState();
 await web.locator('#nav-item-qualificacions').waitFor();assert.match(web.url(),/floating=1/);assert.match(web.url(),/view=qualificacions/);
 assert.equal(await web.getByRole('textbox',{name:/Comentari del grup/}).inputValue(),'Comentari des de finestra flotant');
 await web.getByRole('textbox',{name:/Comentari del grup/}).fill('Canvi compartit');
 await main.waitForFunction(()=>[...document.querySelectorAll('textarea')].some(t=>t.value==='Canvi compartit'));
 console.log('PASS: extension cold launch, native popup reuse, web popup and two-way shared saving.');
}catch(e){for(const p of context.pages())console.error(p.url(),await p.locator('body').innerText().catch(()=>''));throw e;}finally{await context.close();await new Promise(r=>server.close(r));await rm(profile,{recursive:true,force:true});}
